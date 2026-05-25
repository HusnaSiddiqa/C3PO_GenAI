import os
import sys
import json
import asyncio
import re
import boto3
import uuid
import pandas as pd
from typing import List, Any
from dataclasses import dataclass
from collections.abc import AsyncIterator

from langgraph.graph import StateGraph
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel
from langgraph.prebuilt import create_react_agent

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from core.model_provider.factory import ModelFactory
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore
from core.prompt.SystemPrompt import SystemPrompt
from core.prompt.PromptStore import PromptStore
from core.util.ConfigLoader import load_env_variables, get_secret
from a2a.types import AgentSkill
from agents.rag.Tools import Tools, chunk_text, format_image_content, format_document_content, clean_and_parse_json
from utils.llm_util import ainvoke_text


@dataclass
class RAGState:
    messages: list[Any]
    metadata: dict[str, Any]
    lt_history: list = None
    retrieved_docs: list = None
    transformed_chunks: list = None
    # Removed generated_file_url since frontend handles it


class RAGAgent(AgentBase[RAGState]):

    @property
    def name(self) -> str:
        return "RAG_Agent"

    @property
    def description(self) -> str:
        return "Retrieves information from OpenSearch using hybrid search."

    def __init__(self):
        print("\n[DEBUG] --- Initializing RAG Agent ---")
        self.env = load_env_variables()

        self.os_host = self.env.get('OPENSEARCH_HOST_URL_PMR', 'NOT_SET')
        self.os_region = self.env.get('OPENSEARCH_REGION', 'us-west-2')
        self.bedrock_client = boto3.client("bedrock-runtime", region_name=self.os_region)

        self.os_index_name = None
        self.embedding_model_id = None

        secret_name = self.env['SECRET_NAME']
        self.model_api_key = get_secret(secret_name)

        self.system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")
        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'], prefix="agent_memory")

        self.model = None
        self.llm = None

        self.raw_prompt_blob = None

        self.retrieval_template = ""
        self.transformation_template = ""
        self.summarization_template = ""

        self.run_rerank = False
        self.run_transform = False

        self.load_llm_with_mlflow_prompt()

        skill = AgentSkill(
            id='rag_retrieval',
            name='RAG_Agent',
            description="Retrieves documents from OpenSearch.",
            tags=['RAG', 'OpenSearch', 'Search']
        )

        self.initialize_graph()
        super().__init__(llm=self.llm, agent_skill=skill)
        print("[DEBUG] RAG Agent Initialization Complete.\n")

    def _parse_prompt_blob(self, blob: str):
        if not blob:
            raise ValueError("[CRITICAL] Prompt Blob is empty. Cannot initialize RAG Agent.")

        blob = blob.replace("\r\n", "\n")

        kb_pattern = r'<KB_SEARCH>(.*?)</KB_SEARCH>'
        rerank_pattern = r'<RERANK>(.*?)</RERANK>'
        trans_pattern = r'<TRANSFORM>(.*?)</TRANSFORM>'
        summ_pattern = r'<SUMMARY>(.*?)</SUMMARY>'

        kb_match = re.search(kb_pattern, blob, re.DOTALL | re.IGNORECASE)
        rerank_match = re.search(rerank_pattern, blob, re.DOTALL | re.IGNORECASE)
        trans_match = re.search(trans_pattern, blob, re.DOTALL | re.IGNORECASE)
        summ_match = re.search(summ_pattern, blob, re.DOTALL | re.IGNORECASE)

        if not kb_match or not kb_match.group(1).strip():
            raise ValueError("[CRITICAL ERROR] Mandatory Tag <KB_SEARCH> is missing or empty in Prompt Store.")

        if not summ_match or not summ_match.group(1).strip():
            raise ValueError("[CRITICAL ERROR] Mandatory Tag <SUMMARY> is missing or empty in Prompt Store.")

        self.retrieval_template = kb_match.group(1).strip()
        self.summarization_template = summ_match.group(1).strip()

        if rerank_match:
            self.run_rerank = True
            print("[DEBUG] <RERANK> tag found. Reranking Node ENABLED.")
        else:
            self.run_rerank = False
            print("[DEBUG] <RERANK> tag missing. Reranking Node DISABLED.")

        if trans_match and trans_match.group(1).strip():
            self.transformation_template = trans_match.group(1).strip()
            self.run_transform = True
            print("[DEBUG] <TRANSFORM> tag found. Transformation Node ENABLED.")
        else:
            self.transformation_template = None
            self.run_transform = False
            print("[DEBUG] <TRANSFORM> tag missing/empty. Transformation Node DISABLED.")

    def load_llm_with_mlflow_prompt(self, agent_name: str = "RAG_Agent"):
        print('===========agent_name========', agent_name)
        try:
            print("[DEBUG] --- Loading Configuration from PromptStore ---")
            prompt_store = PromptStore(agent_name, f"{self.env['WORKSPACE_NAME']}/agents")
            prompt_config = prompt_store.load_prompt()
            provider = self.env.get('PROVIDER')
            model = prompt_config.get("model")
            base_url = prompt_config.get("model_base_url")

            embedding_model = prompt_config.get("embedding_model")
            print(f"[DEBUG] Embedding Model from config: {embedding_model}")

            temperature = prompt_config.get("temperature")

            self.raw_prompt_blob = prompt_config.get("prompt", "")

            self._parse_prompt_blob(self.raw_prompt_blob)

            self.os_index_name = prompt_config.get("knowledge_store_metadata.indices")
            print(f"[DEBUG] Index name : {self.os_index_name}")

            self.embedding_model_id = embedding_model

            if self.llm is None or self.model != model:
                self.model = model
                print(f'===========reassigning model======== {model}')
                self.llm = ModelFactory.create_provider(
                    provider=provider,
                    model_name=model,
                    base_url=base_url,
                    api_key=self.model_api_key,
                    temperature=temperature
                ).get_llm()

            print("Loaded config from PromptStore.")

        except Exception as e:
            print(f"NOTE: Could not load 'RAG_Agent' config from PromptStore ({e}).")
            if "CRITICAL ERROR" in str(e):
                raise e

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("\n[DEBUG] --- Stream Started ---")

        sub_agent = metadata.get("sub-agent", "RAG_Agent")
        self.load_llm_with_mlflow_prompt(sub_agent)

        self.memory = MemorySaver()
        user_id = metadata.get('user_id', 'default_user')
        conversation_id = metadata.get('conversation_id', 'default_conv')

        lt_history = self.memory_store.search(user_name=user_id, agent_name="RAG", conversation_id=conversation_id,
                                              last_n=10)

        state = RAGState(messages=[HumanMessage(content=query)], metadata=metadata, lt_history=lt_history)
        config = {'configurable': {'thread_id': thread_id}}

        async for output in self._agent.astream(state, config):
            for node_name, node_content in output.items():
                if node_name == "retrieve_documents":
                    docs = node_content.get("retrieved_docs", [])
                    yield {"is_task_complete": False, "require_user_input": False,
                           "content": f"Retrieved {len(docs)} documents.",
                           "debug_data": {"node": "retrieve", "doc_count": len(docs)}}

                elif node_name == "rerank_documents":
                    if not self.run_rerank:
                        yield {"is_task_complete": False, "require_user_input": False,
                               "content": "Skipped Re-ranking.", "debug_data": {"node": "rerank", "status": "skipped"}}
                    else:
                        yield {"is_task_complete": False, "require_user_input": False,
                               "content": "Re-ranked documents.", "debug_data": {"node": "rerank"}}

                elif node_name == "transform_documents":
                    if not self.run_transform:
                        yield {"is_task_complete": False, "require_user_input": False,
                               "content": "Skipped Transformation.",
                               "debug_data": {"node": "transform", "status": "skipped"}}
                    else:
                        chunks_count = len(node_content.get("transformed_chunks", []))
                        yield {"is_task_complete": False, "require_user_input": False,
                               "content": f"Transformed content (Batch Mode).",
                               "debug_data": {"node": "transform", "chunks": chunks_count}}

                elif node_name == "summarize_response":
                    yield {"is_task_complete": True, "require_user_input": False,
                           "content": node_content.get("messages")[-1].content, "debug_data": {}}

    async def retrieve_documents_node(self, state: RAGState) -> dict:
        print("\n[DEBUG] --- Node: Retrieve Documents ---")
        user_query = state.messages[-1].content

        mapping_info = Tools.get_index_mapping(self.os_index_name)
        schema_str = json.dumps(mapping_info, indent=2)

        vector_instructions = f"""
        IMPORTANT: Vector Embedding Injection Strategy
        1. **Use the placeholder "EMBEDDING_VECTOR"** for any vector field value.
        2. The system will automatically replace "EMBEDDING_VECTOR" with the actual embedding vector.
        3. **Use the correct vector field name**: {schema_str}
        """

        history_str = ""
        if state.lt_history:
            history_str = "\n".join([f"{msg.type}: {msg.content}" for msg in state.lt_history])

        user_query_str = state.messages[-1].content
        if isinstance(user_query_str, list):
            user_query_str = " ".join([item.get('text', '') for item in user_query_str if item.get('type') == 'text'])

        formatted_system_prompt = self.retrieval_template \
            .replace("{user_question}", str(user_query_str)) \
            .replace("{fields}", str(schema_str)) \
            .replace("{general_instructions}", str(vector_instructions)) \
            .replace("{chat_history}", str(history_str)) \
            .replace("{common_business_rules}", "") \
            .replace("{data_handling_rules}", "") \
            .replace("{format_instructions}", "Return valid JSON only.") \
            .replace("{example_response}", "")

        opensearch_tool = Tools.create_opensearch_tool(
            index_name=self.os_index_name,
            embedding_model_id=self.embedding_model_id,
            region=self.os_region
        )

        retrieval_agent = create_react_agent(
            model=self.llm,
            tools=[opensearch_tool],
            prompt=formatted_system_prompt
        )

        agent_inputs = {"messages": [HumanMessage(content=user_query)]}
        retrieved_docs = []

        try:
            result = await retrieval_agent.ainvoke(agent_inputs)
            messages = result.get("messages", [])
            for msg in reversed(messages):
                if msg.type == "tool" and msg.name == "execute_opensearch_query":
                    try:
                        content = msg.content
                        tool_output = json.loads(content) if isinstance(content, str) else content
                        if isinstance(tool_output, dict) and "text_results" in tool_output:
                            retrieved_docs = tool_output["text_results"]
                            break
                    except Exception as e:
                        print(f"[WARN] Failed to parse tool output: {e}")
        except Exception as e:
            print(f"[ERROR] Retrieval agent failed: {e}")

        return {"messages": state.messages, "retrieved_docs": retrieved_docs}

    def _rerank_documents_batch(self, query: str, documents: list, model_id: str = None) -> list:
        if not documents:
            return []
        try:
            max_doc_length = int(self.env.get('RERANK_MAX_DOC_LENGTH', 4000))
            overlap = int(self.env.get('RERANK_OVERLAP', 500))
            chunk_candidates = []
            for doc_idx, doc in enumerate(documents):
                title = doc.get('title', 'Untitled')
                try:
                    text_content = json.dumps(doc, default=str, ensure_ascii=False)
                except Exception:
                    text_content = str(doc)
                full_text = f"Title: {title}\n\nContent:\n{text_content}"
                text_chunks = chunk_text(full_text, max_length=max_doc_length, overlap=overlap)
                if not text_chunks and full_text.strip(): text_chunks = [full_text[:4000]]
                for chunk_idx, chunk_segment in enumerate(text_chunks):
                    if not chunk_segment.strip(): continue
                    context_header = f"[Document: {title} | Part {chunk_idx + 1} of {len(text_chunks)}]\n"
                    final_chunk_text = context_header + chunk_segment
                    candidate = {
                        "text": final_chunk_text, "original_full_doc": doc, "chunk_index": chunk_idx,
                        "total_chunks": len(text_chunks), "is_first_chunk": (chunk_idx == 0)
                    }
                    chunk_candidates.append(candidate)
            doc_texts = [c['text'] for c in chunk_candidates]
            if not doc_texts: return []
            request_body = {"query": query, "documents": doc_texts, "top_n": len(doc_texts), "api_version": 2}
            rerank_model = model_id or "cohere.rerank-v3-5:0"
            response = self.bedrock_client.invoke_model(modelId=rerank_model, body=json.dumps(request_body))
            response_body = json.loads(response['body'].read())
            results = response_body.get('results', [])
            ranked_chunks = []
            for result in results:
                index = result['index']
                score = result['relevance_score']
                if index < len(chunk_candidates):
                    candidate = chunk_candidates[index]
                    ranked_chunks.append({"doc": candidate, "score": score, "index": index})
            return ranked_chunks
        except Exception as e:
            print(f"[ERROR] Re-ranking failed: {e}. Returning original docs.")
            fallback_docs = []
            for i, doc in enumerate(documents):
                fallback_docs.append({"doc": {"text": json.dumps(doc, default=str), "title": doc.get('title', ''),
                                              "original_full_doc": doc}, "score": 1.0, "index": i})
            return fallback_docs

    def rerank_documents_node(self, state: RAGState, rerank_model_id: str = None) -> dict:
        print("\n[DEBUG] --- Node: Rerank Documents ---")
        if not self.run_rerank:
            return {"retrieved_docs": state.retrieved_docs}

        docs = state.retrieved_docs or []
        user_query = state.messages[0].content if state.messages else ""
        if not docs:
            return {"retrieved_docs": []}

        doc_sources = [doc.get("_source", doc) for doc in docs]
        ranked_results = self._rerank_documents_batch(user_query, doc_sources, model_id=rerank_model_id)

        clean_docs = []
        for result in ranked_results:
            source = result["doc"]
            clean_doc = {"text": source.get("text", ""), "title": source.get("original_full_doc", {}).get("title", ""),
                         "relevance_score": result["score"]}
            clean_docs.append(clean_doc)
        return {"retrieved_docs": clean_docs}

    async def transform_documents_node(self, state: RAGState) -> dict:
        print("\n[DEBUG] --- Node: Transform Documents ---")
        if not self.run_transform:
            return {"transformed_chunks": []}

        chunks = state.retrieved_docs or []
        if not chunks:
            return {"transformed_chunks": []}

        formatted_chunks, image_blocks = format_document_content(chunks)
        user_query = state.messages[0].content if state.messages else "General analysis"

        master_template = self.transformation_template
        formatted_prompt = master_template \
            .replace("{user_query}", str(user_query)) \
            .replace("{aggregated_chunks}", str(formatted_chunks))

        message_content = [{"type": "text", "text": formatted_prompt}]
        if image_blocks: message_content.extend(image_blocks)

        try:
            # We expect the LLM to return a complex JSON object (stages 1, 2, 3)
            raw_content = await ainvoke_text(
                self.llm,
                [HumanMessage(content=message_content)],
                config={"configurable": {"temperature": 0}}
            )

            # Robust parsing
            parsed_json = clean_and_parse_json(raw_content)

            # Store the analysis and the raw source text for the next nodes
            final_package = {"analysis": parsed_json, "source_context": formatted_chunks}
            return {"transformed_chunks": [final_package]}

        except Exception as e:
            print(f"[ERROR] Transformation node failed: {e}")
            return {"transformed_chunks": []}

    async def summarize_response_node(self, state: RAGState) -> dict:
        """
        Summarizes the answer and prepares the JSON payload for the Chart Agent/Frontend.
        Sanitizes data by flattening lists into strings to prevent crashes.
        """
        print("\n[DEBUG] --- Node: Summarize Response ---")
        user_query = state.messages[0].content if state.messages else "No query"
        context_str = ""

        # This will hold the List of Objects for the Chart Agent/Frontend
        extracted_data_for_chart = []

        if state.transformed_chunks:
            data_package = state.transformed_chunks[0]
            raw_analysis = data_package.get("analysis", {})
            raw_source_content = data_package.get("source_context", "")

            # --- DATA EXTRACTION & SANITIZATION LOGIC ---

            # Case A: 3-Stage Prompt (Stage 3 Groups)
            if isinstance(raw_analysis, dict) and "stage_3_groups" in raw_analysis:
                print("[DEBUG] Extracting Chart Data from 'stage_3_groups'...")
                groups = raw_analysis.get("stage_3_groups", {})
                for group_name, details in groups.items():
                    if isinstance(details, dict):
                        # Create a clean object for the chart agent
                        chart_item = {}
                        # Copy contents but FLATTEN LISTS to prevent unhashable errors
                        for k, v in details.items():
                            if isinstance(v, list):
                                chart_item[k] = ", ".join(map(str, v))
                            elif isinstance(v, dict):
                                chart_item[k] = str(v)
                            else:
                                chart_item[k] = v

                        chart_item["group_name"] = group_name
                        extracted_data_for_chart.append(chart_item)

            # Case B: Standard List
            elif isinstance(raw_analysis, list):
                # Flatten lists inside items
                for item in raw_analysis:
                    if isinstance(item, dict):
                        clean = {}
                        for k, v in item.items():
                            if isinstance(v, list):
                                clean[k] = ", ".join(map(str, v))
                            else:
                                clean[k] = v
                        extracted_data_for_chart.append(clean)

            # Case C: Generic Dict (scan for lists)
            elif isinstance(raw_analysis, dict):
                # Try to find a list value
                found = False
                for k, v in raw_analysis.items():
                    if isinstance(v, list) and len(v) > 0:
                        # Flatten the list found
                        for item in v:
                            if isinstance(item, dict):
                                clean = {}
                                for sub_k, sub_v in item.items():
                                    if isinstance(sub_v, list):
                                        clean[sub_k] = ", ".join(map(str, sub_v))
                                    else:
                                        clean[sub_k] = sub_v
                                extracted_data_for_chart.append(clean)
                        found = True
                        break

                if not found:
                    # Single dict case: Flatten it and wrap in list
                    clean_obj = {}
                    for k, v in raw_analysis.items():
                        if isinstance(v, (list, dict)):
                            clean_obj[k] = str(v)
                        else:
                            clean_obj[k] = v
                    extracted_data_for_chart = [clean_obj]

            # --- END EXTRACTION LOGIC ---

            # Prepare Context for the LLM Summary
            context_str += "### ANALYST INSIGHTS:\n" + json.dumps(raw_analysis, indent=2, ensure_ascii=False)
            context_str += "\n\n### RAW EVIDENCE:\n" + raw_source_content
        else:
            raw_text, _ = format_document_content(state.retrieved_docs or [])
            context_str += "### DOCUMENTS FOUND:\n" + raw_text

        formatted_prompt = self.summarization_template \
            .replace("{user_query}", user_query) \
            .replace("{user_question}", user_query) \
            .replace("{context}", context_str)

        message_content = [{"type": "text", "text": formatted_prompt}]

        try:
            final_report_text = await ainvoke_text(self.llm, [HumanMessage(content=message_content)])

            # FINAL OUTPUT CONSTRUCTION
            # json_data: Must be the LIST we extracted above.
            final_answer = json.dumps({
                "data_analysis": final_report_text.strip(),
                "json_data": extracted_data_for_chart,
                "file_url": None
            })
        except Exception as e:
            print(f"[ERROR] Summarization failed: {e}")
            final_answer = json.dumps({"data_analysis": "Error generating report.", "json_data": []})

        return {"messages": state.messages + [AIMessage(content=final_answer)]}

    def _build_graph(self):
        builder = StateGraph(RAGState)
        builder.add_node("retrieve_documents", self.retrieve_documents_node)
        builder.add_node("rerank_documents", self.rerank_documents_node)
        builder.add_node("transform_documents", self.transform_documents_node)
        builder.add_node("summarize_response", self.summarize_response_node)

        builder.set_entry_point("retrieve_documents")
        builder.add_edge("retrieve_documents", "rerank_documents")
        builder.add_edge("rerank_documents", "transform_documents")
        builder.add_edge("transform_documents", "summarize_response")
        builder.add_edge("summarize_response", "__end__")
        return builder.compile()


if __name__ == "__main__":
    agent = RAGAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}',
                     path="/v2/agents/rag", dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"),
                     dynatrace_auth_token=dynatrace_auth_token)