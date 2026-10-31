import uuid


def test_register_login_and_me(client):
    email = f"auth_{uuid.uuid4().hex[:8]}@example.com"
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "Auth Tester"},
    )
    assert register.status_code == 201, register.text
    body = register.json()
    assert body["access_token"]
    assert body["user"]["email"] == email
    assert body["user"]["profile"]["full_name"] == "Auth Tester"

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "password123"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_duplicate_email_rejected(client):
    email = f"dupe_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "password123", "full_name": "Dupe"}
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


def test_protected_route_requires_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
