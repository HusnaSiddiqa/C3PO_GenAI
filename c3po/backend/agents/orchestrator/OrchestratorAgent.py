import os
import sys
import random
import json
from collections import defaultdict
from json import JSONDecodeError

import httpx
import asyncio
from uuid import uuid4
from collections.abc import AsyncIterator

from typing import Any

from httpx import HTTPStatusError
from langchain_core.output_parsers import PydanticOutputParser
from langgraph.graph import START, StateGraph, END
from opentelemetry.context import get_current
from opentelemetry.trace import get_current_span

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore
from core.model_provider.factory import ModelFactory
from core.util.ConfigLoader import load_env_variables, get_secret
from utils.s3 import read_s3_file
from utils.source_selector import get_source_context, override_sub_agent_mapping
from utils.llm_util import ainvoke_structured, invoke_text, ainvoke_text
from core.prompt.SystemPrompt import SystemPrompt
from a2a.types import AgentSkill, JSONRPCErrorResponse, TextPart, \
    SendStreamingMessageRequest, SendStreamingMessageResponse, SendStreamingMessageSuccessResponse
from a2a.client import A2AClient
from a2a.types import (
    MessageSendParams,
    AgentCard
)
from dataclasses import dataclass
from pydantic import BaseModel
from opentelemetry.propagate import inject
from langchain_core.messages import SystemMessage, HumanMessage
from traceloop_wrapper.metrics import record_response_time
from time import perf_counter

PUBLIC_AGENT_CARD_PATH = '.well-known/agent.json'


class _SafePartialFormat(dict):
    """Allows str.format_map() to leave unfilled placeholders as literal {key} text."""
    def __missing__(self, key):
        return f"{{{key}}}"

class OrchestratorResponse(BaseModel):
    summary: str
    raw_outputs: dict[str, str | None]


orchestrator_response_parser = PydanticOutputParser(pydantic_object=OrchestratorResponse)
orchestrator_response_example = OrchestratorResponse(summary="Example Summary",
                                                     raw_outputs={"Agent1": "Example Output"})


class OrchestratorDecisionResponse(BaseModel):
    agent_names: list[str]
    reason: str


orchestrator_decision_parser = PydanticOutputParser(pydantic_object=OrchestratorDecisionResponse)
orchestrator_decision_example = OrchestratorDecisionResponse(agent_names=["Agent1", "Agent2"],
                                                             reason="Selected agents have skills to resolve query")


class OrchestratorSubAgentDecisionResponse(BaseModel):
    sub_agent_mapping: dict[str, str]
    reason: str


orchestrator_sub_agent_decision_parser = PydanticOutputParser(pydantic_object=OrchestratorSubAgentDecisionResponse)
orchestrator_sub_agent_decision_example = OrchestratorSubAgentDecisionResponse(sub_agent_mapping={"NLQ": "SubAgent1"},
                                                                               reason="Selected agents have skills to resolve query")


class OrchestratorPayloadResolutionResponse(BaseModel):
    is_chat_history_required: bool
    reason: str


orchestrator_payload_parser = PydanticOutputParser(pydantic_object=OrchestratorPayloadResolutionResponse)
orchestrator_payload_example = OrchestratorPayloadResolutionResponse(is_chat_history_required=False,
                                                                     reason="Agent is self-sufficient")

@dataclass
class OrchestratorState:
    query: str
    conversation_id: str
    user_id: str
    metadata: dict[str, Any]
    current_agent: str = None
    last_agent: str = None
    is_chat_history_required: bool = False
    agent_names: list[str] = None
    sub_agent_mapping: dict[str, str] = None
    cards: dict[str, dict] = None
    agent_responses: dict = None
    error: str = None
    reason: str = None
    final_response: dict = None
    final_agent_responses: dict = None
    lt_history: list = None


class OrchestratorAgent(AgentBase[OrchestratorState]):
    @property
    def name(self) -> str:
        return "Orchestrator_Agent"

    @property
    def description(self) -> str:
        return "An orchestrator agent that classifies user queries and routes them to the most appropriate downstream agent(s) based on intent, supported skills, and context. Supports multi-agent delegation, fallback handling, and dynamic composition of agent pipelines."

    def _build_cached_prompt(self, system_text: str, dynamic_parts: dict) -> list:
        """Build [SystemMessage, HumanMessage] for LLM calls.

        When prompt caching is enabled (Bedrock), the SystemMessage content includes
        a cachePoint block so Bedrock can cache the static prefix.
        When disabled, falls back to plain string content — safe for any provider.
        """
        dynamic_content = "\n\n".join(
            f"[{k.upper()}]\n{v}" for k, v in dynamic_parts.items() if v
        )
        if self.enable_prompt_caching:
            system_content = [
                {"type": "text", "text": system_text},
                {"cachePoint": {"type": "default"}},
            ]
        else:
            system_content = system_text
        messages = [SystemMessage(content=system_content)]
        if dynamic_content:
            messages.append(HumanMessage(content=dynamic_content))
        return messages

    def __init__(self):
        req_env_keys = ['PROVIDER', 'MODEL', 'MODEL_BASE_URL', 'SECRET_NAME', 'DATABRICKS_SERVER_HOSTNAME',
                        'DATABRICKS_HTTP_PATH', 'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME']

        env = load_env_variables()

        missing_keys = [key for key in req_env_keys if key not in env]
        if missing_keys:
            raise KeyError(f"Missing required environment variable(s): {', '.join(missing_keys)}")
        
        self.override_agent_decision = [agent 
                                        for agent in env.get('OVERRIDE_AGENT_DECISION', '').split(',')
                                        if agent]

        model = env['MODEL']
        model_base_url = env['MODEL_BASE_URL']
        provider = env['PROVIDER']
        secret_name = env['SECRET_NAME']
        model_api_key = get_secret(secret_name)
        self.memory_store = MemoryStore(bucket_name=env['WORKSPACE_BUCKET_NAME'],
                                        prefix="agent_memory")
        skill = AgentSkill(
            id="orchestrator",
            name="Orchestrator Agent",
            description="Analyzes user queries and selects the best-suited specialized agent(s) for resolution. Supports classification, routing, and coordination across agents.",
            tags=["orchestrator"]
        )
        self.llm_provider = ModelFactory.create_provider(provider=provider, model_name=model,
                                                    base_url=model_base_url,
                                                    api_key=model_api_key)

        self.system_prompts = SystemPrompt(env['WORKSPACE_BUCKET_NAME'], "system_prompts")
        self.agent_skills = {}
        self.enable_prompt_caching = env.get('ENABLE_PROMPT_CACHING', 'false').lower() == 'true'

        llm = self.llm_provider.get_llm()
        super().__init__(llm, skill)
        self.initialize_graph()

    async def _load_agent_skills(self) -> dict:
        skills = {}
        agent_registry = json.loads(
            await asyncio.to_thread(self.system_prompts.get_system_prompt, "agent_registry.json")
        )
        self.agent_registry = agent_registry
        discovery_urls = [
            f'{details["full_url"]}/{PUBLIC_AGENT_CARD_PATH}'
            for details in agent_registry.values()
        ]

        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(connect=10, read=30, write=10, pool=5),
        ) as client:
            for well_known_url in discovery_urls:
                try:
                    response = await client.get(well_known_url)
                    response.raise_for_status()
                    metadata = response.json()

                    agent_card = AgentCard.model_validate(metadata)
                    agent_name = agent_card.name

                    if agent_name:
                        skills[agent_name] = {
                            "description": agent_card.description,
                            "skills": agent_card.skills,
                            "card": agent_card.model_dump(),
                        }

                except Exception as e:
                    print(f"[SupervisorAgent] Failed to load agent from {well_known_url}: {e}")

        skills["General Response Agent"] = {
            "description": "Handles user queries that do not require structured data processing or specialized agent capabilities. Use for general-purpose questions, chit-chat, application-level inquiries, and informational queries about available datasets, data sources, or system functionality. Not intended for follow-up interpretation or dynamic query generation.",
            "skills": [],
            "card": "No Card Available",
        }

        return skills

    @staticmethod
    async def call_agent(card, payload):
        async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(1000)) as httpx_client:
            client = A2AClient(
                httpx_client=httpx_client, agent_card=card
            )

            print('A2AClient initialized.')

            request = SendStreamingMessageRequest(
                id=payload.get("message").get("messageId"), params=MessageSendParams(**payload)
            )
            headers = {
                "user_id": payload.get("metadata").get("user_id", "unknown_user"),
                "conversation_id": payload.get("metadata").get("conversation_id", "unknown_user")
            }

            inject(headers, context=get_current())
            span = get_current_span()
            print("[Orchestrator] Before calling NLQ")
            print("Trace ID:", span.get_span_context().trace_id)
            print("Span ID:", span.get_span_context().span_id)
            stream_response = client.send_message_streaming(request, http_kwargs={"timeout": 1000, "headers": headers})
            async for chunk in stream_response:
                yield chunk

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("Streaming Orchestrator agent...", metadata)
        start = perf_counter()
        if "user_id" not in metadata or "conversation_id" not in metadata:
            raise ValueError("Missing required metadata keys: 'user_id' and/or 'conversation_id'")
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        lt_history = self.memory_store.search(user_name=user_id, agent_name="Orchestrator",
                                              conversation_id=conversation_id,
                                              last_n=10)

        state = OrchestratorState(
            query=query,
            conversation_id=conversation_id,
            metadata=metadata,
            user_id=user_id,
            lt_history=lt_history,
            final_agent_responses={}
        )
        async for output in self._agent.astream(state):
            print('===========output=======', output)
            if "decision" in output and not output["decision"]["error"]:
                yield {
                    "is_task_complete": False,
                    "require_user_input": False,
                    "content": f"Based on your query, the orchestrator has routed the request to: {output['decision']['agent_names']}.\nExplanation: {output['decision']['reason']}",
                }
            elif "sub_agent_decision" in output and not output["sub_agent_decision"]["error"]:
                if len(output['sub_agent_decision']["sub_agent_mapping"]) > 0:
                    mapping_text = "\n".join(
                        f"- For agent type **{agent_type}**, sub-agent **{sub_agent}** was chosen."
                        for agent_type, sub_agent in output['sub_agent_decision']["sub_agent_mapping"].items()
                    )
                    mapping_text += f"Reason: {output['sub_agent_decision']['reason']}"
                else:
                    mapping_text = "No Sub-Agents were found for the selected Agent Types."
                state.sub_agent_mapping = output['sub_agent_decision']["sub_agent_mapping"]
                yield {
                    "is_task_complete": False,
                    "require_user_input": False,
                    "content": mapping_text,
                }
            elif "determine_payload" in output and not output["determine_payload"]["error"]:
                if output["determine_payload"]["is_chat_history_required"]:
                    yield {
                        "is_task_complete": False,
                        "require_user_input": False,
                        "content": "The response above will now be utilized by the agent to carry out the action specified in your request.",
                    }
            elif "api_call" in output and not output["api_call"]["error"]:
                final_agent_responses = output['api_call'].get("final_agent_responses", {})
                agent_responses = output['api_call'].get('agent_responses', {})
                if agent_responses:
                    last_agent = ""
                    agent_call_count = 0
                    for current_agent, response in agent_responses.items():
                        agent_metadata = response['metadata']
                        if current_agent in state.sub_agent_mapping:
                            agent_metadata["sub-agent"] = state.sub_agent_mapping[current_agent]
                        card = AgentCard.model_validate(response['card'])
                        last_agent_response = None
                        if last_agent and last_agent in final_agent_responses:
                            last_agent_response = final_agent_responses[last_agent]
                        parts = [
                            {'kind': 'text',
                             'text': output["api_call"]["query"]},
                        ]
                        if last_agent_response is not None:
                            parts.append({'kind': 'text',
                             'text': f"\n--last_agent_response--{last_agent_response}"})
                        message = {
                            'role': 'user',
                            'parts': parts,
                            'messageId': conversation_id,
                        }
                        payload = {
                            "message": message,
                            "metadata": agent_metadata,
                        }

                        last_agent = current_agent
                        sub_agent = agent_metadata.get("sub-agent") if agent_metadata.get(
                            "sub-agent") is not None else current_agent
                        yield {
                            "is_task_complete": False,
                            "require_user_input": False,
                            "content": f"{sub_agent} is now working on your request...",
                        }

                        agent_response = self.call_agent(card, payload)
                        agent_call_count += 1
                        async for chunk in agent_response:
                            chunk_root: SendStreamingMessageResponse = chunk.root

                            if isinstance(chunk_root, SendStreamingMessageSuccessResponse):
                                result = chunk_root.result
                                if (
                                        hasattr(result, "kind")
                                        and result.kind == "status-update"
                                        and not getattr(result, "final", False)
                                        and hasattr(result.status, "message")
                                        and result.status.message is not None
                                ):
                                    try:
                                        part = result.status.message.parts[0]
                                        if (
                                                hasattr(part, "root")
                                                and isinstance(part.root, TextPart)
                                                and hasattr(part.root, "text")
                                        ):
                                            yield {
                                                "is_task_complete": False,
                                                "require_user_input": False,
                                                "content": part.root.text,
                                            }
                                    except (AttributeError, IndexError):
                                        print('Attribute/Index Error')
                                        continue

                                elif hasattr(result, "kind") and result.kind == "artifact-update":
                                    try:
                                        part = result.artifact.parts[0]
                                        if (
                                                hasattr(part, "root")
                                                and isinstance(part.root, TextPart)
                                                and hasattr(part.root, "text")
                                        ):
                                            result = part.root.text
                                            state.final_agent_responses[current_agent] = result
                                            print('============result===========', result)
                                        if agent_call_count < len(agent_responses):
                                            parsed_result = json.loads(result.replace('\n', '\\n'))
                                            yield {
                                                "is_task_complete": False,
                                                "require_user_input": False,
                                                "kind": "artifact-update",
                                                "content": json.dumps({
                                                    "summary": parsed_result.get("data_analysis", ""),
                                                    "raw_outputs": {
                                                        current_agent: parsed_result
                                                    },
                                                }),
                                            }
                                    except JSONDecodeError:
                                        state.final_agent_responses[current_agent] = result
                                    except (AttributeError, IndexError):
                                        print('Attribute/Index Error')
                                        continue
                            elif isinstance(chunk_root, JSONRPCErrorResponse):
                                raise Exception(chunk_root.error)
                elif len(final_agent_responses) > 0:
                    continue
                else:
                    raise Exception("Agent responses not populated!")
            elif "summarize" in output and not output["summarize"]["error"]:
                summarize = output['summarize']
                final_response = summarize.get('final_response', {})
                summary = final_response.get('summary', '')
                conversation = {'human': query, 'ai': json.dumps(final_response)}
                self.memory_store.save(messages=self.serialize_messages(conversation),
                                       user_name=user_id, agent_name="Orchestrator", conversation_id=conversation_id)
                record_response_time((perf_counter() - start) * 1000)
                raw_outputs = final_response.get('raw_outputs', {})
                agent_responses = summarize.get('agent_responses', {})
                last_agent = list(agent_responses.keys())[-1] if agent_responses else None
                yield {
                    "is_task_complete": True,
                    "require_user_input": False,
                    "content": json.dumps({
                        'summary': summary,
                        'raw_outputs': {
                            last_agent: raw_outputs.get(last_agent, {})
                        } if last_agent else raw_outputs
                    }),
                }
                break

            elif output[next(iter(output))]['error']:
                raise Exception(output[next(iter(output))]['error'])
            else:
                pass

    @staticmethod
    def serialize_messages(messages):
        return [{"role": role, "content": msg} for role, msg in messages.items()]

    def _build_graph(self):
        graph = StateGraph(OrchestratorState)


        def initialize_state_using_agent_cards(state: OrchestratorState, agent_names, agent_skills: dict):
            available_agents_cards = {k: v["card"] for k, v in agent_skills.items() if k in agent_names}
            available_agent_names = available_agents_cards.keys()
            if not len(available_agent_names) > 0:
                state.error = f"Unknown agents selected: {[k for k in agent_names if k not in available_agent_names]}"
            else:
                state.agent_names = list(available_agent_names)
                state.cards = dict(available_agents_cards)


        async def override_decision_node(state: OrchestratorState):
            agent_skills = await self._load_agent_skills()
            agent_names = self.override_agent_decision
            initialize_state_using_agent_cards(state, agent_names, agent_skills)
            return state

        async def decision_node(state: OrchestratorState):
            agent_skills = await self._load_agent_skills()

            agent_options = "\n".join(
                f"- {name}:\n"
                f"  Description: {meta['description']}\n"
                f"  Skills:\n" +
                "\n".join(
                    f"    • {skill.name} - {skill.description}" +
                    (f" [Tags: {', '.join(skill.tags)}]" if skill.tags else "")
                    for skill in meta['skills']
                )
                for name, meta in agent_skills.items()
            )
            orchestrator_decision_prompt: str = self.system_prompts.get_system_prompt("orchestrator_decision_prompt.txt")
            query = state.query
            if state.metadata.get("document_s3_path"):
                query = query + "\n(A document has been uploaded that should be used to answer the query above)"
            source_context = get_source_context(state.metadata)
            if source_context:
                query = query + "\n" + source_context
            system_text = orchestrator_decision_prompt.format_map(_SafePartialFormat(
                general_instructions=state.metadata["general_instructions"],
                agents=agent_options,
                format_instructions=orchestrator_decision_parser.get_format_instructions(),
                example_response=orchestrator_decision_example.model_dump_json(),
            ))
            supervisor_prompt = self._build_cached_prompt(system_text, {
                "query": query,
                "chat_history": str(state.lt_history),
            })
            decision_attempt = 1
            max_attempts = 3
            delay = 0.5
            jitter_ratio = 0.3
            max_interval = 60.0
            backoff_factor = 2.0
            while True:
                try:
                    result = await ainvoke_structured(
                        self.llm,
                        OrchestratorDecisionResponse,
                        supervisor_prompt,
                    )
                    agent_names = result.agent_names
                    reason = result.reason
                    state.reason = reason
                    initialize_state_using_agent_cards(state, agent_names, agent_skills)
                    break

                except Exception as e:
                    if decision_attempt >= max_attempts:
                        print(f"Decision node error: {e}")
                        state.error = f"Decision failed: {str(e)}"
                        break
                    sleep_for = min(delay, max_interval)
                    jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                    sleep_time = max(0.0, sleep_for + jitter)
                    print(f"[Backoff] attempt {decision_attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                    await asyncio.sleep(sleep_time)
                    delay = min(delay * backoff_factor, max_interval)
                    decision_attempt += 1

            return state

        async def fetch_sub_agents(api_base_url: str):
            url = f"{api_base_url}/v2/admin/settings/prompt-template/sub-agents"
            async with httpx.AsyncClient(timeout=httpx.Timeout(1000)) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                return data

        async def sub_agent_decision_node(state: OrchestratorState):
            agent_types = state.agent_names

            # Skip LLM call if user already selected a source
            feature_flag = os.getenv("VITE_ENABLE_SOURCE_SELECTOR", "false")
            selected_source = state.metadata.get("selected_source")
            if feature_flag.lower() == "true" and selected_source:
                try:
                    bucket = os.getenv("WORKSPACE_BUCKET_NAME", "")
                    key = os.getenv("SUB_AGENT_MAPPING", "")
                    source_mapping = read_s3_file(bucket=bucket, key=key)
                    entry = source_mapping.get("sub_agents", {}).get(selected_source)
                    if entry and entry["agent_type"] in agent_types:
                        state.sub_agent_mapping = {entry["agent_type"]: entry["sub_agent"]}
                        state.reason = f"Sub-agent selected from user source: {selected_source}"
                        print(f"[Orchestrator] Skipping LLM sub-agent decision, using source '{selected_source}' → {entry['sub_agent']}")
                        return state
                except Exception as e:
                    print(f"[Orchestrator] Source-based skip failed: {e}, falling back to LLM decision")

            api_base_url = os.getenv("VITE_ADMIN_SECRET", "http://localhost:8000")
            try:
                sub_agents_response = await fetch_sub_agents(api_base_url)
            except Exception as e:
                state.sub_agent_mapping = {}
                return state
            matching_sub_agents = [
                sa for sa in sub_agents_response["sub_agents"] if sa["agent_type"] in agent_types
            ]
            sub_agent_options = "\n".join(
                f"- {sub_agent['name']}:\n"
                f"  Description: {sub_agent.get('description', '')}\n"
                f"  Relates To: {sub_agent.get('relates_to', [])}\n"
                for sub_agent in matching_sub_agents
            ) 
            orchestrator_sub_agent_decision_prompt = self.system_prompts.get_system_prompt(
                "orchestrator_sub_agent_decision_prompt.txt")
            query = state.query
            system_text = orchestrator_sub_agent_decision_prompt.format_map(_SafePartialFormat(
                agent_types=agent_types,
                general_instructions=state.metadata["general_instructions"],
                sub_agents=sub_agent_options,
                format_instructions=orchestrator_sub_agent_decision_parser.get_format_instructions(),
                example_response=orchestrator_sub_agent_decision_example.model_dump_json(),
            ))
            supervisor_prompt = self._build_cached_prompt(system_text, {
                "query": query,
                "chat_history": str(state.lt_history),
            })
            decision_attempt = 1
            max_attempts = 3
            delay = 0.5
            jitter_ratio = 0.3
            max_interval = 60.0
            backoff_factor = 2.0
            while True:
                try:
                    result = await ainvoke_structured(
                        self.llm,
                        OrchestratorSubAgentDecisionResponse,
                        supervisor_prompt,
                    )
                    sub_agent_mapping = {
                        k: v for k, v in result.sub_agent_mapping.items()
                        if v != "" and v != k
                    }
                    reason = result.reason
                    state.reason = reason

                    state.sub_agent_mapping = sub_agent_mapping
                    break

                except Exception as e:
                    if decision_attempt >= max_attempts:
                        print(f"Decision node error: {e}")
                        state.error = f"Decision failed: {str(e)}"
                        break
                    sleep_for = min(delay, max_interval)
                    jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                    sleep_time = max(0.0, sleep_for + jitter)
                    print(f"[Backoff] attempt {decision_attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                    await asyncio.sleep(sleep_time)
                    delay = min(delay * backoff_factor, max_interval)
                    decision_attempt += 1

            # Override sub-agent for the matching agent_type if user selected a source
            state.sub_agent_mapping = override_sub_agent_mapping(
                state.metadata, state.agent_names, state.sub_agent_mapping
            )

            return state

        async def api_call_node(state: OrchestratorState):
            agent_names = state.agent_names
            if not state.agent_names:
                state.error = "No agents selected for API call."
                return state
            for agent_name in agent_names:

                if agent_name == "General Response Agent":
                    try:
                        if "onboarding" not in state.metadata or "general_instructions" not in state.metadata:
                            raise Exception(f"Missing metadata field: onboarding")
                        general_agent_prompt = self.system_prompts.get_system_prompt(
                            "general_agent_prompt.txt")
                        system_text = general_agent_prompt.format_map(_SafePartialFormat(
                            onboarding=state.metadata["onboarding"],
                            general_instructions=state.metadata['general_instructions'],
                        ))
                        general_prompt = self._build_cached_prompt(system_text, {
                            "user_query": state.query,
                        })
                        response_content = await ainvoke_text(self.llm, general_prompt)
                        state.final_agent_responses = {"General Response Agent": response_content}
                        return state

                    except Exception as e:
                        state.error = f"General agent failed: {str(e)}"
                        return state

                card = state.cards[agent_name]
                if not card.get("url"):
                    state.error = "No API URL provided for API-based agent"
                    return state

                missing = set(self.agent_registry[agent_name]["metadata_fields"]) - state.metadata.keys()
                if missing:
                    raise Exception(f"Missing metadata fields: {', '.join(missing)}")
                metadata = {k: state.metadata[k] for k in self.agent_registry[agent_name]["metadata_fields"]}
                metadata["thinking_enabled"] = state.metadata.get("thinking_enabled", False)

                if state.agent_responses:
                    state.agent_responses.update({agent_name: {"metadata": metadata, "card": card}})
                else:
                    state.agent_responses = {agent_name: {"metadata": metadata, "card": card}}
                state.query = state.query

            return state

        async def handle_no_agent_node(state: OrchestratorState):
            state.final_agent_responses = {"no_agent": {"response": {
                "message": "No suitable agent found for this query.",
                "reason": state.reason,
                "suggestions": "Please rephrase your query or contact support for assistance."
            }}}
            return state

        async def determine_input_payload_node(state: OrchestratorState):
            orchestrator_payload_resolution_prompt = self.system_prompts.get_system_prompt(
                "orchestrator_payload_resolution_prompt.txt")

            agent_skills = await self._load_agent_skills()
            agent_options = "\n".join(
                f"- {name}:\n"
                f"  Description: {meta['description']}\n"
                f"  Skills:\n" +
                "\n".join(
                    f"    • {skill.name} - {skill.description}" +
                    (f" [Tags: {', '.join(skill.tags)}]" if skill.tags else "")
                    for skill in meta['skills']
                )
                for name, meta in agent_skills.items()
            )
            system_text = orchestrator_payload_resolution_prompt.format_map(_SafePartialFormat(
                agents_selected=state.agent_names,
                agents_info=agent_options,
                format_instructions=orchestrator_payload_parser.get_format_instructions(),
                example_response=orchestrator_payload_example.model_dump_json(),
            ))
            payload_resolution_prompt = self._build_cached_prompt(system_text, {
                "user_query": state.query,
                "chat_history": str(state.lt_history),
            })
            payload_determination_attempt = 1
            max_attempts = 3
            delay = 0.5
            jitter_ratio = 0.3
            max_interval = 60.0
            backoff_factor = 2.0
            while True:
                try:
                    result = await ainvoke_structured(
                        self.llm,
                        OrchestratorPayloadResolutionResponse,
                        payload_resolution_prompt,
                    )
                    is_chat_history_required = result.is_chat_history_required
                    state.reason = result.reason
                    if is_chat_history_required and not (len(state.agent_names) > 1):
                        state.query = state.query + f"\n--last_agent_response--{state.lt_history}"
                    state.is_chat_history_required = is_chat_history_required
                    break
                except Exception as e:
                    if payload_determination_attempt >= max_attempts:
                        print(f"Payload determination error: {e}")
                        state.error = f"Payload determination failed: {str(e)}"
                        break
                    sleep_for = min(delay, max_interval)
                    jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                    sleep_time = max(0.0, sleep_for + jitter)
                    print(
                        f"[Backoff] attempt {payload_determination_attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                    await asyncio.sleep(sleep_time)
                    delay = min(delay * backoff_factor, max_interval)
                    payload_determination_attempt += 1
            return state

        class AsyncRateLimiter:
            def __init__(self, max_concurrency: int = 4):
                self.sem = asyncio.Semaphore(max_concurrency)

            async def run(self, coro, *, timeout: float | None = 45):
                async with self.sem:
                    return await asyncio.wait_for(coro, timeout=timeout)

        async def with_backoff(coro_factory, retries: int = 3, base: float = 0.6, jitter: float = 0.2):
            for i in range(retries):
                try:
                    return await coro_factory()
                except Exception as e:
                    if i == retries - 1:
                        raise
                    delay = base * (2 ** i)
                    delay += random.uniform(-jitter, jitter)
                    print(f"[Backoff] Retry {i + 1}/{retries} after error: {e}. Sleeping {delay:.2f}s")
                    await asyncio.sleep(delay)

        def format_last_k_turns(history: list[dict], k: int = 10) -> str:
            lines = []
            for m in history[-k:]:
                role = m.get("role") or "User"
                content = m.get("content") or ""
                lines.append(f"{role}: {content}")
            return "\n".join(lines) if lines else "No recent history."

        async def summarize_node(state: OrchestratorState):
            thinking_enabled = state.metadata.get("thinking_enabled", False)
            print(f"[summarize_node] thinking_enabled={thinking_enabled!r} "
                  f"final_agent_responses keys={list(state.final_agent_responses.keys())}")
            if not thinking_enabled:
                state.final_response = dict(
                    OrchestratorResponse(summary="", raw_outputs=state.final_agent_responses)
                )
                return state

            limiter = AsyncRateLimiter(max_concurrency=3)

            agent_outputs = state.final_agent_responses

            chat_map_prompt_template = self.system_prompts.get_system_prompt(
                "chat_map_prompt_template.txt")
            last_k_text = format_last_k_turns(state.lt_history, k=10)
            chat_task = limiter.run(
                with_backoff(lambda: ainvoke_text(self.llm, chat_map_prompt_template.format(last_k_turns_text=last_k_text))))

            agent_tasks = []
            agent_names = []

            agent_map_prompt_template = self.system_prompts.get_system_prompt(
                "agent_map_prompt_template.txt")

            for name, out in agent_outputs.items():
                agent_names.append(name)
                agent_tasks.append(
                    limiter.run(with_backoff(lambda n=name, o=out: ainvoke_text(self.llm, agent_map_prompt_template.format(
                        agent_name=n,
                        user_query=state.query,
                        output_str=str(o)
                    )))))

            try:
                chat_summary, agent_maps = await asyncio.gather(
                    chat_task, asyncio.gather(*agent_tasks) if agent_tasks else asyncio.sleep(0, result=[])
                )

                agent_summaries = {n: s for n, s in zip(agent_names, agent_maps)}
                chat_summary_text = chat_summary

                orchestrator_summarization_prompt = self.system_prompts.get_system_prompt(
                    "orchestrator_summarization_prompt.txt")
                summarizer_prompt = orchestrator_summarization_prompt.format(
                    user_query=state.query,
                    chat_summary=chat_summary_text,
                    agent_notes=str(agent_summaries)
                )

                final_text = await ainvoke_text(self.llm, summarizer_prompt)
                state.final_response = dict(
                    OrchestratorResponse(summary=final_text, raw_outputs=dict(state.final_agent_responses)))

                return state

            except Exception as e:
                print(f"Summarizer node error: {e}")
                state.error = f"Summarizer failed: {str(e)}"
                return state

        graph.add_node("decision", decision_node)
        graph.add_node("override_decision_node", override_decision_node)
        graph.add_node("sub_agent_decision", sub_agent_decision_node)
        graph.add_node("determine_payload", determine_input_payload_node)
        graph.add_node("api_call", api_call_node)
        graph.add_node("no_agent", handle_no_agent_node)
        graph.add_node("summarize", summarize_node)

        def choose_decision_node(state: OrchestratorState):
            print("Choosing decision node...")
            if self.override_agent_decision:
                print("Overriding agent decision...", self.override_agent_decision)
                return "override"
            return "default"

        graph.add_conditional_edges(
            START,
            choose_decision_node,
            {
                "override": "override_decision_node",
                "default": "decision",
            }
        )

        # Conditional routing based on decision
        def route_after_decision(state: OrchestratorState):
            if state.error:
                return END
            elif state.agent_names and len(state.agent_names) > 0:
                return "determine_payload"
            else:
                return "no_agent"

        graph.add_conditional_edges(
            "decision",
            route_after_decision,
            {
                "determine_payload": "sub_agent_decision",
                "no_agent": "no_agent",
                END: END
            }
        )
        graph.add_conditional_edges(
            "override_decision_node",
            route_after_decision,
            {
                "determine_payload": "sub_agent_decision",
                "no_agent": "no_agent",
                END: END
            }
        )
        graph.add_edge("sub_agent_decision", "determine_payload")
        graph.add_edge("determine_payload", "api_call")
        graph.add_edge("api_call", "summarize")
        graph.add_edge("no_agent", "summarize")
        graph.add_edge("summarize", END)
        return graph.compile()


if __name__ == "__main__":
    agent = OrchestratorAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}',
                     path="/v2/agents/orchestrator", dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"),
                     dynatrace_auth_token=dynatrace_auth_token)
