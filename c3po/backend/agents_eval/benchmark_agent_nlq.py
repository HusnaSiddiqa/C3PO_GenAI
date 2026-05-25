import csv
import json
import os
import sys
import time
import re
from typing import Any, Optional
import httpx
import aiohttp
import asyncio
import argparse

import mlflow
import pandas as pd
from databricks import sql
from dotenv import load_dotenv
from mlflow import MlflowClient
# from core.prompt.SystemPrompt import SystemPrompt
from mlflow.entities import Feedback
from mlflow.genai import scorer

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.constants import NLQ_PATH
from utils.constants import MAX_RETRIES, BATCH_SIZE
from utils.constants import DEFAULT_CATALOG, DEFAULT_SCHEMA
from utils.generic import get_secret
from core.prompt.SystemPrompt import SystemPrompt
from core.model_provider.factory import ModelFactory
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel


load_dotenv()

SERVER_HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME")
HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH")
DATABRICKS_TOKEN = get_secret(os.environ["SECRET_NAME"])
BASE_URL = os.getenv("MODEL_BASE_URL")
MODEL_NAME = os.getenv("MODEL")
WORKSPACE_BUCKET_NAME = os.getenv("WORKSPACE_BUCKET_NAME")

CHAT_MANAGER_BASE_URL = os.getenv('CHAT_MANAGER_BASE_URL', 'localhost')
CHAT_MANAGER_PORT = os.getenv('CHAT_MANAGER_PORT', '8000')

CHAT_MANAGER_URL = f'http://{CHAT_MANAGER_BASE_URL}:{CHAT_MANAGER_PORT}/v2/chat-manager/conversation/query-stream'
model_api_key = get_secret(os.environ["SECRET_NAME"])
llm = ModelFactory.create_provider(provider=os.environ["PROVIDER"], model_name=os.environ["MODEL"],
                                 base_url=os.environ['MODEL_BASE_URL'],
                                 api_key=model_api_key).get_llm()

class AIJudgeResponse(BaseModel):
    score: float
    justification: str

ai_judge_parser = PydanticOutputParser(pydantic_object=AIJudgeResponse)
ai_judge_example = AIJudgeResponse(score=1.0, justification="why they are equivalent OR why harmless differences apply")


def execute_sql_to_dataframe(sql_query: str, catalog: str, schema: str) -> pd.DataFrame | str:
    """Executes a SQL query and returns a pandas DataFrame or an error string."""
    print(f"\n[DEBUG] Executing Ground Truth SQL:\n---\n{sql_query}\n---")
    try:
        with sql.connect(
                server_hostname=SERVER_HOSTNAME,
                http_path=HTTP_PATH,
                access_token=DATABRICKS_TOKEN,
                _tls_no_verify=True
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"USE CATALOG `{catalog}`")
                cursor.execute(f"USE SCHEMA `{schema}`")
                cursor.execute(sql_query)
                return cursor.fetchall_arrow().to_pandas()
    except Exception as e:
        return f"SQL Execution Error: {e}"


def get_ai_judge_feedback(question:str, agent_sql: str, expected_sql: str) -> dict:
    """Calls an LLM serving endpoint to compare two SQL queries logically."""
    base_url = BASE_URL
    endpoint_name = MODEL_NAME
    token = DATABRICKS_TOKEN
    print("came inside the get_ai_judge_feedback function")
    if not all([base_url, endpoint_name, token]):
        print("came inside the if loop function")
        error_msg = "Error: Ensure MODEL_BASE_URL, SERVING_ENDPOINT_NAME, and DATABRICKS_TOKEN are set."
        return {"score": 0.0, "justification": error_msg}
    system_prompts = SystemPrompt(os.environ['WORKSPACE_BUCKET_NAME'], "system_prompts")
    prompt_text = system_prompts.get_system_prompt("ai_judge_prompt.txt")
    prompt_text = prompt_text.format(
            user_question=question,
            agent_sql=agent_sql,
            expected_sql=expected_sql,
            format_instructions=ai_judge_parser.get_format_instructions(),
            example_response=ai_judge_example.model_dump_json()
    )
    try:
        response = llm.invoke(prompt_text)
        response_content = response.content if hasattr(response, 'content') else str(response)
        json_response = json.loads(response_content.strip())
        json_response['score'] = float(json_response.get('score', 0.0))
        return json_response
    except Exception as e:
        print(f"[DEBUG] Exception: {e}")
        return {"score": 0.0, "justification": f"Error calling AI judge: {e}"}


@scorer(name="nlq_ai_judge_scorer")
def nlq_ai_judge_scorer(inputs: dict, outputs: str, expectations: dict) -> Feedback:
    """
    Custom scorer that uses an AI Judge to compare SQL query equivalence.
    This version returns a Feedback object with a boolean score (True/False).
    """
    expected_sql = expectations.get('expected_sql', '').strip()
    question = inputs.get('question', '').strip()

    if not expected_sql:
        return Feedback(score=False, justification="Expected SQL was missing.")

    try:
        agent_json = json.loads(outputs)
        agent_sql = agent_json.get("sql_query", "").strip()
    except (json.JSONDecodeError, AttributeError):
        return Feedback(score=False, justification="Agent output was not valid JSON or missing 'sql_query' key.")

    if not agent_sql:
        return Feedback(score=False, justification="Agent did not produce a valid SQL query.")

    judge_result = get_ai_judge_feedback(question, agent_sql, expected_sql)
    print(f"\n[DEBUG] AI Judge Scorer: {judge_result}")

    score_value = judge_result.get('score', 0.0)
    justification = judge_result.get('justification', 'No justification provided by AI judge.')

    boolean_score = (score_value == 1.0)

    return boolean_score


async def fetch_agent_result(session: aiohttp.ClientSession, question: str, user_id: str) -> str:
    """
    Asynchronously fetches the agent's SQL query result from the streaming endpoint.
    """
    max_retries = MAX_RETRIES
    delay = 2


    payload = {
        "message": question,
        "user_id": user_id
    }

    headers = {"Content-Type": "application/json"}

    for attempt in range(max_retries):
        try:

            async with session.post(CHAT_MANAGER_URL, json=payload, headers=headers, timeout=300) as resp:
                resp.raise_for_status()

                async for line in resp.content:
                    if not line:
                        continue
                    try:
                        data = json.loads(line.decode('utf-8'))
                        if data.get("type") == "sql_result":
                            sql_query = data.get("sql_query")
                            if sql_query:
                                print(f"[SUCCESS] Found SQL for question: '{question[:50]}...'")
                                return json.dumps({"sql_query": sql_query})
                    except json.JSONDecodeError:
                        continue  # Ignore lines that are not valid JSON

                print(f"[ERROR] Stream ended for attempt {attempt + 1} but did not contain a 'sql_result' event.")

        except aiohttp.ClientError as e:
            print(f"[ERROR] Attempt {attempt + 1} failed with a network/HTTP exception: {e}")

        if attempt < max_retries - 1:
            print(f"--- Retrying in {delay} seconds... ---")
            await asyncio.sleep(delay)
            delay *= 2

    print(f"[FATAL] All {max_retries} attempts failed for question: '{question[:70]}...'. Returning empty.")
    return ""

async def process_questions(questions: list, user_id: str) -> list:
    """
    Asynchronously processes all questions in batches and returns a list of agent results.
    """
    batch_size = BATCH_SIZE
    all_agent_results = []

    async with aiohttp.ClientSession() as session:
        question_batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]

        print(
            f"Total questions: {len(questions)}. Processing in {len(question_batches)} batches of up to {batch_size} questions each.")

        for i, batch in enumerate(question_batches):
            print(f"--- Processing batch {i + 1}/{len(question_batches)} ({len(batch)} questions) ---")

            tasks = [fetch_agent_result(session, row["question"], user_id) for row in batch]

            batch_results = await asyncio.gather(*tasks)
            all_agent_results.extend(batch_results)

    return all_agent_results


def current_time_millis():
    """Returns the current time in milliseconds."""
    return int(round(time.time() * 1000))


async def main(file_path: str, user_id: str, version_alias: Optional[str] = None):
    """Main function to run NLQ agent benchmarking."""
    questions = []
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            questions.append({
                "question": row["question"],
                "expected_sql": row.get("expected_sql", ""),
            })

    if not questions:
        print("No data found in the input file. Exiting.")
        return

    agent_outputs = await process_questions(questions, user_id)

    eval_df = pd.DataFrame(questions)
    eval_df['outputs'] = agent_outputs
    eval_df['inputs'] = eval_df['question'].apply(lambda q: {'question': q})
    eval_df['expectations'] = eval_df['expected_sql'].apply(lambda s: {'expected_sql': s})

    mlflow.set_tracking_uri('databricks')
    client = MlflowClient()

    try:
        experiment = client.get_experiment_by_name(NLQ_PATH)
        if experiment is None:
            print(f"Error: Experiment '{NLQ_PATH}' not found.")
            sys.exit(1)
        experiment_id = experiment.experiment_id
    except mlflow.exceptions.RestException as e:
        print(f"Error getting MLflow experiment: {e}")
        sys.exit(1)

    try:
        filter_string = f"tags.version_alias = '{version_alias}'" if version_alias else ""
        order_by = ["start_time DESC"] if version_alias else ["tags.version DESC"]
        latest_runs_df = mlflow.search_runs(
            experiment_ids=[experiment_id],
            filter_string=filter_string,
            order_by=order_by,
            max_results=1
        )
        if latest_runs_df.empty:
            print(f"Error: No MLflow run found for experiment '{NLQ_PATH}' with the specified criteria.")
            sys.exit(1)
        latest_run_id = latest_runs_df.iloc[0]['run_id']
    except mlflow.exceptions.RestException as e:
        print(f"Error searching for MLflow runs: {e}")
        sys.exit(1)

    client.delete_traces(experiment_id=experiment_id, max_timestamp_millis=current_time_millis())

    with mlflow.start_run(run_id=latest_run_id) as run:
        eval_results = mlflow.genai.evaluate(
            data=eval_df,
            scorers=[nlq_ai_judge_scorer]
        )
        print("\n--- Overall Metrics ---")
        metrics_to_log = {k: v for k, v in eval_results.metrics.items() if isinstance(v, (int, float))}
        print(metrics_to_log)
        mlflow.log_metrics(metrics_to_log)
        print(f"\nEvaluation complete. View updated results in MLflow UI for run ID: {run.info.run_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Overall Agent Benchmarking")

    parser.add_argument("csv_file_path", type=str, help="Path to CSV file with questions")
    parser.add_argument("user_id", type=str, help="User ID for the agent")
    parser.add_argument("--version_alias", type=str, default=None,
                        help="Version alias to filter MLflow runs (optional)")

    args = parser.parse_args()

    asyncio.run(main(
        file_path=args.csv_file_path,
        user_id=args.user_id,
        version_alias=args.version_alias
    ))