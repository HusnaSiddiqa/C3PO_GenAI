import os
import re
import sys
import json
import time, random
from json import JSONDecodeError
from typing import List

from langchain_core.output_parsers import PydanticOutputParser
from langgraph.errors import GraphRecursionError
from langgraph.types import RetryPolicy

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from collections.abc import AsyncIterator
from typing import Any
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from core.model_provider.factory import ModelFactory
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore

from langgraph.graph import StateGraph
from core.prompt.SystemPrompt import SystemPrompt
from core.prompt.PromptStore import PromptStore
from core.util.ConfigLoader import load_env_variables, get_secret
from langgraph.checkpoint.memory import MemorySaver

from agents.nlq.Tools import build_generate_sql_tool, build_json_parse_tool
from a2a.types import AgentSkill
from pydantic import BaseModel
from dataclasses import dataclass

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


@dataclass
class NLQState:
    messages: list[Any]
    metadata: dict[str, Any]
    lt_history: list = None


class NLQ_DSOAgent(AgentBase[NLQState]):

    @property
    def name(self) -> str:
        return "NLQ_DSO_Agent"

    @property
    def description(self) -> str:
        return """An intelligent agent that processes oncology-focused natural language queries for two distinct data domains:

    1. DSO (Digital Sales Operations) - Non-personal promotional data:
    Generates compliant SQL and executes it against a Databricks SQL warehouse to return structured insights on HCP reach, engagement, and social interactions across various digital channels, tactics, sources, and vendors. Analyzes promotional campaign performance, target HCP interactions, and digital marketing effectiveness.

    2. DS&G (Data Strategy & Governance) - Healthcare claims analytics:
    Analyzes breast cancer treatment claims data from prescription (RX) and medical (MX) sources, providing insights into:
    • RX claims: Pharmacy-dispensed medications with NDC code tracking and fill date analysis
    • MX claims: Physician-administered treatments with HCPCS code mapping and service date tracking
    • NSP analysis: Capture ratio calculations measuring rx and mx claims data completeness against national sales data
    • Projection factors: R12M-based adjustment factors for market forecasting and estimation
    • Analysis across TRODELVY, ENHERTU, CDK inhibitors, chemotherapy, hormonal therapy, targeted therapy, and ADC drugs
    • Quantity conversions: Milligram-level standardization for oral and IV drug comparisons
    • Comparative performance: Drug-to-drug analysis across RX and MX claim types

    This agent is self-sufficient and does not rely on prior outputs or chat history to fulfill user queries. It applies strict domain-specific business rules, ensuring accurate and compliant SQL generation for both promotional analytics and claims data analysis."""
    def __init__(self):
        req_env_keys = ['PROVIDER', 'SECRET_NAME', 'DATABRICKS_SERVER_HOSTNAME', 'DATABRICKS_HOST',
                        'DATABRICKS_HTTP_PATH', 'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME', 'AGENT_BASE_URL',
                        'AGENT_BASE_PORT']

        self.env = load_env_variables()

        missing_keys = [key for key in req_env_keys if key not in self.env]
        if missing_keys:
            raise KeyError(f"Missing required environment variable(s): {', '.join(missing_keys)}")

        secret_name = self.env['SECRET_NAME']
        self.json_limit = int(self.env.get('NLQ_JSON_LIMIT', 100))
        self.model_api_key = get_secret(secret_name)

        self.system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")

        self.tools = [build_generate_sql_tool(), build_json_parse_tool()]
        self.lt_history = None
        self.admin_prompt_template = None
        self.model = None
        self.llm = None
        self.memory = None
        self.load_llm_with_mlflow_prompt()
        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'],
                                        prefix="agent_memory")

        skill = AgentSkill(
            id='convert_to_sql',
            name='NLQ_DSO_Agent',
            description="""Handles structured data queries related to non-personal promotional data in oncology, specifically focusing on HCP reach and engagement through various channels, tactics, sources, and vendors. It analyzes the performance of digital strategies, including social media platforms and website interactions, to assess the reach of target HCPs. The agent leverages schema metadata, business logic, and conversation context to generate and execute SQL queries that provide insights into HCP engagement, social interactions, and promotional tactics, ensuring accurate, compliant, and actionable outputs. This agent operates independently without relying on prior outputs or chat history.Additionally, it analyzes breast cancer treatment rx_mx_claims data providing insights into:
1. DSO (Digital Sales Operations) - Non-personal promotional data in oncology:
   • HCP reach and engagement through various channels, tactics, sources, and vendors
   • Digital strategy performance including social media platforms and website interactions
   • Target HCP reach analysis and promotional tactics effectiveness
   • HCP engagement metrics and social interactions

2. DS&G (Data Strategy & Governance) - Healthcare rx_mx_claims analytics:
   • Prescription (RX) rx_mx_claims analysis: pharmacy-dispensed medications, fill dates, NDC codes
   • Medical (MX) rx_mx_claims analysis: physician-administered treatments, service dates, HCPCS codes
   • NSP analysis: capture ratios, projection factors, adjustment factors
   • Drug utilization patterns across breast cancer treatments (TRODELVY, ENHERTU, CDK inhibitors, chemotherapy, hormonal therapy, targeted therapy, ADC drugs)
   • batch-based cycle analysis
   • capture ratio calculations
   • Forecasting adjustment factors via projection factor generation 
   • Comparative drug performance across RX and MX claim types

The agent leverages schema metadata, business logic, and conversation context to generate and execute SQL queries, ensuring accurate, compliant, and actionable outputs. This agent operates independently without relying on prior outputs or chat history.""",
            tags=[
        # DSO Tags (Original - HCP/Digital Marketing/Engagement)
        'NLQ_DSO', 
        'DSO',
        'HCP_reach',
        'HCP_engagement',
        'digital_channels',
        'promotional_tactics',
        'marketing_sources',
        'target_HCP_list',
        'digital_engagement_metrics',
        'marketing_vendors',
        'social_media_performance',
        'website_interactions',
        'paid_search',
        'paid_social',
        'email_campaigns',
        'display_advertising',
        
        # DS&G Tags (rx_mx_claims Analytics - NEW/UPDATED)
        'DSG',
        'Data_Strategy_Governance',
        'healthcare_rx_mx_claims_analytics',
        
        # Claim Types
        'RX_rx_mx_claims',
        'MX_rx_mx_claims',
        'prescription_rx_mx_claims',
        'medical_rx_mx_claims',
        
        # NSP Analysis (Specific to rx_mx_claims)
        'NSP_analysis',
        'capture_ratio',
        'projection_factor',
        'adjustment_factor',
        'market_capture_ratio_analysis',
        
        # rx_mx_claims-Specific Identifiers
        'NDC_codes',
        'HCPCS_codes',
        'mx_clam_id',
        'pt_cycle_id',
        'batch_analysis',
        
        # Drug Categories (rx_mx_claims Context)
        'breast_cancer_treatments',
        'TRODELVY_rx_mx_claims',
        'ENHERTU_rx_mx_claims',
        'CDK_inhibitors_rx_mx_claims',
        'chemotherapy_rx_mx_claims',
        'hormonal_therapy_rx_mx_claims',
        'targeted_therapy_rx_mx_claims',
        'ADC_drugs_rx_mx_claims',
        'oral_drugs_rx_mx_claims',
        'IV_drugs_rx_mx_claims',
        'rx_mx_rx_mx_claims_trend_analysis',
        'quantity_to_mg_conversion',
        'dual_code_mapping',
        'HCPCS_NDC_mapping',
        'rx_mx_claims_vs_NSP_sales',
        
    ]
        )
        self.initialize_graph()
        super().__init__(llm=self.llm, agent_skill=skill)
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

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("Streaming NLQ agent...")
        self.memory = MemorySaver()
        start = perf_counter()
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        lt_history = self.memory_store.search(user_name=user_id, agent_name="NLQ_DSO_Agent", conversation_id=conversation_id,
                                                   last_n=10)

        state = NLQState(
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
                    try:
                        message = json.loads(messages)
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
                                               user_name=user_id, agent_name="NLQ_DSO_Agent", conversation_id=conversation_id)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": f"""Your query seems incomplete and cannot be processed yet. Reason: {message.get("reason")}.\nCould you please clarify or provide the missing information?""",
                        }
                        break
                elif "main_agent" in output:
                    final_message = {}
                    processing_finished = False
                    reversed_messages = list(reversed(messages))
                    for idx, message in enumerate(reversed_messages):
                        if isinstance(message, AIMessage) and hasattr(message,
                                                                      "response_metadata") and message.response_metadata.get(
                            "finish_reason") in ["stop", "length"]:
                            try:
                                parsed = json.loads(message.content) if message.content != "" else {}
                                final_sql_query = parsed.get("sql_query", None)
                                final_data_analysis = parsed.get("data_analysis", None)
                                final_json_data = None
                                max_limit_breached = False
                                if idx + 1 < len(messages):
                                    prev_msg = reversed_messages[idx + 1]
                                    if isinstance(prev_msg, ToolMessage):
                                        payload = json.loads(prev_msg.content)
                                        final_json_data = json.loads(payload.get("json_data"))
                                        if len(final_json_data) > self.json_limit:
                                            max_limit_breached = True
                                final_message = str(json.dumps({
                                    "json_data": final_json_data,
                                    "data_analysis": final_data_analysis,
                                    "sql_query": final_sql_query,
                                    "proceed_with_llm": not max_limit_breached
                                }))
                            except json.JSONDecodeError:
                                print('============Falling back to AI Message==========')
                                final_message = message.content
                            processing_finished = True
                            break

                    if processing_finished:
                        new_state = output[next(iter(output))]
                        self.memory_store.save(messages=self.serialize_messages(new_state.get('messages', [])),
                                               user_name=user_id, agent_name="NLQ_DSO_Agent", conversation_id=conversation_id)
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

    def identify_completeness_node(self, state: NLQState) -> dict:
        print('===========identify_completeness_node=======', state)
        user_message = None
        for role, content in reversed(state.messages):
            if role == "user":
                user_message = content
                break

        completeness_identification_template = self.system_prompts.get_system_prompt(
            "nlq_dso_completeness_identification_template.txt")
        self.load_llm_with_mlflow_prompt()
        completeness_identification_prompt = completeness_identification_template.format(user_message=user_message,
                                                                                         chat_history=state.lt_history,
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

    def revise_query_node(self, state: NLQState) -> dict:
        revision_prompt_template = self.system_prompts.get_system_prompt("nlq_dso_prompt_revision_template.txt")
        revision_prompt = revision_prompt_template.format(chat_history=state.lt_history,
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

    def main_agent_node(self, state: NLQState):
        revised_message = state.messages
        revised_parsed_message = json.loads(str(revised_message))
        final_prompt_template = self.system_prompts.get_system_prompt("nlq_dso_final_prompt_template.txt")
        filtered_fields = self.filter_fields_by_selected_tables(all_fields=state.metadata['fields'],
                                                                selected_tables=revised_parsed_message.get(
                                                                    "schema_tables"))
        final_prompt = final_prompt_template.format(
            general_instructions=state.metadata['general_instructions'],
            common_business_rules=state.metadata['common_business_rules'],
            data_handling_rules=state.metadata['data_handling_rules'],
            fields=filtered_fields,
            chat_history=state.lt_history,
            format_instructions=nlq_final_parser.get_format_instructions(),
            example_response=nlq_final_example.model_dump_json())

        main_agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            checkpointer=self.memory,
            prompt=final_prompt
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

    @staticmethod
    def serialize_messages(messages):
        return [
            {"role": msg["role"], "content": msg.get("intent", msg.get("content"))}
            if isinstance(msg, dict)
            else {"role": msg.type, "content": msg.content}
            for msg in messages
        ]

    def _build_graph(self):

        builder = StateGraph(NLQState)
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
    print("🚀 Starting NLQ_DSO Agent server...")
    agent = NLQ_DSOAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}', path="/v2/agents/nlq_dso",
                     dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)
