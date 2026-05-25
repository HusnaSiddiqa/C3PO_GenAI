import os

from admin.models.admin_chat_models import CreatePromptRequest, CreatePromptResponse, GetPromptResponse, \
    LatestPromptResponse
from core.prompt.PromptStore import PromptStore
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from utils.constants import PROMPT_PATH
from utils.generic import flatten_dict, expand_dict

load_dotenv()

mlflow_tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "databricks")
app = FastAPI()


# Dynamically create PromptStore for each agent
def get_prompt_store(agent_name: str) -> PromptStore:
    return PromptStore(
        prompt_type=agent_name,
        prompt_path=PROMPT_PATH
    )


def create_prompt(agent_name: str, request: CreatePromptRequest, 
                  model_base_url: str = "", user_id: str = ""):
    store = get_prompt_store(agent_name)

    version_alias = store.store_prompt(
        prompt=request.prompt,
        model_base_url=model_base_url,
        user=user_id,
        **{ key: value for key, value in 
           flatten_dict(
               request.model_dump(
                   exclude={"prompt", "agent_id", "user_id"},
                   mode='json'
                )
            ).items()
           if value is not None }
    )

    return CreatePromptResponse(
        agent_name=agent_name,
        version_alias=version_alias,
        **request.model_dump(),
    )


def get_prompt(agent: str, version: str):
    store = get_prompt_store(agent)

    try:
        data = store.load_prompt(version_alias=version)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    return GetPromptResponse(
        agent=agent,
        **expand_dict(data),
    )


def get_latest_prompt(agent_id: str):
    store = get_prompt_store(agent_id)

    versions = store.list_versions()
    if not versions:
        raise HTTPException(
            status_code=404,
            detail=f"No versions found for agent {agent_id}"
        )

    latest_version = sorted(
        versions,
        key=lambda v: float(v),
        reverse=True
    )[0]

    try:
        data = store.load_prompt(version_alias=latest_version)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    return LatestPromptResponse(
        agent_id=agent_id,
        versions=versions,
        **expand_dict(data)
    )
