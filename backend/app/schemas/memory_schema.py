import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class QuickNoteCreate(BaseModel):
    content: str = Field(min_length=1)
    tags: List[str] = []


class MemoryChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: Optional[uuid.UUID] = None
    user_id: uuid.UUID
    chroma_id: str
    chunk_index: int
    content: str
    extracted_entities: dict = {}
    tags: str = ""
    created_at: datetime


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    file_type: str
    file_size: int
    raw_text_preview: Optional[str] = None
    source_type: str
    created_at: datetime
    chunk_count: int = 0


class PaginatedChunks(BaseModel):
    items: List[MemoryChunkResponse] = []
    total: int = 0
    page: int = 1
    limit: int = 20
    pages: int = 0
