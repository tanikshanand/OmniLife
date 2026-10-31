import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "TODO"
    priority: str = "MEDIUM"
    estimated_hours: str = "2"
    skill_tags: str = ""
    milestone_id: Optional[uuid.UUID] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    estimated_hours: Optional[str] = None
    skill_tags: Optional[str] = None


class TaskStatusUpdate(BaseModel):
    status: str = Field(pattern="^(TODO|IN_PROGRESS|BLOCKED|DONE)$")


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    estimated_hours: str
    skill_tags: str
    completed_at: Optional[datetime] = None
    created_at: datetime


class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    sequence_order: int = 0
    due_date: Optional[date] = None


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sequence_order: Optional[int] = None
    is_completed: Optional[bool] = None
    due_date: Optional[date] = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    title: str
    description: Optional[str] = None
    sequence_order: int
    is_completed: bool
    due_date: Optional[date] = None
    tasks: List[TaskResponse] = []


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "Career"
    target_date: Optional[date] = None
    status: str = "ACTIVE"


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_date: Optional[date] = None
    status: Optional[str] = None
    progress_percent: Optional[int] = Field(default=None, ge=0, le=100)


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    category: str
    target_date: Optional[date] = None
    status: str
    progress_percent: int
    created_at: datetime
    milestones: List[MilestoneResponse] = []


class KanbanColumn(BaseModel):
    status: str
    tasks: List[TaskResponse] = []
