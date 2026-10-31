import json
import logging
import time
import uuid
from typing import List

logger = logging.getLogger("omnilife.chat")

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import get_current_user
from app.models.chat import ChatMessage, ChatSession
from app.models.user import User
from app.schemas.chat_schema import (
    ChatRequest,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionResponse,
    MessageResponse,
)
from app.services.chat_action_service import chat_action_service
from app.services.clone_engine import (
    build_system_prompt,
    build_user_prompt,
    fallback_response,
    stream_text,
)
from app.services.hybrid_retriever import retrieve_hybrid_context
from app.services.llm_service import llm_service

router = APIRouter(prefix="/chat", tags=["Digital Twin Chat"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def _get_owned_session(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> ChatSession:
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found"
        )
    return session


@router.post(
    "/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED
)
async def create_session(
    payload: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(
        user_id=current_user.id, title=payload.title, active_mode=payload.mode
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionResponse.model_validate(session)


@router.get("/sessions/primary", response_model=ChatSessionDetail)
async def get_primary_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve or create the user's single persistent main chat conversation."""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if session is None:
        session = ChatSession(
            user_id=current_user.id,
            title="Main Conversation",
            active_mode="MENTOR",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        result = await db.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.id == session.id)
        )
        session = result.scalar_one()

    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        active_mode=session.active_mode,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[MessageResponse.model_validate(m) for m in session.messages],
    )


@router.post("/sessions/reset", response_model=ChatSessionDetail)
async def reset_primary_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset the primary conversation without creating redundant ghost sessions."""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if session is not None:
        # Delete all messages in the existing main session
        for msg in list(session.messages):
            await db.delete(msg)
        session.title = "Main Conversation"
        session.active_mode = "MENTOR"
        await db.commit()
        await db.refresh(session)
    else:
        session = ChatSession(
            user_id=current_user.id,
            title="Main Conversation",
            active_mode="MENTOR",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        active_mode=session.active_mode,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[],
    )


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    return [ChatSessionResponse.model_validate(row) for row in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned_session(db, session_id, current_user.id)
    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        active_mode=session.active_mode,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[MessageResponse.model_validate(m) for m in session.messages],
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned_session(db, session_id, current_user.id)
    await db.delete(session)
    await db.commit()
    return None


async def _history_text(db: AsyncSession, session_id: uuid.UUID) -> str:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(4)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    if not messages:
        return ""
    lines = ["=== RECENT CONVERSATION HISTORY ==="]
    for message in messages:
        lines.append(f"{message.role.upper()}: {message.content[:400]}")
    return "\n".join(lines)


@router.post("/stream")
async def stream_chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    request_start = time.monotonic()
    mode = (payload.mode or "MENTOR").upper()

    if payload.session_id is not None:
        session = await _get_owned_session(db, payload.session_id, current_user.id)
    else:
        # Default to user's single persistent primary conversation
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == current_user.id)
            .order_by(ChatSession.updated_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        if session is None:
            session = ChatSession(
                user_id=current_user.id,
                title="Main Conversation",
                active_mode=mode,
            )
            db.add(session)
            await db.flush()

    history = await _history_text(db, session.id)

    # Proactively detect and execute any graph mutations requested in chat
    actions_start = time.monotonic()
    executed_actions = await chat_action_service.detect_and_execute_actions(
        payload.query, str(current_user.id), db
    )
    actions_ms = (time.monotonic() - actions_start) * 1000

    retrieval_start = time.monotonic()
    context = await retrieve_hybrid_context(payload.query, str(current_user.id), db)
    retrieval_ms = (time.monotonic() - retrieval_start) * 1000
    sources = list(context["sources"])

    if executed_actions:
        action_notes = []
        for act in executed_actions:
            action_notes.append(f"• {act['details']}")
            sources.append(
                {
                    "type": "graph",
                    "title": f"Graph Updated: {act['name']}",
                    "chunk": act["details"],
                }
            )
        action_context_block = (
            "\n\n=== RECENT KNOWLEDGE GRAPH ACTIONS COMPLETED BY SYSTEM ===\n"
            + "\n".join(action_notes)
            + "\nThe above graph nodes and links have been successfully saved to the database. "
            "Acknowledge this directly and authentically to the user in your current persona. "
            "Do NOT write out raw cypher or internal node IDs unless asked."
        )
        context["context"] += action_context_block

    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=payload.query,
        sources_cited=[],
    )
    db.add(user_message)
    session.active_mode = mode
    if session.title in ("New Conversation", ""):
        session.title = payload.query.strip()[:60] or "New Conversation"
    await db.commit()
    await db.refresh(session)

    system_prompt = build_system_prompt(mode, current_user.profile)
    user_prompt = build_user_prompt(payload.query, context["context"], mode)
    if history:
        user_prompt = f"{history}\n\n{user_prompt}"
    session_id = session.id

    async def event_generator():
        yield _sse(
            "context",
            {
                "sources": sources,
                "session_id": str(session_id),
                "mode": mode,
                "actions": executed_actions,
            },
        )
        collected: List[str] = []
        stream_start = time.monotonic()
        first_token_ms = None

        try:
            if await llm_service.is_available():
                async for delta in llm_service.stream_chat(
                    user_prompt, system=system_prompt
                ):
                    if first_token_ms is None:
                        first_token_ms = (time.monotonic() - request_start) * 1000
                    collected.append(delta)
                    yield _sse("message", {"delta": delta})
            else:
                offline = fallback_response(
                    payload.query, context["context"], mode, current_user.profile
                )
                async for delta in stream_text(offline):
                    if first_token_ms is None:
                        first_token_ms = (time.monotonic() - request_start) * 1000
                    collected.append(delta)
                    yield _sse("message", {"delta": delta})
        except Exception as exc:
            logger.warning("Streaming encounter exception: %s", exc)
            if not collected:
                offline = fallback_response(
                    payload.query, context["context"], mode, current_user.profile
                )
                async for delta in stream_text(offline):
                    if first_token_ms is None:
                        first_token_ms = (time.monotonic() - request_start) * 1000
                    collected.append(delta)
                    yield _sse("message", {"delta": delta})

        content = "".join(collected).strip()
        total_ms = (time.monotonic() - request_start) * 1000
        stream_ms = (time.monotonic() - stream_start) * 1000
        logger.info(
            "Chat stream finished | session=%s | total=%.1fms | ttft=%.1fms | retrieval=%.1fms | actions=%.1fms | deltas=%d | chars=%d",
            session_id,
            total_ms,
            first_token_ms or 0.0,
            retrieval_ms,
            actions_ms,
            len(collected),
            len(content),
        )

        message_id = None
        try:
            async with AsyncSessionLocal() as save_db:
                assistant_message = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=content or "(No response generated)",
                    sources_cited=sources,
                )
                save_db.add(assistant_message)
                save_session = await save_db.get(ChatSession, session_id)
                if save_session is not None:
                    save_session.active_mode = mode
                await save_db.commit()
                await save_db.refresh(assistant_message)
                message_id = str(assistant_message.id)
        except Exception as exc:
            logger.error("Failed to persist assistant message: %s", exc)
            message_id = None

        yield _sse("done", {"session_id": str(session_id), "message_id": message_id})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
