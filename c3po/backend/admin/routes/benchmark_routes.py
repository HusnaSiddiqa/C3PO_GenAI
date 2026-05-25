import asyncio
import json
import os
import subprocess
import sys
import tempfile

import mlflow
from fastapi import UploadFile, File, APIRouter, Form, HTTPException
from mlflow import MlflowClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.constants import NLQ_PATH, BYOD_PATH, OVERALL_BENCHMARKING_PATH

from models.benchmark_models import BenchmarkRequest
from agents_eval.benchmark_agent_overall import main as overall_benchmark_main
from agents_eval.benchmark_agent_nlq import main as nlq_benchmark_main
from agents_eval.benchmark_agent_byod import main as byod_benchmark_main
from fastapi.responses import StreamingResponse
router = APIRouter()


@router.post("/benchmark")
async def run_benchmark(
        request_json: str = Form(...),
        benchmark_file: UploadFile = File(...),
):
    # --- STEP 1: Resolve all dependencies from the request body FIRST ---
    # This is the critical change. We read the file and parse the JSON
    # before we start any streaming logic.
    try:
        request = BenchmarkRequest(**json.loads(request_json))
        if not request.user_id:
            request.user_id = os.getenv("DEFAULT_USER")

        # Read the entire file content into memory. This ensures the upload is
        # fully processed before we proceed.
        file_content = await benchmark_file.read()

    except (json.JSONDecodeError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format for request: {e}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error processing request data: {e}")

    # --- STEP 2: Define the long-running job ---
    # This function now takes the processed data as arguments, not FastAPI dependencies.
    async def long_job(content: bytes, benchmark_request: BenchmarkRequest):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # Determine which script, experiment, and arguments to use
            benchmark_main_func = None
            script_args = []
            experiment_path = ""
            scorer_metric = ""

            if benchmark_request.agent_name == "NLQ":
                benchmark_main_func = nlq_benchmark_main
                experiment_path = NLQ_PATH
                script_args = [temp_file_path, benchmark_request.user_id]
                scorer_metric = "nlq_ai_judge_scorer/mean"

            elif benchmark_request.agent_name == "BYOD":
                if not benchmark_request.BYOD_data:
                    raise HTTPException(status_code=400, detail="BYOD_data required for BYOD Agent")

                benchmark_main_func = byod_benchmark_main
                experiment_path = BYOD_PATH
                file_id = benchmark_request.BYOD_data.file_id
                file_name = benchmark_request.BYOD_data.filename
                file_type = benchmark_request.BYOD_data.file_type
                script_args = [temp_file_path, benchmark_request.user_id, file_id, file_name, file_type]
                scorer_metric = "text_similarity_score/mean"
            else:
                raise HTTPException(status_code=400, detail="Unknown agent_name")

            await benchmark_main_func(*script_args)

            # --- MLflow logic remains the same ---
            mlflow.set_tracking_uri("databricks")
            client = MlflowClient()
            experiment = client.get_experiment_by_name(experiment_path)
            if experiment is None:
                raise HTTPException(status_code=404, detail=f"Experiment '{experiment_path}' not found")

            version_alias = benchmark_request.version_alias
            filter_string = f"tags.version_alias = '{version_alias}'" if version_alias else ""
            order_by = ["start_time DESC"] if version_alias else ["tags.version DESC"]

            latest_runs_df = mlflow.search_runs(
                experiment_ids=[experiment.experiment_id], filter_string=filter_string, order_by=order_by, max_results=1
            )
            if latest_runs_df.empty:
                raise HTTPException(status_code=404, detail="No runs found for the specified criteria")

            latest_run_id = latest_runs_df.iloc[0]['run_id']
            run_data = client.get_run(latest_run_id).data
            accuracy = run_data.metrics.get(scorer_metric)

            if accuracy is None:
                raise HTTPException(status_code=404, detail=f"Accuracy metric '{scorer_metric}' not found in the run")

            accuracy_percent = f"{round(accuracy * 100)}%"
            return {"status": "success", "accuracy": accuracy_percent}

        finally:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

    async def stream_with_heartbeats():
        task = asyncio.create_task(long_job(file_content, request))
        try:
            yield "event: started\ndata: {}\n\n"
            while not task.done():
                yield ": keep-alive\n\n"
                await asyncio.sleep(20)

            result_data = await task
            yield f"event: completed\ndata: {json.dumps(result_data)}\n\n"
        except Exception as e:
            detail = e.detail if isinstance(e, HTTPException) else str(e)
            status_code = e.status_code if isinstance(e, HTTPException) else 500
            err = {"status": "error", "detail": detail, "status_code": status_code}
            yield f"event: error\ndata: {json.dumps(err)}\n\n"

    return StreamingResponse(stream_with_heartbeats(), media_type="text/event-stream")


@router.post("/benchmarking/run")
async def run_benchmark_overall(
        # TODO - uncomment this and comment user_id when extending for BYOD benchmarking
        # request_json: str = Form(...),  # request comes as JSON string in form-data
        user_id: str,
        benchmark_file: UploadFile = File(...),
):
    # TODO - uncomment this and take the stringified JSON from the form-data to extend this API for BYOD benchmarking
    # Parse the incoming JSON string into a Pydantic model
    # try:
    #     request_data = json.loads(request_json)
    #     request = BenchmarkRequest(**request_data)
    #     if not request.user_id:
    #         request.user_id = os.getenv("DEFAULT_USER")
    # except json.JSONDecodeError:
    #     return {"status": "error", "message": "Invalid JSON format for request"}

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as temp_file:
        temp_file.write(await benchmark_file.read())
        temp_file_path = temp_file.name

    # Prepare script args for benchmark_agent_overall.py
    script_name = "benchmark_agent_overall.py"
    agents_eval_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../agents_eval'))
    script_path = os.path.join(agents_eval_dir, script_name)
    script_args = [temp_file_path, user_id]
    # TODO - uncomment this and take the stringified JSON from the form-data to extend this API for BYOD benchmarking
    # Optionally add file_id, file_name, file_type if present
    # if request.BYOD_data:
    #     script_args.extend([
    #         request.BYOD_data.file_id,
    #         request.BYOD_data.filename,
    #         request.BYOD_data.file_type
    #     ])
    # try:
    #     await overall_benchmark_main(temp_file_path, user_id)
    # except subprocess.CalledProcessError as e:
    #     return HTTPException(status_code=500, detail=str(e))

    async def long_job():
        # your existing function; run it here
        await overall_benchmark_main(temp_file_path, user_id)

    async def stream_with_heartbeats():
        task = asyncio.create_task(long_job())
        try:
            yield "event: started\ndata: {}\n\n"

            while not task.done():
                # Yield a heartbeat every 20s (must be << 900s)
                yield ": keep-alive\n\n"
                await asyncio.sleep(20)
            # Propagate exceptions if any:
            await task
            yield f"event: completed\ndata: {json.dumps({'status': 'success'})}\n\n"
        except Exception as e:
            # Send an error message (and let client handle it)
            err = {"status": "error", "detail": str(e)}
            yield f"event: error\ndata: {json.dumps(err)}\n\n"

    # return {"status": "success"}
    return StreamingResponse(stream_with_heartbeats(), media_type="text/event-stream")