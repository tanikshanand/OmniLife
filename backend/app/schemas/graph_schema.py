from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class NodeCreate(BaseModel):
    label: str = Field(description="User, Skill, Project, Goal, Topic, Person, Institution")
    name: str
    properties: Dict[str, Any] = {}


class RelationCreate(BaseModel):
    source_id: str
    target_id: str
    label: str
    properties: Dict[str, Any] = {}


class GraphNode(BaseModel):
    id: str
    name: str
    label: str
    val: int = 10
    color: str = "#06b6d4"
    properties: Dict[str, Any] = {}


class GraphLink(BaseModel):
    source: str
    target: str
    label: str
    properties: Dict[str, Any] = {}


class GraphVisualizationData(BaseModel):
    nodes: List[GraphNode] = []
    links: List[GraphLink] = []
    meta: Optional[Dict[str, Any]] = None
