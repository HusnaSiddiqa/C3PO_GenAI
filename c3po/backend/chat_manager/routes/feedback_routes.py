import os
from datetime import datetime

from fastapi import APIRouter, Path, HTTPException
from utils.constants import CONVERSATION_STORE_TABLE
from utils.dynamodb import get_table
from boto3.dynamodb.conditions import Key, Attr

from ..models.feedback import (
    MessageFeedbackRequest,
    FeedbackResponse
)

router = APIRouter()


@router.post("/message/{message_id}", response_model=FeedbackResponse)
async def send_message_feedback(
        message_id: str = Path(..., description="The ID of the message to provide feedback for"),
        request_body: MessageFeedbackRequest = ...
):
    timestamp = datetime.utcnow().isoformat() + "Z"
    
        # Try to get user_id from request, then from environment variables, then throw error if still empty
    user_id = request_body.user_id.strip() if request_body.user_id and request_body.user_id.strip() else ""
    
    if not user_id:
        # Try to get from environment variables (in order of preference)
        user_id = os.getenv('DEFAULT_USER', '').strip()
        

    
    if not user_id:
        # If still empty, throw error
        raise HTTPException(
            status_code=400, 
            detail="user_id is required. Please provide user_id in request or set one of these environment variables: DEFAULT_USER"
        )
    

    
    try:
        table = get_table(CONVERSATION_STORE_TABLE)
        items = []  # Initialize items to empty list

        try:
            # First get all messages for this conversation
            messages_response = table.query(
                KeyConditionExpression=Key("PK").eq(f"CONVERSATION#{request_body.conversation_id}")
            )
            all_items = messages_response.get("Items", [])
            items = [item for item in all_items if message_id in item.get('SK', '')]
        except Exception as e:
            # items remains empty list if query fails
            pass

        if not items:
            raise HTTPException(status_code=404, detail="Message not found")

        # Get the first item that contains the message_id in SK
        target_item = items[0] if items else None

        if not target_item:
            raise HTTPException(status_code=404, detail="Message not found")

        # Extract the PK and SK for the update
        pk = target_item['PK']
        sk = target_item['SK']



        current_message = table.get_item(
            Key={
                "PK": pk,
                "SK": sk
            }
        ).get("Item")
        if not current_message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        response = table.query(
            KeyConditionExpression=Key("PK").eq(f"CONVERSATION#{request_body.conversation_id}")
        )
        all_items = response.get("Items", [])
        items = [item for item in all_items if item.get('message_id') == current_message.get('prev_message_id')]
        previous_message = items[0] if items else None

        
        feedback_response = FeedbackResponse(
                feedback_rating=request_body.feedback_rating,
                feedback_comment=request_body.feedback_comment,
                feedback_created_at=timestamp,
                feedback_sql_query=current_message.get('sql_query', ""),
                feedback_prompt=previous_message.get('summary') if previous_message and previous_message.get('summary') else "",
                feedback_response=current_message.get('summary', ""),
                feedback_updated_at=timestamp,
                feedback_updated_by=user_id,
                feedback_pk='FEEDBACK',
            )

        try:
            feedback_response_dict = feedback_response.model_dump()
            feedback_response_dict["feedback_pk"] = "FEEDBACK"
            feedback_response_dict["user_id"] = user_id  # Use the processed user_id
            current_message.update(feedback_response_dict)
        except Exception as e:
            pass

        table.put_item(Item=current_message)

        return feedback_response

    except HTTPException:
        # Re-raise HTTP exceptions (like 404) without wrapping them
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {str(e)}")
