from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.graph_schema import (
    GraphNode,
    GraphVisualizationData,
    NodeCreate,
    RelationCreate,
)
from app.services.graph_engine import graph_engine

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


@router.get("/subgraph", response_model=GraphVisualizationData)
async def get_subgraph(
    depth: int = Query(default=2, ge=1, le=4),
    limit: int = Query(default=150, ge=10, le=1000),
    current_user: User = Depends(get_current_user),
):
    data = await graph_engine.get_user_subgraph(
        str(current_user.id), depth=depth, limit=limit
    )
    return GraphVisualizationData(**data)


@router.get("/nodes/{node_id}")
async def get_node_details(
    node_id: str, current_user: User = Depends(get_current_user)
):
    data = await graph_engine.get_user_subgraph(
        str(current_user.id), depth=2, limit=500
    )
    node = next((n for n in data["nodes"] if n["id"] == node_id), None)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Graph node not found"
        )
    neighbors = [
        link
        for link in data["links"]
        if link["source"] == node_id or link["target"] == node_id
    ]
    related_ids = set()
    for link in neighbors:
        related_ids.add(link["source"])
        related_ids.add(link["target"])
    related_nodes = [n for n in data["nodes"] if n["id"] in related_ids]
    return {"node": node, "links": neighbors, "neighbors": related_nodes}


@router.post("/nodes", response_model=GraphNode, status_code=status.HTTP_201_CREATED)
async def create_node(
    payload: NodeCreate, current_user: User = Depends(get_current_user)
):
    try:
        node = await graph_engine.create_node(
            str(current_user.id), payload.label, payload.name, payload.properties
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    from app.services.graph_engine import NODE_COLORS, NODE_SIZES

    label = node.get("label", payload.label)
    return GraphNode(
        id=node["id"],
        name=node["name"],
        label=label,
        val=NODE_SIZES.get(label, 10),
        color=NODE_COLORS.get(label, "#06b6d4"),
        properties=node.get("properties", {}),
    )


@router.post("/relationships", status_code=status.HTTP_201_CREATED)
async def create_relationship(
    payload: RelationCreate, current_user: User = Depends(get_current_user)
):
    await graph_engine.create_relationship(
        str(current_user.id),
        payload.source_id,
        payload.target_id,
        payload.label,
        payload.properties,
    )
    return {
        "source": payload.source_id,
        "target": payload.target_id,
        "label": payload.label,
        "properties": payload.properties,
    }


@router.delete("/relationships", status_code=status.HTTP_200_OK)
async def delete_relationship(
    source_id: str = Query(...),
    target_id: str = Query(...),
    label: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
):
    success = await graph_engine.delete_relationship(
        str(current_user.id), source_id, target_id, label
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relationship not found between specified nodes",
        )
    return {"status": "deleted", "source": source_id, "target": target_id}


@router.delete("/relationships/by-names", status_code=status.HTTP_200_OK)
async def delete_relationship_by_names(
    source_name: str = Query(...),
    target_name: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    count = await graph_engine.delete_relationship_between_entities(
        str(current_user.id), source_name, target_name
    )
    return {"status": "ok", "deleted_count": count}


@router.patch("/nodes/{node_id}")
async def update_node(
    node_id: str,
    properties: dict,
    current_user: User = Depends(get_current_user),
):
    updated = await graph_engine.update_node_properties(
        str(current_user.id), node_id, properties
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Node not found or not editable"
        )
    return updated


@router.get("/facts")
async def get_facts(current_user: User = Depends(get_current_user)):
    facts = await graph_engine.get_user_facts(str(current_user.id))
    return {"facts": facts}


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(node_id: str, current_user: User = Depends(get_current_user)):
    deleted = await graph_engine.delete_node(str(current_user.id), node_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Graph node not found"
        )
    return None
