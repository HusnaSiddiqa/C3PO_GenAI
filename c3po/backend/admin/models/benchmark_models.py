from pydantic import BaseModel
from typing import Optional


class BYODData(BaseModel):
    file_url: str
    filename: str
    file_id: str
    file_type: str


class BenchmarkRequest(BaseModel):
    user_id: str
    agent_name: str
    BYOD_data: Optional[BYODData] = None
    version_alias: Optional[str] = None
