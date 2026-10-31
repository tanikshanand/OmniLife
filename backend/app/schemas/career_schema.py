from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RoadmapRequest(BaseModel):
    role_id: str
    weeks: int = Field(default=4, ge=1, le=26)


class SkillGapItem(BaseModel):
    name: str
    category: str = "General"
    is_mastered: bool = False
    proficiency: str = "None"
    importance: str = "Recommended"


class GapAnalysisResponse(BaseModel):
    role_id: str
    role_title: str
    match_percent: float
    mastered_skills: List[SkillGapItem] = []
    in_progress_skills: List[SkillGapItem] = []
    missing_skills: List[SkillGapItem] = []
    total_required: int = 0


class RoadmapResponse(BaseModel):
    role_id: str
    role_title: str
    weeks: int
    roadmap: Dict[str, Any]
