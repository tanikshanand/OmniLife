"""Idempotent demo seeding so the app is immediately explorable."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.analytics import DailyLog
from app.models.chat import ChatMessage, ChatSession
from app.models.goal import Goal, Milestone, Task
from app.models.memory import Document, MemoryChunk
from app.models.user import Profile, User
from app.services.graph_engine import graph_engine
from app.services.rag_engine import add_memory_chunks

DEMO_EMAIL = "demo@omnilife.ai"
DEMO_PASSWORD = "demo1234"

RESUME_TEXT = (
    "Taniksh Anand is a CSE-AIML student and systems builder based in India. "
    "Built a real-time event streaming pipeline using Apache Kafka, FastAPI, and PostgreSQL "
    "handling 15k requests per second. Developed OmniLife, a digital twin platform combining "
    "Neo4j GraphRAG, ChromaDB vector memory and a Next.js dashboard. Skilled in Python, FastAPI, "
    "Docker, PyTorch, PostgreSQL, Neo4j, TypeScript and Next.js. Target goal: land an AI Systems "
    "Engineer role by 2027. Interested in distributed inference, Triton and Kubernetes."
)

PROJECT_NOTES_TEXT = (
    "OmniLife project notes: evaluated Triton versus vLLM for model serving latency and noted "
    "memory optimization bottlenecks. Built a hybrid retriever combining ChromaDB semantic search "
    "with Neo4j graph traversal. Implemented FastAPI async endpoints and Server-Sent Events for "
    "streaming responses. Next milestone is Kubernetes deployment and distributed model inference. "
    "Won first place at HackMAIT 2026 for an autonomous robotics project using ROS and Python."
)

DEMO_SKILLS = [
    ("Python", "Language", "Expert"),
    ("FastAPI", "Framework", "Advanced"),
    ("Docker", "DevOps", "Intermediate"),
    ("PyTorch", "ML/AI", "Intermediate"),
    ("PostgreSQL", "Database", "Advanced"),
    ("Neo4j", "Database", "Intermediate"),
    ("TypeScript", "Language", "Intermediate"),
    ("Next.js", "Framework", "Intermediate"),
    ("ChromaDB", "ML/AI", "Intermediate"),
]


async def _seed_memories(db, user: User) -> None:
    for filename, text, source_type in [
        ("Resume_Taniksh_2026.pdf", RESUME_TEXT, "RESUME"),
        ("Project_Notes.md", PROJECT_NOTES_TEXT, "NOTE"),
    ]:
        document = Document(
            user_id=user.id,
            filename=filename,
            file_type=filename.rsplit(".", 1)[-1],
            file_size=len(text.encode("utf-8")),
            raw_text_preview=text[:1000],
            source_type=source_type,
        )
        db.add(document)
        await db.flush()

        chunk = MemoryChunk(
            document_id=document.id,
            user_id=user.id,
            chroma_id=f"chunk_{document.id}_0",
            chunk_index=0,
            content=text,
            extracted_entities={},
            tags="demo",
        )
        db.add(chunk)
        await db.commit()
        await db.refresh(chunk)

        await add_memory_chunks(
            [
                {
                    "id": chunk.chroma_id,
                    "content": text,
                    "document_id": str(document.id),
                    "filename": filename,
                    "chunk_index": 0,
                    "source_type": source_type,
                    "tags": "demo",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ],
            str(user.id),
        )


async def _seed_goal(db, user: User) -> Goal:
    goal = Goal(
        user_id=user.id,
        title="Land AI Systems Engineer Role",
        description="Become a production-grade AI systems engineer focused on inference infrastructure.",
        category="Career",
        target_date=date(2027, 1, 1),
        status="ACTIVE",
        progress_percent=25,
    )
    db.add(goal)
    await db.flush()

    milestones_spec = [
        (
            "Master distributed model inference",
            [
                ("Evaluate Triton vs vLLM", "DONE", "HIGH", "Triton Inference Server, PyTorch"),
                ("Benchmark inference latency", "IN_PROGRESS", "HIGH", "PyTorch"),
                ("Write benchmark report", "TODO", "MEDIUM", "Communication"),
            ],
        ),
        (
            "Ship a production RAG system",
            [
                ("Harden hybrid retriever", "IN_PROGRESS", "HIGH", "FastAPI, ChromaDB"),
                ("Add streaming citations", "DONE", "MEDIUM", "FastAPI"),
                ("Deploy with Docker", "TODO", "MEDIUM", "Docker"),
            ],
        ),
        (
            "Build a public portfolio",
            [
                ("Publish OmniLife case study", "TODO", "MEDIUM", "Communication"),
                ("Record demo video", "TODO", "LOW", "Communication"),
            ],
        ),
    ]

    for index, (title, tasks) in enumerate(milestones_spec):
        milestone = Milestone(
            goal_id=goal.id,
            title=title,
            description="",
            sequence_order=index,
            is_completed=False,
        )
        db.add(milestone)
        await db.flush()
        for task_title, task_status, priority, tags in tasks:
            db.add(
                Task(
                    milestone_id=milestone.id,
                    user_id=user.id,
                    title=task_title,
                    status=task_status,
                    priority=priority,
                    estimated_hours="4",
                    skill_tags=tags,
                    completed_at=datetime.now(timezone.utc)
                    if task_status == "DONE"
                    else None,
                )
            )
    await db.commit()
    return goal


async def _seed_chat(db, user: User) -> None:
    session = ChatSession(
        user_id=user.id, title="Career Strategy", active_mode="MENTOR"
    )
    db.add(session)
    await db.flush()
    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=(
                "Welcome back, Taniksh. Your knowledge graph shows strong FastAPI and "
                "PostgreSQL foundations. Your target milestone for distributed model "
                "inference is the highest-leverage gap right now. What should we tackle today?"
            ),
            sources_cited=[
                {"type": "graph", "title": "Skill: FastAPI", "chunk": "Advanced"},
                {"type": "goal", "title": "Goal: Land AI Systems Engineer Role", "chunk": "Progress 25%"},
            ],
        )
    )
    await db.commit()


async def _seed_daily_logs(db, user: User) -> None:
    specs = [
        (0, 4, "Shipped the hybrid retriever benchmark.", "Triton setup took longer than expected.", "Finish the latency report."),
        (1, 3, "Refactored the GraphRAG context fusion.", "Context window pressure.", "Write tests for citations."),
        (2, 5, "Deep work on Neo4j traversal queries.", "", "Design the Kanban board."),
    ]
    for offset, energy, accomplishments, blockers, priorities in specs:
        db.add(
            DailyLog(
                user_id=user.id,
                log_date=date.today() - timedelta(days=offset),
                energy_level=energy,
                accomplishments=accomplishments,
                blockers=blockers,
                tomorrow_priorities=priorities,
            )
        )
    await db.commit()


async def _seed_graph(user: User, goal: Goal) -> None:
    await graph_engine.upsert_user_node(
        str(user.id), "Taniksh Anand", user.email
    )
    for name, category, proficiency in DEMO_SKILLS:
        await graph_engine.upsert_skill(str(user.id), name, category, proficiency)

    await graph_engine.create_project(
        str(user.id),
        "OmniLife",
        "AI digital twin with hybrid GraphRAG memory and interactive knowledge graph.",
        "Active",
    )
    await graph_engine.create_project(
        str(user.id),
        "HackMAIT Robotics",
        "Autonomous robotics project using ROS and Python. First place at HackMAIT 2026.",
        "Completed",
    )
    for skill in ["Python", "FastAPI", "Neo4j", "ChromaDB", "Next.js", "Docker"]:
        await graph_engine.link_project_skill(str(user.id), "OmniLife", skill)
    await graph_engine.ensure_skill("ROS", "Framework")
    for skill in ["Python", "ROS"]:
        await graph_engine.link_project_skill(
            str(user.id), "HackMAIT Robotics", skill
        )

    goal_node = await graph_engine.create_goal_node(
        str(user.id),
        str(goal.id),
        goal.title,
        goal.target_date.isoformat() if goal.target_date else None,
        goal.status,
    )
    for skill in ["Triton Inference Server", "Kubernetes", "Distributed Systems"]:
        skill_id = await graph_engine.ensure_skill(skill)
        await graph_engine.create_relationship(
            str(user.id), goal_node, skill_id, "REQUIRES_SKILL", {"priority": "High"}
        )


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.email == DEMO_EMAIL)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return

        user = User(
            email=DEMO_EMAIL, hashed_password=get_password_hash(DEMO_PASSWORD)
        )
        db.add(user)
        await db.flush()

        db.add(
            Profile(
                user_id=user.id,
                full_name="Taniksh Anand",
                headline="CSE-AIML Student & Systems Builder",
                bio=(
                    "I build AI systems that combine retrieval, knowledge graphs and "
                    "product-grade interfaces. Currently focused on distributed inference."
                ),
                communication_style="Analytical & Concise",
                personality_traits={
                    "openness": 0.85,
                    "analytical_depth": 0.9,
                    "brevity_preference": 0.75,
                    "formality": 0.45,
                },
                target_roles=["AI Systems Engineer", "Staff ML Engineer"],
            )
        )
        await db.commit()
        await db.refresh(user)

        goal = await _seed_goal(db, user)
        await _seed_memories(db, user)
        await _seed_chat(db, user)
        await _seed_daily_logs(db, user)
        await _seed_graph(user, goal)
