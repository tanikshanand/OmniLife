import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.services.graph_engine import graph_engine
from app.services.chat_action_service import chat_action_service
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_all_user_natural_language_queries():
    """Verify all 10 specific user conversational commands produce real mutations and confirmations."""
    await init_db()
    test_user_id = str(uuid.uuid4())
    await graph_engine.upsert_user_node(test_user_id, "NLP Test User", "nlp@test.com")

    async with AsyncSessionLocal() as db:
        # 1. "Add that I am learning Rust."
        res1 = await chat_action_service.detect_and_execute_actions(
            "Add that I am learning Rust.", test_user_id, db
        )
        assert len(res1) == 1
        assert res1[0]["type"] == "SKILL_CREATED"
        assert res1[0]["name"] == "Rust"

        # Verify in graph
        rust_node = await graph_engine.find_entity_by_name(test_user_id, "Rust")
        assert rust_node is not None
        assert rust_node["name"] == "Rust"

        # 2. "Remember that my preferred programming language is Python."
        res2 = await chat_action_service.detect_and_execute_actions(
            "Remember that my preferred programming language is Python.", test_user_id, db
        )
        assert len(res2) == 1
        assert res2[0]["type"] in ("PREFERENCE_SAVED", "PREFERENCE_UPDATED")
        facts = await graph_engine.get_user_facts(test_user_id)
        assert facts.get("preferred_language") == "Python"

        # 3. "Add my new project called Project Atlas."
        res3 = await chat_action_service.detect_and_execute_actions(
            "Add my new project called Project Atlas.", test_user_id, db
        )
        assert len(res3) == 1
        assert res3[0]["type"] == "PROJECT_CREATED"
        assert res3[0]["name"] == "Project Atlas"

        # Verify project exists
        p_node = await graph_engine.find_project_node(test_user_id, "Project Atlas")
        assert p_node is not None

        # 4. "Connect Project Atlas to my backend development work."
        res4 = await chat_action_service.detect_and_execute_actions(
            "Connect Project Atlas to my backend development work.", test_user_id, db
        )
        assert len(res4) == 1
        assert res4[0]["type"] == "RELATIONSHIP_CREATED"
        assert "Project Atlas" in res4[0]["name"]

        # 5. "Update my preferred language from Java to Python."
        res5 = await chat_action_service.detect_and_execute_actions(
            "Update my preferred language from Java to Python.", test_user_id, db
        )
        assert len(res5) == 1
        assert res5[0]["type"] == "PREFERENCE_UPDATED"
        facts = await graph_engine.get_user_facts(test_user_id)
        assert facts.get("preferred_language") == "Python"

        # 6. "Delete the relationship between Project Atlas and Python."
        # First ensure Python is linked to Atlas
        await graph_engine.create_custom_relationship(test_user_id, "Project Atlas", "Python")
        res6 = await chat_action_service.detect_and_execute_actions(
            "Delete the relationship between Project Atlas and Python.", test_user_id, db
        )
        assert len(res6) == 1
        assert res6[0]["type"] == "RELATIONSHIP_DELETED"

        # 7. "Remove Rust from my knowledge graph."
        res7 = await chat_action_service.detect_and_execute_actions(
            "Remove Rust from my knowledge graph.", test_user_id, db
        )
        assert len(res7) == 1
        assert res7[0]["type"] == "ENTITY_DELETED"
        rust_node_after = await graph_engine.find_entity_by_name(test_user_id, "Rust")
        assert rust_node_after is None

        # 8. "Forget my old project." (Only 1 project exists: Project Atlas)
        res8 = await chat_action_service.detect_and_execute_actions(
            "Forget my old project.", test_user_id, db
        )
        assert len(res8) == 1
        assert res8[0]["type"] == "PROJECT_DELETED"
        p_node_after = await graph_engine.find_project_node(test_user_id, "Project Atlas")
        assert p_node_after is None

        # 9. "Remove my previous preferred programming language."
        res9 = await chat_action_service.detect_and_execute_actions(
            "Remove my previous preferred programming language.", test_user_id, db
        )
        assert len(res9) == 1
        assert res9[0]["type"] == "PREFERENCE_DELETED"
        facts_after = await graph_engine.get_user_facts(test_user_id)
        assert "preferred_language" not in facts_after

        # 10. "Delete the outdated information about my project."
        res10 = await chat_action_service.detect_and_execute_actions(
            "Delete the outdated information about my project.", test_user_id, db
        )
        assert len(res10) == 1
        assert res10[0]["type"] == "OUTDATED_INFO_REMOVED"


@pytest.mark.asyncio
async def test_strict_multi_user_data_isolation():
    """Verify two users with identically named projects/skills cannot see or mutate each other's data."""
    await init_db()
    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    await graph_engine.upsert_user_node(user_a_id, "User Alpha", "alpha@test.com")
    await graph_engine.upsert_user_node(user_b_id, "User Beta", "beta@test.com")

    # Both create identically named projects and skills
    await graph_engine.create_project(user_a_id, "Secret Project", "Alpha's secret", "Active")
    await graph_engine.create_project(user_b_id, "Secret Project", "Beta's secret", "Active")

    await graph_engine.upsert_skill(user_a_id, "Rust", "Systems", "Expert")
    await graph_engine.upsert_skill(user_b_id, "Rust", "Systems", "Beginner")

    await graph_engine.set_user_fact(user_a_id, "preferred_language", "Rust")
    await graph_engine.set_user_fact(user_b_id, "preferred_language", "Go")

    # Subgraph isolation
    subgraph_a = await graph_engine.get_user_subgraph(user_a_id)
    subgraph_b = await graph_engine.get_user_subgraph(user_b_id)

    # User A's node list should only contain Alpha user and Alpha's specific nodes
    user_a_node_ids = {n["id"] for n in subgraph_a["nodes"]}
    user_b_node_ids = {n["id"] for n in subgraph_b["nodes"]}

    assert f"usr_{user_a_id}" in user_a_node_ids
    assert f"usr_{user_b_id}" not in user_a_node_ids

    assert f"usr_{user_b_id}" in user_b_node_ids
    assert f"usr_{user_a_id}" not in user_b_node_ids

    # Facts isolation
    facts_a = await graph_engine.get_user_facts(user_a_id)
    facts_b = await graph_engine.get_user_facts(user_b_id)
    assert facts_a.get("preferred_language") == "Rust"
    assert facts_b.get("preferred_language") == "Go"

    # User A deletes their "Secret Project"
    deleted_a = await graph_engine.delete_project(user_a_id, "Secret Project")
    assert deleted_a is True

    # User A no longer has Secret Project
    p_a = await graph_engine.find_project_node(user_a_id, "Secret Project")
    assert p_a is None

    # User B's Secret Project MUST still exist completely intact!
    p_b = await graph_engine.find_project_node(user_b_id, "Secret Project")
    assert p_b is not None
    assert p_b["properties"]["description"] == "Beta's secret"


@pytest.mark.asyncio
async def test_primary_chat_session_reuse():
    """Verify user gets a single persistent primary chat session and can reset it without creating ghost sessions."""
    await init_db()
    async with AsyncSessionLocal() as db:
        user = User(email=f"primary_user_{uuid.uuid4()}@test.com", hashed_password="pw")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_id = str(user.id)

    token = create_access_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Fetch primary session
        res1 = await ac.get("/api/v1/chat/sessions/primary", headers=headers)
        assert res1.status_code == 200
        session_id_1 = res1.json()["id"]

        # 2. Fetch primary session again -> MUST be identical ID
        res2 = await ac.get("/api/v1/chat/sessions/primary", headers=headers)
        assert res2.status_code == 200
        session_id_2 = res2.json()["id"]
        assert session_id_1 == session_id_2

        # 3. Reset primary session
        res3 = await ac.post("/api/v1/chat/sessions/reset", headers=headers)
        assert res3.status_code == 200
        assert len(res3.json()["messages"]) == 0
        assert res3.json()["id"] == session_id_1

        # 4. Fetch primary session after reset -> still returns the same clean primary session
        res4 = await ac.get("/api/v1/chat/sessions/primary", headers=headers)
        assert res4.status_code == 200
        assert res4.json()["id"] == session_id_1


@pytest.mark.asyncio
async def test_graph_router_relationship_endpoints():
    """Verify DELETE /graph/relationships and /graph/relationships/by-names."""
    await init_db()
    async with AsyncSessionLocal() as db:
        user = User(email=f"graph_endpoints_{uuid.uuid4()}@test.com", hashed_password="pw")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_id = str(user.id)

    token = create_access_token(user_id)
    headers = {"Authorization": f"Bearer {token}"}

    await graph_engine.upsert_user_node(user_id, "Graph User", user.email)
    await graph_engine.create_project(user_id, "Apollo", "Spacecraft", "Active")
    await graph_engine.upsert_skill(user_id, "Propulsion", "Aero", "Expert")
    await graph_engine.create_custom_relationship(user_id, "Apollo", "Propulsion", "USES")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Delete relationship by entity names
        res = await ac.delete(
            "/api/v1/graph/relationships/by-names",
            params={"source_name": "Apollo", "target_name": "Propulsion"},
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
        assert res.json()["deleted_count"] >= 1

        # Read facts endpoint
        facts_res = await ac.get("/api/v1/graph/facts", headers=headers)
        assert facts_res.status_code == 200
        assert isinstance(facts_res.json()["facts"], dict)
