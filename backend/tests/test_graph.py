def test_graph_nodes_relationships_and_subgraph(client, auth_headers):
    rust = client.post(
        "/api/v1/graph/nodes",
        json={"label": "Skill", "name": "Rust", "properties": {"category": "Language"}},
        headers=auth_headers,
    )
    assert rust.status_code == 201, rust.text
    rust_node = rust.json()
    assert rust_node["label"] == "Skill"

    wasm = client.post(
        "/api/v1/graph/nodes",
        json={
            "label": "Topic",
            "name": "WebAssembly",
            "properties": {"domain": "Systems"},
        },
        headers=auth_headers,
    )
    assert wasm.status_code == 201, wasm.text
    wasm_node = wasm.json()

    relation = client.post(
        "/api/v1/graph/relationships",
        json={
            "source_id": rust_node["id"],
            "target_id": wasm_node["id"],
            "label": "RELATED_TO",
            "properties": {"strength": "high"},
        },
        headers=auth_headers,
    )
    assert relation.status_code == 201

    subgraph = client.get("/api/v1/graph/subgraph", headers=auth_headers)
    assert subgraph.status_code == 200
    data = subgraph.json()
    assert any(node["name"] == "Rust" for node in data["nodes"])
    assert any(node["name"] == "WebAssembly" for node in data["nodes"])
    assert any(
        link["source"] == rust_node["id"] and link["target"] == wasm_node["id"]
        for link in data["links"]
    )

    details = client.get(
        f"/api/v1/graph/nodes/{rust_node['id']}", headers=auth_headers
    )
    assert details.status_code == 200
    assert details.json()["node"]["name"] == "Rust"

    deleted = client.delete(
        f"/api/v1/graph/nodes/{wasm_node['id']}", headers=auth_headers
    )
    assert deleted.status_code == 204
