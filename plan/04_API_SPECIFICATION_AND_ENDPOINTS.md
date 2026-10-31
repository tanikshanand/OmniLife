# Document 04: API Specification & Endpoints Reference

All endpoints are hosted under `/api/v1` and adhere to RESTful conventions with JSON payloads and Server-Sent Events (SSE) for streaming responses.

---

## 1. Authentication & Security Middleware

Every request to a protected endpoint must include an HTTP Authorization header:
```http
Authorization: Bearer <jwt_access_token>
```

### Standard Error Response Format
```json
{
  "detail": "Descriptive error message",
  "error_code": "RESOURCE_NOT_FOUND",
  "timestamp": "2026-10-24T14:40:00Z"
}
```

---

## 2. API Endpoint Matrix

### 2.1 Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Request Body | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new user | `{"email": "...", "password": "...", "full_name": "..."}` | `201 Created` |
| `POST` | `/auth/login` | Login and obtain JWT | `{"email": "...", "password": "..."}` | `200 OK` (`{"access_token": "...", "token_type": "bearer"}`) |
| `GET` | `/auth/me` | Current authenticated user profile | None | `200 OK` |

### 2.2 Profile & Persona Management (`/api/v1/profile`)
| Method | Endpoint | Description | Request Body | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/profile` | Get full user profile and twin persona | None | `200 OK` |
| `PUT` | `/profile` | Update profile, communication style & traits | `ProfileUpdateSchema` | `200 OK` |
| `GET` | `/profile/export`| Export entire user data (GDPR/Data sovereignty) | None | `200 OK` (JSON bundle) |

### 2.3 Memory Vault & Document Ingestion (`/api/v1/memory`)
| Method | Endpoint | Description | Request Body / Params | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/memory/upload` | Upload PDF/Markdown/TXT document for RAG & Graph ingestion | `multipart/form-data` (`file`) | `202 Accepted` |
| `POST` | `/memory/quick-note` | Add quick textual memory directly | `{"content": "...", "tags": ["learning"]}` | `201 Created` |
| `GET` | `/memory/chunks` | Paginated search of indexed memory chunks | `?query=...&page=1&limit=20` | `200 OK` |
| `DELETE` | `/memory/documents/{id}` | Delete document and cascade delete vectors & graph links | None | `204 No Content` |
| `DELETE` | `/memory/chunks/{id}` | Purge specific chunk from ChromaDB | None | `204 No Content` |

### 2.4 Knowledge Graph Engine (`/api/v1/graph`)
| Method | Endpoint | Description | Request Body / Params | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/graph/subgraph` | Get user's knowledge graph for UI visualization | `?depth=2&limit=150` | `200 OK` (`GraphVisualizationData`) |
| `POST` | `/graph/nodes` | Manually add a graph node (Skill, Project, etc.) | `NodeCreateSchema` | `201 Created` |
| `DELETE`| `/graph/nodes/{id}` | Delete a node and its incident edges | None | `204 No Content` |
| `POST` | `/graph/relationships` | Create an explicit edge between two nodes | `RelationCreateSchema` | `201 Created` |

#### Graph Visualization Response Payload (`GraphVisualizationData`)
```json
{
  "nodes": [
    {"id": "usr_1", "name": "Taniksh", "label": "User", "val": 20, "color": "#6366f1"},
    {"id": "skl_fastapi", "name": "FastAPI", "label": "Skill", "val": 12, "color": "#10b981"},
    {"id": "prj_omnilife", "name": "OmniLife", "label": "Project", "val": 15, "color": "#f59e0b"}
  ],
  "links": [
    {"source": "usr_1", "target": "skl_fastapi", "label": "HAS_SKILL", "proficiency": "Expert"},
    {"source": "prj_omnilife", "target": "skl_fastapi", "label": "UTILIZES"}
  ]
}
```

### 2.5 Dual-Mode Conversational Twin (`/api/v1/chat`)
| Method | Endpoint | Description | Request Body / Params | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/chat/sessions` | Create a new conversation session | `{"title": "Career Strategy", "mode": "MENTOR"}` | `201 Created` |
| `GET` | `/chat/sessions` | List all sessions for user | None | `200 OK` |
| `GET` | `/chat/sessions/{id}` | Get session details and message history | None | `200 OK` |
| `POST` | `/chat/stream` | Stream LLM response via Server-Sent Events (SSE) | `ChatRequestSchema` | `200 OK (text/event-stream)` |

#### SSE Event Format
```text
event: context
data: {"sources": [{"title": "Resume.pdf", "chunk": "FastAPI async backend"}, {"graph": "OmniLife -> Python"}]}

event: message
data: {"delta": "Based on your "}

event: message
data: {"delta": "knowledge graph, you have solid foundations in FastAPI..."}

event: done
data: {"session_id": "9b1deb4d", "message_id": "4e1a49a2"}
```

### 2.6 Goal & Kanban Engine (`/api/v1/goals`)
| Method | Endpoint | Description | Request Body / Params | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/goals` | List all goals with milestones & progress | None | `200 OK` |
| `POST` | `/goals` | Create a new goal | `GoalCreateSchema` | `201 Created` |
| `POST` | `/goals/{id}/decompose` | AI breakdown of goal into milestones & tasks | None | `200 OK` |
| `PATCH` | `/goals/{id}` | Update goal status or target date | `GoalUpdateSchema` | `200 OK` |
| `GET` | `/tasks/kanban` | Get tasks organized by status (TODO, DOING, DONE) | None | `200 OK` |
| `PATCH` | `/tasks/{id}/status` | Move task across Kanban columns | `{"status": "DONE"}` | `200 OK` |

### 2.7 Career Compass & Skill Gap Analyzer (`/api/v1/career`)
| Method | Endpoint | Description | Request Body / Params | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/career/benchmark-roles` | Get available target benchmark career roles | None | `200 OK` |
| `GET` | `/career/gap-analysis` | Compare user skill graph with target role | `?role_id=role_ai_systems_engineer` | `200 OK` |
| `POST` | `/career/generate-roadmap` | Generate tailored project/study sprint | `{"role_id": "role_ai_systems_engineer", "weeks": 4}` | `200 OK` |

### 2.8 Behavioral Analytics & Focus Logging (`/api/v1/analytics`)
| Method | Endpoint | Description | Request Body / Params | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/analytics/daily-log` | Submit daily reflection & focus entry | `DailyLogCreateSchema` | `201 Created` |
| `GET` | `/analytics/metrics` | Retrieve velocity, skill growth, and streaks | `?days=30` | `200 OK` |
| `GET` | `/analytics/weekly-debrief`| Generate / retrieve weekly AI retrospective summary | None | `200 OK` |

### 2.9 Voice Interaction (`/api/v1/voice`)
| Method | Endpoint | Description | Request Body | Response Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/voice/tts` | Convert text to natural streaming audio | `{"text": "...", "voice": "en-US-ChristopherNeural"}` | `200 OK (audio/mpeg)` |
| `POST` | `/voice/transcribe` | Transcribe user spoken audio file (Whisper) | `multipart/form-data` (`audio`) | `200 OK` (`{"text": "..."}`) |
