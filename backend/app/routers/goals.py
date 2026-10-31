import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.database import get_db
from app.models.goal import Goal, Milestone, Task
from app.models.user import User
from app.schemas.goal_schema import (
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    MilestoneCreate,
    MilestoneResponse,
    MilestoneUpdate,
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.graph_engine import graph_engine
from app.services.llm_service import llm_service

router = APIRouter(tags=["Goals & Kanban"])

DECOMPOSE_SYSTEM_PROMPT = """You are an expert career and productivity coach for OmniLife.
Break the user's goal into 3-5 sequential, concrete milestones. Each milestone must have 2-4 actionable tasks.
Return JSON only with this exact shape:
{"milestones": [{"title": "...", "description": "...", "tasks": [{"title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "estimated_hours": "2", "skill_tags": "Python, FastAPI"}]}]}
Tasks must be specific, achievable in under a week, and build on the user's existing skills.
"""


async def _load_goal(
    db: AsyncSession, goal_id: uuid.UUID, user_id: uuid.UUID
) -> Goal:
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones).selectinload(Milestone.tasks))
        .where(Goal.id == goal_id, Goal.user_id == user_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )
    return goal


async def _recalculate_goal_progress(db: AsyncSession, goal: Goal) -> None:
    task_result = await db.execute(
        select(Task)
        .join(Milestone, Task.milestone_id == Milestone.id)
        .where(Milestone.goal_id == goal.id)
    )
    tasks = list(task_result.scalars().all())
    if tasks:
        done = sum(1 for task in tasks if task.status == "DONE")
        goal.progress_percent = round(100 * done / len(tasks))
    else:
        milestone_result = await db.execute(
            select(Milestone).where(Milestone.goal_id == goal.id)
        )
        milestones = list(milestone_result.scalars().all())
        if milestones:
            done = sum(1 for m in milestones if m.is_completed)
            goal.progress_percent = round(100 * done / len(milestones))
        else:
            goal.progress_percent = 0

    if goal.progress_percent >= 100:
        goal.status = "COMPLETED"
    elif goal.status == "COMPLETED" and goal.progress_percent < 100:
        goal.status = "ACTIVE"
    await db.flush()


def _heuristic_decomposition(goal: Goal) -> Dict[str, Any]:
    title = (goal.title or "").lower()
    if any(word in title for word in ["ai", "ml", "machine learning", "genai"]):
        tags = ["Python", "PyTorch", "LLMs", "RAG", "Vector Databases"]
    elif any(word in title for word in ["engineer", "backend", "systems"]):
        tags = ["Python", "System Design", "Docker", "FastAPI"]
    elif any(word in title for word in ["frontend", "product", "web"]):
        tags = ["TypeScript", "React", "Next.js"]
    else:
        tags = ["System Design", "Communication", "Python"]

    return {
        "milestones": [
            {
                "title": "Clarify scope and success criteria",
                "description": f"Define what 'done' means for: {goal.title}.",
                "tasks": [
                    {
                        "title": "Write a one-page success criteria document",
                        "description": "List the measurable outcomes, deadline and constraints.",
                        "priority": "HIGH",
                        "estimated_hours": "2",
                        "skill_tags": "Communication",
                    },
                    {
                        "title": "Audit current skills against the goal",
                        "description": "List strengths, gaps and the top three risks.",
                        "priority": "HIGH",
                        "estimated_hours": "2",
                        "skill_tags": ", ".join(tags[:2]),
                    },
                ],
            },
            {
                "title": "Build the core capability",
                "description": "Create the smallest end-to-end implementation that proves the concept.",
                "tasks": [
                    {
                        "title": "Prototype the core technical component",
                        "description": "Build a minimal working slice and record the architecture.",
                        "priority": "HIGH",
                        "estimated_hours": "8",
                        "skill_tags": ", ".join(tags[:3]),
                    },
                    {
                        "title": "Write tests for the critical path",
                        "description": "Cover the failure modes you are most worried about.",
                        "priority": "MEDIUM",
                        "estimated_hours": "4",
                        "skill_tags": "Testing",
                    },
                ],
            },
            {
                "title": "Ship a portfolio-ready artifact",
                "description": "Package the work so a hiring manager or collaborator can evaluate it.",
                "tasks": [
                    {
                        "title": "Write the README and architecture diagram",
                        "description": "Explain the problem, approach, trade-offs and results.",
                        "priority": "MEDIUM",
                        "estimated_hours": "3",
                        "skill_tags": "Communication",
                    },
                    {
                        "title": "Publish and gather feedback",
                        "description": "Share with two trusted reviewers and log their feedback.",
                        "priority": "MEDIUM",
                        "estimated_hours": "2",
                        "skill_tags": "Communication",
                    },
                ],
            },
            {
                "title": "Validate, reflect and iterate",
                "description": "Measure the outcome against the success criteria and plan the next loop.",
                "tasks": [
                    {
                        "title": "Run a retrospective and update the goal",
                        "description": "Record what worked, what didn't and the next highest-leverage step.",
                        "priority": "LOW",
                        "estimated_hours": "1",
                        "skill_tags": ", ".join(tags[-2:]),
                    }
                ],
            },
        ]
    }


def _normalize_decomposition(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    milestones = raw.get("milestones") if isinstance(raw, dict) else None
    if not isinstance(milestones, list) or not milestones:
        return []
    cleaned: List[Dict[str, Any]] = []
    for milestone in milestones[:6]:
        if not isinstance(milestone, dict):
            continue
        title = str(milestone.get("title") or "").strip()
        if not title:
            continue
        tasks_raw = milestone.get("tasks") if isinstance(milestone.get("tasks"), list) else []
        tasks = []
        for task in tasks_raw[:5]:
            if not isinstance(task, dict):
                continue
            task_title = str(task.get("title") or "").strip()
            if not task_title:
                continue
            priority = str(task.get("priority") or "MEDIUM").upper()
            if priority not in {"HIGH", "MEDIUM", "LOW"}:
                priority = "MEDIUM"
            tasks.append(
                {
                    "title": task_title,
                    "description": str(task.get("description") or ""),
                    "priority": priority,
                    "estimated_hours": str(task.get("estimated_hours") or "2"),
                    "skill_tags": str(task.get("skill_tags") or ""),
                }
            )
        if not tasks:
            tasks.append(
                {
                    "title": f"Make progress on: {title}",
                    "description": "",
                    "priority": "MEDIUM",
                    "estimated_hours": "2",
                    "skill_tags": "",
                }
            )
        cleaned.append(
            {
                "title": title,
                "description": str(milestone.get("description") or ""),
                "tasks": tasks,
            }
        )
    return cleaned


@router.get("/goals", response_model=List[GoalResponse])
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones).selectinload(Milestone.tasks))
        .where(Goal.user_id == current_user.id)
        .order_by(Goal.created_at.desc())
    )
    return [GoalResponse.model_validate(goal) for goal in result.scalars().all()]


@router.get("/goals/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal(db, goal_id, current_user.id)
    return GoalResponse.model_validate(goal)


@router.post("/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = Goal(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        target_date=payload.target_date,
        status=payload.status,
        progress_percent=0,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)

    try:
        await graph_engine.create_goal_node(
            str(current_user.id),
            str(goal.id),
            goal.title,
            goal.target_date.isoformat() if goal.target_date else None,
            goal.status,
        )
    except Exception:
        pass

    goal = await _load_goal(db, goal.id, current_user.id)
    return GoalResponse.model_validate(goal)


@router.patch("/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal(db, goal_id, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    await db.commit()

    try:
        await graph_engine.create_goal_node(
            str(current_user.id),
            str(goal.id),
            goal.title,
            goal.target_date.isoformat() if goal.target_date else None,
            goal.status,
        )
    except Exception:
        pass

    goal = await _load_goal(db, goal.id, current_user.id)
    return GoalResponse.model_validate(goal)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal(db, goal_id, current_user.id)
    await db.delete(goal)
    await db.commit()
    try:
        await graph_engine.delete_node(str(current_user.id), f"goal_{goal_id}")
    except Exception:
        pass
    return None


@router.post(
    "/goals/{goal_id}/decompose",
    response_model=GoalResponse,
    status_code=status.HTTP_200_OK,
)
async def decompose_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal(db, goal_id, current_user.id)
    goal_uuid = goal.id
    skills = await graph_engine.get_user_skills(str(current_user.id))
    skill_names = ", ".join(s.get("name", "") for s in skills[:20]) or "none recorded"

    prompt = (
        f"Goal title: {goal.title}\n"
        f"Goal description: {goal.description or 'N/A'}\n"
        f"Category: {goal.category}\n"
        f"Target date: {goal.target_date.isoformat() if goal.target_date else 'none'}\n"
        f"User's current skills: {skill_names}\n\n"
        "Generate the milestone and task breakdown now."
    )
    raw = await llm_service.chat_json(prompt, system=DECOMPOSE_SYSTEM_PROMPT)
    milestones_data = _normalize_decomposition(raw or {})
    if not milestones_data:
        milestones_data = _normalize_decomposition(_heuristic_decomposition(goal))
    if not milestones_data:
        milestones_data = _normalize_decomposition(_heuristic_decomposition(goal))

    for milestone in list(goal.milestones):
        await db.delete(milestone)
    await db.flush()

    required_skills: set = set()
    for index, milestone_data in enumerate(milestones_data):
        milestone = Milestone(
            goal_id=goal.id,
            title=milestone_data["title"],
            description=milestone_data.get("description", ""),
            sequence_order=index,
            is_completed=False,
        )
        db.add(milestone)
        await db.flush()
        for task_data in milestone_data.get("tasks", []):
            db.add(
                Task(
                    milestone_id=milestone.id,
                    user_id=current_user.id,
                    title=task_data["title"],
                    description=task_data.get("description", ""),
                    status="TODO",
                    priority=task_data.get("priority", "MEDIUM"),
                    estimated_hours=task_data.get("estimated_hours", "2"),
                    skill_tags=task_data.get("skill_tags", ""),
                )
            )
            for tag in (task_data.get("skill_tags") or "").split(","):
                tag = tag.strip()
                if tag:
                    required_skills.add(tag)

    goal.progress_percent = 0
    await db.commit()

    try:
        goal_node_id = await graph_engine.create_goal_node(
            str(current_user.id),
            str(goal_uuid),
            goal.title,
            goal.target_date.isoformat() if goal.target_date else None,
            goal.status,
        )
        for skill_name in required_skills:
            skill_id = await graph_engine.ensure_skill(skill_name)
            await graph_engine.create_relationship(
                str(current_user.id),
                goal_node_id,
                skill_id,
                "REQUIRES_SKILL",
                {},
            )
    except Exception:
        pass

    db.expunge(goal)
    goal = await _load_goal(db, goal_uuid, current_user.id)
    return GoalResponse.model_validate(goal)


@router.post(
    "/goals/{goal_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_milestone(
    goal_id: uuid.UUID,
    payload: MilestoneCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal(db, goal_id, current_user.id)
    milestone = Milestone(
        goal_id=goal.id,
        title=payload.title,
        description=payload.description,
        sequence_order=payload.sequence_order,
        due_date=payload.due_date,
    )
    db.add(milestone)
    await db.commit()
    await _recalculate_goal_progress(db, goal)
    await db.commit()
    result = await db.execute(
        select(Milestone)
        .options(selectinload(Milestone.tasks))
        .where(Milestone.id == milestone.id)
    )
    return MilestoneResponse.model_validate(result.scalar_one())


@router.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    milestone = await db.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    goal = await db.get(Goal, milestone.goal_id)
    if goal is None or goal.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, key, value)
    await db.flush()
    await _recalculate_goal_progress(db, goal)
    await db.commit()
    result = await db.execute(
        select(Milestone)
        .options(selectinload(Milestone.tasks))
        .where(Milestone.id == milestone.id)
    )
    return MilestoneResponse.model_validate(result.scalar_one())


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    milestone = await db.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    goal = await db.get(Goal, milestone.goal_id)
    if goal is None or goal.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    await db.delete(milestone)
    await db.flush()
    await _recalculate_goal_progress(db, goal)
    await db.commit()
    return None


@router.get("/tasks/kanban")
async def kanban_board(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task)
        .where(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()
    board: Dict[str, List[TaskResponse]] = {
        "TODO": [],
        "IN_PROGRESS": [],
        "BLOCKED": [],
        "DONE": [],
    }
    for task in tasks:
        column = task.status if task.status in board else "TODO"
        board[column].append(TaskResponse.model_validate(task))
    return {"columns": board}


@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.milestone_id is not None:
        milestone = await db.get(Milestone, payload.milestone_id)
        if milestone is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
            )
        goal = await db.get(Goal, milestone.goal_id)
        if goal is None or goal.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
            )

    task = Task(
        milestone_id=payload.milestone_id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status=payload.status if payload.status in {"TODO", "IN_PROGRESS", "BLOCKED", "DONE"} else "TODO",
        priority=payload.priority,
        estimated_hours=payload.estimated_hours,
        skill_tags=payload.skill_tags,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    if task.milestone_id:
        milestone = await db.get(Milestone, task.milestone_id)
        if milestone:
            goal = await db.get(Goal, milestone.goal_id)
            if goal:
                await _recalculate_goal_progress(db, goal)
                await db.commit()
    return TaskResponse.model_validate(task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None or task.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    was_done = task.status == "DONE"
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(task, key, value)
    if "status" in updates:
        task.completed_at = (
            datetime.now(timezone.utc) if task.status == "DONE" else None
        )
    await db.flush()
    await _sync_task_side_effects(
        db, task, current_user.id, was_done, task.status == "DONE"
    )
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.patch("/tasks/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: uuid.UUID,
    payload: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None or task.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    was_done = task.status == "DONE"
    task.status = payload.status
    task.completed_at = (
        datetime.now(timezone.utc) if payload.status == "DONE" else None
    )
    await db.flush()
    await _sync_task_side_effects(
        db, task, current_user.id, was_done, payload.status == "DONE"
    )
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


async def _sync_task_side_effects(
    db: AsyncSession,
    task: Task,
    user_id: uuid.UUID,
    was_done: bool,
    is_done: bool,
) -> None:
    if task.milestone_id:
        milestone = await db.get(Milestone, task.milestone_id)
        if milestone is not None:
            sibling_result = await db.execute(
                select(Task).where(Task.milestone_id == milestone.id)
            )
            siblings = list(sibling_result.scalars().all())
            milestone.is_completed = bool(siblings) and all(
                sibling.status == "DONE" for sibling in siblings
            )
            goal = await db.get(Goal, milestone.goal_id)
            if goal is not None:
                await _recalculate_goal_progress(db, goal)

    if is_done and not was_done:
        tags = [tag.strip() for tag in (task.skill_tags or "").split(",") if tag.strip()]
        if tags:
            try:
                await graph_engine.record_skill_practice(str(user_id), tags)
            except Exception:
                pass


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await db.get(Task, task_id)
    if task is None or task.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    milestone_id = task.milestone_id
    await db.delete(task)
    await db.flush()
    if milestone_id:
        milestone = await db.get(Milestone, milestone_id)
        if milestone:
            goal = await db.get(Goal, milestone.goal_id)
            if goal:
                await _recalculate_goal_progress(db, goal)
    await db.commit()
    return None
