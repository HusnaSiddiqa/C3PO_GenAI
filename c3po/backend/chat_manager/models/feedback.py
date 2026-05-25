from pydantic import BaseModel, validator
from typing import Literal, Optional


class MessageFeedbackRequest(BaseModel):
    user_id: Optional[str] = None
    feedback_rating: Literal["positive", "negative"]
    feedback_comment: Optional[str] = None
    message_id: str
    conversation_id: str
    assistant_message_timestamp: str


class FeedbackResponse(BaseModel):
    feedback_rating: Optional[Literal["positive", "negative"]] = None
    feedback_comment: Optional[str] = None
    feedback_created_at: Optional[str] = None
    feedback_sql_query: Optional[str] = None
    feedback_prompt: Optional[str] = None
    feedback_response: Optional[str] = None
    feedback_updated_at: Optional[str] = None
    feedback_updated_by: Optional[str] = None
