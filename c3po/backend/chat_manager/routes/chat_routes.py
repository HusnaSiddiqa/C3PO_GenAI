import uuid
from datetime import datetime, timezone
import os

from boto3.dynamodb.conditions import Key, Attr
from fastapi import APIRouter, HTTPException
from utils.constants import ONBOARDING_TABLE, CONVERSATION_STORE_TABLE, CLICKABLE_QUESTIONS_TABLE, BYOD_FILES_TABLE
from utils.dynamodb import get_table
import json

from utils.s3 import read_s3_file
from ..models.conversation import (
    ChatHistoryResponse,
    ConversationThread,
    OnboardingResponse, ChatMessage, ChartModel, FileModel
)

router = APIRouter()


def generate_id() -> str:
    return str(uuid.uuid4())


# ------------------------
# Clickable Questions
# ------------------------

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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {str(e)}")


@router.get("/clickable")
async def get_clickable_questions():
    try:
        table = get_table(CLICKABLE_QUESTIONS_TABLE)
        response = table.scan()
        items = response.get("Items", [])

        if not items:
            return []
        items = sorted(
            items,
            key=lambda x: int(x.get("order", 0)) if str(x.get("order", "")).isdigit() else 0
        )
        # Transform items to the desired format
        categories = []
        for item in items:
            category = item.get("category", "")
            question = item.get("question", "")
            question_id = item.get("question_id", "")
            enabled = item.get("enabled", False)
            print("===========enabled=======", enabled)
            # Ensure same category can have multiple questions
            if not any(cat["category"] == category for cat in categories) and enabled:
                categories.append({
                    "category": category,
                    "clickable_questions": []
                })
            # Add question to the corresponding category
            for cat in categories:
                if cat["category"] == category:
                    cat["clickable_questions"].append({
                        "id": question_id,
                        "question": question
                    })
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching clickable questions: {str(e)}")


# ------------------------
# Conversation Detail
# ------------------------

@router.get("/conversation/{conversation_id}", response_model=ConversationThread)
async def get_conversation(conversation_id: str):
    """
    Retrieve a conversation thread by conversation ID.
    """
    table = get_table(CONVERSATION_STORE_TABLE)

    try:
        # Fetch conversation metadata
        meta_response = table.get_item(
            Key={
                "PK": f"CONVERSATION#{conversation_id}",
                "SK": "META"
            }
        )
        if "Item" not in meta_response:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if meta_response["Item"].get("status") != "active":
            raise HTTPException(status_code=404, detail="Conversation not found")

        meta_item = meta_response["Item"]

        # Query messages
        messages_response = table.query(
            KeyConditionExpression=Key("PK").eq(f"CONVERSATION#{conversation_id}") & Key("SK").begins_with("MESSAGE#"),
            FilterExpression=Attr("role").ne("system")  # <-- use Attr here, not Key
        )

        messages = []
        for item in messages_response.get("Items", []):
            chart_data = item.get("chart", "[]") 
            try:
                chart_data = json.loads(chart_data)
                if type(chart_data) == dict and chart_data.get("error"):
                    chart_data = []
                else:
                    chart_data = chart_data
            except json.JSONDecodeError:
                chart_data = []
            file = None
            # Handle file data if present
            file_id = item.get("file_id", None)
            if file_id:
                file_table = get_table(BYOD_FILES_TABLE)
                file_item = file_table.get_item(
                    Key={
                        "PK": f"FILE#{file_id}",
                        "SK": "META"
                    }
                ).get("Item", None)

                if file_item:
                    file = FileModel(
                        file_id=file_item.get("file_id", ""),
                        filename=file_item.get("filename", ""),
                        file_type=file_item.get("file_type", "")
                    )

            # Construct chat message
            raw_result = item.get("result", "null")
            try:
                if isinstance(raw_result, str):
                    raw_result = json.loads(raw_result)
            except json.JSONDecodeError:
                raw_result = []

            if isinstance(raw_result, dict):
                result = [raw_result]
            elif isinstance(raw_result, list):
                result = raw_result
            else:
                result = []
            chat_message = ChatMessage(
                timestamp=item.get("timestamp"),
                role=item.get("role"),
                type=item.get("type"),
                summary=item.get("summary", None),
                result=result,                
                conversation_id=item.get("conversation_id"),
                message_id=item.get("message_id"),
                file=file if file else None,
                feedback_rating=item.get("feedback_rating", None),
                feedback_comment=item.get("feedback_comment", None),
                prev_message_id=item.get("prev_message_id", None),
                sql_query=item.get("sql_query", None),
                data_limit_exceeded=item.get("data_limit_exceeded", None)
            )

            if len(chart_data) > 0:
                chat_message.chart = chart_data

            messages.append(chat_message)

        # Return full thread
        return ConversationThread(
            conversation_id=meta_item["conversation_id"],
            user_id=meta_item["user_id"],
            status=meta_item["status"],
            created_at=meta_item["created_at"],
            last_updated=meta_item["last_updated"],
            title=meta_item.get("title", ""),
            messages=messages
        )

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation: {str(e)}")


# ------------------------
# Chat History Summary
# ------------------------

@router.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    user_id: str = None
):
    """
    Retrieve chat history grouped by time (today, yesterday, last 7 days, older).
    """
    try:
        table = get_table(CONVERSATION_STORE_TABLE)
        if not user_id:
            user_id = os.getenv("DEFAULT_USER")
        # Scan for all conversation META items and status should be "active"
        response = table.query(
            IndexName="UserLastUpdated",
            KeyConditionExpression=Key("user_id").eq(user_id),
            FilterExpression="#status_attr = :status AND (attribute_not_exists(#benchmarking_attr) OR #benchmarking_attr = :benchmarking)",
            ExpressionAttributeNames={"#status_attr": "status", "#benchmarking_attr": "benchmarking"},
            ExpressionAttributeValues={":status": "active", ":benchmarking": False},
            ScanIndexForward=False
        )
        # Filter for META items in Python since SK is a primary key
        items = [item for item in response.get("Items", []) if item.get("SK") == "META"]
        items = sorted(
            items,
            key=lambda x: x.get("last_updated", ""),
            reverse=True
        )

        # Prepare buckets
        chat_history = {
            "today": [],
            "yesterday": [],
            "last7Days": [],
            "older": []
        }

        now = datetime.now(timezone.utc)
        for item in items:
            timestamp_str = item.get("last_updated")
            if not timestamp_str:
                continue
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
            except Exception:
                continue

            delta = now - timestamp
            entry = {
                "conversation_id": item.get("conversation_id"),
                "timestamp": timestamp_str,
                "title": item.get("title", "")
            }

            if delta.days == 0 and now.date() == timestamp.date():
                chat_history["today"].append(entry)
            elif delta.days == 1 or (delta.days == 0 and now.date() != timestamp.date()):
                chat_history["yesterday"].append(entry)
            elif 1 < delta.days < 7:
                chat_history["last7Days"].append(entry)
            else:
                chat_history["older"].append(entry)

        return {"chatHistory": chat_history}

    except HTTPException:
        raise
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error retrieving chat history: {str(e)}")
    
# ------------------------
# Get File based on conversation_id
# ------------------------

@router.get("/file/{conversation_id}")
async def get_file(conversation_id: str):
    """
    Retrieve a file based on conversation ID.
    """
    file_table = get_table(BYOD_FILES_TABLE)
    response = file_table.scan(
        FilterExpression=Attr("conversation_id").eq(conversation_id) &
        Attr("type").eq("BYOD")
    )
    items = response.get("Items", [])
    if not items:
        raise HTTPException(status_code=404, detail="File not found")
    item = items[0]
    return {
        "file_id": item.get("file_id"),
        "filename": item.get("filename"),
        "s3_path": item.get("s3_path")
    }
    
