"""Hybrid Vector + Graph + Relational context fusion (GraphRAG)."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.goal import Goal, Task
from app.models.user import Profile
from app.services.graph_engine import graph_engine
from app.services.rag_engine import query_semantic_memory


async def _load_profile(db: AsyncSession, user_id: uuid.UUID) -> Optional[Profile]:
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    return result.scalar_one_or_none()


async def _load_goals(db: AsyncSession, user_id: uuid.UUID) -> List[Goal]:
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones))
        .where(Goal.user_id == user_id, Goal.status.in_(["ACTIVE", "IN_PROGRESS"]))
        .order_by(Goal.created_at.desc())
        .limit(6)
    )
    return list(result.scalars().all())


async def _load_active_tasks(db: AsyncSession, user_id: uuid.UUID) -> List[Task]:
    result = await db.execute(
        select(Task)
        .where(Task.user_id == user_id, Task.status == "IN_PROGRESS")
        .limit(8)
    )
    return list(result.scalars().all())


async def _load_relational_context(
    db: AsyncSession, user_uuid: Optional[uuid.UUID]
) -> tuple[Optional[Profile], List[Goal], List[Task]]:
    if not user_uuid:
        return None, [], []
    try:
        profile = await _load_profile(db, user_uuid)
        goals = await _load_goals(db, user_uuid)
        tasks = await _load_active_tasks(db, user_uuid)
        return profile, goals, tasks
    except Exception as exc:
        print(f"[HybridRetriever] Relational context fetch error: {exc}")
        return None, [], []


def _format_context(
    profile: Optional[Profile],
    goals: List[Goal],
    tasks: List[Task],
    skills: List[Dict[str, Any]],
    graph: Dict[str, Any],
    memories: List[Dict[str, Any]],
) -> str:
    lines: List[str] = ["=== USER PROFILE CONTEXT ==="]
    if profile:
        lines.append(f"Name: {profile.full_name}")
        lines.append(f"Headline: {profile.headline or 'Not specified'}")
        lines.append(f"Communication Style: {profile.communication_style}")
        if profile.bio:
            lines.append(f"Bio: {profile.bio[:400]}")
        if profile.target_roles:
            lines.append(f"Target Roles: {', '.join(map(str, profile.target_roles))}")
        if profile.personality_traits:
            traits = ", ".join(f"{k}={v}" for k, v in profile.personality_traits.items())
            lines.append(f"Personality Traits: {traits}")
    else:
        lines.append("Name: Unknown")

    lines.append("")
    lines.append("=== ACTIVE GOALS & STATUS (from PostgreSQL) ===")
    if goals:
        for goal in goals[:5]:
            pending = next(
                (m.title for m in goal.milestones if not m.is_completed), None
            )
            target = goal.target_date.isoformat() if goal.target_date else "no deadline"
            line = (
                f'- Goal: "{goal.title}" (Target: {target}, '
                f"Progress: {goal.progress_percent}%)"
            )
            if pending:
                line += f' - Pending Milestone: "{pending}"'
            lines.append(line)
    else:
        lines.append("- No active goals recorded yet.")

    if tasks:
        lines.append("")
        lines.append("=== IN-PROGRESS TASKS ===")
        for task in tasks[:4]:
            lines.append(f"- {task.title} ({task.priority} priority)")

    lines.append("")
    lines.append("=== CONNECTED KNOWLEDGE GRAPH (from Neo4j) ===")
    if skills:
        skill_text = ", ".join(
            f"{s.get('name')} ({s.get('proficiency', 'Intermediate')})" for s in skills[:10]
        )
        lines.append(f"- User HAS_SKILL: {skill_text}")
    else:
        lines.append("- No skills recorded in the knowledge graph yet.")

    projects = graph.get("projects", [])
    if projects:
        lines.append(
            "- Projects: "
            + ", ".join(f'"{p["name"]}"' for p in projects[:6])
        )

    graph_goals = graph.get("goals", [])
    if graph_goals:
        lines.append(
            "- Graph Goals: " + ", ".join(f'"{g["name"]}"' for g in graph_goals[:4])
        )

    topics = graph.get("topics", [])
    if topics:
        lines.append("- Topics: " + ", ".join(t["name"] for t in topics[:6]))

    persons = graph.get("persons", [])
    if persons:
        lines.append("- People: " + ", ".join(p["name"] for p in persons[:4]))

    if graph.get("links"):
        lines.append("- Key Relationships:")
        for link in graph["links"][:6]:
            lines.append(
                f"  {link['source']} -[{link['label']}]-> {link['target']}"
            )

    lines.append("")
    lines.append("=== RETRIEVED EPISODIC & DOCUMENT MEMORIES (from ChromaDB) ===")
    if memories:
        for index, memory in enumerate(memories, start=1):
            metadata = memory.get("metadata") or {}
            filename = metadata.get("filename", "memory")
            content = (memory.get("content") or "").strip().replace("\n", " ")
            lines.append(f'[Memory {index} | {filename}]: "{content[:400]}"')
    else:
        lines.append("- No matching document memories found.")

    return "\n".join(lines)


def _build_sources(
    memories: List[Dict[str, Any]],
    skills: List[Dict[str, Any]],
    graph: Dict[str, Any],
    goals: List[Goal],
) -> List[Dict[str, Any]]:
    sources: List[Dict[str, Any]] = []
    for memory in memories:
        metadata = memory.get("metadata") or {}
        sources.append(
            {
                "type": "memory",
                "title": metadata.get("filename", "Memory"),
                "chunk": (memory.get("content") or "")[:400],
                "score": round(float(memory.get("score", 0.0)), 3),
                "document_id": metadata.get("document_id"),
            }
        )
    for skill in skills[:6]:
        sources.append(
            {
                "type": "graph",
                "title": f"Skill: {skill.get('name')}",
                "chunk": f"Proficiency: {skill.get('proficiency', 'Intermediate')}",
            }
        )
    for project in graph.get("projects", [])[:4]:
        sources.append(
            {
                "type": "graph",
                "title": f"Project: {project['name']}",
                "chunk": (project.get("properties") or {}).get("description", "")[:250],
            }
        )
    for goal in goals[:4]:
        sources.append(
            {
                "type": "goal",
                "title": f"Goal: {goal.title}",
                "chunk": f"Progress {goal.progress_percent}%",
            }
        )
    return sources


async def retrieve_hybrid_context(
    query: str, user_id: str, db: AsyncSession
) -> Dict[str, Any]:
    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        user_uuid = None

    # Concurrently execute vector search, graph context, user skills, and relational loads
    memories_future = query_semantic_memory(query, str(user_id), n_results=3)
    graph_future = graph_engine.get_graph_context(str(user_id))
    skills_future = graph_engine.get_user_skills(str(user_id))
    relational_future = _load_relational_context(db, user_uuid)

    results = await asyncio.gather(
        memories_future,
        graph_future,
        skills_future,
        relational_future,
        return_exceptions=True,
    )

    memories = results[0] if isinstance(results[0], list) else []
    graph = results[1] if isinstance(results[1], dict) else {}
    skills = results[2] if isinstance(results[2], list) else []
    relational = results[3] if isinstance(results[3], tuple) else (None, [], [])
    profile, goals, tasks = relational

    context_text = _format_context(profile, goals, tasks, skills, graph, memories)
    sources = _build_sources(memories, skills, graph, goals)

    return {
        "context": context_text,
        "sources": sources,
        "memories": memories,
        "graph": graph,
        "skills": skills,
        "goals": [
            {
                "id": str(goal.id),
                "title": goal.title,
                "progress_percent": goal.progress_percent,
            }
            for goal in goals
        ],
        "profile": profile,
    }
