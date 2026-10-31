import os
import uuid
from pathlib import Path

import pytest

BASE = Path(__file__).resolve().parent
TEST_DB = BASE / "test_omnilife.db"
GRAPH_FILE = BASE / "test_graph_fallback.json"
VECTOR_FILE = BASE / "test_vector_fallback.json"

for path in (TEST_DB, GRAPH_FILE, VECTOR_FILE):
    if path.exists():
        path.unlink()

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB.as_posix()}"
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["NEO4J_ENABLED"] = "false"
os.environ["CHROMA_ENABLED"] = "false"
os.environ["GRAPH_FALLBACK_PATH"] = str(GRAPH_FILE)
os.environ["VECTOR_FALLBACK_PATH"] = str(VECTOR_FILE)
os.environ["OLLAMA_BASE_URL"] = "http://127.0.0.1:9"
os.environ["SECRET_KEY"] = "test_secret_key_0123456789abcdef"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(client):
    email = f"user_{uuid.uuid4().hex[:10]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "password123",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
