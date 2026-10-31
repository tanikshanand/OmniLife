from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.chat import ChatSession
from app.models.goal import Goal
from app.models.memory import Document
from app.models.user import Profile, User
from app.schemas.user_schema import ProfileResponse, ProfileUpdate
from app.services.graph_engine import graph_engine

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=current_user.id, full_name=current_user.email.split("@")[0])
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return ProfileResponse.model_validate(profile)


@router.put("", response_model=ProfileResponse)
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=current_user.id, full_name=current_user.email.split("@")[0])
        db.add(profile)
        await db.flush()

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)

    try:
        await graph_engine.upsert_user_node(
            str(current_user.id), profile.full_name, current_user.email
        )
    except Exception:
        pass

    return ProfileResponse.model_validate(profile)


@router.get("/export")
async def export_data(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Full data-sovereignty export bundle for the authenticated user."""
    profile_res = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = profile_res.scalar_one_or_none()

    docs_res = await db.execute(
        select(Document)
        .options(selectinload(Document.chunks))
        .where(Document.user_id == current_user.id)
    )
    documents = docs_res.scalars().all()

    goals_res = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones))
        .where(Goal.user_id == current_user.id)
    )
    goals = goals_res.scalars().all()

    sessions_res = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == current_user.id)
    )
    sessions = sessions_res.scalars().all()

    try:
        graph = await graph_engine.get_user_subgraph(str(current_user.id), depth=3)
    except Exception:
        graph = {"nodes": [], "links": []}

    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat()
            if current_user.created_at
            else None,
        },
        "profile": ProfileResponse.model_validate(profile).model_dump()
        if profile
        else None,
        "documents": [
            {
                "id": str(d.id),
                "filename": d.filename,
                "file_type": d.file_type,
                "file_size": d.file_size,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "chunks": [
                    {
                        "id": str(c.id),
                        "chroma_id": c.chroma_id,
                        "content": c.content,
                        "tags": c.tags,
                        "extracted_entities": c.extracted_entities,
                    }
                    for c in d.chunks
                ],
            }
            for d in documents
        ],
        "goals": [
            {
                "id": str(g.id),
                "title": g.title,
                "description": g.description,
                "category": g.category,
                "status": g.status,
                "progress_percent": g.progress_percent,
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "milestones": [
                    {
                        "id": str(m.id),
                        "title": m.title,
                        "description": m.description,
                        "sequence_order": m.sequence_order,
                        "is_completed": m.is_completed,
                        "due_date": m.due_date.isoformat() if m.due_date else None,
                    }
                    for m in g.milestones
                ],
            }
            for g in goals
        ],
        "chat_sessions": [
            {
                "id": str(s.id),
                "title": s.title,
                "active_mode": s.active_mode,
                "messages": [
                    {
                        "id": str(m.id),
                        "role": m.role,
                        "content": m.content,
                        "sources_cited": m.sources_cited,
                        "created_at": m.created_at.isoformat()
                        if m.created_at
                        else None,
                    }
                    for m in s.messages
                ],
            }
            for s in sessions
        ],
        "graph": graph,
    }
