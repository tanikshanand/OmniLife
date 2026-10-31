def test_stream_chat_and_persistence(client, auth_headers):
    session = client.post(
        "/api/v1/chat/sessions",
        json={"title": "Career Strategy", "mode": "MENTOR"},
        headers=auth_headers,
    )
    assert session.status_code == 201, session.text
    session_id = session.json()["id"]

    with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={
            "session_id": session_id,
            "query": "What should I focus on next?",
            "mode": "MENTOR",
        },
        headers=auth_headers,
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: context" in body
    assert "event: message" in body
    assert "event: done" in body

    detail = client.get(
        f"/api/v1/chat/sessions/{session_id}", headers=auth_headers
    )
    assert detail.status_code == 200
    messages = detail.json()["messages"]
    assert len(messages) >= 2
    assert messages[-1]["role"] == "assistant"
    assert messages[-1]["content"]


def test_clone_mode_stream(client, auth_headers):
    response = client.post(
        "/api/v1/chat/stream",
        json={
            "query": "Tell me about my experience with FastAPI.",
            "mode": "CLONE",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    text = response.text
    assert "event: context" in text
    assert "event: done" in text
