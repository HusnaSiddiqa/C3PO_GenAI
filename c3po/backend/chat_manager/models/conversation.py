from pydantic import BaseModel
from typing import Literal, Optional, List, Dict

class FileModel(BaseModel):
    file_id: str
    filename: Optional[str] = None
    file_type: Optional[str] = None

class ConversationRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: str
    file: Optional[FileModel] = None
    benchmarking: Optional[bool] = False
    selected_source: Optional[str] = None
    thinking_enabled: Optional[bool] = False


class ChartModel(BaseModel):
    type: str
    x_field: str
    y_field: str
    data: List[dict]


class ChatMessage(BaseModel):
    timestamp: str
    role: str
    type: str
    summary: Optional[str] = None
    result: Optional[List[dict]] = None
    conversation_id: str
    message_id: Optional[str] = None
    prev_message_id: Optional[str] = None
    chart: Optional[List[dict]] = None
    file: Optional[FileModel] = None
    feedback_rating: Optional[Literal["positive", "negative"]] = None
    feedback_comment: Optional[str] = None
    sql_query: Optional[str] = None
    data_limit_exceeded: Optional[bool] = None


class ConversationResponse(BaseModel):
    conversation_id: str
    user_id: str
    status: str
    created_at: str
    last_updated: str
    messages: List[ChatMessage]


class ConversationThread(BaseModel):
    conversation_id: str
    user_id: str
    status: str
    created_at: str
    last_updated: str
    title: str
    messages: List[ChatMessage]


class OnboardingResponse(BaseModel):
    onboarding_id: str
    updated_by: str
    agent_description: str
    agent_name: str
    updated_at: str


class HistoryItem(BaseModel):
    conversation_id: str
    timestamp: str
    title: str


class ChatHistoryResponse(BaseModel):
    chatHistory: Dict[str, List[HistoryItem]]


class ConversationStatusUpdateResponse(BaseModel):
    conversation_id: str
    status: str
    message: str


class StatusUpdateRequest(BaseModel):
    status: Literal["active", "inactive"]


class RenameTitleRequest(BaseModel):
    conversation_id: str
    title: str


class RenameTitleResponse(BaseModel):
    conversation_id: str
    title: str
    message: str
