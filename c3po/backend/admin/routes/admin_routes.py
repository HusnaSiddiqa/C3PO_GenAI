import os
import traceback
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException
from utils import mlflow_agents
from utils.constants import ONBOARDING_TABLE, INSTRUCTIONS_TABLE, ADMIN_CONFIG_TABLE
from utils.dynamodb import get_table, value_exists_already, _scan_first_match
from boto3.dynamodb.conditions import Attr

from ..models.admin_chat_models import (
    EmbeddingModel,
    EmbeddingModelsResponse,
    KnowledgeStore,
    KnowledgeStoresResponse,
    OnboardingResponse,
    OnboardingUpdateRequest, InstructionsResponse, InstructionsUpdateRequest, AgentsListResponse, AgentListItem, SubAgentListItem, SubAgentsListResponse,
    CreatePromptResponse, CreatePromptRequest, GetPromptResponse, LatestPromptResponse, CreateSubAgentRequest, DeletePromptResponse
)

router = APIRouter()


def generate_id() -> str:
    return str(uuid.uuid4())


@router.get("/onboarding", response_model=OnboardingResponse)
async def get_onboarding():
    """
    Retrieve onboarding information for the AI agent from DynamoDB.
    """
    try:
        table = get_table(ONBOARDING_TABLE)
        response = table.scan(Limit=1)
        items = response.get("Items", [])

        if not items:
            raise HTTPException(status_code=404, detail="Onboarding data not found")

        item = items[0]

        return OnboardingResponse(
            onboarding_id=item.get("onboarding_id", ""),
            updated_by=item.get("updated_by", ""),
            agent_description=item.get("agent_description", ""),
            agent_name=item.get("agent_name", ""),
            updated_at=item.get("updated_at", "")
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {str(e)}")


@router.put("/onboarding", response_model=OnboardingResponse)
async def update_onboarding(request: OnboardingUpdateRequest):
    """
    Update onboarding information for the AI agent in DynamoDB.
    """
    try:
        table = get_table(ONBOARDING_TABLE)
        now = datetime.utcnow().isoformat() + "Z"
        onboarding_id = request.onboarding_id if request.onboarding_id else generate_id()

        # Check if onboarding item already exists
        response = table.query(
            KeyConditionExpression="onboarding_id = :onboarding_id",
            ExpressionAttributeValues={":onboarding_id": request.onboarding_id}
        )

        if response.get("Items"):
            # If exists, use existing onboarding_id
            existing_item = response["Items"][0]
            onboarding_id = existing_item["onboarding_id"]

        # Update or insert the onboarding item
        table.put_item(Item={
            "onboarding_id": onboarding_id,
            "agent_name": request.agent_name,
            "agent_description": request.agent_description,
            "updated_by": request.updated_by,
            "updated_at": now
        })

        return OnboardingResponse(
            onboarding_id=onboarding_id,
            agent_name=request.agent_name,
            agent_description=request.agent_description,
            updated_by=request.updated_by,
            updated_at=now
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {str(e)}")


@router.get("/instructions", response_model=List[InstructionsResponse])
async def get_instructions():
    """
    Retrieve general instructions, business rules, and data handling instructions for the AI agent.
    """
    try:
        table = get_table(INSTRUCTIONS_TABLE)
        response = table.scan()
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="Instructions not found")

        response = [
            InstructionsResponse(
                instruction_id=item.get("instruction_id", ""),
                category=item.get("category", ""),
                description=item.get("description", ""),
                updated_by=item.get("updated_by", ""),
                updated_at=item.get("updated_at", "")
            ) for item in items
        ]

        response.sort(reverse=True, key=lambda x: x.updated_at)

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving instructions: {str(e)}")


@router.put("/instructions", response_model=InstructionsResponse)
async def update_instructions(request: InstructionsUpdateRequest):
    """
    Update instructions for the AI agent in DynamoDB.
    """
    try:
        table = get_table(INSTRUCTIONS_TABLE)
        now = datetime.now(timezone.utc).isoformat()

        response = table.query(
            KeyConditionExpression="instruction_id = :instruction_id",
            ExpressionAttributeValues={":instruction_id": request.instruction_id}
        )
        if not response.get("Items"):
            raise HTTPException(status_code=404, detail="Instructions data not found")

        existing_item = response["Items"][0]
        existing_category = existing_item["category"]

        # Update or insert the instructions item
        table.put_item(Item={
            "instruction_id": request.instruction_id,
            "category": existing_category,
            "description": request.description,
            "updated_by": request.updated_by,
            "updated_at": now
        })

        return InstructionsResponse(
            instruction_id=request.instruction_id,
            category=existing_category,
            description=request.description,
            updated_by=request.updated_by,
            updated_at=now
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {str(e)}")


@router.get("/prompt-template/agents", response_model=AgentsListResponse)
async def get_agent_prompt_template():
    """
    Retrieve all the agents from db
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        response = table.scan()
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No agents found")

        agents = [
            AgentListItem(
                id=item.get("KeyId", ""),
                name=item.get("value", "")

            ) for item in items if item.get("type") == "agent"
        ]

        return AgentsListResponse(agents=agents)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving agents: {str(e)}")


@router.put("/prompt-template/sub-agent", response_model=CreatePromptResponse)
async def create_sub_agent_dynamodb(agent_request: CreateSubAgentRequest):
    """
    Create agent entry in db
    """
    try:
        agent_name = agent_request.agent_name
        if not agent_name:
            raise HTTPException(status_code=400, detail="Please provide agent details")
        table = get_table(ADMIN_CONFIG_TABLE)
        value = value_exists_already(table, agent_name)
        key_id = str(uuid.uuid4())
        if value and value['KeyId']:
            key_id = value['KeyId']
        table.put_item(
            Item={
                "KeyId": key_id,
                "base_url": "",
                "type": "sub-agent",
                "value": agent_name,
                "description": agent_request.agent_description,
                "agent_type": agent_request.agent_type,
                "relates_to": agent_request.relates_to
            },
        )
        user_id = agent_request.user_id or os.getenv("DEFAULT_USER")
        model = agent_request.model
        item = _scan_first_match(
            table,
            Attr("type").eq("model") & Attr("value").eq(model),
            projection="base_url"
        )
        model_base_url = item.get("base_url")
        if not model_base_url:
            raise HTTPException(status_code=404, detail=f"Model '{model}' not found in configuration")

        prompt_request = CreatePromptRequest(agent_id=key_id, **agent_request.model_dump(exclude={"agent_name", "agent_description", "agent_type", "relates_to"}))

        agent = mlflow_agents.create_prompt(agent_name, prompt_request, model_base_url,
                                            user_id)
        return agent
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating agent: {str(e)}")

@router.delete("/prompt-template/sub-agent/{agent_name}", response_model=DeletePromptResponse)
async def delete_sub_agent(agent_name: str):
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        item = _scan_first_match(
            table,
            Attr("type").eq("sub-agent") & Attr("value").eq(agent_name)
        )
        if not item:
            raise HTTPException(status_code=404, detail=f"Sub-agent '{agent_name}' not found")

        key_id = item.get("KeyId")
        table.delete_item(Key={"KeyId": key_id})

        store = mlflow_agents.get_prompt_store(agent_name)
        deleted = store.delete_prompt()
        if not deleted:
            raise HTTPException(
                status_code=500,
                detail=f"Sub-agent '{agent_name}' config deleted, but failed to delete associated MLflow experiment"
            )
        result = DeletePromptResponse(success=True, message=f"Sub-agent '{agent_name}' and its MLflow experiment deleted successfully", agent_name=agent_name, agent_id=key_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating agent: {str(e)}")

@router.get("/prompt-template/sub-agents", response_model=SubAgentsListResponse)
async def create_sub_agent_dynamodb():
    """
    Retrieve all the sub-agents from db
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        resp = table.scan(
            FilterExpression=Attr("type").eq("sub-agent")
        )
        items = resp.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No agents found")

        return SubAgentsListResponse(
            sub_agents=[SubAgentListItem(id=i.get("KeyId", ""), name=i.get("value", ""), agent_type=i.get("agent_type", "") ,description=i.get("description", ""), relates_to=i.get("relates_to", [])) for i in items]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving agents: {str(e)}")

@router.get("/prompt-template/knowledge-stores", response_model=KnowledgeStoresResponse)
async def get_knowledge_stores():
    """
    Retrieve all knowledge stores from db
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        resp = table.scan(
            FilterExpression=Attr("type").eq("knowledge-store")
        )
        items = resp.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No knowledge stores found")

        return KnowledgeStoresResponse(
            knowledge_stores=[
                KnowledgeStore(
                    id=i.get("id", ""),
                    name=i.get("value", ""),
                ) for i in items
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving knowledge stores: {str(e)}")

@router.get("/prompt-template/embedding-models", response_model=EmbeddingModelsResponse)
async def get_embedding_models():
    """
    Retrieve all embedding models from db
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        resp = table.scan(
            FilterExpression=Attr("type").eq("embedding-model")
        )
        items = resp.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No embedding models found")

        return EmbeddingModelsResponse(
            embedding_models=[
                EmbeddingModel(
                    id=i.get("id", ""),
                    name=i.get("value", ""),
                ) for i in items
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving embedding models: {str(e)}")

@router.get("/prompt-template/sub-agent/{agent_type}", response_model=SubAgentsListResponse)
async def get_sub_agents(agent_type):
    """
    Retrieve all the sub-agents of agent_type
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        resp = table.scan(
            FilterExpression=Attr("type").eq("sub-agent") & Attr("agent_type").eq(agent_type)
        )
        items = resp.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No agents found")

        return SubAgentsListResponse(
            sub_agents=[SubAgentListItem(id=i.get("KeyId", ""), name=i.get("value", ""), description=i.get("description", ""), relates_to=i.get("relates_to", []), agent_type=i.get("agent_type", "")) for i in items]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving agents: {str(e)}")

@router.get("/prompt-template/agent_types", response_model=AgentsListResponse)
async def get_agent_type():
    """
    Retrieve all the agent-types from db
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        resp = table.scan(
            FilterExpression=Attr("type_flag").eq(True),
            ProjectionExpression="KeyId, #v",
            ExpressionAttributeNames={"#v": "value"},
        )
        items = resp.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No agent types found")

        return AgentsListResponse(
            agents=[AgentListItem(id=i.get("KeyId", ""), name=i.get("value", "")) for i in items]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving agents: {str(e)}")


# Create a new version for prompts and return the prompt and its version.
@router.put("/prompt-template/{agent_id}",
            response_model=CreatePromptResponse)
async def create_prompt_template(agent_id: str, prompt_template_request: CreatePromptRequest):
    """
    Create a new version of the prompt template for the specified agent.
    """
    try:
        if not prompt_template_request.user_id:
            prompt_template_request.user_id = os.getenv("DEFAULT_USER")
        table = get_table(ADMIN_CONFIG_TABLE)
        response = table.scan()
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No agents found")

        agent_name = next((item for item in items if item.get("KeyId") == agent_id and item.get("type") in ["agent", "sub-agent"]),
                          {}).get("value", None)
        if not agent_name:
            raise HTTPException(status_code=404, detail=f"Agent with ID {agent_id} not found")

        model = prompt_template_request.model
        model_base_url = ""
        for item in items:
            if item.get("type") == "model" and item.get("value") == model:
                model_base_url = item.get("base_url", "")
                break
        if not model_base_url:
            raise HTTPException(status_code=404, detail=f"Model {model} not found in configuration")

    except HTTPException:
        # Re-raise HTTP exceptions (like 404) without wrapping them
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving agents: {str(e)}")

    agent = mlflow_agents.create_prompt(agent_name, prompt_template_request, 
                                        model_base_url,
                                        prompt_template_request.user_id)
    return agent


# Fetch the prompt template for a specific agent and version.
@router.get("/prompt-template/{agent}/{version}", response_model=GetPromptResponse)
async def get_prompt_template_by_version(agent: str, version: str):
    """
    Retrieve the prompt template for a specific agent and version.
    """
    agent = mlflow_agents.get_prompt(agent=agent, version=str(version))
    return agent


# Fetch the latest versions if given an agent name
@router.get("/prompt-template/agent-versions/latest/{agent}",
            response_model=LatestPromptResponse)
async def get_latest_prompt_template(agent: str):
    """
    Retrieve the latest versions of the prompt template for a specific agent.
    """
    version_response = mlflow_agents.get_latest_prompt(agent)
    return version_response


@router.get("/prompt-template/models", response_model=List[str])
async def get_available_models():
    """
    Retrieve a list of available models for the AI agent.
    """
    try:
        table = get_table(ADMIN_CONFIG_TABLE)
        response = table.scan()
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="No models found")

        models = [item.get("value", "") for item in items if item.get("type") == "model"]
        return models

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving models: {str(e)}")
