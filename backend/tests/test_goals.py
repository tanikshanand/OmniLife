def test_goal_decompose_and_kanban(client, auth_headers):
    goal = client.post(
        "/api/v1/goals",
        json={
            "title": "Land an AI Systems Engineer role",
            "description": "Build production inference and RAG experience.",
            "category": "Career",
        },
        headers=auth_headers,
    )
    assert goal.status_code == 201, goal.text
    goal_id = goal.json()["id"]

    decomposed = client.post(
        f"/api/v1/goals/{goal_id}/decompose", headers=auth_headers
    )
    assert decomposed.status_code == 200, decomposed.text
    body = decomposed.json()
    assert len(body["milestones"]) >= 3
    tasks = [task for milestone in body["milestones"] for task in milestone["tasks"]]
    assert len(tasks) >= 3

    task_id = tasks[0]["id"]
    moved = client.patch(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "DONE"},
        headers=auth_headers,
    )
    assert moved.status_code == 200
    assert moved.json()["status"] == "DONE"

    kanban = client.get("/api/v1/tasks/kanban", headers=auth_headers)
    assert kanban.status_code == 200
    assert len(kanban.json()["columns"]["DONE"]) >= 1

    updated_goal = client.get(f"/api/v1/goals/{goal_id}", headers=auth_headers)
    assert updated_goal.status_code == 200
    assert updated_goal.json()["progress_percent"] >= 0
