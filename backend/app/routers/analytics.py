import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.analytics import DailyLog
from app.models.goal import Goal, Milestone, Task
from app.models.user import User
from app.schemas.analytics_schema import DailyLogCreate, DailyLogResponse
from app.services.graph_engine import graph_engine
from app.services.llm_service import llm_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])

DEBRIEF_SYSTEM_PROMPT = """You are the OmniLife weekly retrospective engine.
Given the user's week, produce a concise, honest and encouraging retrospective.
Return JSON only: {"summary": "...", "highlights": ["..."], "blockers": ["..."], "recommendations": ["..."]}.
"""


@router.post(
    "/daily-log", response_model=DailyLogResponse, status_code=status.HTTP_201_CREATED
)
async def create_daily_log(
    payload: DailyLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log_date = payload.log_date or date.today()
    result = await db.execute(
        select(DailyLog).where(
            DailyLog.user_id == current_user.id, DailyLog.log_date == log_date
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        entry = DailyLog(user_id=current_user.id, log_date=log_date)
        db.add(entry)

    entry.energy_level = payload.energy_level
    entry.accomplishments = payload.accomplishments
    entry.blockers = payload.blockers
    entry.tomorrow_priorities = payload.tomorrow_priorities
    await db.commit()
    await db.refresh(entry)
    return DailyLogResponse.model_validate(entry)


@router.get("/daily-logs", response_model=List[DailyLogResponse])
async def list_daily_logs(
    limit: int = Query(default=30, ge=1, le=180),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyLog)
        .where(DailyLog.user_id == current_user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(limit)
    )
    return [DailyLogResponse.model_validate(row) for row in result.scalars().all()]


def _streak(log_dates: List[date]) -> int:
    if not log_dates:
        return 0
    ordered = sorted(set(log_dates), reverse=True)
    today = date.today()
    if ordered[0] not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    for previous, current in zip(ordered, ordered[1:]):
        if (previous - current).days == 1:
            streak += 1
        else:
            break
    return streak


@router.get("/metrics")
async def metrics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    task_result = await db.execute(
        select(Task).where(Task.user_id == current_user.id)
    )
    all_tasks = list(task_result.scalars().all())
    completed_recent = [
        task
        for task in all_tasks
        if task.status == "DONE"
        and task.completed_at is not None
        and task.completed_at.replace(tzinfo=timezone.utc) >= cutoff
    ]

    goal_result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones))
        .where(Goal.user_id == current_user.id)
    )
    goals = list(goal_result.scalars().all())
    active_goals = [goal for goal in goals if goal.status != "COMPLETED"]
    average_progress = (
        round(sum(goal.progress_percent for goal in active_goals) / len(active_goals), 1)
        if active_goals
        else 0.0
    )

    log_result = await db.execute(
        select(DailyLog)
        .where(DailyLog.user_id == current_user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(days)
    )
    logs = list(log_result.scalars().all())
    energy_average = (
        round(sum(log.energy_level for log in logs) / len(logs), 2) if logs else 0.0
    )

    focus_counts: Dict[str, int] = {}
    for task in all_tasks:
        for tag in (task.skill_tags or "").split(","):
            tag = tag.strip()
            if tag:
                focus_counts[tag] = focus_counts.get(tag, 0) + 1
    focus_distribution = [
        {"skill": skill, "count": count}
        for skill, count in sorted(
            focus_counts.items(), key=lambda item: item[1], reverse=True
        )[:12]
    ]

    velocity_map: Dict[str, int] = {}
    for task in completed_recent:
        if task.completed_at is None:
            continue
        key = task.completed_at.date().isoformat()
        velocity_map[key] = velocity_map.get(key, 0) + 1
    velocity = []
    for offset in range(days - 1, -1, -1):
        key = (date.today() - timedelta(days=offset)).isoformat()
        velocity.append({"date": key, "completed": velocity_map.get(key, 0)})

    skills = await graph_engine.get_user_skills(str(current_user.id))
    total_done = sum(1 for task in all_tasks if task.status == "DONE")

    return {
        "period_days": days,
        "tasks_total": len(all_tasks),
        "tasks_completed": total_done,
        "tasks_completed_recent": len(completed_recent),
        "completion_rate": round(total_done / len(all_tasks) * 100, 1)
        if all_tasks
        else 0.0,
        "active_goals": len(active_goals),
        "average_goal_progress": average_progress,
        "focus_distribution": focus_distribution,
        "velocity": velocity,
        "energy_average": energy_average,
        "streak_days": _streak([log.log_date for log in logs]),
        "skills_indexed": len(skills),
        "daily_logs": [DailyLogResponse.model_validate(log) for log in logs[:7]],
    }


def _fallback_debrief(
    tasks_completed: int,
    goals: List[Goal],
    logs: List[DailyLog],
    skills: List[Dict[str, Any]],
) -> Dict[str, Any]:
    highlights = []
    if tasks_completed:
        highlights.append(f"Completed {tasks_completed} tasks this week.")
    if goals:
        top_goal = max(goals, key=lambda goal: goal.progress_percent)
        highlights.append(
            f'"{top_goal.title}" is at {top_goal.progress_percent}% progress.'
        )
    if skills:
        highlights.append(
            "Knowledge graph now tracks "
            + ", ".join(skill.get("name", "") for skill in skills[:5])
            + "."
        )
    if not highlights:
        highlights.append("A quiet week - a good moment to reset and pick one clear target.")

    blockers = [log.blockers for log in logs if log.blockers]
    recommendations = [
        "Pick one goal and define the single next task that moves it forward.",
        "Schedule two focused 90-minute blocks this week.",
        "Log a daily reflection so your twin can spot patterns.",
    ]
    return {
        "summary": (
            f"You completed {tasks_completed} tasks across {len(goals)} active goals this week. "
            "Momentum is built from small, consistent loops - choose one lever and pull it hard next week."
        ),
        "highlights": highlights[:5],
        "blockers": blockers[:5],
        "recommendations": recommendations,
    }


@router.get("/weekly-debrief")
async def weekly_debrief(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    week_end = date.today()
    week_start = week_end - timedelta(days=6)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    task_result = await db.execute(
        select(Task).where(Task.user_id == current_user.id)
    )
    tasks = list(task_result.scalars().all())
    completed = [
        task
        for task in tasks
        if task.status == "DONE"
        and task.completed_at is not None
        and task.completed_at.replace(tzinfo=timezone.utc) >= cutoff
    ]

    goal_result = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id)
    )
    goals = list(goal_result.scalars().all())

    log_result = await db.execute(
        select(DailyLog)
        .where(
            DailyLog.user_id == current_user.id,
            DailyLog.log_date >= week_start,
        )
        .order_by(DailyLog.log_date.desc())
    )
    logs = list(log_result.scalars().all())

    skills = await graph_engine.get_user_skills(str(current_user.id))

    prompt = (
        f"Week: {week_start.isoformat()} to {week_end.isoformat()}\n"
        f"Tasks completed: {len(completed)}\n"
        f"Tasks completed titles: {', '.join(task.title for task in completed[:15]) or 'none'}\n"
        f"Active goals: {', '.join(f'{goal.title} ({goal.progress_percent}%)' for goal in goals[:8]) or 'none'}\n"
        f"Daily reflections: {' | '.join((log.accomplishments or '') for log in logs[:7]) or 'none'}\n"
        f"Blockers: {' | '.join((log.blockers or '') for log in logs if log.blockers) or 'none'}\n"
        f"Skills: {', '.join(skill.get('name', '') for skill in skills[:15]) or 'none'}\n"
        "Write the weekly debrief."
    )
    raw = await llm_service.chat_json(prompt, system=DEBRIEF_SYSTEM_PROMPT)
    generated_by = "ollama"
    if not isinstance(raw, dict) or not raw.get("summary"):
        raw = _fallback_debrief(len(completed), goals, logs, skills)
        generated_by = "offline"

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "summary": raw.get("summary", ""),
        "highlights": raw.get("highlights", []),
        "blockers": raw.get("blockers", []),
        "recommendations": raw.get("recommendations", []),
        "tasks_completed": len(completed),
        "generated_by": generated_by,
    }
