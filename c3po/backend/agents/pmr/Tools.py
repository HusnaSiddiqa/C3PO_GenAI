import os
import json
from utils.constants import Region_NAME, EMBEDDING_MODEL
from langchain_core.tools import tool
from core.util.DataWareHouse import DataWarehouse
from pydantic import BaseModel, Field
import awswrangler as wr
from opensearchpy import OpenSearch
import boto3
import requests
from langchain_aws import BedrockEmbeddings
from typing import Optional
import asyncio
import random

INDEX_NAME_PMR=os.getenv("INDEX_NAME_PMR")
OPENSEARCH_HOST_URL=os.getenv("OPENSEARCH_HOST_URL_PMR")

class RetrieveChunks:
    """Creates embedding for the user query and finds relevant chunks from OpenSearch."""

    def __init__(self, embedding_model: BedrockEmbeddings):
        self.embedding_model = embedding_model

    def get_opensearch_client(self):
        """Create a fresh OpenSearch client each time"""
        try:
            print("before initializing opensearch client")
            # Force fresh credentials by creating new session
            session = boto3.Session(region_name=Region_NAME)
            
            open_search_client = wr.opensearch.connect(
                host=OPENSEARCH_HOST_URL,
                region=Region_NAME,
                boto3_session=session
            )

            print("OpenSearch client initialized with host:", OPENSEARCH_HOST_URL)
            print("OpenSearch client : ",open_search_client)
            print("mapping of index : ",open_search_client.indices.get_mapping(index=INDEX_NAME_PMR))

            if open_search_client:
                print("OpenSearch client initialized successfully.")
            else:
                print("Failed to initialize OpenSearch client.")

            return open_search_client
        except Exception as e:
            print(f"Error creating OpenSearch client: {e}")
            return None

    async def query_embedding(self,user_question:str):
        """Creates embedding for the inputted text"""
        query = user_question

        try:
            max_attempts = 3
            delay = 0.5
            jitter_ratio = 0.3
            max_interval = 60.0
            backoff_factor = 2.0

            for attempt in range(1, max_attempts + 1):
                try:
                    return await self.embedding_model.aembed_query(query)
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

@tool
async def hybrid_search(hybrid_query:str, user_question:str)->dict:
    """
        Use this tool for retrieving relevant text using OpenSearch query for healthcare professional opinion data. 
        This function uses the hybrid_query that uses exact minimum number of filters needed (maximum 3 keyword filters) with proper syntax and structure. 
        The user_question is obtained from the prompt and is converted into embedding and injected into the query.
        OpenSearch query is executed and the relevant data is returned from the OpenSearch healthcare professional opinion data.

    Args:
        hybrid_query: The hybrid query to opensearch for the user_question.
        user_question: The revised question from user.
    """
    result={}
    hybrid_query_pmr=hybrid_query

    embedding_model = BedrockEmbeddings(
        client=boto3.client("bedrock-runtime", region_name=Region_NAME),
        model_id=EMBEDDING_MODEL
    )

    retriever = RetrieveChunks(embedding_model)
    # Get and inject embeddingg
    print("pmr hybrid query before any processing :",hybrid_query_pmr)
    print("user question before embeddings : ",user_question)
    question_embedding = await retriever.query_embedding(user_question)
    hybrid_query_pmr = json.loads(hybrid_query_pmr)
    hybrid_query_pmr['query']['bool']['must'][1]['knn']['pmr_embedding_v2_ingest']['vector'] = question_embedding
    

    print("final query from pmr to opensearch: ",hybrid_query_pmr)

    print(f"✓ Embedding injected: {len(question_embedding)} dims")
    print(f"✓ Filters: {len(hybrid_query_pmr['query']['bool'].get('filter', []))}")
    
    # Execute search with corrected routing
    open_search_client = retriever.get_opensearch_client()

    response = open_search_client.search(
        index=INDEX_NAME_PMR,
        body=hybrid_query_pmr,
        routing="pmr_updated_v2" 
    )
    total_hits = response['hits']['total']['value']
    print(f"✓ Results: {total_hits} hits")
    
    # Process results
    # text_results = {"questions": [], "answers": [], "respondent_type": [],'source':[]}
    text_results={'questions':[], 'answers':[],'respondent_type':[],
    'source':[], 'tier':[], 'medical_profession':[], 'primary_medical_specialty':[],
    'practice_setting':[], 'geography_setting':[], 'identify_as':[],
    'tro_user/non_user':[], 'age':[], 'gender':[], 'health_insurance_coverage':[],'years_in_practice':[],'area_of_treatment':[]}
    for hit in response["hits"]["hits"]:
        text_results['questions'].append(hit["_source"].get("pmr_question_v2_ingest", ""))
        text_results['answers'].append(hit["_source"].get("pmr_answer_v2_ingest", ""))
        text_results['respondent_type'].append(hit["_source"].get("pmr_respondent_type_v2_ingest", ""))
        text_results['source'].append(hit["_source"].get("pmr_source_v2_ingest", ""))
        text_results['tier'].append(hit["_source"].get("pmr_tier_v2_ingest", ""))
        text_results['medical_profession'].append(hit["_source"].get("pmr_medical_profession_v2_ingest", ""))
        text_results['primary_medical_specialty'].append(hit["_source"].get("pmr_primary_medical_specialty_v2_ingest", ""))
        text_results['practice_setting'].append(hit["_source"].get("pmr_practice_setting_v2_ingest", ""))
        text_results['geography_setting'].append(hit["_source"].get("pmr_geography_setting_v2_ingest", ""))
        text_results['identify_as'].append(hit["_source"].get("pmr_identify_as_v2_ingest", ""))
        text_results['tro_user/non_user'].append(hit["_source"].get("pmr_tro_user_non_user_v2_ingest", ""))
        text_results['age'].append(hit["_source"].get("pmr_age_v2_ingest", ""))
        text_results['gender'].append(hit["_source"].get("pmr_gender_v2_ingest", ""))
        text_results['health_insurance_coverage'].append(hit["_source"].get("pmr_health_insurance_coverage_v2_ingest", ""))
        text_results['years_in_practice'].append(hit["_source"].get("pmr_years_in_practice_v2_ingest", ""))
        text_results['area_of_treatment'].append(hit["_source"].get("pmr_area_of_treament_v2_ingest", ""))
    print("relevant chunks:", text_results)
    result["text_results"] = text_results
    result["hybrid_query"]=json.loads(hybrid_query)
    return result 

@tool
def json_parse_output(content: str):
    """
        Use this tool to validate that your output is correct JSON and fully matches the required schema.
        
        MANDATORY STEPS:
        1. After generating your JSON response, immediately call this tool with your entire output string.  
        2. If the tool returns a JSON error, regenerate the response as a valid JSON object ONLY (no extra text, no explanation).  
        3. Repeat until the tool confirms success.  
        
        Args:
            content: The JSON string that needs to be validated for correct syntax and parseability.
        """
    print('==============json_parse_output================', content)
    return json.loads(content.strip())

class Tools:
    hybrid_search = hybrid_search
    json_parse_output = json_parse_output