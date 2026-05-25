import os
import sys
import boto3
import json
import re
from collections.abc import AsyncIterator
from typing import Any, Dict
from typing import List
import time, random


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from langgraph.graph import StateGraph

from langgraph.checkpoint.memory import MemorySaver

from langgraph.prebuilt import create_react_agent
from langgraph.errors import GraphRecursionError
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.messages import AIMessage, ToolMessage, BaseMessage ,HumanMessage

from core.prompt.SystemPrompt import SystemPrompt

from langchain_aws import BedrockEmbeddings

from langgraph.types import RetryPolicy

from agents.nlq.Tools import build_generate_sql_tool, build_json_parse_tool

from core.agent.Agent import AgentBase

from core.model_provider.factory import ModelFactory

from core.agent.ConversationState import ConversationState

from core.memory.memory_store import MemoryStore

from core.util.ConfigLoader import load_env_variables, get_secret

from core.prompt.PromptStore import PromptStore

from utils.constants import Region_NAME, EMBEDDING_MODEL

from a2a.types import AgentSkill
from pydantic import BaseModel
from traceloop_wrapper.metrics import record_response_time

from time import perf_counter

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
    json_data: str
    data_analysis: str
    sql_query: str


nlq_final_parser = PydanticOutputParser(pydantic_object=NLQFinalResponse)
nlq_final_example = NLQFinalResponse(json_data='[{"month": "2022-12"}]', data_analysis="Example Analysis",
                                     sql_query="SELECT count(*) FROM Schema.Table1")


class ONC_driver_analysisAgent(AgentBase[ConversationState]):
    @property
    def name(self) -> str:
        return "ONC_driver_analysis_Agent"

    @property
    def description(self) -> str:
        return "An agent that performs comprehensive analysis on given data by identifying key factors influencing changes or significant deviations or outliers of a given data. It automatically determines the scope of the analysis based on user query and executes comparisons across time periods (e.g., recent vs. previous) or categories. The agent provides insights into factors driving growth or decline, can also pinpoint values that fall outside typical ranges or exhibit unusual pattern in drug sales, and report these findings accordingly."
    def __init__(self):
        self.env = load_env_variables()
        req_env_keys = [
            'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME', 'SECRET_NAME',
            'DATABRICKS_SERVER_HOSTNAME'
        ]
        missing_keys = [key for key in req_env_keys if key not in self.env]
        if missing_keys:
            raise KeyError(f"Missing required Databricks environment variable(s): {', '.join(missing_keys)}")

        secret_name = self.env['SECRET_NAME']
        self.model_api_key = get_secret(secret_name)

        self.tools = [build_generate_sql_tool(), build_json_parse_tool()]
        self.system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")
        self.final_prompt = None
        self.memory = None
        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'], prefix="agent_memory")
        self.lt_history = None
        self.admin_prompt_template = None
        self.llm = None
        self._chat_model = None
        self.load_llm_with_mlflow_prompt()

        skill = AgentSkill(
            id='onc_driver_analysis',
            name=self.name,
            description=(
                "Use this agent to analyze what's driving changes in performance or pinpoint the outliers in performance across different dimensions."
                "This agent should ONLY be used for explicit driver analysis queries that ask about causation, factors, or reasons behind changes and ONLY be used for explicit outlier analysis queries that ask about outliers, significant/sharp deviations, abnormal patterns, or unexpected values."
                "Trigger keywords: 'driving', 'drivers', 'what is causing', 'what caused', 'factors behind', 'reasons for','which category types are driving','Outliers for performance','Where are many outliers','Outlier analysis for [metric] in [time_period]','Which [dimension] show significant deviation in [metrics]','Significant deviation/sharp deviation in the metrics','outside the ranges','significantly higher' or similar words. 'Unusually high/low [anything]','Which [time_period] showed unusual [metric]','Sharp increase/decrease', 'Abnormal patterns', 'Unexpected values'."
                "DO NOT use for questions about specific individual entities - only for category-based analysis or (e.g., 'which individual accounts had outliers') - only for aggregated or grouped analysis."
                "It automatically determines the analysis scope, performs time-period comparisons, and provides insights into performance drivers or outliers."
            ),
            tags=[
                'driver analysis',
                'causation analysis', 
                'performance drivers',
                'factor identification',
                'category_type analysis',
                'dimensional drivers',
                'outlier analysis',
                'Outlier Detection', 
                'Deviation Analysis',
                'Unusual Patterns',
                'Anomaly Detection',
            ]
        )
        super().__init__(llm=self._chat_model, agent_skill=skill)

    def load_llm_with_mlflow_prompt(self):
        try:
            prompt_template = PromptStore(self.name, f"{self.env['WORKSPACE_NAME']}/agents").load_prompt()
            provider = self.env['PROVIDER']
            model = prompt_template.get("model", "")
            model_base_url = prompt_template.get("model_base_url", "")
            temperature = prompt_template.get("temperature", "0")
            self.admin_prompt_template = prompt_template.get("prompt", "")

            self.llm = ModelFactory.create_provider(provider=provider, model_name=model,
                                                    base_url=model_base_url,
                                                    api_key=self.model_api_key,
                                                    temperature=float(temperature)).get_llm()
        except ValueError:
            pass

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
    
    @staticmethod
    def serialize_messages(messages: list[BaseMessage]):
        return [{"role": msg.type, "content": msg.content} for msg in messages]

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("Streaming onc driver agent...")
        self.memory = MemorySaver()
        start = perf_counter()
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        self.lt_history = self.memory_store.search(user_name=user_id, agent_name="ONC_driver_analysis", conversation_id=conversation_id,
                                                   last_n=10)
        self.initialize_graph()

        state = ConversationState(
            messages=[("user", query)],
            metadata=metadata
        )
        config = {'configurable': {'thread_id': thread_id}}
        try:
            async for output in self._agent.astream(state, config):
                print('===========output=======', output)
                messages = output[next(iter(output))]['messages']

                if "revise_query" in output:
                    message = json.loads(messages)
                    yield {
                        "is_task_complete": False,
                        "require_user_input": False,
                        "content": f"""A context-aware revision of your query has been produced:\nRephrased Query: {message.get("query")}\nSelected Data Sources: {message.get("selected_data_sources")}\nBusiness Rules: {message.get("business_rules")}\nTables Selected: {message.get("schema_tables")}\nExample Queries: {message.get("example_queries")}""",
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
                                               user_name=user_id, agent_name="ONC_driver_analysis", conversation_id=conversation_id)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": f"""Your query seems incomplete and cannot be processed yet. Reason: {message.get("reason")}.\nCould you please clarify or provide the missing information?""",
                        }
                        break
                elif "main_agent" in output:
                    final_message = {}
                    processing_finished = False
                    for message in reversed(messages):
                        if isinstance(message, AIMessage) and hasattr(message,
                                                                      "response_metadata") and message.response_metadata.get(
                            "finish_reason") == "stop":
                            final_message = message.content
                            processing_finished = True
                            break

                    if processing_finished:
                        new_state = output[next(iter(output))]
                        self.memory_store.save(messages=self.serialize_messages(new_state.get('messages', [])),
                                               user_name=user_id, agent_name="ONC_driver_analysis", conversation_id=conversation_id)
                        record_response_time((perf_counter() - start) * 1000)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": final_message,
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

    def identify_completeness_node(self, state: ConversationState) -> dict:
        user_message = None
        for role, content in reversed(state.messages):
            if role == "user":
                user_message = content
                break

        completeness_identification_template = self.system_prompts.get_system_prompt(
            "nlq_completeness_identification_template.txt")
        self.load_llm_with_mlflow_prompt()
        completeness_identification_prompt = completeness_identification_template.format(user_message=user_message,
                                                                                         chat_history=self.lt_history,
                                                                                         fields=state.metadata[
                                                                                             "fields"],
                                                                                         format_instructions=nlq_intent_parser.get_format_instructions(),
                                                                                         example_response=nlq_intent_example.model_dump_json())

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

    def revise_query_node(self, state: ConversationState) -> dict:
        revision_prompt_template = self.system_prompts.get_system_prompt("nlq_prompt_revision_template.txt")
        revision_prompt = revision_prompt_template.format(chat_history=self.lt_history,
                                                          prompt_template=self.admin_prompt_template,
                                                          format_instructions=nlq_revision_parser.get_format_instructions(),
                                                          example_response=nlq_revision_example.model_dump_json())

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
        revised_user_message = state.messages[0].content
        for idx, message in enumerate(reversed(result["messages"])):
            if isinstance(message, AIMessage) and hasattr(message,
                                                          "response_metadata") and message.response_metadata.get(
                "finish_reason") == "stop":
                orig_idx = len(result["messages"]) - 1 - idx
                if orig_idx - 1 >= 0:
                    prev_msg = result["messages"][orig_idx - 1]
                    if isinstance(prev_msg, ToolMessage):
                        revised_user_message = {"messages": prev_msg.content}
                    else:
                        revised_user_message = {"messages": message.content}
                else:
                    revised_user_message = {"messages": message.content}
                break
        return revised_user_message

    def main_agent_node(self, state: ConversationState):
        revised_message = state.messages
        revised_parsed_message = json.loads(str(revised_message))
        final_prompt_template = self.system_prompts.get_system_prompt("ONC_driver_analysis_template.txt")
        filtered_fields = self.filter_fields_by_selected_tables(all_fields=state.metadata['fields'],
                                                                selected_tables=revised_parsed_message.get(
                                                                    "schema_tables"))
        self.final_prompt = final_prompt_template.format(
            general_instructions=state.metadata['general_instructions'],
            common_business_rules=state.metadata['common_business_rules'],
            data_handling_rules=state.metadata['data_handling_rules'],
            fields=filtered_fields,
            chat_history=self.lt_history,
            format_instructions=nlq_final_parser.get_format_instructions(),
            example_response=nlq_final_example.model_dump_json())

        main_agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            checkpointer=self.memory,
            prompt=self.final_prompt
        )

        max_attempts = 3
        attempt = 1
        delay = 0.5
        jitter_ratio = 0.3
        max_interval = 60.0
        backoff_factor = 2.0
        while True:
            try:
                result = main_agent.invoke({"messages": state.messages})
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

        return result

    def _build_graph(self):

        builder = StateGraph(ConversationState)
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

        builder.set_entry_point("identify_completeness")
        builder.add_edge("identify_completeness", "revise_query")
        builder.add_edge("revise_query", "main_agent")

        return builder.compile()


if __name__ == "__main__":
    print("🚀 Starting ONC_driver_analysis Agent server...")
    try:
        agent = ONC_driver_analysisAgent()
        base_url = os.getenv("AGENT_BASE_URL")
        agent_port = os.getenv("AGENT_BASE_PORT")
        dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
        agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}',
                         path="/v2/agents/onc_driver_analysis", dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)
    except Exception as e:
        print(f"ERROR: Failed to start agent server. {e}")
        sys.exit(1)
