import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import Profile, User
from app.schemas.user_schema import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.services.graph_engine import graph_engine

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _load_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    return result.scalar_one()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    await db.flush()

    profile = Profile(
        user_id=user.id,
        full_name=payload.full_name,
        headline="Digital Twin Explorer",
        bio="",
        communication_style="Analytical & Direct",
        personality_traits={
            "openness": 0.8,
            "analytical_depth": 0.85,
            "brevity_preference": 0.6,
            "formality": 0.5,
        },
        target_roles=[],
    )
    db.add(profile)
    await db.commit()

    try:
        await graph_engine.upsert_user_node(
            str(user.id), payload.full_name, user.email
        )
    except Exception:
        pass

    loaded = await _load_user(db, user.id)
    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(loaded),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.email == payload.email.lower())
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
        )

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_user(
    payload: UserRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add another person with completely isolated graph, memory, and chat history."""
    clean_email = payload.email.strip().lower()
    existing = await db.execute(select(User).where(User.email == clean_email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=clean_email,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    await db.flush()

    profile = Profile(
        user_id=user.id,
        full_name=payload.full_name.strip(),
        headline="Digital Twin Member",
        bio="",
        communication_style="Analytical & Direct",
        personality_traits={
            "openness": 0.8,
            "analytical_depth": 0.85,
            "brevity_preference": 0.6,
            "formality": 0.5,
        },
        target_roles=[],
    )
    db.add(profile)
    await db.commit()

    try:
        await graph_engine.upsert_user_node(
            str(user.id), payload.full_name.strip(), user.email
        )
    except Exception:
        pass

    loaded = await _load_user(db, user.id)
    return {
        "status": "created",
        "message": f"Successfully created isolated account for {payload.full_name}",
        "user": UserResponse.model_validate(loaded).model_dump(),
    }


@router.get("/members")
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List registered users/profiles on this local platform for quick account switching."""
    result = await db.execute(
        select(User).options(selectinload(User.profile)).order_by(User.created_at.asc())
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.profile.full_name if u.profile else u.email.split("@")[0],
            "is_current": u.id == current_user.id,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/switch-account", response_model=TokenResponse)
async def switch_account(
    payload: UserLogin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Securely switch to another user's isolated account requiring credential verification."""
    clean_email = payload.email.strip().lower()
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.email == clean_email)
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password for target account",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
        )

    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )
