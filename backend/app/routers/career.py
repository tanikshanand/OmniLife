from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.career_schema import RoadmapRequest
from app.services.career_engine import (
    compute_skill_gap,
    generate_curated_roadmap,
    get_benchmark_roles,
)

router = APIRouter(prefix="/career", tags=["Career Compass"])


@router.get("/benchmark-roles")
async def benchmark_roles(current_user: User = Depends(get_current_user)):
    return await get_benchmark_roles()


@router.get("/gap-analysis")
async def gap_analysis(
    role_id: str = Query(default="role_ai_systems_engineer"),
    current_user: User = Depends(get_current_user),
):
    roles = await get_benchmark_roles()
    if role_id not in {role["id"] for role in roles}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Benchmark role not found"
        )
    return await compute_skill_gap(str(current_user.id), role_id)


@router.post("/generate-roadmap")
async def generate_roadmap(
    payload: RoadmapRequest, current_user: User = Depends(get_current_user)
):
    roles = await get_benchmark_roles()
    if payload.role_id not in {role["id"] for role in roles}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Benchmark role not found"
        )
    return await generate_curated_roadmap(
        str(current_user.id), payload.role_id, weeks=payload.weeks
    )
