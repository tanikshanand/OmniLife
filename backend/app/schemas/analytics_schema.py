import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DailyLogCreate(BaseModel):
    log_date: Optional[date] = None
    energy_level: int = Field(default=3, ge=1, le=5)
    accomplishments: Optional[str] = None
    blockers: Optional[str] = None
    tomorrow_priorities: Optional[str] = None


class DailyLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    log_date: date
    energy_level: int
    accomplishments: Optional[str] = None
    blockers: Optional[str] = None
    tomorrow_priorities: Optional[str] = None
    created_at: datetime
