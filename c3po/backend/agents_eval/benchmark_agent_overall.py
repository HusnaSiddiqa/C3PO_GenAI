import asyncio
import csv
import json
import os
import sys
from datetime import datetime

import aiohttp
import mlflow
import pandas as pd
from dotenv import load_dotenv
from mlflow import MlflowClient
from mlflow.genai.scorers import RelevanceToQuery

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.constants import CLICKABLE_QUESTIONS_TABLE
from utils.constants import OVERALL_BENCHMARKING_PATH
from utils.constants import BATCH_SIZE, MAX_RETRIES
from utils.dynamodb import get_table
from utils.generic import get_secret
# Import custom scorers from existing scripts
from .benchmark_agent_byod import text_similarity_scorer
from .benchmark_agent_nlq import nlq_ai_judge_scorer, current_time_millis

load_dotenv()
CHAT_MANAGER_BASE_URL = os.getenv('CHAT_MANAGER_BASE_URL', 'localhost')
CHAT_MANAGER_PORT = os.getenv('CHAT_MANAGER_PORT', '8000')

CHAT_MANAGER_URL = f'http://{CHAT_MANAGER_BASE_URL}:{CHAT_MANAGER_PORT}/v2/chat-manager/conversation/query-stream'

async def fetch_agent_result(session, question: str, user_id: str):
    """
    Send question to chat manager with a retry mechanism for null/failed responses.
    """
    max_retries = MAX_RETRIES
    delay = 2  # Initial delay in seconds
    # Loop for a maximum of 3 retries
    for attempt in range(max_retries):
        agent_type = None
        summary = None
        result = None

        try:
            payload = {"message": question, "user_id": user_id, "benchmarking": True}
            async with session.post(CHAT_MANAGER_URL, json=payload, timeout=18000) as resp:
                # This will raise an exception for non-2xx status codes (like 429, 500, etc.)
                resp.raise_for_status()
                full_response_text = await resp.text()
                print('========full_response_text====', full_response_text)
                for line in full_response_text.strip().split('\n'):
                    try:
                        data = json.loads(line)
                        if data.get("role") == "assistant" and "agent" in data:
                            print('========data====', data)
                            agent_type = data["agent"]
                            print('========agent_type====', agent_type)
                            if agent_type == "BYOD_Agent":
                                summary = data.get("summary", "")
                            elif agent_type == "NLQ_Agent" or agent_type == "NLQ_DSO_Agent":
                                if "sql_query" in data:
                                    result = data["sql_query"]
                                elif "result" in data:
                                    result = data["result"]
                                summary = data.get("summary", "")
                    except json.JSONDecodeError:
                        continue  # Ignore lines that aren't valid JSON

        except Exception as e:
            print(f"[DEBUG] Attempt {attempt + 1}/{max_retries} failed with an exception: {e} for question: '{question[:70]}...'")

        if agent_type:
            output = summary if agent_type == "BYOD_Agent" else json.dumps({"sql_query": result})
            return {"agent_type": agent_type, "output": output, "summary": summary}

        print(
            f"[DEBUG] Attempt {attempt + 1}/{max_retries} received a null response for question: '{question[:70]}...'")

        if attempt < max_retries - 1:
            print(f"--- Retrying in {delay} seconds... ---")
            await asyncio.sleep(delay)
            delay *= 2
    print(f"[ERROR] All {max_retries} attempts failed for question: '{question[:70]}...'. Returning null.")
    return {"agent_type": None, "output": None, "summary": None}



async def process_questions(questions, user_id):
    """
    Asynchronously processes all questions in batches and returns a list of agent results.
    """
    batch_size = BATCH_SIZE
    all_agent_results = []
    question_batches = []
    # Create a single session to be reused for all requests for efficiency
    async with aiohttp.ClientSession() as session:
        # Split the main list of questions into smaller batches
        for i in range(0, len(questions), batch_size):
            if i + batch_size > len(questions):
                question_batches.append(questions[i:])
            else:
                question_batches.append(questions[i:i + batch_size])

        print(f"Total questions: {len(questions)}. Processing in {len(question_batches)} batches of up to {batch_size} questions each.")

        # Process each batch sequentially
        for i, batch in enumerate(question_batches):
            print(f"--- Processing batch {i + 1}/{len(question_batches)} ({len(batch)} questions) ---")

            # Create concurrent tasks for all questions WITHIN the current batch
            tasks = [fetch_agent_result(session, row["question"], user_id) for row in batch]

            # Wait for the current batch to complete before moving to the next
            batch_results = await asyncio.gather(*tasks)

            # Add the results from the completed batch to our main list
            all_agent_results.extend(batch_results)

    return all_agent_results


async def main(file_path: str, user_id: str, file_id: str = None, file_name: str = None, file_type: str = None):
    DATABRICKS_TOKEN = get_secret(os.environ["SECRET_NAME"])
    os.environ["DATABRICKS_TOKEN"] = DATABRICKS_TOKEN
    questions = []
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            original_question = row["question"]
            questions.append({
                "original_question": original_question,
                "question": original_question,  # No agent-specific suffix
                "expected_answer": row.get("expected_answer") or None,
                "expected_sql": row.get("sql_query", ""),
                "question_id": row.get("question_id", ""),
                "category": row.get("category", ""),
            })
    if not questions:
        print("No data found in the input file. Exiting.")
        return
    agent_results = await process_questions(questions, user_id)
    # Build eval_df
    eval_rows = []
    scorers_per_row = []
    for q, res in zip(questions, agent_results):
        agent_type = res.get("agent_type")
        output = res.get("output")
        summary = res.get("summary")
        expectations = {"expected_answer": q["expected_answer"], "expected_sql": q["expected_sql"]}
        eval_rows.append({
            "inputs": {"question": q["original_question"]},
            "outputs": output,
            "summary": summary,
            "expectations": expectations,
            "agent_type": agent_type
        })
        print(f"[DBG_DF] Building eval_df row: output={output[:100] if output else None}")
        print(f"[DBG_DF] Expectations: {expectations}")
        # Select scorers for each row
        if agent_type == "BYOD_Agent":
            scorers_per_row.append([text_similarity_scorer, RelevanceToQuery()])
        elif agent_type == "NLQ_Agent" or agent_type == "NLQ_DSO_Agent":
            scorers_per_row.append([nlq_ai_judge_scorer])
        else:
            scorers_per_row.append([])
            
    eval_df = pd.DataFrame(eval_rows)
    # Set irrelevant scorer columns to None using pandas masking
    eval_df["text_similarity_score/score"] = None
    eval_df["relevance_to_query/v1/score"] = None
    eval_df["nlq_ai_judge_scorer/score"] = None
    byod_mask = eval_df["agent_type"] == "BYOD_Agent"
    nlq_mask = eval_df["agent_type"] == "NLQ_Agent"
    eval_df.loc[byod_mask, "nlq_ai_judge_scorer/score"] = None
    eval_df.loc[nlq_mask, ["text_similarity_score/score", "relevance_to_query/v1/score"]] = None
    # MLflow setup
    
    mlflow.set_tracking_uri("databricks")
    client = MlflowClient()
    experiment_path = OVERALL_BENCHMARKING_PATH
    experiment = client.get_experiment_by_name(experiment_path)
    if experiment is None:
        print(f"Experiment '{experiment_path}' not found. Creating it...")
        experiment_id = client.create_experiment(name=experiment_path)
        print(f"Created new experiment. ID: {experiment_id}")
    else:
        experiment_id = experiment.experiment_id
        print(f"Successfully found Experiment ID: {experiment_id}")

    latest_runs_df = mlflow.search_runs(
        experiment_ids=[experiment_id], order_by=["start_time DESC"], max_results=1
    )
    if latest_runs_df.empty:
        print(f"No runs found in experiment ID '{experiment_id}'. Creating a new run...")
        with mlflow.start_run(experiment_id=experiment_id, run_name="Overall_Agent_Benchmark_1.0") as run:
            latest_run_id = run.info.run_id
            print(f"Created new run. ID: {latest_run_id}")
    else:
        latest_run_id = latest_runs_df.iloc[0]['run_id']
        print(f"Found latest run. ID: {latest_run_id}")

    client.delete_traces(
        experiment_id=experiment_id,
        max_timestamp_millis=current_time_millis()
    )
    print(f"Deleted existing traces for run ID: {latest_run_id}")
    # Evaluate and log metrics inside the MLflow run context
    with mlflow.start_run(run_id=latest_run_id) as run:
        eval_results = mlflow.genai.evaluate(
            data=eval_df,
            scorers=[text_similarity_scorer, RelevanceToQuery(), nlq_ai_judge_scorer]
        )
        print(f"\nEvaluation complete. View updated results in MLflow UI for run ID: {run.info.run_id}")
        # Update DynamoDB table for each question: check if item exists, then update, using agent_results only
        # Update DynamoDB table for each question: check if item exists, then update, using agent_results only
        table = get_table(CLICKABLE_QUESTIONS_TABLE)

        for q in questions:
            question_text = q.get('question')
            category = q.get('category')
            user_id_val = user_id  # from main() argument
            # Query DynamoDB for item with matching question text and category
            # Assuming a GSI or scan is available for this purpose
            try:
                # Scan for item with matching question text and category
                response = table.scan(
                    FilterExpression="question = :qt AND category = :cat",
                    ExpressionAttributeValues={
                        ":qt": question_text,
                        ":cat": category
                    }
                )
                items = response.get('Items', [])
                if not items:
                    print(f"No DynamoDB item found for question='{question_text}', category='{category}'. Skipping update.")
                    continue
                item = items[0]
                question_id = item.get('question_id')
                pk = item.get('PK')
                sk = item.get('SK')
                if not question_id or not pk or not sk:
                    print(f"Missing PK/SK/question_id in DynamoDB item for question='{question_text}'. Skipping update.")
                    continue
            except Exception as e:
                print(f"DynamoDB scan failed for question='{question_text}': {e}")
                continue

            # Extract agent_type and compute scorer_value on-the-fly
            eval_row = eval_df[eval_df['inputs'].apply(lambda x: x.get('question') == question_text if isinstance(x, dict) else False)]
            agent_type = None
            scorer_value = None
            if not eval_row.empty:
                row = eval_row.iloc[0]
                agent_type = row.get('agent_type', None)
                input = row.get('inputs', None)
                output = row.get('outputs', None)
                expectations = row.get('expectations', None)
                feedback_obj = None
                if agent_type == "NLQ_Agent" or agent_type == "NLQ_DSO_Agent":
                    try:
                        feedback_obj = nlq_ai_judge_scorer(input, output, expectations)
                        print(f"----------{agent_type} score:---------- {feedback_obj}")
                    except Exception as e:
                        feedback_obj = None
                elif agent_type == "BYOD_Agent":
                    try:
                        feedback_obj = text_similarity_scorer(output, expectations)
                    except Exception as e:
                        feedback_obj = None
                if isinstance(feedback_obj, bool):
                    scorer_value = feedback_obj
                    print(f"The Scorer value is: {scorer_value}")
                elif feedback_obj is not None and hasattr(feedback_obj, 'score'):
                    raw_score = feedback_obj.score
                    scorer_value = bool(raw_score) if raw_score is not None else None
                    print(f"The Scorer value is: {scorer_value}")
                else:
                    scorer_value = None
            try:
                table.update_item(
                    Key={'PK': pk, 'SK': sk},
                    UpdateExpression="SET agent_type = :a, scorer = :s, updated_at = :u, updated_by = :ub",
                    ExpressionAttributeValues={
                        ':a': agent_type,
                        ':s': scorer_value,
                        ':u': datetime.utcnow().isoformat(),
                        ':ub': user_id_val
                    }
                )
            except Exception as e:
                print(f"DynamoDB update failed for question_id '{question_id}': {e}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Overall Agent Benchmarking")
    parser.add_argument("csv_file_path", type=str, help="Path to CSV file with questions")
    parser.add_argument("user_id", type=str, help="User ID")
    parser.add_argument("--file_id", type=str, default=None, help="BYOD file_id (optional)")
    parser.add_argument("--file_name", type=str, default=None, help="BYOD file_name (optional)")
    parser.add_argument("--file_type", type=str, default=None, help="BYOD file_type (optional)")
    args = parser.parse_args()
    asyncio.run(main(
        file_path=args.csv_file_path,
        user_id=args.user_id,
        file_id=args.file_id,
        file_name=args.file_name,
        file_type=args.file_type
    ))