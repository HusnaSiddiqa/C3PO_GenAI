import os
import re
import sys
import pandas as pd
import json
import boto3
import time, random
from typing import List
import ast
from langchain_core.output_parsers import PydanticOutputParser
from langgraph.errors import GraphRecursionError
from langgraph.types import RetryPolicy
from urllib3 import fields

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
from langchain_aws import BedrockEmbeddings
from core.prompt.PromptStore import PromptStore
from core.util.ConfigLoader import load_env_variables, get_secret
from langgraph.checkpoint.memory import MemorySaver

from agents.pmr.Tools import Tools, hybrid_search, json_parse_output
from agents.nlq.Tools import build_json_parse_tool
from a2a.types import AgentSkill
from pydantic import BaseModel
from dataclasses import dataclass

from traceloop_wrapper.metrics import record_response_time
from time import perf_counter

import asyncio
from collections import defaultdict



class pmrRevisionResponse(BaseModel):
    query: str
    business_rules: list[str]
    fields: list[str]
    example_queries: list[dict[str, str]]


pmr_revision_parser = PydanticOutputParser(pydantic_object=pmrRevisionResponse)
pmr_revision_example = pmrRevisionResponse(query="How many records are in the table?",
                                           business_rules=["Example Business Rules"],
                                           fields=["Schema.Table1"],
                                           example_queries=[{"Q1": "SELECT count(1) from Schema.Table1;"}])


class pmrIntentResponse(BaseModel):
    is_user_input_required: bool
    reason: str


pmr_intent_parser = PydanticOutputParser(pydantic_object=pmrIntentResponse)
pmr_intent_example = pmrIntentResponse(is_user_input_required=False, reason="Query is complete.")


class pmrHybridResponse(BaseModel):
    dict_data: dict
    hybrid_query: str
    user_question: str


pmr_hybrid_parser = PydanticOutputParser(pydantic_object=pmrHybridResponse)
pmr_hybrid_example = pmrHybridResponse(dict_data={"questions": ["Okay. Understood. And so once you do get those results back, how how long to initiate that that treatment. And again we\'re still talking about early stages.", "Oh, goodness. I\'m so sorry to."], "answers": ["[Respondent]: Um, within a couple of weeks for anyone to therapy, I can we can get started on treatment.", "[Respondent]: I think probably maybe you see what I got the V when we tried. Maybe it would have given her more time, but it\'s hard to say."], "respondent_type":["support_staff", "support_staff"], "source":  ["../PMR-ONC/COMPLETE_Transcripts_from_pete/HCP Interview Transcripts/251017 5_20_25 330 PM Nurse Practitioner.docx", "../PMR-ONC/COMPLETE_Transcripts_from_pete/HCP Interview Transcripts/251017 5_30_25 1230 PM Physician Assistant.docx"], "tier": ["nan", "nan"], "medical_profession": ["Nurse Practitioner (NP)", "Physician’s Assistant (PA)"], "primary_medical_specialty": ["Medical Oncology", "Medical Oncology"], "practice_setting": ["Teaching hospital or academic medical center", "Outpatient oncology center or clinic affiliated with a teaching hospital or academic medical center"], "geography_setting": ["Suburban", "Rural"], "identify_as": ["White (Non-Hispanic)", "White (Non-Hispanic)"], "tro_user/non_user": ["", ""], "age": ["nan", "nan"], "health_insurance_coverage": ["nan", "nan"]},
                                     hybrid_query='{"query": {"bool": {"must": [{"term": {"doc_type": "pmr_updated_v2"}}, {"knn": {"pmr_embedding_v2_ingest": {"vector": "{{EMBEDDING_VECTOR}}", "k": 10000}}}] , "filter": [{"term": {"pmr_respondent_type_v2_ingest": "hcp"}}, {"term": {"pmr_medical_profession_v2_ingest": "Physician"}}, {"term": {"pmr_tier_v2_ingest": "1"}}]}}, "_source": ["pmr_question_v2_ingest", "pmr_answer_v2_ingest", "pmr_combined_text_v2_ingest", "pmr_respondent_type_v2_ingest", "pmr_source_v2_ingest", "pmr_tier_v2_ingest", "pmr_medical_profession_v2_ingest", "pmr_primary_medical_specialty_v2_ingest", "pmr_practice_setting_v2_ingest", "pmr_geography_setting_v2_ingest", "pmr_identify_as_v2_ingest", "pmr_tro_user/non_user_v2_ingest", "pmr_age_v2_ingest", "pmr_gender_v2_ingest", "pmr_health_insurance_coverage_v2_ingest"], "size": 100}', user_question='What are the typical insurance or financial barriers patients face when starting Trodelvy in support words?')

class pmrInsightsResponse(BaseModel):
    insights: str


pmr_insights_parser = PydanticOutputParser(pydantic_object=pmrInsightsResponse)
pmr_insights_example = pmrInsightsResponse(insights = '{"summary": "Based on systematic analysis of [X] chunks: PRIMARY SPECIFIC DETAILS (mentioned 3+ times): [detail 1], [detail 2], [detail 3]; SECONDARY SPECIFIC DETAILS (mentioned 1-2 times): [detail A], [detail B], [detail C]; COMPLETE REFERENCE INVENTORY: All specific details found: [comma-separated list using exact respondent terminology]; DETAIL GROUPINGS: - [Category 1]: [detail1, detail2, detail3]; - [Category 2]: [detailA, detailB, detailC]; This inventory provides the complete framework for topic extraction."}')


class pmrTopicExtractorResponse(BaseModel):
    topic: list


pmr_topic_parser = PydanticOutputParser(pydantic_object=pmrTopicExtractorResponse)
pmr_topic_example = pmrTopicExtractorResponse(topic = ["bone pain symptom", "fatigue symptom"])

class pmrTopicStandardizerResponse(BaseModel):
    std_topic_json: list
    


pmr_std_parser = PydanticOutputParser(pydantic_object=pmrTopicStandardizerResponse)
pmr_std_example = pmrTopicStandardizerResponse(std_topic_json = [{"standard_topic": "Nurse Navigator for patient coordination and guidance", "frequency": 1, "original_topics": ["nurse navigator"]}, {"standard_topic": "Dietitian for nutritional support during treatment", "frequency": 1, "original_topics": ["dietitian"]}, {"standard_topic": "Support Groups for emotional and peer assistance", "frequency": 1, "original_topics": ["support groups"]}])



@dataclass
class pmrState:
    messages: list[Any]
    metadata: dict[str, Any]
    lt_history: list = None


class pmrAgent(AgentBase[pmrState]):

    @property
    def name(self) -> str:
        return "pmr_Agent"

    @property
    def description(self) -> str:
        return "Analyzes **primary market research (PMR) interview transcripts** for mTNBC (first-line metastatic triple-negative breast cancer). Handles qualitative insights from in-depth interviews with three respondent types: **HCP Interviews**: Treatment algorithms, treatment timelines and sequencing, Trodelvy perceptions and positioning, prescribing behaviors, barriers to adoption, competitive landscape, unmet clinical needs. **Support Staff Interviews**: Patient education approaches, treatment process explanations, support services and resources, care coordination, administration and monitoring support, challenges in patient care. **Patient Interviews**: Treatment experiences, side effects and symptom management, education and information needs, Trodelvy perceptions, quality of life impacts, decision-making preferences, care team interactions. Retrieves Q&A pairs from chunked interview transcripts in OpenSearch and synthesizes qualitative themes, patterns in attitudes/behaviors/perceptions, and actionable market insights. USE FOR: Qualitative interview analysis, treatment perceptions, patient journey insights, HCP attitudes, support staff practices, therapy positioning, barriers and facilitators, unmet needs, transcript-based research questions. DO NOT use for: Quantitative chart audit surveys, claims data analysis, prescription volumes, SQL queries, geographic trends, market share metrics, structured numeric data."

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

        self.tools = [Tools.json_parse_output, Tools.hybrid_search]

        self.lt_history = None
        self.admin_prompt_template = None
        self.model = None
        self.llm = None
        self.memory = None
        self.load_llm_with_mlflow_prompt()
        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'],
                                        prefix="agent_memory")


        skill = AgentSkill(
            id='retrieve_info',
            name='pmr_Agent',
            description="- Qualitative transcript analysis from HCP, support staff, and patient interviews - Semantic search across interview Q&A pairs stored in OpenSearch - Treatment pathway and timeline extraction from provider and patient perspectives - Trodelvy and competitor therapy perception analysis - Barrier and facilitator identification across the care continuum - Multi-stakeholder insight synthesis (HCP + support staff + patient views) - Patient journey mapping from diagnosis through treatment - Care team dynamics and communication pattern analysis - Unmet needs identification in mTNBC treatment - Thematic analysis of attitudes, behaviors, and experiences - Qualitative evidence extraction for market access and commercial strategy",
            tags=['pmr', "interview transcripts"
                    "HCP interviews", "provider interviews"
                    "patient interviews", "patient perspectives"
                    "support staff"
                    "qualitative insights"
                    "treatment perceptions"
                    "Trodelvy perceptions"
                    "patient journey"
                    "treatment timeline"
                    "side effects experiences"
                    "what do patients say"
                    "what do doctors think"
                    "barriers to treatment"
                    "unmet needs"
                    "mTNBC"]
        )
        self.initialize_graph()
        super().__init__(llm=self.llm, agent_skill=skill)

    def load_llm_with_mlflow_prompt(self):
        try:
            prompt_template = PromptStore(self.name, f"{self.env['WORKSPACE_NAME']}/agents").load_prompt()
            provider = self.env['PROVIDER']
            model = prompt_template.get("model", "")
            model_base_url = prompt_template.get("model_base_url", "")
            print("Base URL:", model_base_url)
            temperature = 0
            print("Temperature:", temperature)

            self.admin_prompt_template = prompt_template.get("prompt", "")

            self.llm = ModelFactory.create_provider(provider=provider, model_name=model,
                                                   base_url=model_base_url,
                                                   api_key=self.model_api_key,
                                                   temperature=float(temperature)).get_llm()

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
        print("Streaming pmr agent...")
        self.memory = MemorySaver()
        start = perf_counter()
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        lt_history = self.memory_store.search(user_name=user_id, agent_name="pmr", conversation_id=conversation_id,
                                                   last_n=10)

        state = pmrState(
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
                                               user_name=user_id, agent_name="pmr", conversation_id=conversation_id)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": f"""Your query seems incomplete and cannot be processed yet. Reason: {message.get("reason")}.\nCould you please clarify or provide the missing information?""",
                        }
                        break
                elif "hybrid_query" in output:
                    message = messages
                    yield {
                        "is_task_complete": False,
                        "require_user_input": False,
                        "content": "Fetched relevant chunks.. Extracting topics Querying", 
                    }
                elif "topic_extractor" in output:
                    final_message = {}
                    processing_finished = False
                    if not messages:
                        print("No relevant topics found")
                    if type(messages[-1]) is AIMessage:
                        final_message = messages[-1].content.strip()
                        processing_finished = True
                    if processing_finished:
                        new_state = output[next(iter(output))]
                        print("final_message",final_message)
                        self.memory_store.save(messages=self.serialize_messages(new_state.get('messages', [])),
                                               user_name=user_id, agent_name="pmr", conversation_id=conversation_id)
                        record_response_time((perf_counter() - start) * 1000)
                        print("final agent response of pmr :",final_message)
                        yield {
                            "is_task_complete": True,
                            "require_user_input": False,
                            "content": final_message,
                        }
                        break
                
                    #for message in reversed(messages):
                    #    if isinstance(message, AIMessage) and hasattr(message,
                    #                                                  "response_metadata") and message.response_metadata.get(
                    #        "finish_reason") == "stop":
                    #        final_message = message.content
                    #        processing_finished = True
                    #        break
                    # print("final_message in stream",final_message)
                    # if processing_finished:
                    #     new_state = output[next(iter(output))]
                    #     self.memory_store.save(messages=self.serialize_messages(new_state.get('messages', [])),
                    #                            user_name=user_id, agent_name="pmr", conversation_id=conversation_id)
                    #     record_response_time((perf_counter() - start) * 1000)
                    #     yield {
                    #         "is_task_complete": True,
                    #         "require_user_input": False,
                    #         "content": final_message,
                    #     }
                    #     break
                else:

                    pass
        except GraphRecursionError:
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": "The agent’s instruction set lacked sufficient context, leading the LLM to generate inconsistent outputs. Please request the Admin to enrich the instruction set with relevant context to ensure accurate outputs.",
            }

    def identify_completeness_node(self, state: pmrState) -> dict:
        print('===========identify_completeness_node=======', state)
        user_message = None
        for role, content in reversed(state.messages):
            if role == "user":
                user_message = content
                break

        completeness_identification_template = self.system_prompts.get_system_prompt(
            "pmr_completeness_identification_template.txt")
        self.load_llm_with_mlflow_prompt()
        completeness_identification_prompt = completeness_identification_template.format(user_message=user_message,
                                                                                         chat_history=state.lt_history,
                                                                                         fields=state.metadata["fields"],
                                                                                         format_instructions=pmr_intent_parser.get_format_instructions(),
                                                                                         example_response=pmr_intent_example.model_dump_json())
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

    def revise_query_node(self, state: pmrState) -> dict:
        print("entered revise_query_node")
        revision_prompt_template = self.system_prompts.get_system_prompt("pmr_prompt_revision_template.txt")
        revision_prompt = revision_prompt_template.format(chat_history=state.lt_history,
                                                          prompt_template=self.admin_prompt_template,
                                                          format_instructions=pmr_revision_parser.get_format_instructions(),
                                                          example_response=pmr_revision_example.model_dump_json())

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
        print("revised_user_message",revised_user_message)
        return revised_user_message

    async def hybrid_query_node(self, state: pmrState) -> dict:
        hybrid_query_message = {"messages": {}}
        revised_message = state.messages
        print("revised_message at hybrid query",revised_message)
        revised_parsed_message = json.loads(str(revised_message))
        user_question = revised_parsed_message.get("query")
        relevant_fields = revised_parsed_message.get("fields")

        print("user_question",user_question)
        final_prompt_template = self.system_prompts.get_system_prompt("pmr_hybrid_query_prompt_template.txt")
        final_prompt = final_prompt_template.format(
            general_instructions=state.metadata['general_instructions'],
            common_business_rules=state.metadata['common_business_rules'],
            data_handling_rules=state.metadata['data_handling_rules'],
            user_question=user_question,
            fields=relevant_fields,
            chat_history=state.lt_history,
            format_instructions=pmr_hybrid_parser.get_format_instructions(),
            example_response=pmr_hybrid_example.model_dump_json())
        print("final_hybrid_query_prompt",final_prompt)
        hybrid_react_agent = create_react_agent(
            model=self.llm,
            tools=[Tools.hybrid_search],
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
                relevant_chunks_result = await hybrid_react_agent.ainvoke({"messages": state.messages})
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

        print('===========hybrid_query_node result=======', relevant_chunks_result)
        hybrid_query_message["messages"]["user_question"] = user_question
        for idx, message in enumerate(reversed(relevant_chunks_result["messages"])):
            if isinstance(message, AIMessage):
                hybrid_query_message["messages"]["summary"] = message.content
                print("summary in hybrid query node: ",hybrid_query_message["messages"]["summary"])
            if isinstance(message, AIMessage) and hasattr(message,
                                                          "response_metadata") and message.response_metadata.get(
                "finish_reason") == "stop":
                orig_idx = len(relevant_chunks_result["messages"]) - 1 - idx
                if orig_idx - 1 >= 0:
                    prev_msg = relevant_chunks_result["messages"][orig_idx - 1]
                    if isinstance(prev_msg, ToolMessage):
                        hybrid_query_message["messages"]["dict_data"] = prev_msg.content
                        hybrid_query_message["messages"]["hybrid_query"] = prev_msg.content
                    else:
                        hybrid_query_message["messages"]["dict_data"] = message.content
                        hybrid_query_message["messages"]["hybrid_query"] = message.content
                else:
                    hybrid_query_message ["messages"]["dict_data"]= message.content
                    hybrid_query_message["messages"]["hybrid_query"] = message.content
                break
        print("hybrid_query_message",hybrid_query_message)    
        return hybrid_query_message

    async def topic_extractor_node(self, state: pmrState):
        hybrid_result_message = state.messages
        standardized_topic_final_result = {}
        match_insights={}
        insights_draft_final=''
        user_question=hybrid_result_message["user_question"]
        print("user_question",user_question)
        relevant_chunks_updated = json.loads(hybrid_result_message["dict_data"])
        relevant_chunks=relevant_chunks_updated["text_results"]
        print("dict_data",relevant_chunks)
        hybrid_query=relevant_chunks_updated["hybrid_query"]
        print("hybrid_query",hybrid_query)
        summary=hybrid_result_message["summary"]
        print("summary",summary)

        relevant_chunks_df = pd.DataFrame(relevant_chunks)
        print("relevant chunks before insight draft:",relevant_chunks)

        insights_draft_template = self.system_prompts.get_system_prompt("pmr_insight_draft.txt")
        insights_draft_final_prompt = insights_draft_template.format(
            general_instructions=state.metadata['general_instructions'],
            common_business_rules=state.metadata['common_business_rules'],
            data_handling_rules=state.metadata['data_handling_rules'],
            relevant_chunks = relevant_chunks,
            user_question = user_question,
            format_instructions=pmr_insights_parser.get_format_instructions(),
            example_response=pmr_insights_example.model_dump_json())

        insight_draft_result = self.llm.invoke(insights_draft_final_prompt)
        print("insight_draft_result",insight_draft_result)
        #insight_draft_result.content += summary
        #print("insight_draft_result updated: ",insight_draft_result)
        insights_draft_updated=insight_draft_result
        if isinstance(insight_draft_result, AIMessage):
            try:
                
                # First, trying to parse the whole content as JSON
                parsed_whole = None
                try:
                    parsed_whole = json.loads(insight_draft_result.content.strip())
                except json.JSONDecodeError:
                    parsed_whole = None

                if isinstance(parsed_whole, dict) and parsed_whole:
                    # Looking for either "insights" or "insights_draft"
                    if "insights" in parsed_whole:
                        insights_value = parsed_whole["insights"]
                    elif "insights_draft" in parsed_whole:
                        insights_value = parsed_whole["insights_draft"]
                    else:
                        insights_value = None

                    if isinstance(insights_value, str):
                        # Trying to parse inner string as JSON to extract "summary" if present
                        inner = None
                        try:
                            inner = json.loads(insights_value)
                        except json.JSONDecodeError:
                            inner = None
                        if isinstance(inner, dict) and "summary" in inner:
                            insights_draft_updated = inner["summary"]
                        else:
                            insights_draft_updated = insights_value
                else:
                    # Regex fallback: capture {"insights": "..."} or {"insights_draft": "..."} with escaped quotes/newlines
                    # Value pattern matches a JSON string: "(?:[^"\\]|\\.)*"
                    obj_match = re.search(
                        r'\{\s*"(insights|insights_draft)"\s*:\s*("(?:(?:[^"\\\\]|\\\\.)*)")\s*\}',
                        insight_draft_result.content,
                        flags=re.DOTALL | re.IGNORECASE,
                    )
                    if obj_match:
                        try:
                            # Building minimal JSON from the matched object and parse it
                            minimal_obj = '{' + f'"{obj_match.group(1)}": {obj_match.group(2)}' + '}'
                            minimal_parsed = json.loads(minimal_obj)
                            key = next(iter(minimal_parsed))
                            insights_value = minimal_parsed.get(key, "")
                            if isinstance(insights_value, str):
                                # Trying to parse inner JSON for "summary"; else keeping as-is
                                try:
                                    inner = json.loads(insights_value)
                                    if isinstance(inner, dict) and "summary" in inner:
                                        insights_draft_updated = inner["summary"]
                                    else:
                                        insights_draft_updated = insights_value
                                except json.JSONDecodeError:
                                    insights_draft_updated = insights_value
                        except Exception:
                            print("Error while extracting insights with regex")
                    else:
                        # As a last resort, finding any JSON object containing the keys and trying to parse it
                        any_obj = re.search(r'\{[\s\S]*?\}', insight_draft_result.content, flags=re.DOTALL)
                        if any_obj:
                            try:
                                any_parsed = json.loads(any_obj.group(0))
                                if isinstance(any_parsed, dict):
                                    if "insights" in any_parsed and isinstance(any_parsed["insights"], str):
                                        insights_draft_updated = any_parsed["insights"]
                                    elif "insights_draft" in any_parsed and isinstance(any_parsed["insights_draft"], str):
                                        insights_draft_updated = any_parsed["insights_draft"]
                            except json.JSONDecodeError:
                                print("Error while converting insights from fallback object")
            except:
                print("Json error")
        else:
            print("The output of insights_draft is not AI message")

        print('===========insights_draft result=======',insights_draft_updated)

        relevant_chunks_df["combined_text"] = relevant_chunks_df["questions"].astype(str) + '\n' + relevant_chunks_df["answers"].astype(str)
        print("\nprinting user_question",user_question)

        results=[]
        topic_picking_prompt_template = self.system_prompts.get_system_prompt("pmr_topic_selection_template.txt")
        indices = list(relevant_chunks_df.index)
        BATCH_SIZE = 20  # Process 20 chunks at a time
        INTER_BATCH_DELAY = 0.1  # 100ms delay between batches for fairness
        _semaphore = asyncio.Semaphore(5) 

        async def extract_topic_for_chunk(ind):
            """Extracting topic for a single chunk with rate limiting"""
            # Acquire global semaphore only (batching handles per-user limiting)
            async with _semaphore:
                topics_draft_final_prompt = topic_picking_prompt_template.format(
                    general_instructions=state.metadata['general_instructions'],
                    common_business_rules=state.metadata['common_business_rules'],
                    data_handling_rules=state.metadata['data_handling_rules'],
                    Respondent_Text = relevant_chunks_df.loc[ind, "combined_text"],
                    user_question = user_question,
                    summary = insight_draft_result,
                    format_instructions=pmr_topic_parser.get_format_instructions(),
                    example_response=pmr_topic_example.model_dump_json())

            # Using async invoke if available, otherwise running sync in thread pool
                try:
                    if hasattr(self.llm, 'ainvoke'):
                        result = await self.llm.ainvoke(topics_draft_final_prompt)
                    else:
                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(None, self.llm.invoke, topics_draft_final_prompt)
                except Exception as e:
                    print(f"Error processing chunk {ind}: {e}")
                    return (ind, None)  # Return tuple with index

                print ("result of topic of text",result)
                print ("type of result",type(result))

                if isinstance(result, AIMessage):
                    content_insights = result.content
                    updated_result = {}

                    try:
                        updated_result = json.loads(content_insights)
                    except json.JSONDecodeError:
                        # Trying to find an object with one of the expected keys mapping to a list of dicts
                        keyed_match = re.search(
                            r'\{\s*"(topics?|topic_of_text)"\s*:\s*(\[\s*\{[\s\S]*?\}\s*(?:,\s*\{[\s\S]*?\}\s*)*\s*\])[\s\S]*?\}',
                            content_insights,
                            flags=re.DOTALL | re.IGNORECASE,
                        )
                        if keyed_match:
                            try:
                                key = keyed_match.group(1)
                                array_text = keyed_match.group(2)
                                array_val = json.loads(array_text)
                                updated_result = {key: array_val}
                            except json.JSONDecodeError:
                                print("Error while parsing keyed list-of-dicts JSON segment")
                        else:
                            # Fallback: look for a bare JSON array of dicts
                            array_match = re.search(
                                r'\[\s*\{[\s\S]*?\}\s*(?:,\s*\{[\s\S]*?\}\s*)*\s*\]',
                                content_insights,
                                flags=re.DOTALL,
                            )
                            if array_match:
                                try:
                                    array_val = json.loads(array_match.group(0))
                                    # Wrap to a default key to keep downstream contract
                                    updated_result = {"topic_of_text": array_val}
                                except json.JSONDecodeError:
                                    print("Error while extracting Topic from content")
                else:
                    print("result is not an valid")

                if updated_result and updated_result[next(iter(updated_result))]:
                    return (ind, updated_result[next(iter(updated_result))])  # Return tuple with index
                return (ind, None)  # Return tuple with index

        # Process chunks in batches for better fairness and resource management
        all_results = []
        total_batches = (len(indices) + BATCH_SIZE - 1) // BATCH_SIZE

        for batch_num in range(total_batches):
            batch_start = batch_num * BATCH_SIZE
            batch_end = min(batch_start + BATCH_SIZE, len(indices))
            batch_indices = indices[batch_start:batch_end]

            print(f"Processing batch {batch_num + 1}/{total_batches} ({len(batch_indices)} chunks)")

            # Launch batch tasks
            batch_tasks = [extract_topic_for_chunk(ind) for ind in batch_indices]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

            all_results.extend(batch_results)

            # Add delay between batches (except after last batch) for fairness
            if batch_num < total_batches - 1:
                await asyncio.sleep(INTER_BATCH_DELAY)

        # Process results and place them at correct dataframe locations
        for result_tuple in all_results:
            if isinstance(result_tuple, Exception):
                print(f"Exception in result: {result_tuple}")
                continue

            if result_tuple is None or len(result_tuple) != 2:
                continue

            ind, topic_result = result_tuple

            if topic_result is not None:
                relevant_chunks_df.loc[ind, 'Topic_of_Text'] = str(topic_result)
                results.append(topic_result)

        print('===========topic_extractor_node result=======', results)
        std_topic_final_result={}
        content = {}
        if (results != []):
            standardized_topic_prompt_template = self.system_prompts.get_system_prompt("pmr_topic_standardization_template.txt")
            
            standardized_topic_final_prompt = standardized_topic_prompt_template.format(
                general_instructions=state.metadata['general_instructions'],
                common_business_rules=state.metadata['common_business_rules'],
                data_handling_rules=state.metadata['data_handling_rules'],
                topics_list = results,
                user_question = user_question,
                summary = insight_draft_result,
                format_instructions=pmr_std_parser.get_format_instructions(),
                example_response=pmr_std_example.model_dump_json())
            
            standardized_topic_result = self.llm.invoke(standardized_topic_final_prompt)
            
            print('===========standardized_topic result=======', standardized_topic_result)
            if isinstance(standardized_topic_result, AIMessage):
                try:
                    # parsing the entire content as JSON
                    parsed = None
                    try:
                        parsed = json.loads(standardized_topic_result.content.strip())
                    except json.JSONDecodeError:
                        parsed = None

                    if isinstance(parsed, dict) and "std_topic_json" in parsed and isinstance(parsed["std_topic_json"], list):
                        content = parsed
                    else:
                        # Targeted extraction of just the std_topic_json array
                        array_match = re.search(
                            r'"std_topic_json"\s*:\s*(\[\s*\{[\s\S]*?\}\s*(?:,\s*\{[\s\S]*?\}\s*)*\s*\])',
                            standardized_topic_result.content,
                            flags=re.DOTALL | re.IGNORECASE,
                        )
                        if array_match:
                            try:
                                std_array = json.loads(array_match.group(1))
                                content = {"std_topic_json": std_array}
                            except json.JSONDecodeError:
                                print("Failed to parse std_topic_json array")
                        else:
                            # Minimal fallback: first JSON object in content, if it contains std_topic_json
                            any_obj = re.search(r'\{[\s\S]*?\}', standardized_topic_result.content, flags=re.DOTALL)
                            if any_obj:
                                try:
                                    tentative = json.loads(any_obj.group(0))
                                    if isinstance(tentative, dict) and "std_topic_json" in tentative:
                                        content = tentative
                                    else:
                                        print("No std_topic_json in tentative object")
                                except json.JSONDecodeError:
                                    print("No JSON found in content")
                except:
                    print("Error fetching Json data")
            else:
                raise ValueError("No AI message found")
            
            print("standardized result output",content)
            extracted_content= [
                {
                    'standard_topic': inner_dict['standard_topic'],
                    'frequency': inner_dict['frequency']
                }
                for inner_dict in content["std_topic_json"]
            ]
            print("extracted_content",extracted_content)
            json_data = json.dumps(json.dumps(extracted_content))
            print("json_data",json_data)
            standard_topic_output=content
            for index in relevant_chunks_df.index:
                standard_topic_mapping=[]
                print(index)
                if pd.notna(relevant_chunks_df.loc[index,'Topic_of_Text']):
                    for topic in ast.literal_eval(relevant_chunks_df.loc[index,'Topic_of_Text']):
                        for key in standard_topic_output['std_topic_json']:
                            print(topic)
                            if topic['label'] in key['original_topics']:
                                standard_topic_mapping.append(key['standard_topic'])
                    relevant_chunks_df.loc[index,"Standardized"]=str(standard_topic_mapping)
                    print("\n\n")
            print("Standardizing topics completed")

            topic_sources = defaultdict(set)
            for index in relevant_chunks_df.index:
                val = relevant_chunks_df.loc[index, 'Standardized']
                if val != '' and pd.notna(val):
                    try:
                        topics = ast.literal_eval(val)
                        topics = [t for t in topics if t and t != 'not_related']
                        for topic in topics:
                            topic_sources[topic].add(relevant_chunks_df.loc[index, 'source'])
                    except: continue

            df = pd.Series({t: len(s) for t, s in topic_sources.items()})

            json_data=[]
            for key,value in df.to_dict().items():
                sample={}
                sample['standard_topic']=key
                sample['frequency']=value
                json_data.append(sample)
            
            #print("relvant_chunk_df: ",relevant_chunks_df.head())
            if (type(insights_draft_updated) is AIMessage):
                print("insights_draft_updated[-1].content.strip()",insights_draft_updated.content.strip())
                insights_draft_final = (insights_draft_updated.content.strip())
            print("insights_draft_final",insights_draft_final)
            insights_draft_final+=summary
            
            summary_prompt_template = self.system_prompts.get_system_prompt("pmr_final_summary_prompt_template.txt")
            
            summary_final_prompt = summary_prompt_template.format(
                analysis_data = str(json_data).replace("'", '"'),
                complete_data = relevant_chunks_df.to_json(orient='index'),
                user_question = user_question)
                #format_instructions=pmr_std_parser.get_format_instructions(),
                #example_response=pmr_std_example.model_dump_json())
            
            summary_result = self.llm.invoke(summary_final_prompt)

            summary_result_upd=""

            print("summary result raw: ",summary_result)
            if (type(summary_result) is AIMessage):
                summary_result_upd = summary_result.content
            cleaned_text_insight = re.sub(r'^\{.*?"insights(_draft)?"\s*:\s*"|\"\}$', '', summary_result_upd).replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').strip()
            standardized_topic_final_result["data_analysis"] = cleaned_text_insight
            standardized_topic_final_result["json_data"] = str(json_data).replace("'", '"')
            standardized_topic_final_result["sql_query"] = str(hybrid_query)
            #result = Tools.json_parse_output.run(standardized_topic_final_result["data_analysis"])
            if (standardized_topic_final_result):
                new_messages = {"messages": [AIMessage(content = str(standardized_topic_final_result))]}
            
            print("final_output",new_messages)
            return new_messages
        else:
            print("No topics found to standardize")
        
        return new_messages
        

    @staticmethod
    def serialize_messages(messages):
        return [
            {"role": msg["role"], "content": msg.get("intent", msg.get("content"))}
            if isinstance(msg, dict)
            else {"role": msg.type, "content": msg.content}
            for msg in messages
        ]

    def _build_graph(self):

        builder = StateGraph(pmrState)
        builder.add_node("revise_query", self.revise_query_node, retry=RetryPolicy(
            max_attempts=3,
            jitter=True,
            max_interval=60
        ))
        builder.add_node("identify_completeness", self.identify_completeness_node)
        builder.add_node("hybrid_query", self.hybrid_query_node, retry=RetryPolicy(
            max_attempts=3,
            jitter=True,
            max_interval=60
        ))
        builder.add_node("topic_extractor", self.topic_extractor_node, retry=RetryPolicy(
            max_attempts=3,
            jitter=True,
            max_interval=60
        ))

        builder.set_entry_point("identify_completeness")
        builder.add_edge("identify_completeness", "revise_query")
        builder.add_edge("revise_query", "hybrid_query")
        builder.add_edge("hybrid_query", "topic_extractor")

        return builder.compile()


if __name__ == "__main__":
    agent = pmrAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}', path="/v2/agents/pmr",
                     dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)
