import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChatSessionCreate(BaseModel):
    title: str = Field(default="New Conversation", max_length=255)
    mode: str = Field(default="MENTOR", pattern="^(MENTOR|CLONE)$")


class ChatRequest(BaseModel):
    session_id: Optional[uuid.UUID] = None
    query: str = Field(min_length=1)
    mode: str = Field(default="MENTOR", pattern="^(MENTOR|CLONE)$")


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    sources_cited: List = []
    created_at: datetime


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    active_mode: str
    created_at: datetime
    updated_at: datetime


class ChatSessionDetail(ChatSessionResponse):
    messages: List[MessageResponse] = []
