import pytest
from app.core.database import AsyncSessionLocal, init_db
from app.services.chat_action_service import chat_action_service
from app.services.graph_engine import graph_engine

@pytest.mark.asyncio
async def test_full_project_lifecycle_via_chat():
    await init_db()
    test_user_id = "test-user-uuid-9999"
    await graph_engine.upsert_user_node(test_user_id, "Lifecycle User", "life@user.com")

    async with AsyncSessionLocal() as db:
        # 1. ADD PROJECT
        add_query = "add project Autonomous Drone with Python and ROS"
        actions = await chat_action_service.detect_and_execute_actions(add_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "PROJECT_CREATED"
        assert actions[0]["name"] == "Autonomous Drone"

        # Verify in graph
        node = await graph_engine.find_project_node(test_user_id, "Autonomous Drone")
        assert node is not None
        assert node["name"] == "Autonomous Drone"

        # 2. UPDATE PROJECT STATUS
        update_query = "mark project Autonomous Drone as Completed"
        actions = await chat_action_service.detect_and_execute_actions(update_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "PROJECT_UPDATED"
        assert actions[0]["status"] == "Completed"

        # Verify updated status
        node = await graph_engine.find_project_node(test_user_id, "Autonomous Drone")
        assert node["properties"]["status"] == "Completed"

        # 3. DELETE PROJECT
        delete_query = "delete project Autonomous Drone"
        actions = await chat_action_service.detect_and_execute_actions(delete_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "PROJECT_DELETED"
        assert actions[0]["name"] == "Autonomous Drone"

        # Verify node is gone
        node = await graph_engine.find_project_node(test_user_id, "Autonomous Drone")
        assert node is None

@pytest.mark.asyncio
async def test_skill_lifecycle_via_chat():
    test_user_id = "test-user-uuid-9999"
    await graph_engine.upsert_user_node(test_user_id, "Lifecycle User", "life@user.com")

    async with AsyncSessionLocal() as db:
        # 1. ADD SKILL
        add_query = "add skill Golang as Intermediate"
        actions = await chat_action_service.detect_and_execute_actions(add_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "SKILL_CREATED"
        assert actions[0]["name"] == "Golang"

        # 2. UPDATE SKILL
        update_query = "update skill Golang to Expert"
        actions = await chat_action_service.detect_and_execute_actions(update_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "SKILL_UPDATED"
        assert actions[0]["proficiency"] == "Expert"

        # 3. DELETE SKILL
        delete_query = "delete skill Golang"
        actions = await chat_action_service.detect_and_execute_actions(delete_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "SKILL_DELETED"

import uuid
from app.models.user import User

@pytest.mark.asyncio
async def test_goal_lifecycle_via_chat():
    await init_db()
    async with AsyncSessionLocal() as db:
        user = User(email=f"goal_user_{uuid.uuid4()}@test.com", hashed_password="pw")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        test_user_id = str(user.id)
        await graph_engine.upsert_user_node(test_user_id, "Lifecycle User", user.email)

        # 1. ADD GOAL
        add_query = "add a goal to Publish NeurIPS Paper"
        actions = await chat_action_service.detect_and_execute_actions(add_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "GOAL_CREATED"
        assert "Publish NeurIPS Paper" in actions[0]["name"]

        # 2. DELETE GOAL
        delete_query = "delete goal Publish NeurIPS Paper"
        actions = await chat_action_service.detect_and_execute_actions(delete_query, test_user_id, db)
        assert len(actions) == 1
        assert actions[0]["type"] == "GOAL_DELETED"
