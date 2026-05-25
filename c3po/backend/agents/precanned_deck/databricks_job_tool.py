import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from databricks.sdk import WorkspaceClient
from pydantic import BaseModel, Field
from typing import List
from core.util.ConfigLoader import load_env_variables
from langchain_core.tools import Tool
from utils.constants import PRECANNED_JOB_FILE
from utils.s3 import read_s3_file, get_s3_client
from utils.generic import get_secret
from langchain_core.output_parsers import PydanticOutputParser
import logging
import json


logger = logging.getLogger(__name__)
class DBDeckJob(BaseModel):
    job_id: str = Field(..., description="The ID of the job")
    job_name: str = Field(..., description="The name of the job")
    job_description: str = Field(..., description="The description of the job")
    deck_path: str = Field(..., description="The S3 path where the generated deck will be saved")
class NoInput(BaseModel):
    pass

class DeckJobTriggerOutput(BaseModel):
    message: str
    deck_path: str
job_trigger_output_parser = PydanticOutputParser(pydantic_object=DeckJobTriggerOutput)
example_response = DeckJobTriggerOutput(message="Deck job completed successfully", deck_path="s3://bucket/path/to/deck.pptx")

env = load_env_variables()
db = WorkspaceClient(
    host=env['DATABRICKS_SERVER_HOSTNAME'],
    token=get_secret(os.environ["SECRET_NAME"])
)

def trigger_deck_job(job_id: str, deck_path: str):
    function_response = "No job found with the given ID"
    if job_id:
        job_id = job_id.replace("X", "")
        print(f"Job ID: {job_id}")
        run = db.jobs.run_now(job_id=job_id, job_parameters={"output_folder": deck_path})
        if run is not None:
            while True:
                try:
                    run_status = db.jobs.get_run(run_id=run.run_id)
                    result_state = run_status.state.result_state
                    if result_state is not None:
                        if str(result_state).__contains__("SUCCESS"):
                            function_response = f"Deck job completed successfully. Deck is available at {deck_path}/deck.pptx"
                            break
                        elif str(result_state).__contains__("FAILED"):
                            function_response = f"Deck job failed. Please check the job logs for more details."
                            break
                except Exception as e:
                    function_response = f"Here is the error : {e}"

    return function_response

def get_list_of_jobs(_) -> List[DBDeckJob]:
    job_list_file = PRECANNED_JOB_FILE
    db_job_list: List[DBDeckJob] = []
    jobs = db.jobs.list()
    bucket_name = env['WORKSPACE_BUCKET_NAME']
    job_list = read_s3_file(bucket_name, job_list_file, get_s3_client(), file_format='json')
    print(f"Job list from S3: {job_list}")
    if job_list is None or not isinstance(job_list, dict) or "job_list" not in job_list:
        job_list = {"job_list": []}
    for job in jobs:
        full_job = db.jobs.get(job_id=job.job_id)
        if full_job.settings.name in [j["job_name"] for j in job_list["job_list"]]:
            for param in full_job.settings.parameters:
                if param.name == 'output_folder':
                    db_job_list.append(DBDeckJob(job_id=str(job.job_id)[0]+"X"+str(job.job_id)[1:], job_name=full_job.settings.name, job_description=full_job.settings.description, deck_path=param.default))
    print(f"Databricks job list: {db_job_list}")
    return db_job_list

def build_precanned_deck_job_list_tool():
    dynamic_description = (
        """
        Useful when you need to find list of databricks jobs that can be used to generate precanned PPT deck.
        This function is for running databricks sdk to find the list of jobs.
        
        Input: None

        Output:
            A list of databricks jobs that can be used to generate precanned PPT deck in the format list[DBDeckJob].

            class DBDeckJob(BaseModel):
                job_id: int
                job_name: str
                job_description: str
                deck_path: str
        """
    )

    return Tool(
        name="get_list_of_jobs",
        description=dynamic_description,
        func=get_list_of_jobs
    )

def build_precanned_deck_job_trigger_tool():
    dynamic_description = (
        f"""
        Useful when you need to trigger a specific databricks job that can be used to generate a precanned PPT deck.
        This function is for running databricks sdk to trigger the job.
        Example output:
            {example_response}
        Input: 
            - job_id: The ID of the job to trigger (retrieved from the job list).
            - deck_path: The path where the generated PPT deck should be saved.
        Output:
            {job_trigger_output_parser}
        """
    )

    return Tool(
        name="trigger_deck_job",
        description=dynamic_description,
        func=lambda x: trigger_deck_job(**json.loads(x)),
    )


if __name__ == "__main__":
    # Example usage
    jobs = get_list_of_jobs('Dummy')
    for job in jobs:
        print(f"Job ID: {job.job_id}, Name: {job.job_name}, Description: {job.job_description}, Deck Path: {job.deck_path}")
    
    # Trigger a specific job
    if jobs:
        response = trigger_deck_job(jobs[0].job_id, jobs[0].deck_path)
        print(response)