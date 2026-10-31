def test_benchmark_roles_and_gap_analysis(client, auth_headers):
    roles = client.get("/api/v1/career/benchmark-roles", headers=auth_headers)
    assert roles.status_code == 200
    role_list = roles.json()
    assert len(role_list) >= 10
    role_ids = {role["id"] for role in role_list}
    assert "role_ai_systems_engineer" in role_ids

    gap = client.get(
        "/api/v1/career/gap-analysis",
        params={"role_id": "role_ai_systems_engineer"},
        headers=auth_headers,
    )
    assert gap.status_code == 200
    body = gap.json()
    assert body["total_required"] > 0
    assert 0 <= body["match_percent"] <= 100
    assert body["missing_skills"]


def test_generate_roadmap(client, auth_headers):
    response = client.post(
        "/api/v1/career/generate-roadmap",
        json={"role_id": "role_ai_systems_engineer", "weeks": 4},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["weeks"] == 4
    assert len(body["roadmap"]["weeks"]) == 4
