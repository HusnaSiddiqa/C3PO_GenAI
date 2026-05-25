import os
import json
import re
import ast
import boto3
import asyncio
import random
import sys
from typing import Any, List, Optional, Tuple
from opensearchpy import OpenSearch, RequestsHttpConnection
from opensearchpy.exceptions import RequestError
from requests_aws4auth import AWS4Auth
from langchain_core.tools import tool
from langchain_aws import BedrockEmbeddings

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from core.util.ConfigLoader import load_env_variables
from core.prompt.PromptStore import PromptStore  # Import PromptStore


ENV = load_env_variables()

OPENSEARCH_HOST_URL = ENV.get("OPENSEARCH_HOST_URL_PMR")
OPENSEARCH_REGION = ENV.get("OPENSEARCH_REGION", "us-west-2")
WORKSPACE_NAME = ENV.get("WORKSPACE_NAME", "default")

def _get_tool_config():
    """
    Loads the Index Name and Embedding Model ID from the RAG_Agent PromptStore configuration.
    Falls back to Environment Variables if PromptStore lookup fails or keys are missing.

    Returns:
        tuple: (index_name, embedding_model_id)
    """

    try:
        prompt_store = PromptStore("RAG_Agent", f"{WORKSPACE_NAME}/agents")
        config = prompt_store.load_prompt()

        if config.get("embedding_model"):
            embedding_model_id = config.get("embedding_model")
            print(f"Using embedding model in tools.py: {embedding_model_id}")

        index_name = config.get("knowledge_store_metadata.indices")
        print(f"Index name in tools.py: {index_name}")

    except Exception as e:
        print(f"[WARN] Tools.py: Failed to load config from PromptStore ({e}). Using ENV fallbacks.")

    return index_name, embedding_model_id


class RetrieveChunks:
    """Creates embedding for the user query and finds relevant chunks from OpenSearch."""

    def __init__(self, embedding_model: BedrockEmbeddings):
        self.embedding_model = embedding_model

    def get_opensearch_client(self):
        """Create a fresh OpenSearch client each time"""
        return _create_opensearch_client()

    async def query_embedding(self, user_question: str):
        """Creates embedding for the inputted text"""
        try:
            max_attempts = 3
            delay = 0.5
            jitter_ratio = 0.3
            max_interval = 60.0
            backoff_factor = 2.0

            for attempt in range(1, max_attempts + 1):
                try:
                    return await self.embedding_model.aembed_query(user_question)
                except Exception as e:
                    if attempt == max_attempts:
                        raise

                    sleep_for = min(delay, max_interval)
                    jitter = sleep_for * random.uniform(-jitter_ratio, jitter_ratio)
                    sleep_time = max(0.0, sleep_for + jitter)
                    print(f"[Backoff] attempt {attempt} failed: {e}. Retrying in {sleep_time:.2f}s")

                    await asyncio.sleep(sleep_time)
                    delay = min(delay * backoff_factor, max_interval)

        except Exception as e:
            print(f"Error creating embedding for the user question: {e}")
            return None


def _create_opensearch_client():
    """Helper to create OpenSearch client"""
    try:
        service = 'es'
        session = boto3.Session(region_name=OPENSEARCH_REGION)
        credentials = session.get_credentials()
        awsauth = AWS4Auth(credentials.access_key, credentials.secret_key,
                           OPENSEARCH_REGION, service,
                           session_token=credentials.token)

        use_ssl = True
        verify_certs = True

        if not OPENSEARCH_HOST_URL:
            print("[ERROR] OPENSEARCH_HOST_URL is not set.")
            return None

        if "localhost" in OPENSEARCH_HOST_URL or "127.0.0.1" in OPENSEARCH_HOST_URL:
            verify_certs = False
            if not OPENSEARCH_HOST_URL.startswith("https://"):
                use_ssl = False
        elif OPENSEARCH_HOST_URL.startswith("http://"):
            use_ssl = False
            verify_certs = False

        return OpenSearch(
            hosts=[OPENSEARCH_HOST_URL],
            http_auth=awsauth,
            use_ssl=use_ssl,
            verify_certs=verify_certs,
            connection_class=RequestsHttpConnection,
            timeout=30
        )
    except Exception as e:
        print(f"Error creating OpenSearch client: {e}")
        return None


def get_knn_vector_fields(mapping: dict) -> list:
    """
    Extract all knn_vector field names from an OpenSearch mapping.
    """
    vector_fields = []

    def _extract_fields(obj: dict, prefix: str = ""):
        if isinstance(obj, dict):
            if obj.get("type") == "knn_vector":
                vector_fields.append(prefix.rstrip("."))
            elif "properties" in obj:
                for field_name, field_def in obj["properties"].items():
                    new_prefix = f"{prefix}{field_name}."
                    _extract_fields(field_def, new_prefix)

    _extract_fields(mapping)
    return vector_fields


def get_index_mapping(index_name: str = None) -> dict:
    """
    Fetch the mapping (schema) of the OpenSearch index.
    Uses the provided index_name if available, otherwise falls back to config.
    """
    # Load config dynamically if index_name not provided
    if not index_name:
        index_name, _ = _get_tool_config()

    try:
        print(f"[DEBUG] Fetching mapping for index: {index_name}")
        client = _create_opensearch_client()
        if not client:
            return {"mappings": {}, "vector_fields": []}

        response = client.indices.get_mapping(index=index_name)
        if index_name in response:
            mappings = response[index_name].get("mappings", {})
            vector_fields = get_knn_vector_fields(mappings)
            print(f"[DEBUG] Found {len(vector_fields)} knn_vector fields: {vector_fields}")
            return {"mappings": mappings, "vector_fields": vector_fields}
        return {"mappings": response, "vector_fields": []}

    except Exception as e:
        print(f"[WARN] Failed to fetch index mapping: {e}")
        return {"mappings": {}, "vector_fields": []}


async def _execute_opensearch_query_impl(hybrid_query: str, user_question: str, index_name: str, embedding_model_id: str) -> dict:
    """
    Internal implementation for retrieving relevant text using OpenSearch query.
    """
    print(f"[DEBUG] Executing Tool | Index: {index_name} | Model: {embedding_model_id}")

    result = {}
    hybrid_query_obj = hybrid_query


    embedding_model = BedrockEmbeddings(
        client=boto3.client("bedrock-runtime", region_name=OPENSEARCH_REGION),
        model_id=embedding_model_id
    )

    retriever = RetrieveChunks(embedding_model)

    print("[DEBUG] User question:", user_question)
    print("[DEBUG] Query received from LLM:", str(hybrid_query_obj)[:300] + "...")

    question_embedding = await retriever.query_embedding(user_question)

    if isinstance(hybrid_query_obj, str):
        try:
            hybrid_query_obj = json.loads(hybrid_query_obj)
        except json.JSONDecodeError:
            try:
                hybrid_query_obj = clean_and_parse_json(hybrid_query_obj)
            except Exception:
                print(f"[WARN] Could not parse hybrid_query as JSON: {hybrid_query_obj}. Using fallback.")
                hybrid_query_obj = None

    hybrid_query_obj, found = inject_embedding_into_body(hybrid_query_obj, question_embedding)

    if found:
        print(f"[DEBUG] ✓ Successfully injected vector embedding using '{PLACEHOLDER}' placeholder")
    else:
        print(f"[WARN] No '{PLACEHOLDER}' placeholder found in query. Attempting to merge KNN into existing query.")

        knn_clause = {"knn": {"embedding": {"vector": question_embedding, "k": 10}}}

        if isinstance(hybrid_query_obj, dict) and "query" in hybrid_query_obj:
            query_part = hybrid_query_obj["query"]
            if "bool" in query_part:
                bool_part = query_part["bool"]
                if "should" in bool_part:
                    if isinstance(bool_part["should"], list):
                        bool_part["should"].append(knn_clause)
                    else:
                        bool_part["should"] = [bool_part["should"], knn_clause]
                elif "must" in bool_part:
                    if isinstance(bool_part["must"], list):
                        bool_part["must"].append(knn_clause)
                    else:
                        bool_part["must"] = [bool_part["must"], knn_clause]
                else:
                    bool_part["should"] = [knn_clause]
            else:
                original_query = hybrid_query_obj["query"]
                hybrid_query_obj["query"] = {
                    "bool": {
                        "should": [
                            original_query,
                            knn_clause
                        ]
                    }
                }
        else:
            print("[WARN] Query structure unrecognized. Constructing default KNN query.")
            hybrid_query_obj = {
                "query": {
                    "bool": {
                        "should": [
                            {"match": {"text": user_question}},
                            {"knn": {"embedding": {"vector": question_embedding, "k": 10}}}
                        ]
                    }
                }
            }

    print("Final query to OpenSearch:", json.dumps(hybrid_query_obj)[:200] + "...")

    open_search_client = retriever.get_opensearch_client()
    if not open_search_client:
        return {"error": "Failed to connect to OpenSearch"}

    try:
        response = open_search_client.search(
            index=index_name,
            body=hybrid_query_obj
        )
        total_hits = response['hits']['total']['value']
        print(f"✓ Results: {total_hits} hits")

        text_results = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]
            doc = {
                "text": source.get("text", source.get("content", "")),
                "title": source.get("title", ""),
                "metadata": {k: v for k, v in source.items() if
                             k not in ["text", "content", "title", "embedding", "image_data"]}
            }
            if "image_data" in source:
                doc["image_data"] = source["image_data"]
            if "image_metadata" in source:
                doc["image_metadata"] = source["image_metadata"]

            text_results.append(doc)

        result["text_results"] = text_results
        result["hybrid_query"] = hybrid_query_obj
        return result

    except RequestError as e:
        if "not knn_vector type" in str(e) or "failed to create query" in str(e):
            print(f"[WARN] KNN query failed: {e}. Falling back to text-only match.")
            try:
                fallback_query = {
                    "query": {
                        "match": {
                            "text": user_question
                        }
                    }
                }
                print("Fallback query:", json.dumps(fallback_query))
                response = open_search_client.search(
                    index=index_name,  # Use dynamic index here too
                    body=fallback_query
                )
                total_hits = response['hits']['total']['value']
                print(f"✓ Fallback Results: {total_hits} hits")

                text_results = []
                for hit in response["hits"]["hits"]:
                    source = hit["_source"]
                    doc = {
                        "text": source.get("text", source.get("content", "")),
                        "title": source.get("title", ""),
                        "metadata": {k: v for k, v in source.items() if
                                     k not in ["text", "content", "title", "embedding", "image_data"]}
                    }
                    if "image_data" in source:
                        doc["image_data"] = source["image_data"]
                    if "image_metadata" in source:
                        doc["image_metadata"] = source["image_metadata"]
                    text_results.append(doc)

                result["text_results"] = text_results
                result["hybrid_query"] = fallback_query
                return result

            except Exception as fallback_e:
                print(f"Error executing fallback search: {fallback_e}")
                return {"error": str(fallback_e)}
        else:
            print(f"Error executing search: {e}")
            return {"error": str(e)}

    except Exception as e:
        print(f"Error executing search: {e}")
        return {"error": str(e)}


@tool
def json_parse_output(content: str):
    """
    Use this tool to validate that your output is correct JSON and fully matches the required schema.

    Args:
        content: The JSON string that needs to be validated.
    """
    print('==============json_parse_output================', content)
    return clean_and_parse_json(content)


# Helper functions
def clean_and_parse_json(llm_text: str) -> Any:
    if not isinstance(llm_text, str):
        return llm_text  # Already parsed?

    text = llm_text.strip()
    fence_pattern = re.compile(r"```(?:\w*\n)?(.*?)```", re.DOTALL)
    m = fence_pattern.search(text)
    if m:
        candidate = m.group(1).strip()
    else:
        start = text.find("{")
        if start != -1:
            candidate = text[start:]
            depth = 0
            for i, char in enumerate(candidate):
                if char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                if depth == 0:
                    candidate = candidate[:i + 1]
                    break
        else:
            candidate = text

    candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

    # First attempt: strict=False allows some control characters
    try:
        return json.loads(candidate, strict=False)
    except Exception:
        pass

    # Second attempt: Python literal eval (handles single quotes, etc.)
    try:
        return ast.literal_eval(candidate)
    except Exception:
        pass

    # Third attempt: Robust repair for unescaped newlines/tabs in strings
    try:
        def escape_inner_control_chars(match):
            # Escape control characters inside the matched string literal
            content = match.group(0)
            return content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

        # Regex to match double-quoted string literals, handling escaped quotes
        # Pattern explanation: " ( escaped_char OR non_quote_non_backslash )* "
        string_literal_pattern = r'"(\\[\s\S]|[^"\\])*"'
        
        # Apply replacement only to string literals
        repaired_candidate = re.sub(string_literal_pattern, escape_inner_control_chars, candidate)
        
        return json.loads(repaired_candidate, strict=False)
    except Exception as exc:
        # Final fallback: Try to return detailed error
        raise ValueError(f"Failed to parse JSON: {exc}")


PLACEHOLDER = "EMBEDDING_VECTOR"


def inject_embedding_into_body(body: Any, embedding: List[float]) -> Tuple[Any, bool]:
    """
    Recursively walk a JSON-like structure (dict/list/scalar) and
    replace any string containing PLACEHOLDER with the embedding list.

    Args:
        body: JSON-like object (dict/list/etc.) returned by LLM
        embedding: list[float] – the vector to inject

    Returns:
        (new_body, found)
        new_body: body with placeholder replaced
        found: True if at least one placeholder was replaced
    """
    found = False

    def _replace(x: Any) -> Any:
        nonlocal found

        if isinstance(x, dict):
            return {k: _replace(v) for k, v in x.items()}

        if isinstance(x, list):
            return [_replace(v) for v in x]

        if isinstance(x, str) and PLACEHOLDER in x:
            found = True
            return embedding

        return x

    new_body = _replace(body)
    return new_body, found


def build_opensearch_body_from_llm_json(
        llm_body: dict,
        embedding: List[float],
        strict: bool = False,
) -> dict:
    """
    Take the dict returned by the LLM, inject the embedding where PLACEHOLDER appears,
    and return the final OpenSearch body.
    """
    final_body, found = inject_embedding_into_body(llm_body, embedding)

    if strict and not found:
        raise ValueError(
            f"Embedding placeholder '{PLACEHOLDER}' not found in LLM JSON body."
        )

    return final_body


class Tools:
    json_parse_output = json_parse_output

    @staticmethod
    def get_index_mapping(index_name: str = None) -> dict:
        """
        Wrapper for the standalone get_index_mapping function.
        Accepts index_name argument to match RAGAgent call signature.
        """
        return get_index_mapping(index_name)

    @staticmethod
    def create_opensearch_tool(index_name=None, embedding_model_id=None, region=None):
        """
        Returns the execute_opensearch_query tool.
        Dynamically configures the tool with the provided index_name and embedding_model_id.
        """
        
        # Fallback to default if not provided (though RAGAgent should provide them)
        if not index_name or not embedding_model_id:
            default_index, default_model = _get_tool_config()
            index_name = index_name or default_index
            embedding_model_id = embedding_model_id or default_model

        @tool
        async def execute_opensearch_query(hybrid_query: str, user_question: str) -> dict:
            """
            Use this tool for retrieving relevant text using OpenSearch query.
            The user_question is obtained from the prompt and is converted into embedding and injected into the query.
            OpenSearch query is executed and the relevant data is returned.

            Args:
                hybrid_query: The hybrid query to opensearch for the user_question.
                user_question: The revised question from user.
            """
            return await _execute_opensearch_query_impl(hybrid_query, user_question, index_name, embedding_model_id)

        return execute_opensearch_query


def chunk_text(text: str, max_length: int = 4000, overlap: int = 500) -> list[str]:
    """Chunks text into smaller segments with overlap."""
    if not text or len(text) <= max_length:
        return [text] if text else []
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + max_length, text_len)
        chunks.append(text[start:end])
        if end == text_len:
            break
        start += max_length - overlap
    return chunks


def format_image_content(image_data: str, media_type: str = "image/png") -> dict:
    """Formats base64 image data for LLM consumption."""
    if image_data.startswith("data:image"):
        parts = image_data.split(",", 1)
        if len(parts) == 2:
            image_data = parts[1]
            media_part = parts[0]
            if "image/" in media_part:
                media_type = media_part.split(";")[0].replace("data:", "")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": image_data}
    }


def format_document_content(documents: list) -> tuple[str, list]:
    """Formats a list of document objects into a readable string and extracts image blocks."""
    formatted_text = ""
    images = []
    for idx, doc in enumerate(documents):
        content = doc.get('text', '') or doc.get('pmr_combined_text_v2_ingest', '') or str(doc)
        title = doc.get('title', 'Untitled')
        relevance = doc.get('relevance_score', 'N/A')

        formatted_text += f"\\n[DOC_ID: {idx}] [Relevance: {relevance}]\\nCONTENT:\\n{content[:2000]}\\n"
        formatted_text += "=" * 40 + "\\n"
    return formatted_text, images