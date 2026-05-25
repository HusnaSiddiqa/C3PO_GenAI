import asyncio
import csv
import json
import os
import sys

import aiohttp
import mlflow
import pandas as pd
from dotenv import load_dotenv
from mlflow import MlflowClient
from mlflow.entities import Feedback
from mlflow.genai import scorer
from mlflow.genai.scorers import RelevanceToQuery

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.constants import BYOD_PATH
from utils.constants import BATCH_SIZE
from agents_eval.benchmark_agent_nlq import current_time_millis

load_dotenv()
CHAT_MANAGER_BASE_URL = os.getenv('CHAT_MANAGER_BASE_URL', 'localhost')
CHAT_MANAGER_PORT = os.getenv('CHAT_MANAGER_PORT', '8000')

CHAT_MANAGER_URL = f'http://{CHAT_MANAGER_BASE_URL}:{CHAT_MANAGER_PORT}/v2/chat-manager/conversation/query-stream'


@scorer(name="text_similarity_score")
def text_similarity_scorer(outputs: str, expectations: dict) -> Feedback:
    """
    Custom scorer that compares the agent's summary response with the expected answer.
    This function is decorated with @mlflow.genai.scorer and is called for each row.
    It must return an mlflow.entities.Feedback object.
    """
    agent_summary = str(outputs).strip()

    if isinstance(expectations, dict):
        expected_answer = str(expectations.get('expected_answer', '')).strip()
    else:
        expected_answer = str(expectations).strip()

    if not agent_summary:
        return Feedback(value=0, rationale="Agent's summary was missing or empty.")
    if not expected_answer:
        return Feedback(value=0, rationale="Expected answer was missing for comparison.")

    agent_summary_lower = agent_summary.lower()
    expected_answer_lower = expected_answer.lower()

    words_expected = set(expected_answer_lower.split())
    words_agent = set(agent_summary_lower.split())

    if not words_expected:
        overlap_ratio = 0.0
    else:
        common_words = words_expected.intersection(words_agent)
        overlap_ratio = len(common_words) / len(words_expected)

    is_match = overlap_ratio >= 0.5 or expected_answer_lower in agent_summary_lower
    score = True if is_match else False

    rationale = (
        f"Summary matches expected answer (overlap: {overlap_ratio:.2%})."
        if is_match else
        f"Summary does not match expected answer (overlap: {overlap_ratio:.2%}). "
        f"Expected: '{expected_answer}', Got: '{agent_summary}'"
    )
    return Feedback(value=score, rationale=rationale)


async def fetch_agent_result(session, question: str, user_id: str, file_info: dict):
    """
    Fetch result from chat manager with BYOD payload including file information.
    The 'question' parameter must be a string.
    """
    payload = {
        "message": question,
        "user_id": user_id,
        "file": file_info,
        "benchmarking": True
    }
    summary = ""

    print(f"--> Sending request for question: '{question}'")

    try:
        async with session.post(CHAT_MANAGER_URL, json=payload, timeout=18000) as resp:
            resp.raise_for_status()

            full_response_text = await resp.text()

            for line in full_response_text.strip().split('\n'):
                try:
                    data = json.loads(line)

                    if "summary" in data:
                        summary = data["summary"]
                    elif "response" in data and isinstance(data["response"], dict):
                        summary = data["response"].get("summary", summary)
                    elif "content" in data:
                        summary = data["content"]

                except json.JSONDecodeError:
                    # It's possible some lines are not valid JSON (e.g., delimiters), so we skip them.
                    print(f"Warning: Could not decode JSON from line: {line}")
                    continue
    except aiohttp.ClientError as e:
        print(f"Error fetching agent result for question '{question}': {e}")
        return ""  # Return empty string on error

    return summary


async def process_questions(questions, user_id, file_info):
    """
    Asynchronously processes all questions in batches.
    """
    batch_size = BATCH_SIZE
    all_agent_results = []

    async with aiohttp.ClientSession() as session:
        question_batches = [questions[i:i + batch_size] for i in range(0, len(questions), batch_size)]

        print(
            f"Total questions: {len(questions)}. Processing in {len(question_batches)} batches of up to {batch_size} questions each.")

        for i, batch in enumerate(question_batches):
            print(f"--- Processing batch {i + 1}/{len(question_batches)} ({len(batch)} questions) ---")

            tasks = [fetch_agent_result(session, row["question"], user_id, file_info) for row in batch]
            batch_results = await asyncio.gather(*tasks)
            all_agent_results.extend(batch_results)

    return all_agent_results


async def main(file_path: str, user_id: str, file_id: str, file_name: str, file_type: str):
    """
    Main function to run BYOD agent benchmarking using mlflow.evaluate.
    """
    questions = []
    try:
        with open(file_path, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                original_question = row["question"]
                modified_question = f"{original_question}\n** EXECUTE THIS ON BYOD AGENT **\n"
                questions.append({
                    "original_question": original_question,
                    "question": modified_question,
                    "expected_answer": row.get("expected_answer", "")
                })
    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
        sys.exit(1)

    if not questions:
        print("No data found in the input file. Exiting.")
        return

    file_info = {"file_id": file_id, "file_name": file_name, "file_type": file_type}
    if not all(file_info.values()):
        print("Error: All file information (file_id, file_name, file_type) must be provided.")
        sys.exit(1)

    agent_results = await process_questions(questions, user_id, file_info)
    eval_df = pd.DataFrame(questions)
    eval_df['summary'] = agent_results

    # Use the original question for MLflow traces
    eval_df['inputs'] = eval_df['original_question'].apply(lambda q: {'question': q})
    eval_df['outputs'] = eval_df['summary']
    eval_df['expectations'] = eval_df['expected_answer'].apply(lambda e: {'expected_answer': e})

    mlflow.set_tracking_uri("databricks")
    client = MlflowClient()

    try:
        experiment_path = BYOD_PATH
        experiment = client.get_experiment_by_name(experiment_path)
        if experiment is None:
            print(f"Error: Experiment '{experiment_path}' not found.")
            sys.exit(1)
        experiment_id = experiment.experiment_id
        print(f"Successfully found Experiment ID: {experiment_id}")

        latest_runs_df = mlflow.search_runs(
            experiment_ids=[experiment_id], order_by=["start_time DESC"], max_results=1
        )
        if latest_runs_df.empty:
            print(f"Error: No runs found in experiment ID '{experiment_id}'.")
            sys.exit(1)
        latest_run_id = latest_runs_df.iloc[0]['run_id']
        print(f"Found latest run. ID: {latest_run_id}")

        client.delete_traces(
            experiment_id=experiment_id,
            max_timestamp_millis=current_time_millis()
        )

    except mlflow.exceptions.RestException as e:
        print(f"Error communicating with MLflow: {e}")
        sys.exit(1)

    with mlflow.start_run(run_id=latest_run_id) as run:
        print(f"Successfully re-opened run '{latest_run_id}' to add evaluation results.")

        scorers_to_use = [
            text_similarity_scorer,
            RelevanceToQuery()
        ]
        eval_results = mlflow.genai.evaluate(
            data=eval_df,
            scorers=scorers_to_use,
        )
        print(dir(eval_results))
        print(f"Evaluation results: {eval_results}")
        print(eval_results.tables.keys())
        print("\n--- Overall Metrics ---")
        print(eval_results.metrics)
        mlflow.log_metrics(eval_results.metrics)

        run_data = client.get_run(run.info.run_id).data
        if "num_questions" not in run_data.params:
            mlflow.log_param("num_questions", len(eval_df))

        print("\n--- Detailed Results per Row ---")
        display_cols = [
            'inputs', 'outputs', 'expectations',
            'text_similarity_score/score', 'text_similarity_score/justification',
            'relevance_to_query/v1/score', 'relevance_to_query/v1/justification',
            'correctness/v1/score', 'correctness/v1/justification'
        ]

        print(f"\nEvaluation complete. View updated results in MLflow UI for run ID: {run.info.run_id}")


if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Usage: python benchmark_agent_byod.py [csv_file_path] [user_id] [file_id] [file_name] [file_type]")
        print(
            "Example: python benchmark_agent_byod.py benchmark_questions_byod.csv test_user_123 ba9724f2-a13c-4a6d-90d0-df0e02e6ffb4 \"MyDocument.pdf\" \"application/pdf\"")
        sys.exit(1)

    asyncio.run(main(
        file_path=sys.argv[1],
        user_id=sys.argv[2],
        file_id=sys.argv[3],
        file_name=sys.argv[4],
        file_type=sys.argv[5]
    ))
