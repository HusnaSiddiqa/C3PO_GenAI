import os
import re
import sys
import json
import time, random
from typing import List, Literal

from langchain_core.output_parsers import PydanticOutputParser
from langgraph.errors import GraphRecursionError
from langgraph.types import RetryPolicy

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from collections.abc import AsyncIterator
from typing import Any
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

# Imports for calling Chart Agent in chartaudit
import httpx
import requests
from a2a.client import A2AClient
from a2a.types import (
    MessageSendParams,
    AgentCard,
    SendStreamingMessageRequest,
    SendStreamingMessageResponse,
    SendStreamingMessageSuccessResponse,
    JSONRPCErrorResponse,
    TextPart,
    AgentSkill
)
from opentelemetry.propagate import inject
from opentelemetry.context import get_current
from opentelemetry.trace import get_current_span

from core.model_provider.factory import ModelFactory
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore

from langgraph.graph import StateGraph,END
from core.prompt.SystemPrompt import SystemPrompt
from core.prompt.PromptStore import PromptStore
from core.util.ConfigLoader import load_env_variables, get_secret
from langgraph.checkpoint.memory import MemorySaver

from agents.nlq.Tools import build_generate_sql_tool, build_json_parse_tool
from pydantic import BaseModel
from dataclasses import dataclass

from traceloop_wrapper.metrics import record_response_time
from time import perf_counter
from utils.constants import LAST_AGENT_SEPARATOR

class ChartauditRevisionResponse(BaseModel):
    query: str


chartaudit_revision_parser = PydanticOutputParser(pydantic_object=ChartauditRevisionResponse)


class ChartauditIntentResponse(BaseModel):
    is_user_input_required: bool
    reason: str


chartaudit_intent_parser = PydanticOutputParser(pydantic_object=ChartauditIntentResponse)
chartaudit_intent_example = ChartauditIntentResponse(is_user_input_required=False, reason="Query is complete.")


class ChartauditSQLQueryWithData(BaseModel):
    type: Literal["structured", "unstructured"]
    sql_query: str
    json_data: str

class ChartauditSampleResponse(BaseModel):
    sample_query: str
    query_results: str
    decision: str

chartaudit_sample_parser = PydanticOutputParser(pydantic_object=ChartauditSampleResponse)

class ChartauditFinalResponse(BaseModel):
    sample_analysis: ChartauditSampleResponse
    queries: List[ChartauditSQLQueryWithData]
    data_analysis: str

chartaudit_final_parser = PydanticOutputParser(pydantic_object=ChartauditFinalResponse)

chartaudit_final_example = ChartauditFinalResponse(
    sample_analysis=ChartauditSampleResponse(
        sample_query="SELECT count(*) FROM Schema.Table",
        query_results='[{"col1": "value1","data_type": "structured"}, {"col1": "value2","data_type": "unstructured"}]',
        decision="Analysis: Found both structured and unstructured data types. Structured data contains categorical responses.Approach used. Will generate two separate queries."
    ),
    queries=[
        ChartauditSQLQueryWithData(
            type="structured",
            sql_query="SELECT count(*) FROM Schema.Table1",
            json_data='[{"category": "123"}]'
        ),
        ChartauditSQLQueryWithData(
            type="unstructured",
            sql_query="SELECT count(1) from Schema.Table1;",
            json_data='[{"category": "123"}]'
        )
    ],
    data_analysis="example analysis"
)


@dataclass
class ChartauditState:
    messages: list[Any]
    metadata: dict[str, Any]
    lt_history: list = None
    chart_agent_card: AgentCard = None  # Store chart agent card
    analysis_mode: str = "individual"  # NEW: "individual" | "cross"

class ChartauditAgent(AgentBase[ChartauditState]):

    @property
    def name(self) -> str:
        return "Chartaudit_Agent"

    @property
    def description(self) -> str:
        return "An intelligent agent that analyzes HIV PrEP chart audit-focused natural language queries, applies domain-specific business rules, generates compliant SQL, and executes it against a Databricks SQL warehouse to return results.. Use this agent for questions about: prescriber characteristics (specialty, board certification, time allocation); treatment discussions (what was discussed vs. prescribed); reasons for prescribing or NOT prescribing drugs (Why analysis); patient requests, preferences, and awareness; insurance/payer denials and willingness to contest; barriers (needle phobia, pill burden, cost concerns, access); prescriber attitudes and familiarity with products and PURPOSE trials; treatment switch discussions and decision-making; injection timing and acquisition methods; visit types and communication formats. DO NOT use for: patient volume metrics, consumer counts, or market share; geographic patient distribution or time-series patient trends; source of business flow analysis (naive/switch/restart counts); claims-based patient demographics or prescriber TRx rankings. Self-sufficient agent that doesn't rely on chat history."
    def __init__(self):
        req_env_keys = ['PROVIDER', 'SECRET_NAME', 'DATABRICKS_SERVER_HOSTNAME', 'DATABRICKS_HOST',
                        'DATABRICKS_HTTP_PATH', 'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME', 'AGENT_BASE_URL',
                        'AGENT_BASE_PORT']

        self.env = load_env_variables()

        missing_keys = [key for key in req_env_keys if key not in self.env]
        if missing_keys:
            raise KeyError(f"Missing required environment variable(s): {', '.join(missing_keys)}")

        secret_name = self.env['SECRET_NAME']
        self.model_api_key = get_secret(secret_name)

        self.system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")

        # Initialize tools including SQL execution
        self.tools = [build_generate_sql_tool(), build_json_parse_tool()]
        self.lt_history = None
        self.admin_prompt_template = None
        self.llm = None
        self.memory = None
        self.load_llm_with_mlflow_prompt()
        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'],
                                        prefix="agent_memory")
        
        # Load Chart Agent card for chartaudit
        self.chart_agent_card = self._fetch_downstream_chart_agent_card()

        skill_config = json.loads(
            self.system_prompts.get_system_prompt("chartaudit_skill_config.json")
        )
        skill = AgentSkill(
            id=skill_config.get("id", "convert_to_sql"),
            name=skill_config.get("name", "Chartaudit_Agent"),
            description=skill_config.get("description", "Analyzes **survey responses from healthcare providers (HCPs)** about their HIV PrEP prescribing attitudes, practices, and experiences. Handles ONLY chart audit questionnaire data including: HCP characteristics (specialty, practice settings, board certification, time allocation); HCP-reported treatment discussions; HCP reasons for prescribing/not prescribing; patient requests and awareness as reported by HCPs; HCP willingness to contest insurance denials; HCP-reported barriers (needle phobia, cost concerns); HCP attitudes, familiarity, and PURPOSE trials knowledge; HCP-reported treatment switch conversations; injection timing discussions. **This agent analyzes what HCPs report in surveys, NOT actual patient claims, prescription volumes, market share, patient counts, geographic distribution, or longitudinal trends. For questions about actual patient numbers, prescriptions written, market metrics, switches, or any time-series patient tracking, use NLQ_Agent instead.**"),
            tags=skill_config.get("tags", [])
        )
        self.initialize_graph()
        super().__init__(llm=self.llm, agent_skill=skill)

    def _fetch_downstream_chart_agent_card(self) -> AgentCard:
        """Fetch Chart Agent's card from agent registry for downstream chart generation"""
        try:
            print("[ChartauditAgent] Loading agent registry...")
            
            # OPTIONAL: Uncomment below for local development override
            chart_agent_url_override = self.env.get('CHART_AGENT_URL')
            if chart_agent_url_override:
                print(f"[ChartauditAgent] Using CHART_AGENT_URL environment variable: {chart_agent_url_override}")
                chart_agent_url = f'{chart_agent_url_override}/.well-known/agent.json'
                print(f"[ChartauditAgent] Fetching agent card from: {chart_agent_url}")
                
                try:
                    response = requests.get(chart_agent_url, timeout=30)
                    response.raise_for_status()
                    metadata = response.json()
                    
                    agent_card = AgentCard.model_validate(metadata)
                    agent_card.url = chart_agent_url_override
                    print(f"[ChartauditAgent] ✓ Successfully loaded Chart Agent card from environment variable")
                    return agent_card
                except Exception as e:
                    print(f"[ChartauditAgent] ERROR: Failed to fetch using CHART_AGENT_URL override: {e}")
                    print(f"[ChartauditAgent] Falling back to agent registry...")
            
            # Load from agent registry
            agent_registry = json.loads(self.system_prompts.get_system_prompt("agent_registry.json"))
            print(f"[ChartauditAgent] Available agents in registry: {list(agent_registry.keys())}")
            
            chart_agent_info = agent_registry.get("Chart_Agent")
            
            if not chart_agent_info:
                print("[ChartauditAgent] ERROR: 'Chart_Agent' not found in registry")
                print(f"[ChartauditAgent] Available agent names: {list(agent_registry.keys())}")
                return None
            
            print(f"[ChartauditAgent] Found Chart Agent info: {chart_agent_info}")
            chart_agent_url = f'{chart_agent_info["full_url"]}/.well-known/agent.json'
            
            print(f"[ChartauditAgent] Fetching agent card from: {chart_agent_url}")
            response = requests.get(chart_agent_url, timeout=30)
            response.raise_for_status()
            metadata = response.json()
            
            agent_card = AgentCard.model_validate(metadata)
            print(f"[ChartauditAgent] ✓ Successfully loaded Chart Agent card")
            
            return agent_card
            
        except Exception as e:
            error_msg = f"[ChartauditAgent] FATAL ERROR: Failed to load Chart Agent card: {type(e).__name__}: {e}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            raise Exception(error_msg)

    async def _call_chart_agent(self, card: AgentCard, payload: dict):
        """
        Make an API call to the Chart Agent using A2AClient.
        This maintains modularity by using API calls instead of direct method imports.
        """
        async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(1000)) as httpx_client:
            client = A2AClient(
                httpx_client=httpx_client, agent_card=card
            )

            print('[ChartauditAgent] A2AClient initialized for Chart Agent.')

            request = SendStreamingMessageRequest(
                id=payload.get("message").get("messageId"), params=MessageSendParams(**payload)
            )
            headers = {
                "user_id": payload.get("metadata").get("user_id", "unknown_user"),
                "conversation_id": payload.get("metadata").get("conversation_id", "unknown_user")
            }

            inject(headers, context=get_current())
            span = get_current_span()
            print("[ChartauditAgent] Before calling Chart Agent")
            print("Trace ID:", span.get_span_context().trace_id)
            print("Span ID:", span.get_span_context().span_id)
            stream_response = client.send_message_streaming(request, http_kwargs={"timeout": 1000, "headers": headers})
            async for chunk in stream_response:
                yield chunk

    def load_llm_with_mlflow_prompt(self):
        try:
            prompt_template = PromptStore(self.name, f"{self.env['WORKSPACE_NAME']}/agents").load_prompt()
            provider = self.env['PROVIDER']
            model = prompt_template.get("model", "")
            model_base_url = prompt_template.get("model_base_url", "")
            temperature = prompt_template.get("temperature", "0")
            try:
                temperature = float(temperature)
            except (ValueError, TypeError):
                temperature = 0
            self.admin_prompt_template = prompt_template.get("prompt", "")

            if self.llm is None or self.model != model:
                self.model = model
                print('===========reassigning model========', model)
                self.llm = ModelFactory.create_provider(provider=provider, model_name=model,
                                                        base_url=model_base_url,
                                                        api_key=self.model_api_key,
                                                        temperature=temperature).get_llm()
        except ValueError:
            pass

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("Streaming Chartaudit agent...")
        self.memory = MemorySaver()
        start = perf_counter()
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        lt_history = self.memory_store.search(user_name=user_id, agent_name="Chartaudit", conversation_id=conversation_id,
                                                last_n=10)
        state = ChartauditState(
            messages=[("user", query)],
            metadata=metadata,
            lt_history=lt_history
        )
        config = {'configurable': {'thread_id': thread_id}}
        try:
            async for output in self._agent.astream(state, config):
                print('===========output=======', output)
                messages = output[next(iter(output))]['messages']

                if "revise_query" in output:
                    # Extract the revised query from the messages list
                    revised_query = None
                    if isinstance(messages, list) and len(messages) > 0:
                        last_msg = messages[-1]
                        if isinstance(last_msg, tuple) and len(last_msg) == 2:
                            revised_query = last_msg[1]
                        elif hasattr(last_msg, 'content'):
                            revised_query = last_msg.content
                    
                    if revised_query:
                        yield {
                            "is_task_complete": False,
                            "require_user_input": False,
                            "content": f"A context-aware revision of your query has been produced:\nRephrased Query:**{revised_query}**\n",
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
                                            user_name=user_id, agent_name="Chartaudit", conversation_id=conversation_id)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": f"""Your query seems incomplete and cannot be processed yet. Reason: {message.get("reason")}.\nCould you please clarify or provide the missing information?""",
                        }
                        break
                elif "relevant_question_picking" in output:
                    questions = []
                    for message in messages:
                        if isinstance(message, tuple) and message[0] == "questions":
                            questions = message[1]
                            break
                    
                    if any(isinstance(message, tuple) and message[0] == "current_question" and message[1] is None for message in messages):
                        record_response_time((perf_counter() - start) * 1000)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": "No relevant questions found for your query. Please try with a different query.",
                        }
                        break

                elif "analysis_decision" in output:
                    node_data = output[next(iter(output))]
                    mode = node_data.get("analysis_mode", "individual")
                    questions = next(
                        (m[1] for m in messages if isinstance(m, tuple) and m[0] == "questions"),
                        []
                    )
                    mode_line = (
                        "**Cross-question analysis** is selected — constructing a unified SQL query from all questions."
                        if mode == "cross"
                        else "**Individual analysis** is selected — processing each question separately"
                    )
                    yield {
                        "is_task_complete": False,
                        "require_user_input": False,
                        "content": (
                            f"Found {len(questions)} relevant question{'s' if len(questions) != 1 else ''}\n\n"
                            + "\n".join(f"  {i+1}. {q['question']}" for i, q in enumerate(questions))
                            + f"\n\n{mode_line}"
                        ),
                    }
                elif "sql_node" in output:
                    # Count how many sql_results exist in current output
                    sql_results_in_current_output = []
                    has_more_questions = False
                    
                    for message in messages:
                        if isinstance(message, tuple):
                            if message[0] == "current_question" and message[1] is not None:
                                has_more_questions = True
                            elif message[0] == "sql_results":
                                sql_results_in_current_output.append(message[1])
                    
                    # Only yield the LAST sql_results (the newly added one)
                    if sql_results_in_current_output:
                        result = sql_results_in_current_output[-1]
                        current_question = result["question"]
                        q_text = current_question.get("question", "")
                        q_id = current_question.get("question_id", "")
                        
                        questions = next(
                            (m[1] for m in messages if isinstance(m, tuple) and m[0] == "questions"),
                            []
                        )
                        pos = next(
                            (i + 1 for i, q in enumerate(questions) if q.get("question_id") == q_id),
                            None
                        )
                        pos_label = f"Question {pos}" if pos else "Question"

                        yield {
                            "is_task_complete": False,
                            "require_user_input": False,
                            "content": f"Generating SQL & charts for {pos_label}",
                        }
                        # Process SQL results for this question
                        for sql_result in result["results"]:
                            yield {
                                "is_task_complete": False,
                                "require_user_input": False,
                                "content": json.dumps({
                                    "question": current_question["question"],
                                    "type": sql_result["type"],
                                    "sql": sql_result["sql"],
                                    "results": sql_result["results"]
                                }, indent=2)
                            }
                elif "cross_sql_node" in output:
                    sql_results_in_current_output = []

                    for message in messages:
                        if isinstance(message, tuple):
                            if message[0] == "sql_results":
                                sql_results_in_current_output.append(message[1])

                    if sql_results_in_current_output:
                        result = sql_results_in_current_output[-1]
                        current_question = result["question"]

                        # question is now a list — display all of them
                        question_display = current_question["question"]
                        if not isinstance(question_display, list):
                            question_display = [question_display]  # fallback: wrap in list

                        for sql_result in result["results"]:
                            yield {
                                "is_task_complete": False,
                                "require_user_input": False,
                                "content": json.dumps({
                                    "question": question_display,  # ← list of all relevant questions
                                    "type": sql_result["type"],
                                    "sql": sql_result["sql"],
                                    "results": sql_result["results"]
                                }, indent=2)
                            }

                elif "charts_node" in output:
                    final_result_for_current_question = None
                    all_final_results_in_state = []
                    last_current_question = None  # FIX: track only the last one

                    for message in messages:
                        if isinstance(message, tuple):
                            if message[0] == "final_result":
                                all_final_results_in_state.append(message[1])
                            elif message[0] == "current_question":
                                last_current_question = message[1]  # FIX: overwrite each time

                    # FIX: use last-wins (mirrors graph's has_questions logic)
                    has_more_questions = (last_current_question is not None)

                    if all_final_results_in_state:
                        final_result_for_current_question = all_final_results_in_state[-1]

                        if final_result_for_current_question:
                            # FIX: removed duplicate append that was here before
                            yield {
                                "is_task_complete": False,
                                "require_user_input": False,
                                "content": json.dumps({
                                    "status": "Question Processed",
                                    "result": final_result_for_current_question
                                }, indent=2)
                            }

                    if not has_more_questions:
                        all_final_results_on_end = [
                            msg[1] for msg in messages if isinstance(msg, tuple) and msg[0] == "final_result"
                        ]
                        self.memory_store.save(messages=self.serialize_messages(messages),
                                        user_name=user_id, agent_name="Chartaudit", conversation_id=conversation_id)
                        record_response_time((perf_counter() - start) * 1000)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": json.dumps({
                                "status": "Task Complete",
                                "final_summary": "Processed all relevant questions and generated analysis/charts.",
                                "all_question_results": all_final_results_on_end
                            }, indent=2),
                        }
                        break # Terminate the stream
                else:
                    # For any other node outputs, pass them through
                    if any(isinstance(message, (AIMessage, HumanMessage)) for message in messages):
                        yield {
                            "is_task_complete": False,
                            "require_user_input": False,
                            "content": str(messages[-1].content if hasattr(messages[-1], 'content') else messages[-1]),
                        }
        except GraphRecursionError:
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": "The agent's instruction set lacked sufficient context, leading the LLM to generate inconsistent outputs. Please request the Admin to enrich the instruction set with relevant context to ensure accurate outputs.",
            }

    def identify_completeness_node(self, state: ChartauditState) -> dict:
        print('===========identify_completeness_node=======', state)
        user_message = None
        for role, content in reversed(state.messages):
            if role == "user":
                user_message = content
                break

        completeness_identification_template = self.system_prompts.get_system_prompt("completeness_identification_template.txt")
        self.load_llm_with_mlflow_prompt()
        completeness_identification_prompt = completeness_identification_template.format(user_message=user_message,
                                                                                         chat_history=state.lt_history,
                                                                                         format_instructions=chartaudit_intent_parser.get_format_instructions(),
                                                                                         example_response=chartaudit_intent_example.model_dump_json())

        result = self.llm.invoke(completeness_identification_prompt)
        intent = result.content if hasattr(result, 'content') else str(result)
        new_messages = state.messages[:-1] + [HumanMessage(user_message)]
        if type(intent) is list:
            intent = intent[0]
        intent_json = json.loads(intent.strip())
        if intent_json.get("is_user_input_required"):
            new_messages = [HumanMessage(user_message), AIMessage(intent)]

        return {
            "messages": new_messages
        }

    def revise_query_node(self, state: ChartauditState) -> dict:

        revision_prompt_template = self.system_prompts.get_system_prompt("revised_query_instructions.txt")
        
        revision_prompt = revision_prompt_template.format(
            chat_history=state.lt_history,
            format_instructions=chartaudit_revision_parser.get_format_instructions()
        )

        revise_react_agent = create_react_agent(
            model=self.llm,
            tools=[build_json_parse_tool()],
            checkpointer=self.memory,
            prompt=revision_prompt
        )
        
        max_attempts = 3
        attempt = 1
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0
        
        while True:
            try:
                result = revise_react_agent.invoke({"messages": state.messages})
                break
            except Exception as e:
                if attempt >= max_attempts:
                    raise
                sleep_for = min(delay, max_interval)
                jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                sleep_time = max(0.0, sleep_for + jitter)
                print(f"[Backoff] attempt {attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                time.sleep(sleep_time)
                delay = min(delay * backoff_factor, max_interval)
                attempt += 1

        print('===========revise_query_node result=======', result)
        
        # Extract the revised query content
        revised_content = None
        for idx, message in enumerate(reversed(result["messages"])):
            if isinstance(message, AIMessage) and hasattr(message, "response_metadata") and message.response_metadata.get("finish_reason") == "stop":
                orig_idx = len(result["messages"]) - 1 - idx
                if orig_idx - 1 >= 0:
                    prev_msg = result["messages"][orig_idx - 1]
                    if isinstance(prev_msg, ToolMessage):
                        revised_content = prev_msg.content
                    else:
                        revised_content = message.content
                else:
                    revised_content = message.content
                break
        
        # If no revised content found, use original message
        if revised_content is None:
            original = state.messages[0]
            revised_content = original[1] if isinstance(original, tuple) else original.content
        
        # Parse the JSON string to get the revised query
        try:
            parsed = json.loads(revised_content)
            revised_query = parsed.get("query", revised_content)
        except (json.JSONDecodeError, AttributeError):
            revised_query = revised_content
        
        # Return messages in the correct format as a list with a tuple
        return {
            "messages": [("user", revised_query)]
        }
    
    def relevant_question_picking_node(self, state: ChartauditState) -> dict:
        print('===========relevant_question_picking_node=======', state)
        user_message = None
        for role, content in reversed(state.messages):
            if role == "user":
                user_message = content
                break

        relevant_question_picking_template = self.system_prompts.get_system_prompt("relevant_survey_questions_prompt.txt")

        unique_survey_questions = json.loads(self.system_prompts.get_system_prompt("unique_survey_questions.json"))   
        relevant_question_picking_prompt = relevant_question_picking_template.format(
            user_question=user_message,
            questions_text=json.dumps(unique_survey_questions))

        result = self.llm.invoke(relevant_question_picking_prompt)
        content = result.content if hasattr(result, 'content') else str(result)

        questions = []
        
        if content.strip().lower() == "none":
            questions = []
        else:
            try:
                parsed_json = json.loads(content)
                # Ensure the parsed result is a list (JSON array)
                if isinstance(parsed_json, list):
                    # 3. Iterate through the list and map keys
                    for item in parsed_json:
                        # Use .get() for safety in case the LLM messes up keys
                        question = item.get("Question")
                        question_id = item.get("Question ID")

                        if question and question_id:
                            questions.append({
                                "question": question,
                                "question_id": question_id
                            })
                # If not a list, it's a parsing error or unexpected format, so questions remains empty.
                
            except json.JSONDecodeError as e:
                # Handle cases where the LLM output is not valid JSON
                print(f"JSONDecodeError: Failed to parse LLM output. Error: {e}")
                questions = [] # Treat as no questions found
                
        # The rest of the state management remains the same
        new_messages = state.messages[:-1] + [HumanMessage(user_message)]
        if not questions:
            new_messages.append(("current_question", None))  # Signal no relevant questions found
        else:
            new_messages.extend([
                ("questions", questions),
                ("current_question", questions[0])  # Start with first question
            ])
        # After questions list is built, before return:
        for i, q in enumerate(questions):
            print(f"  [{i+1}] ID={q['question_id']} | Q={q['question'][:80]}...")

        return {
            "messages": new_messages
        }
    
    def analysis_decision_node(self, state: ChartauditState) -> dict:
        """
        LLM decides if the user query requires cross-question analysis
        (aggregating across all questions) or individual per-question answering.
        """
        questions = []
        user_message = None

        for message in state.messages:
            if isinstance(message, tuple) and message[0] == "questions":
                questions = message[1]
            if isinstance(message, HumanMessage):
                user_message = message.content

        # Single question — no decision needed, always individual
        if len(questions) <= 1:
            return {**state.__dict__, "analysis_mode": "individual"}
        
        analysis_decision_prompt = self.system_prompts.get_system_prompt("analysis_decision_prompt.txt")
        decision_prompt = analysis_decision_prompt
        prompt = decision_prompt.format(
            user_question=user_message,
            questions=json.dumps(questions)
        )

        result = self.llm.invoke(prompt)
        content = result.content if hasattr(result, "content") else str(result)

        try:
            parsed = json.loads(content.strip())
            mode = "cross" if parsed.get("requires_cross_analysis", False) else "individual"
        except (json.JSONDecodeError, AttributeError):
            mode = "individual"  # Safe default

        print(f"[ChartauditAgent] Analysis mode decision: {mode}")
        print(f"[analysis_decision_node] Questions found: {len(questions)}")
        print(f"[analysis_decision_node] Question IDs: {[q['question_id'] for q in questions]}")
        print(f"[analysis_decision_node] ✅ Decision: mode='{mode}' | Reason: {parsed.get('reason','')}")
        return {**state.__dict__, "analysis_mode": mode}    
    
    def cross_sql_node(self, state: ChartauditState) -> dict:
        """
        Single LLM call that takes ALL relevant questions and generates
        one unified SQL query covering all of them.
        """

        # At the top:
        print(f"\n{'='*50}")
        print(f"[cross_sql_node] ▶ Cross-question analysis")
        questions = []
        user_message = None

        for message in state.messages:
            if isinstance(message, tuple) and message[0] == "questions":
                questions = message[1]
        for message in reversed(state.messages):
            if isinstance(message, HumanMessage):
                user_message = message.content
                break
            elif isinstance(message, tuple) and message[0] == "user":
                user_message = message[1]
                break
        print(f"[cross_sql_node]   All question IDs: {[q['question_id'] for q in questions]}")
        print(f"[cross_sql_node]   User query: {user_message}...")
        
        cross_sql_prompt_template = self.system_prompts.get_system_prompt("cross_sql_prompt.txt")
        main_prompt = cross_sql_prompt_template.format(
            user_question=user_message,
            survey_question=json.dumps([q["question"] for q in questions]),  # all questions
            survey_question_id=json.dumps([q["question_id"] for q in questions]),
            format_instructions=chartaudit_final_parser.get_format_instructions(),
            example_response=chartaudit_final_example.model_dump_json(),
            chat_history=state.lt_history
        )

        sql_agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            checkpointer=self.memory,
            prompt=main_prompt
        )

        max_attempts = 3
        attempt = 1
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0

        while True:
            try:
                main_result = sql_agent.invoke({"messages": [HumanMessage(content=user_message)]})

                result_content = None
                for msg in reversed(main_result["messages"]):
                    if isinstance(msg, ToolMessage) and msg.name == "json_parse_output":
                        result_content = msg.content
                        break

                if result_content is None:
                    raise ValueError("Could not find json_parse_output in cross_sql_node response")

                parsed_dict = json.loads(result_content)
                result_content = ChartauditFinalResponse(**parsed_dict)
                break

            except Exception as e:
                if attempt >= max_attempts:
                    return {"messages": state.messages + [("error", f"cross_sql_node failed after {max_attempts} attempts: {str(e)}")]}
                sleep_for = min(delay * (backoff_factor ** (attempt - 1)), max_interval)
                jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                time.sleep(max(0.0, sleep_for + jitter))
                attempt += 1

        all_results = []
        for query_info in result_content.queries:
            if query_info.sql_query and query_info.type and query_info.json_data:
                try:
                    results = json.loads(query_info.json_data)
                    all_results.append({
                        "type": query_info.type,
                        "sql": query_info.sql_query,
                        "results": results
                    })
                except json.JSONDecodeError:
                    print(f"Error parsing json_data in cross_sql_node for type {query_info.type}")

        # Represent "all questions" as a single synthetic question entry
        synthetic_question = {
            "question": "Cross-question analysis: " + " | ".join(q["question"] for q in questions),
            "question_id": "cross_" + "_".join(q["question_id"] for q in questions)
        }
        # FIX: Strip old current_question and questions before adding new ones
        base_messages = [msg for msg in state.messages
                        if not (isinstance(msg, tuple) and msg[0] in ("current_question", "questions"))]
        new_messages = base_messages + [
            ("sql_results", {
                "question": synthetic_question,
                "results": all_results,
                "data_analysis": result_content.data_analysis
            }),
            ("current_question", synthetic_question),   # charts_node reads this
            ("questions", [synthetic_question]),         # override so charts_node sees 1 question → no loop
        ]

        # After result_content parsed:
        print(f"[cross_sql_node] ✅ SQL generated | Queries: {len(result_content.queries)} | Types: {[q.type for q in result_content.queries]}")
        print(f"[cross_sql_node]   Synthetic question_id={synthetic_question['question_id']}")
        print(f"{'='*50}\n")        

        return {"messages": new_messages}
    

    def sql_node(self, state: ChartauditState):
        """Node that generates and executes SQL queries only"""
        # Check for already processed questions to prevent duplicates
        processed_questions = set()
        for message in state.messages:
            if isinstance(message, tuple) and message[0] == "sql_results":
                question_id = message[1].get("question", {}).get("question_id")
                if question_id:
                    processed_questions.add(question_id)
        
        current_question = None
        questions = []
        current_idx = -1
        # Get current question and full questions list
        for message in state.messages:
            if isinstance(message, tuple):
                if message[0] == "current_question":
                    current_question = message[1]
                elif message[0] == "questions":
                    questions = message[1]

        if not current_question or not questions:
            return {"messages": state.messages}
        
        # Skip if this question was already processed
        if current_question["question_id"] in processed_questions:
            print(f"Question {current_question['question_id']} already processed, skipping to next")
            
            # Find index and move to next question
            current_idx = next((i for i, q in enumerate(questions) 
                            if q["question_id"] == current_question["question_id"]), -1)
            
            base_messages = [msg for msg in state.messages 
                        if not (isinstance(msg, tuple) and msg[0] == "current_question")]
            
            if current_idx >= 0 and current_idx < len(questions) - 1:
                next_question = questions[current_idx + 1]
                return {"messages": base_messages + [("current_question", next_question)]}
            else:
                return {"messages": base_messages + [("current_question", None)]}
        
        # Find index of current question
        current_idx = next((i for i, q in enumerate(questions) 
                        if q["question_id"] == current_question["question_id"]), -1)
        main_prompt_template = self.admin_prompt_template   
        # Extract user message
        user_message = None
        for message in reversed(state.messages):
            if isinstance(message, tuple) and message[0] == "user":
                user_message = message[1]
                break
            elif isinstance(message, HumanMessage):
                user_message = message.content
                break
        main_prompt = main_prompt_template.format(
            user_question=user_message,
            survey_question=current_question["question"],
            survey_question_id=current_question["question_id"],
            format_instructions=chartaudit_final_parser.get_format_instructions(),
            example_response=chartaudit_final_example.model_dump_json(),
            chat_history=state.lt_history
        )

        sql_agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            checkpointer=self.memory,
            prompt=main_prompt
        )

        max_attempts = 3
        attempt = 1
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0
        
        while True:
            try:
                # Use filtered messages instead of state.messages
                main_result = sql_agent.invoke({"messages" : [HumanMessage(content=user_message)]})

                # Extract the final JSON from the tool message (json_parse_output)
                result_content = None
                for msg in reversed(main_result["messages"]):
                    if isinstance(msg, ToolMessage) and msg.name == "json_parse_output":
                        result_content = msg.content
                        break
                
                if result_content is None:
                    raise ValueError("Could not find json_parse_output tool message in agent response")
                
                
                # Parse the JSON string into ChartauditFinalResponse object
                try:
                    parsed_dict = json.loads(result_content)
                    result_content = ChartauditFinalResponse(**parsed_dict)
                except (json.JSONDecodeError, Exception) as e:
                    print(f"Failed to parse result content: {e}")
                    raise
                
                break
            except Exception as e:
                if attempt >= max_attempts:
                    return {"messages": state.messages + [("error", f"Failed after {max_attempts} attempts: {str(e)}")]}
                sleep_for = min(delay, max_interval)
                jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                sleep_time = max(0.0, sleep_for + jitter)
                print(f"[Backoff] attempt {attempt} failed: {e}. Retrying in {sleep_time:.2f}s")
                time.sleep(sleep_time)
                delay = min(delay * backoff_factor, max_interval)
                attempt += 1

        try:
            all_results = []
            
            for query_info in result_content.queries:
                sql = query_info.sql_query
                data_type = query_info.type
                json_data = query_info.json_data
                
                if sql and data_type and json_data:
                    try:
                        results = json.loads(json_data)
                        all_results.append({
                            "type": data_type,
                            "sql": sql,
                            "results": results
                        })
                    except json.JSONDecodeError:
                        print(f"Error parsing json_data for query type {data_type}")
            
            # Keep all messages except old current_question
            base_messages = [msg for msg in state.messages 
                        if not (isinstance(msg, tuple) and msg[0] == "current_question")]
            
            # Add SQL results
            new_messages = base_messages + [
                ("sql_results", {
                    "question": current_question,
                    "results": all_results,
                    "data_analysis": result_content.data_analysis
                })
            ]
            
            # Move to next question if available
            if current_idx >= 0 and current_idx < len(questions) - 1:
                next_question = questions[current_idx + 1]
                new_messages.append(("current_question", next_question))
            else:
                new_messages.append(("current_question", None))
            
            return {"messages": new_messages}
            
        except Exception as e:
            return {"messages": state.messages + [("error", f"Failed to execute queries: {str(e)}")]}

    async def charts_node(self, state: ChartauditState):
        """
        Generate chart specifications by calling the Chart Agent for each SQL result type
        Makes API calls to Chart Agent to maintain modularity
        """
        print("Entering charts_node to call Chart Agent...")
        
        # 1. Extract current question, SQL results, and data analysis from state
        current_sql_results = []
        current_question = None
        data_analysis = ""
        questions = []
        latest_sql_results_data = None
        
        for message in reversed(state.messages):
            if isinstance(message, tuple):
                if message[0] == "sql_results" and latest_sql_results_data is None:
                    latest_sql_results_data = message[1]
                    current_question = latest_sql_results_data.get("question")
                    current_sql_results.extend(latest_sql_results_data.get("results", []))
                    data_analysis = latest_sql_results_data.get("data_analysis", "")
                elif message[0] == "questions":
                    questions = message[1]
            
            if latest_sql_results_data is not None and questions:
                break

        if not current_sql_results:
            print("No SQL results found, returning current state.")
            return {"messages": state.messages}
        
        # Check if Chart Agent card is loaded - FAIL if not available
        if not self.chart_agent_card:
            error_msg = "[ChartauditAgent] ERROR: Chart Agent card not available!"
            print(error_msg)
            raise Exception(error_msg)
        
        current_idx = next((i for i, q in enumerate(questions) 
                            if q.get("question_id") == current_question.get("question_id")), -1)
        
        total_questions = len(questions)
        if total_questions > 1:
            question_prefix = f"Relevant question {current_idx + 1}: {current_question.get('question', '')}\n\n"
        else:
            question_prefix = f"Relevant question: {current_question.get('question', '')}\n\n"
        
        formatted_data_analysis = data_analysis
        
        # 2. Get user query for context
        user_query = "Based on the data given use it to visualize the data and recommend the possible charts"
        for message in reversed(state.messages):
            if isinstance(message, tuple) and message[0] == "user":
                user_query = message[1]
                break
            elif isinstance(message, HumanMessage):
                user_query = message.content
                break
        
        # 3. Call Chart Agent for each SQL result type
        all_chart_specs = []
        
        for sql_result in current_sql_results:
            print("sql_result at chart audit: ",sql_result,"\n\n")
            data_type = sql_result.get("type")
            results = sql_result.get("results", [])
            
            if not results:
                continue
            
            # Get fields from the data
            fields = []
            if results and isinstance(results[0], dict):
                fields = list(results[0].keys())
            
            # Prepare metadata for Chart Agent
            chart_metadata = {
                "user_id": state.metadata.get("user_id", "unknown_user"),
                "conversation_id": state.metadata.get("conversation_id", "unknown_conversation")
            }
            
            # Prepare payload in the format ChartAgent expects (dict with json_data key)
            chart_agent_payload = {
                "json_data": results,
                "data_limit_exceeded": False
            }

            # Prepare the message for Chart Agent
            message = {
                'role': 'user',
                'parts': [
                    {
                        'kind': 'text',
                        'text': f"{user_query or 'Generate charts for this data'}\n{question_prefix}{LAST_AGENT_SEPARATOR}{json.dumps(chart_agent_payload)}"
                    }
                ],
                'messageId': state.metadata.get("conversation_id", "unknown_conversation"),
            }

            payload = {
                "message": message,
                "metadata": chart_metadata,
            }
            
            print(f"[ChartauditAgent] Calling Chart Agent for data_type: {data_type}")
            print(f"[ChartauditAgent] Payload: {payload}")
            try:
                # Make API call to Chart Agent to maintain modularity
                chart_response = self._call_chart_agent(self.chart_agent_card, payload)
                
                chart_specs_text = None
                
                # Process streaming response
                async for chunk in chart_response:
                    chunk_root: SendStreamingMessageResponse = chunk.root
                    
                    if isinstance(chunk_root, SendStreamingMessageSuccessResponse):
                        result = chunk_root.result
                        
                        # Extract the final artifact (chart specs)
                        if hasattr(result, "kind") and result.kind == "artifact-update":
                            try:
                                part = result.artifact.parts[0]
                                if (
                                    hasattr(part, "root")
                                    and isinstance(part.root, TextPart)
                                    and hasattr(part.root, "text")
                                ):
                                    chart_specs_text = part.root.text
                                    print(f"[ChartauditAgent] Received chart specs from Chart Agent for {data_type}")
                            except (AttributeError, IndexError):
                                print('[ChartauditAgent] Attribute/Index Error while extracting chart specs')
                                continue
                    
                    elif isinstance(chunk_root, JSONRPCErrorResponse):
                        raise Exception(chunk_root.error)
                
                # Parse the chart specs returned by Chart Agent
                if chart_specs_text:
                    try:
                        chart_specs_text = chart_specs_text.replace("```json", "").replace("```", "").strip()
                        chart_specs = json.loads(chart_specs_text)
                        if not isinstance(chart_specs, list):
                            chart_specs = [chart_specs]
                        
                        for chart_spec in chart_specs:
                            chart_spec["data_type"] = data_type
                            if isinstance(chart_spec.get("data"), dict) and "label" in chart_spec["data"]:
                                chart_spec["data"]["label"] = f"{chart_spec['data']['label']} ({data_type.title()})"
                        
                        all_chart_specs.extend(chart_specs)
                        
                    except (json.JSONDecodeError, ValueError) as e:
                        print(f"Failed to parse Chart Agent output for {data_type}. Error: {e}")
                        raise Exception(f"Failed to handle chart generation for {data_type}")
                else:
                    print(f"[ChartauditAgent] No chart specs received from Chart Agent for {data_type}")
                    raise Exception(f"Failed to handle chart generation for {data_type}")
                    
            except Exception as e:
                print(f"Failed to call Chart Agent for {data_type}: {str(e)}")
                raise Exception(f"Failed to handle chart generation for {data_type}")
        
        # 4. Aggregate the complete result for the current finished question
        combined_result = {
            "question": current_question.get("question") if current_question else "Unknown Question",
            "question_id": current_question.get("question_id") if current_question else "N/A",
            "data_analysis": formatted_data_analysis,
            "sql_results": current_sql_results,
            "charts": all_chart_specs
        }
        
        base_messages = [msg for msg in state.messages 
                        if not (isinstance(msg, tuple) and msg[0] in ("sql_results", "current_question"))]

        # Add the complete result for the question just finished
        new_messages = base_messages + [("final_result", combined_result)]
        
        # Determine the next step (which question is next)
        next_question = None
        if current_idx >= 0 and current_idx < len(questions) - 1:
            next_question = questions[current_idx + 1]

        # Add the next question (or None) to signal the graph's continuation or end
        new_messages.append(("current_question", next_question))
        
        return {"messages": new_messages}

    @staticmethod
    def serialize_messages(messages):
        serialized = []
        for msg in messages:
            if isinstance(msg, dict):
                # Handle existing dict format (if used, e.g., for intent)
                serialized.append({"role": msg["role"], "content": msg.get("intent", msg.get("content"))})
            
            elif isinstance(msg, tuple) and len(msg) == 2:
                # Handle custom state tuples: ('key', value)
                key = msg[0]
                value = msg[1]
                
                # Serialize complex structures to JSON strings for memory storage
                if isinstance(value, (list, dict)):
                    content = json.dumps(value)
                elif hasattr(value, 'model_dump_json'):
                    content = value.model_dump_json()
                elif value is None:
                    content = "None"
                else:
                    content = str(value)
                    
                # Use a specific role/type to signal this is an internal state tuple
                serialized.append({"role": "tuple_state", "type": key, "content": content})
            
            elif hasattr(msg, 'type') and hasattr(msg, 'content'):
                # It's a LangChain message object (AIMessage, HumanMessage)
                serialized.append({"role": msg.type, "content": msg.content})
            
            else:
                # Fallback - convert to string
                serialized.append({"role": "unknown", "content": str(msg)})
                
        return serialized

    def _build_graph(self):
        builder = StateGraph(ChartauditState)

        builder.add_node("identify_completeness", self.identify_completeness_node)
        builder.add_node("revise_query", self.revise_query_node, retry=RetryPolicy(max_attempts=3, jitter=True, max_interval=60))
        builder.add_node("relevant_question_picking", self.relevant_question_picking_node)
        builder.add_node("analysis_decision", self.analysis_decision_node)   # NEW
        builder.add_node("cross_sql_node", self.cross_sql_node , retry=RetryPolicy(max_attempts=3, jitter=True, max_interval=60))              # NEW
        builder.add_node("sql_node", self.sql_node, retry=RetryPolicy(max_attempts=3, jitter=True, max_interval=60))
        builder.add_node("charts_node", self.charts_node)

        builder.set_entry_point("identify_completeness")
        builder.add_edge("identify_completeness", "revise_query")
        builder.add_edge("revise_query", "relevant_question_picking")

        # Gate: if no questions found → END, else → decision node
        # Also fix route_after_question_picking for consistency:
        def route_after_question_picking(state: ChartauditState) -> str:
            current_question = "NOT_FOUND"
            for message in state.messages:
                if isinstance(message, tuple) and message[0] == "current_question":
                    current_question = message[1]
            if current_question == "NOT_FOUND" or current_question is None:
                return END
            return "analysis_decision"

        builder.add_conditional_edges("relevant_question_picking", route_after_question_picking)

        # NEW: Route based on analysis mode
        def route_by_analysis_mode(state: ChartauditState) -> str:
            return "cross_sql_node" if state.analysis_mode == "cross" else "sql_node"

        builder.add_conditional_edges("analysis_decision", route_by_analysis_mode)

        # Cross branch: sql → charts → end (synthetic question ensures has_questions returns END)
        builder.add_edge("cross_sql_node", "charts_node")

        # Individual branch: existing loop
        builder.add_edge("sql_node", "charts_node")

        # In _build_graph(), the has_questions used after charts_node:
        def has_questions(state: ChartauditState) -> str:
            current_question = "NOT_FOUND"
            all_cq_entries = []  # collect all for debug
            for message in state.messages:
                if isinstance(message, tuple) and message[0] == "current_question":
                    all_cq_entries.append(message[1])
                    current_question = message[1]
            
            print(f"[has_questions] Entries found={len(all_cq_entries)} | Last={current_question['question_id'] if isinstance(current_question, dict) else current_question}")
            
            if current_question == "NOT_FOUND" or current_question is None:
                print(f"[has_questions] → END")
                return END
            print(f"[has_questions] → sql_node")
            return "sql_node"

        builder.add_conditional_edges("charts_node", has_questions)

        return builder.compile()


if __name__ == "__main__":
    agent = ChartauditAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}', path="/v2/agents/chartaudit",
                     dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)