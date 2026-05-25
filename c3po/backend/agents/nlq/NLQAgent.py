import asyncio
import csv
import io
import os
import re
import sys
import json
import time, random
from json import JSONDecodeError
from typing import Annotated, List, Dict, Optional, Any, TypedDict

import httpx
from langchain_core.output_parsers import PydanticOutputParser
from langgraph.errors import GraphRecursionError
from langgraph.types import RetryPolicy

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from utils.databricks_sql import (
    wrap_query_with_count,
    wrap_query_with_insert,
    wrap_query_with_limit,
)
from agents.nlq.nlq_query_templates import SAVE_LARGE_CSV_TO_S3

from collections.abc import AsyncIterator
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from core.model_provider.factory import ModelFactory
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from core.prompt.SystemPrompt import SystemPrompt
from core.prompt.PromptStore import PromptStore
from core.util.ConfigLoader import load_env_variables, get_secret
from langgraph.checkpoint.memory import MemorySaver
from core.util.DataWareHouse import DataWarehouse

from agents.nlq.Tools import build_generate_sql_tool, build_json_parse_tool, execute_sql, normalize_tvf_user_args
from a2a.types import AgentSkill
from pydantic import BaseModel
from dataclasses import asdict, dataclass

from traceloop_wrapper.metrics import record_response_time
from time import perf_counter
from utils.s3 import upload_to_s3, get_next_nlq_csv_key
from utils.llm_util import ainvoke_structured, ainvoke_text


class PromptTemplateDetails(BaseModel):
    provider: str
    model: str
    model_base_url: str
    prompt_template: str
    temperature: float


class NLQRevisionResponse(BaseModel):
    query: str
    selected_data_sources: list[str]
    business_rules: list[str]
    schema_tables: list[str]
    example_queries: list[dict[str, str]]


nlq_revision_parser = PydanticOutputParser(pydantic_object=NLQRevisionResponse)
nlq_revision_example = NLQRevisionResponse(query="How many records are in the table?",
                                           selected_data_sources=["Datasource1"],
                                           business_rules=["Example Business Rules"],
                                           schema_tables=["Schema.Table1"],
                                           example_queries=[{"Q1": "SELECT count(1) from Schema.Table1;"}])


class NLQIntentResponse(BaseModel):
    is_user_input_required: bool
    reason: str


nlq_intent_parser = PydanticOutputParser(pydantic_object=NLQIntentResponse)
nlq_intent_example = NLQIntentResponse(is_user_input_required=False, reason="Query is complete.")


class NLQFinalResponse(BaseModel):
    data_analysis: str
    sql_query: str


nlq_final_parser = PydanticOutputParser(pydantic_object=NLQFinalResponse)
nlq_final_example = NLQFinalResponse(
    data_analysis="Example Analysis",
    sql_query="SELECT count(*) FROM Schema.Table1")

common_model = os.environ.get("MODEL", None)
latency_optimized_model_enabled = os.getenv("ENABLE_LATENCY_OPTIMIZED_INFERENCE", "false").lower()
nlq_max_tokens = int(os.getenv("NLQ_MAX_TOKENS", "1000"))

@dataclass
class NLQState:
    messages: list[Any]
    metadata: dict[str, Any]
    data_limit_exceeded: bool
    final_message: dict[str, Any]
    prompt_template_details: PromptTemplateDetails
    user_email: str
    lt_history: list = None
    thinking_enabled: bool = False
    revision_output: str = None   # NLQRevisionResponse JSON from revise_query_node
    agent_output: str = None      # NLQFinalResponse JSON from main_agent_node


class MainAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    user_email: str
    remaining_steps: int
    step: int
    structured_response: Optional[NLQFinalResponse]


class NLQAgent(AgentBase[NLQState]):

    @property
    def name(self) -> str:
        return "NLQ_Agent"

    @property
    def description(self) -> str:
        return "An intelligent agent that processes oncology-focused natural language queries, applies domain-specific business rules, generates compliant SQL, and executes it against a Databricks SQL warehouse to return structured results. This agent is self-sufficient and does not rely on prior outputs or chat history to fulfill user queries."

    def __init__(self):
        req_env_keys = ['PROVIDER', 'SECRET_NAME', 'DATABRICKS_SERVER_HOSTNAME', 'DATABRICKS_HOST',
                        'DATABRICKS_HTTP_PATH', 'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME', 'AGENT_BASE_URL',
                        'AGENT_BASE_PORT']

        self.env: dict[str, Any] = load_env_variables()

        missing_keys = [key for key in req_env_keys if key not in self.env]
        if missing_keys:
            raise KeyError(f"Missing required environment variable(s): {', '.join(missing_keys)}")

        secret_name = self.env['SECRET_NAME']
        self.json_limit = int(self.env.get('NLQ_JSON_LIMIT', 100))
        self.enable_prompt_caching = self.env.get('ENABLE_PROMPT_CACHING', 'false').lower() == 'true'
        self.model_api_key = get_secret(secret_name)

        self.system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")

        self.tools = [build_generate_sql_tool(), build_json_parse_tool()]
        self.lt_history = None
        # self.memory = None
        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'],
                                        prefix="agent_memory")

        skill = AgentSkill(
            id='convert_to_sql',
            name='NLQ_Agent',
            description="Handles structured data queries expressed in natural language by generating and executing SQL over oncology datasets. Leverages schema metadata, business logic, and conversation context to produce accurate, compliant outputs. This agent is self-sufficient and does not rely on prior outputs or chat history to fulfill user queries.",
            tags=['NLQ', 'general_instructions', 'common_business_rules', 'data_handling_rules', 'fields']
        )
        self.initialize_graph()
        super().__init__(llm=self.get_llm(prompt_template_details=self.fetch_sub_agent_prompt_template_details()), agent_skill=skill)

    def get_llm(self, prompt_template_details: PromptTemplateDetails):
        model = prompt_template_details.model
        provider = prompt_template_details.provider
        model_base_url = prompt_template_details.model_base_url
        temperature = prompt_template_details.temperature

        print('===========reassigning model========', model)
        timeout = 1000
        return ModelFactory.create_provider(provider=provider, model_name=model,
                                                base_url=model_base_url,
                                                api_key=self.model_api_key,
                                                temperature=temperature,
                                                timeout=timeout).get_llm()


    def fetch_sub_agent_prompt_template_details(self, agent_name: str = 'NLQ'):
        prompt_template = PromptStore(agent_name, f"{self.env['WORKSPACE_NAME']}/agents").load_prompt()
        provider = self.env['PROVIDER']
        model = prompt_template.get("model", "")
        model_base_url = prompt_template.get("model_base_url", "")
        temperature = prompt_template.get("temperature", "0")
        
        try:
            temperature = float(temperature)
        except (ValueError, TypeError):
            temperature = 0
        
        admin_prompt_template = prompt_template.get("prompt", "")
        
        return PromptTemplateDetails(
            prompt_template=admin_prompt_template,
            provider=provider,
            model=model,
            model_base_url=model_base_url,
            temperature=temperature,
        )


    def filter_fields_by_selected_tables(self,
                                         all_fields: List[str],
                                         selected_tables: List[str]
                                         ) -> List[str]:

        def normalize_table_name(table_str: str) -> str:
            cleaned = re.sub(r"`", "", table_str.strip().lower())
            parts = cleaned.split(".")
            return parts[-1] if parts else ""

        selected_table_names = {
            normalize_table_name(tbl) for tbl in selected_tables
        }

        filtered_fields = [
            field for field in all_fields
            if field and field.split(".")[0].strip().lower() in selected_table_names
        ]

        return filtered_fields

    def _build_prompt(self, template: str, static_vars: dict, dynamic_vars: dict, use_cache: bool, as_callable: bool = False):
        """Build agent prompt using LangChain middleware pattern.

        Without cache: single formatted string (system prompt).
        With cache + as_callable=True: returns a callable middleware for create_react_agent's
          prompt parameter — invoked per-request with the graph state so it can prepend a
          cached SystemMessage ahead of the live conversation messages.
        With cache + as_callable=False: returns a messages list for direct ainvoke calls
          (e.g. ainvoke_structured).

        Static vars: large unchanging content (instructions, rules, schema) — cached block.
        Dynamic vars: per-request content (chat_history, user_email) — excluded from cache.
        """
        if not use_cache:
            return template.format(**static_vars, **dynamic_vars)

        system_text = template.format(**static_vars, **{k: "" for k in dynamic_vars})
        dynamic_content = "\n\n".join(
            f"[{k.upper()}]\n{v}" for k, v in dynamic_vars.items() if v
        )
        content_blocks: list = [
            {"type": "text", "text": system_text},
            {"cachePoint": {"type": "default"}},
        ]
        if dynamic_content:
            # Append after cachePoint so it is sent each request but not cached,
            # avoiding consecutive HumanMessages that Bedrock Converse rejects.
            content_blocks.append({"type": "text", "text": dynamic_content})
        prefix = [SystemMessage(content=content_blocks)]

        if as_callable:
            def prompt_middleware(state):
                """LangChain message middleware: prepends cached system block to conversation."""
                messages = state.get("messages", [])
                return prefix + list(messages)
            return prompt_middleware

        # Bedrock Converse requires at least one user message after the system block is
        # extracted. Use the user_message from dynamic_vars (present in the completeness
        # node) so the conversation structure is valid.
        user_msg = dynamic_vars.get("user_message") or "Process the above query."
        return prefix + [HumanMessage(content=user_msg)]

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("Streaming NLQ agent...")
        # self.memory = MemorySaver()
        start = perf_counter()
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        lt_history = self.memory_store.search(user_name=user_id, agent_name="NLQ", conversation_id=conversation_id,
                                              last_n=10)
        sub_agent = metadata.get("sub-agent", "NLQ")
        print('===========sub_agent========', sub_agent)
        try:
            prompt_template_details = self.fetch_sub_agent_prompt_template_details(sub_agent)
        except Exception as e:
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": f"Error fetching prompt template details: {e}",
            }
        try:
            self.get_llm(prompt_template_details)
        except Exception as e:
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": f"Error getting llm: {e}",
            }
        state = NLQState(
            messages=[HumanMessage(query)],
            metadata=metadata,
            data_limit_exceeded=False,
            lt_history=lt_history,
            final_message={},
            user_email=user_id,
            prompt_template_details=prompt_template_details,
            thinking_enabled=metadata.get("thinking_enabled", False),
        )
        config = {'configurable': {'thread_id': thread_id}, "max_concurrency": int(self.env.get('LANGGRAPH_MAX_CONCURRENCY', 2))}
        agent_or_graph = self._agent

        try:
            async for output in agent_or_graph.astream(state, config):
                print('===========output=======', output)
                messages = output[next(iter(output))]['messages']

                if "revise_query" in output:
                    try:
                        message = json.loads(output["revise_query"]["revision_output"])
                        yield {
                            "is_task_complete": False,
                            "require_user_input": False,
                            "content": f"""A context-aware revision of your query has been produced:\nRephrased Query: {message.get("query")}\nSelected Data Sources: {message.get("selected_data_sources")}\nBusiness Rules: {message.get("business_rules")}\nTables Selected: {message.get("schema_tables")}\nExample Queries: {message.get("example_queries")}""",
                        }
                    except JSONDecodeError:
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": messages,
                        }

                elif "identify_completeness" in output:
                    message = {}
                    if type(messages[-1]) is AIMessage:
                        message = json.loads(messages[-1].content.strip())
                    elif type(messages[-1]) is HumanMessage:
                        pass
                    else:
                        raise Exception("Incorrect query completeness identification response!")
                    if "is_user_input_required" in message and message.get("is_user_input_required"):
                        new_state = output[next(iter(output))]
                        self.memory_store.save(messages=self.serialize_messages(new_state.get('messages', [])),
                                               user_name=user_id, agent_name="NLQ", conversation_id=conversation_id)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": f"""Your query seems incomplete and cannot be processed yet. Reason: {message.get("reason")}.\nCould you please clarify or provide the missing information?""",
                        }
                        break
                elif "main_agent" in output:
                    pass
                elif "fetch_json" in output:
                    node_state = output["fetch_json"]
                    final_message = node_state.get("final_message", {})
                    str_final_message = str(json.dumps({
                        **final_message,
                        "data_limit_exceeded": node_state.get("data_limit_exceeded", False)
                    }))
                    messages = [HumanMessage(query), AIMessage(str_final_message)]
                    self.memory_store.save(messages=self.serialize_messages(messages),
                                           user_name=user_id, agent_name="NLQ", conversation_id=conversation_id)
                    record_response_time((perf_counter() - start) * 1000)
                    yield {
                        "is_task_complete": True,
                        "require_user_input": False,
                        "content": str_final_message,
                    }

                elif "sql_execution" in output:
                    new_state = output[next(iter(output))]
                    if new_state.get("metadata").get("sql_execution_result") == "ERROR":
                        yield {
                            "is_task_complete": False,
                            "require_user_input": False,
                            "content": "Ground Truth SQL query is invalid and failed to execute. Proceeding with NLQ execution.",
                        }
                    else:
                        self.memory_store.save(messages=self.serialize_messages(new_state.get('messages', [])),
                                               user_name=user_id, agent_name="NLQ", conversation_id=conversation_id)
                        record_response_time((perf_counter() - start) * 1000)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": new_state.get("metadata", {}).get("sql_execution_result", {}),
                        }
                        break
                else:
                    pass
        except GraphRecursionError:
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": "The agent’s instruction set lacked sufficient context, leading the LLM to generate inconsistent outputs. Please request the Admin to enrich the instruction set with relevant context to ensure accurate outputs.",
            }

    async def identify_completeness_node(self, state: NLQState) -> dict:
        print('===========identify_completeness_node=======', state)
        user_message = next(
            (m.content for m in reversed(state.messages) if isinstance(m, HumanMessage)),
            None,
        )

        completeness_identification_template = self.system_prompts.get_system_prompt(
            "nlq_completeness_identification_template.txt")

        attempt = 1
        max_attempts = 3
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0

        effective_details = state.prompt_template_details
        llm = self.get_llm(effective_details).bind(max_tokens=nlq_max_tokens)
        use_cache = self.enable_prompt_caching
        new_messages = state.messages[:-1] + [HumanMessage(user_message)]
        while True:
            try:
                completeness_identification_prompt = self._build_prompt(
                    completeness_identification_template,
                    static_vars=dict(
                        fields=state.metadata["fields"],
                        format_instructions=nlq_intent_parser.get_format_instructions(),
                        example_response=nlq_intent_example.model_dump_json(),
                    ),
                    dynamic_vars=dict(
                        user_message=user_message,
                        chat_history=state.lt_history,
                        user_email=state.user_email,
                    ),
                    use_cache=use_cache,
                )
                result = await ainvoke_structured(llm, NLQIntentResponse, completeness_identification_prompt)
                if result.is_user_input_required:
                    new_messages = new_messages + [AIMessage(result.model_dump_json())]
                    state.metadata['needs_user_input'] = True
                break
            except Exception as e:
                if use_cache:
                    print(f"[Cache fallback] identify_completeness_node failed: {e}, retrying without cache")
                    use_cache = False
                    continue
                if attempt >= max_attempts:
                    print(f"Payload determination error: {e}")
                    state.error = f"Payload determination failed: {str(e)}"
                    break
                sleep_for = min(delay, max_interval)
                jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                sleep_time = max(0.0, sleep_for + jitter)
                print(
                    f"[Backoff] attempt {attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
                delay = min(delay * backoff_factor, max_interval)
                attempt += 1
        state.messages = new_messages
        return state

    @staticmethod
    async def check_if_clickable(state: NLQState):
        api_base_url = os.getenv("VITE_ADMIN_SECRET", "http://localhost:8000")
        url = f"{api_base_url}/v2/admin/clickable/clickable-questions/search"
        question = state.messages[0].content
        async with httpx.AsyncClient(timeout=httpx.Timeout(1000)) as client:
            try:
                resp = await client.post(url, json={"question": question})
                resp.raise_for_status()
                data = resp.json()
                print('==========clickable search=======', data)
                if "sql_query" in data:
                    state.metadata['gt_sql_query'] = data["sql_query"]
                    state.metadata['clickable_decision'] = "tool_call"
                else:
                    state.metadata['clickable_decision'] = "nlq_execution"
            except Exception:
                state.metadata['clickable_decision'] = "nlq_execution"
        return state

    async def sql_execution_node(self, state: NLQState):
        user_message = next(
            (m.content for m in reversed(state.messages) if isinstance(m, HumanMessage)),
            None,
        )
        data_analysis = ""
        json_data = None
        data_limit_exceeded = False
        final_sql_query = state.metadata.get('gt_sql_query')
        if final_sql_query:
            try:
                json_data, data_limit_exceeded = await self.get_and_save_data_records(state, final_sql_query)
                print('===========sql_execution_node=======', json_data)
            except Exception:
                state.metadata['sql_execution_result'] = "ERROR"
                return state

        if state.thinking_enabled and json_data:
            try:
                llm = self.get_llm(state.prompt_template_details)
                analysis_prompt = (
                    f"Analyze the following SQL query results for the question: {user_message}\n\n"
                    f"SQL Query: {final_sql_query}\n\n"
                    f"Results (sample): {json.dumps(json_data[:10], default=str)}\n\n"
                    "Provide a concise data analysis summarizing the key findings."
                )
                data_analysis = await ainvoke_text(llm, analysis_prompt)
            except Exception as e:
                print(f"[sql_execution_node] data_analysis generation failed: {e}")

        result = {
            "json_data": json_data,
            "data_analysis": data_analysis,
            "sql_query": final_sql_query,
            "data_limit_exceeded": data_limit_exceeded
        }
        new_messages = [HumanMessage(user_message),
                        ToolMessage(json_data, tool_call_id=state.metadata.get("conversation_id"))]
        state.messages = new_messages
        state.metadata['sql_execution_result'] = json.dumps(result)
        return state

    async def revise_query_node(self, state: NLQState) -> dict:
        revision_prompt_template: str = str(self.system_prompts.get_system_prompt("nlq_prompt_revision_template.txt"))

        effective_details = state.prompt_template_details
        llm = self.get_llm(effective_details).bind(max_tokens=nlq_max_tokens)
        use_cache = self.enable_prompt_caching
        revise_react_agent = None
        max_attempts = 3
        attempt = 1
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0
        while True:
            try:
                if revise_react_agent is None:
                    revision_prompt = self._build_prompt(
                        revision_prompt_template,
                        static_vars=dict(
                            prompt_template=state.prompt_template_details.prompt_template,
                            format_instructions=nlq_revision_parser.get_format_instructions(),
                            example_response=nlq_revision_example.model_dump_json(),
                        ),
                        dynamic_vars=dict(
                            chat_history=state.lt_history,
                            user_email=state.user_email,
                        ),
                        use_cache=use_cache,
                        as_callable=use_cache,
                    )
                    revise_react_agent = create_react_agent(
                        model=llm,
                        tools=[build_json_parse_tool()],
                        # checkpointer=self.memory,
                        prompt=revision_prompt,
                        response_format=NLQRevisionResponse,
                    )
                result = await revise_react_agent.ainvoke({"messages": state.messages})
                break
            except Exception as e:
                if use_cache:
                    print(f"[Cache fallback] revise_query_node failed: {e}, retrying without cache")
                    use_cache = False
                    revise_react_agent = None
                    continue
                if attempt >= max_attempts:
                    raise
                sleep_for = min(delay, max_interval)
                jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                sleep_time = max(0.0, sleep_for + jitter)
                print(f"[Backoff] attempt {attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
                delay = min(delay * backoff_factor, max_interval)
                attempt += 1

        print('===========revise_query_node result=======', result)
        structured_response: NLQRevisionResponse = result["structured_response"]
        state.revision_output = structured_response.model_dump_json()
        return state

    async def main_agent_node(self, state: NLQState):
        revised_parsed_message = json.loads(state.revision_output)
        final_prompt_template = self.system_prompts.get_system_prompt("nlq_final_prompt_template.txt")
        filtered_fields = self.filter_fields_by_selected_tables(all_fields=state.metadata['fields'],
                                                                selected_tables=revised_parsed_message.get(
                                                                    "schema_tables"))
        llm = self.get_llm(state.prompt_template_details)
        use_cache = self.enable_prompt_caching

        # Build an enriched message that carries the revision context (revised query,
        # extracted business rules, and domain-specific example queries) so the SQL
        # generation agent has the full picture rather than just the raw user query.
        enriched_messages = self._build_enriched_messages(revised_parsed_message, state.messages)

        main_agent = None
        max_attempts = 3
        attempt = 1
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0
        while True:
            try:
                if main_agent is None:
                    final_prompt = self._build_prompt(
                        final_prompt_template,
                        static_vars=dict(
                            general_instructions=state.metadata['general_instructions'],
                            common_business_rules=state.metadata['common_business_rules'],
                            data_handling_rules=state.metadata['data_handling_rules'],
                            fields=filtered_fields,
                            format_instructions=nlq_final_parser.get_format_instructions(),
                            example_response=nlq_final_example.model_dump_json(),
                        ),
                        dynamic_vars=dict(
                            chat_history=state.lt_history,
                            user_email=state.user_email,
                        ),
                        use_cache=use_cache,
                        as_callable=use_cache,
                    )
                    main_agent = create_react_agent(
                        model=llm,
                        tools=self.tools,
                        # checkpointer=self.memory,
                        prompt=final_prompt,
                        state_schema=MainAgentState,
                        response_format=NLQFinalResponse,
                    )
                result = await main_agent.ainvoke(MainAgentState(
                    messages=enriched_messages,
                    remaining_steps=10,
                    step=0,
                    user_email=state.user_email,
                ))
                break
            except Exception as e:
                if use_cache:
                    print(f"[Cache fallback] main_agent_node failed: {e}, retrying without cache")
                    use_cache = False
                    main_agent = None
                    continue
                if attempt >= max_attempts:
                    raise
                sleep_for = min(delay, max_interval)
                jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                sleep_time = max(0.0, sleep_for + jitter)
                print(f"[Backoff] attempt {attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)
                delay = min(delay * backoff_factor, max_interval)
                attempt += 1
        structured_response: NLQFinalResponse = result["structured_response"]
        state.agent_output = structured_response.model_dump_json()
        print('===========main_agent_node structured_response=======', structured_response)
        return state


    def set_sql_query(self, state: NLQState):
        final_message = state.final_message
        try:
            parsed = json.loads(state.agent_output)
            final_message = final_message | {
                "data_analysis": parsed.get("data_analysis"),
                "sql_query": parsed.get("sql_query"),
            }
        except (json.JSONDecodeError, TypeError) as e:
            print(f"============set_sql_query parse error: {e}==========")
        state.final_message = final_message
        return state

    async def fetch_json_records(self, state: NLQState):
        final_message = state.final_message
        json_data = []
        data_limit_exceeded = False

        if "sql_query" in final_message and final_message.get("sql_query") is not None:
            final_sql_query = final_message.get("sql_query")
            print('==========final_sql_query======', final_sql_query)
            try:
                json_data, data_limit_exceeded = await self.get_and_save_data_records(state, final_sql_query)
                print('========json_data + data_limit_exceeded======', (json_data, data_limit_exceeded))
            except Exception as e:
                final_message = {**final_message, "data_analysis": str(e)}

        state.final_message = {**final_message, "json_data": json_data}
        state.data_limit_exceeded = data_limit_exceeded
        return state


    async def get_and_save_data_records(self, state: NLQState, final_sql_query):
        json_limit = int(os.getenv('NLQ_JSON_LIMIT', '100'))
        data_limit_exceeded = False
        try:
            count_result = await asyncio.to_thread(
                execute_sql,
                wrap_query_with_count(final_sql_query),
                user_email=state.user_email,
            )
            result = count_result[0]
            print('========num_rows=======', result)
            data_limit_exceeded = result.get("num_rows", 0) > json_limit
        except Exception as e:
            # Count query can fail when sqlglot cannot transform certain SQL constructs
            # into a valid subquery wrapper (e.g. QUALIFY, PIVOT, complex CTEs).
            # The count is only used for pagination; fall back to running the original
            # SQL directly so the user always gets data when the query itself is valid.
            print(f"[get_and_save_data_records] Count query failed, running original SQL: {e}")

        normalized_sql = normalize_tvf_user_args(final_sql_query)
        if data_limit_exceeded:
            query = wrap_query_with_limit(normalized_sql, json_limit)
        else:
            query = normalized_sql
        result = await asyncio.to_thread(
            execute_sql,
            query,
            user_email=state.user_email,
        )
        if data_limit_exceeded:
            csv_prefix = get_next_nlq_csv_key(bucket=self.env['WORKSPACE_BUCKET_NAME'],
                                                          prefix=f"NLQ/{state.metadata.get('user_id')}/{state.metadata.get('conversation_id')}/")
            try:
                await asyncio.to_thread(
                    execute_sql,
                    wrap_query_with_insert(
                        final_sql_query,
                        SAVE_LARGE_CSV_TO_S3
                    ).format_map({
                        'bucket': self.env['WORKSPACE_BUCKET_NAME'],
                        'path': csv_prefix,
                    }),
                    user_email=state.user_email,
                )
            except Exception:
                pass
        
        return result, data_limit_exceeded



    @staticmethod
    def json_rows_to_csv_bytes(
            rows: List[Dict[str, Any]],
            fieldnames: Optional[List[str]] = None,
    ) -> bytes:
        if not rows:
            raise ValueError("rows is empty")

        if fieldnames is None:
            fieldnames = list(rows[0].keys())
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

        return buf.getvalue().encode("utf-8")

    @staticmethod
    def serialize_messages(messages):
        return [
            {"role": msg["role"], "content": msg.get("intent", msg.get("content"))}
            if isinstance(msg, dict)
            else {"role": msg.type, "content": msg.content}
            for msg in messages
        ]

    @staticmethod
    def _build_enriched_messages(revised: dict, original_messages: list) -> list:
        """Combine the revision output into a single HumanMessage for the main agent.

        The revision step extracts a domain-specific revised query, applicable business
        rules, and matching example queries from the sub-agent prompt.  Previously these
        were discarded before SQL generation; now they are forwarded so the LLM has the
        full context needed to produce correct SQL (e.g. time-series patterns that have
        no analogue in the generic final-prompt template).

        Falls back to the original messages when revision produced nothing useful.
        """
        parts = []

        revised_query = revised.get("query", "")
        if revised_query:
            parts.append(f"[REVISED QUERY]\n{revised_query}")

        business_rules = revised.get("business_rules") or []
        if business_rules:
            rules_text = "\n".join(f"- {r}" for r in business_rules)
            parts.append(f"[APPLICABLE BUSINESS RULES]\n{rules_text}")

        example_queries = revised.get("example_queries") or []
        if example_queries:
            parts.append(f"[REFERENCE EXAMPLE QUERIES]\n{json.dumps(example_queries, indent=2)}")

        if not parts:
            return original_messages

        return [HumanMessage("\n\n".join(parts))]

    def _build_graph(self):

        def route_clickable_decision(state: NLQState):
            print('===========route_decision=======', state)
            decision = state.metadata['clickable_decision']
            return decision

        def route_sql_execution_decision(state: NLQState):
            print('===========route_sql_decision=======', state)
            result = state.metadata['sql_execution_result']
            if result == "ERROR":
                return "nlq_execution"
            else:
                return "succeeded"

        builder = StateGraph(NLQState)
        builder.add_conditional_edges(
            "check_if_clickable",
            route_clickable_decision,
            {
                "tool_call": "sql_execution",
                "nlq_execution": "identify_completeness",
                END: END
            }
        )

        builder.add_conditional_edges(
            "sql_execution",
            route_sql_execution_decision,
            {
                "nlq_execution": "identify_completeness",
                "succeeded": END
            }
        )

        builder.add_node("check_if_clickable", self.check_if_clickable)
        builder.add_node("sql_execution", self.sql_execution_node)
        builder.add_node("revise_query", self.revise_query_node, retry=RetryPolicy(
            max_attempts=3,
            jitter=True,
            max_interval=60
        ))
        builder.add_node("identify_completeness", self.identify_completeness_node)
        builder.add_node("main_agent", self.main_agent_node, retry=RetryPolicy(
            max_attempts=3,
            jitter=True,
            max_interval=60
        ))
        builder.add_node("set_sql_query", self.set_sql_query)
        builder.add_node("fetch_json", self.fetch_json_records)

        builder.set_entry_point("check_if_clickable")
        def route_completeness(state: NLQState):
            return END if state.metadata.get('needs_user_input') else "revise_query"

        builder.add_conditional_edges("identify_completeness", route_completeness, {
            "revise_query": "revise_query",
            END: END,
        })
        builder.add_edge("revise_query", "main_agent")
        builder.add_edge("main_agent", "set_sql_query")
        builder.add_edge("set_sql_query", "fetch_json")
        builder.add_edge("fetch_json", END)

        return builder.compile()


if __name__ == "__main__":
    agent = NLQAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}', path="/v2/agents/nlq",
                     dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)
