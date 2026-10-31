def test_quick_note_vector_search_and_delete(client, auth_headers):
    note = client.post(
        "/api/v1/memory/quick-note",
        json={
            "content": "I built a high-throughput FastAPI service backed by PostgreSQL.",
            "tags": ["backend", "fastapi"],
        },
        headers=auth_headers,
    )
    assert note.status_code == 201, note.text
    chunk = note.json()
    assert chunk["chroma_id"].startswith("chunk_")

    listing = client.get(
        "/api/v1/memory/chunks",
        params={"query": "FastAPI"},
        headers=auth_headers,
    )
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] >= 1
    assert any("FastAPI" in item["content"] for item in body["items"])

    stats = client.get("/api/v1/memory/stats", headers=auth_headers)
    assert stats.status_code == 200
    assert stats.json()["vectors"] >= 1

    deleted = client.delete(
        f"/api/v1/memory/chunks/{chunk['id']}", headers=auth_headers
    )
    assert deleted.status_code == 204

    after = client.get(
        "/api/v1/memory/chunks",
        params={"query": "FastAPI"},
        headers=auth_headers,
    )
    assert after.json()["total"] == 0
