from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, APIRouter, Query, Body
from utils.constants import CONVERSATION_STORE_TABLE
from utils.dynamodb import (get_table)
from boto3.dynamodb.conditions import Key, Attr


# --- Admin API for dynamic table access ---
router = APIRouter()


chat_feedback_table = get_table(CONVERSATION_STORE_TABLE)

# --- Admin Feedback Routes ---

# GET /admin/feedback
# Query: days: int (default 30), prompt: Optional[str], user_id: Optional[str]
# Returns: List of feedback entries
# Auth: Admin only
@router.get("/admin/feedback")
def get_feedback(
    search: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    rating: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),  
    date_to: Optional[str] = Query(None),    
    days: int = Query(30, ge=1, le=365)
):
    """
    Get feedback entries for admin review.
    Uses feedback_date_index if user_id is provided,
    feedback_global_date_index if not.
    """

    since = (datetime.utcnow() - timedelta(days=days)).isoformat()
    start_date = date_from or since
    end_date = date_to or datetime.utcnow().isoformat()

    try:
        # Case 1: Filter by user_id (use feedback_date_index)
        if user_id:
            response = chat_feedback_table.query(
                IndexName="feedback_date_index",
                KeyConditionExpression=(
                    Key("user_id").eq(user_id) &
                    Key("feedback_created_at").between(start_date, end_date)
                ),
                ScanIndexForward=False
            )
            items = response.get("Items", [])

        # Case 2: No user_id, query global date index
        else:
            response = chat_feedback_table.query(
                IndexName="feedback_global_date_index",
                KeyConditionExpression=(
                    Key("feedback_pk").eq("FEEDBACK") &
                    Key("feedback_created_at").between(start_date, end_date)
                ),
                ScanIndexForward=False
            )
            items = response.get("Items", [])

        # Filter by rating if provided
        if rating:
            items = [i for i in items if i.get("feedback_rating") == rating]

        # Filter by search if provided
        if search:
            search_lower = search.lower()
            items = [
                i for i in items
                if search_lower in (i.get("feedback_prompt") or "").lower()
                or search_lower in (i.get("user_id") or "").lower()
                or search_lower in (i.get("feedback_comment") or "").lower()
                or search_lower in (i.get("feedback_response") or "").lower()
            ]

        # Only keep records with feedback or rating
        items = [
            i for i in items
            if i.get("feedback_comment") or i.get("feedback_rating")
        ]

        # Sort newest first (just in case)
        items.sort(key=lambda x: x.get("feedback_created_at", ""), reverse=True)

        # Final mapping
        result = [
            {
                "rating": i.get("feedback_rating"),
                "user_id": i.get("user_id"),
                "Agent": i.get("agent", "C3PO"),
                "prompt": i.get("feedback_prompt"),
                "response": i.get("feedback_response"),
                "feedback": i.get("feedback_comment"),
                "date": i.get("feedback_created_at"),
                "sql_query": i.get("feedback_sql_query"),
                "id": i.get("message_id"),
                "conversation_id": i.get("conversation_id"),
            }
            for i in items
        ]

        return result

    except Exception as e:
        print(f"Error retrieving feedback entries: {e}")
        return []

def full_table_scan(table):
    """Helper to scan the entire table (no pagination in response)"""
    items = []
    last_evaluated_key = None

    while True:
        scan_kwargs = {}
        if last_evaluated_key:
            scan_kwargs['ExclusiveStartKey'] = last_evaluated_key

        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))

        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            break

    return items


## GET /admin/feedback/user
# Returns: List of unique user_ids from feedback entries
# Auth: Admin only
@router.get("/admin/feedback/user")
def get_feedback_users():
    """
    Get a sorted list of unique user_ids from feedback entries for use in a dropdown.
    Admin only.
    """
    try:
        # Attempt to fetch user_ids from DynamoDB
        response = chat_feedback_table.scan()
        items = response.get('Items', [])
        user_ids = set(item.get('user_id') for item in items if item.get('user_id'))
        return sorted(user_ids)

    except Exception as e:
        print(f"Error retrieving user_ids from feedback: {e}")
        # Mock response in case of DynamoDB failure
        return [
            "mock-user-1",
            "mock-user-2",
            "mock-user-3"
        ]


# GET /admin/feedback/{message_id}
# Returns: Detailed feedback info for a given message_id
# Auth: Admin only
# Fields returned: user_id, rating, prompt, agent, response, feedback, sql_query
# Use case: Admins can view all details of a specific feedback entry for review or audit
@router.get("/admin/feedback/{message_id}")
def get_feedback_detail(message_id: str):
    """
    Get detailed feedback info for a given message_id.
    Returns: {user_id, rating, prompt, agent, response, feedback, sql_query}
    """
    try:
        # Scan for the message_id in the SK since it's embedded as MESSAGE#{timestamp}#{message_id}
        scan_response = chat_feedback_table.query(
            IndexName="feedback_global_date_index",
            KeyConditionExpression=(
                Key("feedback_pk").eq("FEEDBACK") &
                Key("message_id").eq(message_id)
            ),
            ScanIndexForward=True
        )
        
        items = scan_response.get('Items', [])
        if not items:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        target_item = items[0]
        
        return {
            'user_id': target_item.get('user_id'),
            'rating': target_item.get('feedback_rating'),
            'prompt': target_item.get('feedback_prompt'),
            'agent': target_item.get('agent', 'C3PO'),  # Default to C3PO if not set
            'response': target_item.get('feedback_response'),
            'feedback': target_item.get('feedback_comment'),
            'sql_query': target_item.get('feedback_sql_query'),
        }

    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"Error retrieving feedback details for message_id {message_id}: {error_msg}")
        print(f"Error type: {type(e).__name__}")
        # Mock response in case of DynamoDB failure
        return {
            'user_id': "mock-user",
            'rating': "5",
            'prompt': f"Mock prompt for message_id {message_id}",
            'agent': "C3PO",
            'response': f"Mock response for message_id {message_id}",
            'feedback': "This is a mock feedback comment.",
            'sql_query': f"SELECT * FROM mock_table WHERE id = '{message_id}';"
        }


# PUT /admin/feedback/{message_id}
# Allows admin to update the sql_query, feedback_updated_at, and feedback_updated_by fields for a feedback entry
# Auth: Admin only
# Use case: Admins can save or correct the SQL query associated with a feedback
@router.put("/admin/feedback/{message_id}")
def review_feedback(
    message_id: str,
    sql_query: str = Body(...),
    conversation_id: str = Body(...),
    user_id: str = Body(...),  # User ID of the admin making the update
):
    """
    Update the sql_query, feedback_updated_at, and feedback_updated_by fields for a feedback entry (admin only).
    Request: {sql_query, admin_user_id}
    Response: {status: 'updated'}
    """
    if not sql_query:
        return {"status": "no changes"}
    
    try:
        # Get the current timestamp for feedback_updated_at
        feedback_updated_at = datetime.utcnow().isoformat()

        # First, we need to find the item by scanning for the message_id in the SK
        # Since the message_id is embedded in the SK as MESSAGE#{timestamp}#{message_id}
        scan_response = chat_feedback_table.query(
            IndexName="feedback_pk-conversation",
            KeyConditionExpression=(
                Key("feedback_pk").eq("FEEDBACK") &
                Key("conversation_id").eq(conversation_id)
            ),
            ScanIndexForward=True
        )
        
        items = scan_response.get('Items', [])
        if not items:
            raise HTTPException(status_code=404, detail="Feedback entry not found")
        
        # filter the item by message_id
        target_item = [i for i in items if i.get('message_id') == message_id][0]

        if not target_item:
            raise HTTPException(status_code=404, detail="Feedback entry not found")
        
        # Extract the PK and SK for the update
        pk = target_item['PK']
        sk = target_item['SK']
        
        print(f"Found item with PK: {pk}, SK: {sk}")

        # Attempt to update the sql_query, feedback_updated_at, and feedback_updated_by fields in DynamoDB
        update_response = chat_feedback_table.update_item(
            Key={
                "PK": pk,
                "SK": sk
            },
            UpdateExpression="SET feedback_sql_query = :sql_query, feedback_updated_at = :feedback_updated_at, feedback_updated_by = :feedback_updated_by",
            ExpressionAttributeValues={
                ":sql_query": sql_query,
                ":feedback_updated_at": feedback_updated_at,
                ":feedback_updated_by": user_id
            },
            ReturnValues="UPDATED_NEW"
        )
        
        print(f"Successfully updated feedback for message_id {message_id}")
        return {
            "status": "updated",
            "message_id": message_id,
            "pk": pk,
            "sk": sk,
            "updated_fields": {
                "feedback_sql_query": sql_query,
                "feedback_updated_at": feedback_updated_at,
                "feedback_updated_by": user_id
            }
        }

    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"Error updating feedback for message_id {message_id}: {error_msg}")
        print(f"Error type: {type(e).__name__}")
        
        # Return more detailed error information for debugging
        return {
            "status": "error",
            "message": f"Failed to update feedback for message_id {message_id}",
            "error_details": error_msg,
            "error_type": type(e).__name__
        }



# Create a api if feedback_rating found in conversation_store table update the feedback_pk to FEEDBACK
@router.post("/admin/feedback/update_feedback_pk")
def update_feedback_pk():
    """
    Update the feedback_pk to FEEDBACK if feedback_rating is found in conversation_store table
    """
    try:
        # Get all items from conversation_store table
        response = full_table_scan(chat_feedback_table)
        items = response

        # Update the feedback_pk to FEEDBACK if feedback_rating is found and check count
        count = 0
        for item in items:
            if item.get('feedback_rating'):
                chat_feedback_table.update_item(
                    Key={'PK': item['PK'], 'SK': item['SK']},
                    UpdateExpression='SET feedback_pk = :new_pk',
                    ExpressionAttributeValues={':new_pk': 'FEEDBACK'}
                )
                count += 1
        return {"status": "success", "message": f"Updated {count} items"}
    except Exception as e:
        print(f"Error updating feedback_pk: {e}")
        return {"status": "error", "message": str(e)}