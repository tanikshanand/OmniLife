# Document 06: Step-by-Step AI Build Execution Prompts

This document is the **Golden Master Execution Sequence**. It contains 10 modular, rigorously structured prompts. You can feed these prompts one-by-one into an AI coding assistant (or execute them sequentially) to build the entire OmniLife platform without missing dependencies or hallucinated schemas.

---

## 📋 Execution Protocol for the AI Agent
1. **Execute sequentially**: Never jump ahead to Phase N+1 until Phase N has passed its verification test.
2. **Reference the Plan**: Always read the corresponding planning document in `plan/` before generating code.
3. **No Placeholders**: Never write `// TODO: implement later` or pass empty stub functions. Implement complete, working logic with fallback defaults.
4. **Resilience**: Ensure database connections gracefully handle reconnection and provide mock/in-memory fallbacks when external services (e.g., live Neo4j) are spinning up.

---

## Phase 1: Project Scaffolding, Docker Compose & Environment Setup

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 1 - SCAFFOLDING & INFRASTRUCTURE

You are acting as the lead software engineer for OmniLife Digital Twin.
Your goal is to initialize the project scaffolding, create the multi-container Docker Compose configuration, setup the Python backend virtual environment structure, and initialize the Next.js frontend.

Please reference:
- plan/00_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md

TASKS:
1. Create the root `docker-compose.yml` specifying:
   - `postgres:16-alpine` (port 5432) with healthy checks.
   - `neo4j:5.20.0-community` (ports 7474, 7687) with APOC enabled.
   - `chromadb/chroma:0.5.3` (port 8001 -> 8000).
   - `backend` (FastAPI, port 8000).
   - `frontend` (Next.js, port 3000).
2. Create `.env.example` and `.env` in the root with all necessary environment variables:
   - `OLLAMA_BASE_URL=http://localhost:11434` (or `http://host.docker.internal:11434` for containers)
   - `PRIMARY_MODEL=ollama/llama3.2`
   - `EMBEDDING_MODEL=all-MiniLM-L6-v2`
   - PostgreSQL credentials, Neo4j auth, Chroma host/port, JWT secret.
   - Note: Zero paid cloud API keys required. All inference runs via local Ollama.
3. Scaffold the `backend/` directory:
   - `requirements.txt` with: fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, pydantic, pydantic-settings, python-jose[cryptography], passlib[bcrypt], chromadb, neo4j, litellm, instructor, pypdf, python-multipart, edge-tts, pytest, pytest-asyncio, httpx.
   - `backend/Dockerfile` with Python 3.11-slim.
   - `backend/app/main.py` with basic FastAPI app and healthcheck endpoint (`/api/v1/health`).
   - `backend/app/core/config.py` using Pydantic `BaseSettings` reading environment variables.
4. Scaffold the `frontend/` directory with `package.json` for Next.js 14, Tailwind CSS, Lucide React, and TypeScript.
5. Create a root `.gitignore` ignoring `.env`, `node_modules`, `__pycache__`, `.venv`, and data volumes.

VERIFICATION COMMAND:
Run: `python -m venv backend/.venv` and verify that `backend/app/core/config.py` imports without error.
```

---

## Phase 2: PostgreSQL Database Engine & SQLAlchemy Models

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 2 - RELATIONAL DATABASE & SCHEMAS

Implement the complete PostgreSQL async database layer and SQLAlchemy ORM models for OmniLife.

Please reference:
- plan/02_DATA_MODELS_AND_GRAPH_SCHEMAS.md (Section 1)

TASKS:
1. In `backend/app/core/database.py`:
   - Initialize SQLAlchemy `create_async_engine` and `async_sessionmaker`.
   - Provide an async dependency `get_db()` yielding `AsyncSession`.
2. In `backend/app/models/`:
   - `base.py`: Base class and `TimestampMixin` (`created_at`, `updated_at`).
   - `user.py`: `User` and `Profile` models with exact fields, relationships, and JSON columns.
   - `memory.py`: `Document` and `MemoryChunk` models.
   - `goal.py`: `Goal`, `Milestone`, and `Task` models with foreign key cascades.
   - `chat.py`: `ChatSession` and `ChatMessage` models with JSON `sources_cited`.
   - `analytics.py`: `DailyLog` model.
3. In `backend/app/schemas/`:
   - Create Pydantic v2 schemas for User registration, login, token responses, and Profile updates.
4. In `backend/app/core/security.py`:
   - Implement `verify_password`, `get_password_hash`, and `create_access_token` using `passlib` and `jose`.
5. In `backend/app/routers/auth.py` and `backend/app/routers/users.py`:
   - Implement `POST /api/v1/auth/register`.
   - Implement `POST /api/v1/auth/login`.
   - Implement `GET /api/v1/auth/me` with JWT dependency `get_current_user`.
   - Implement `GET /api/v1/profile` and `PUT /api/v1/profile`.
6. Mount the routers in `backend/app/main.py`.

VERIFICATION:
Create a script or test `backend/tests/test_auth.py` verifying registration and login token issuance.
```

---

## Phase 3: ChromaDB Vector Store & Semantic Memory Ingestion

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 3 - CHROMADB VECTOR MEMORY ENGINE

Implement the persistent vector memory engine for episodic and semantic storage using ChromaDB.

Please reference:
- plan/02_DATA_MODELS_AND_GRAPH_SCHEMAS.md (Section 3)
- plan/01_FEATURE_SPECIFICATION_AND_SYSTEM_MODULES.md (Module 2)

TASKS:
1. In `backend/app/core/vector_client.py`:
   - Create a persistent ChromaDB client connecting to the Chroma HTTP service (or fallback to local `./chroma_data` if running standalone).
   - Initialize the collection `omnilife_memory_vault` with cosine distance.
2. In `backend/app/services/rag_engine.py`:
   - Implement `embed_text(text: str) -> list[float]` using ChromaDB's local `all-MiniLM-L6-v2` ONNX embedding function (or Ollama embeddings `nomic-embed-text`) - completely local and free with zero API key requirement.
   - Implement `add_memory_chunks(chunks: list[dict], user_id: str)` to insert vectors with required metadata (`user_id`, `document_id`, `source`, `tags`).
   - Implement `query_semantic_memory(query: str, user_id: str, n_results: int = 5) -> list[dict]` enforcing the `{"user_id": user_id}` metadata filter.
   - Implement `delete_document_vectors(document_id: str, user_id: str)`.
3. In `backend/app/services/doc_parser.py`:
   - Parse `.pdf` (using `pypdf`), `.md`, and `.txt` files into clean text.
   - Implement semantic text chunking (chunk size 500 characters, overlap 50 characters).
4. In `backend/app/routers/memory.py`:
   - `POST /api/v1/memory/upload`: Upload file, parse, chunk, store in Postgres `Document` & `MemoryChunk`, and insert embeddings into ChromaDB.
   - `POST /api/v1/memory/quick-note`: Insert a short text memory.
   - `GET /api/v1/memory/chunks`: Query and return chunks with pagination.
   - `DELETE /api/v1/memory/documents/{id}`: Cascade delete.

VERIFICATION:
Write a test in `backend/tests/test_rag.py` uploading sample text, asserting vectors are saved in ChromaDB, and querying semantic similarity.
```

---

## Phase 4: Neo4j Knowledge Graph Engine & Cypher Subgraph Traversal

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 4 - NEO4J KNOWLEDGE GRAPH ENGINE

Implement the personal knowledge graph subsystem using Neo4j and Cypher.

Please reference:
- plan/02_DATA_MODELS_AND_GRAPH_SCHEMAS.md (Section 2 & 4)

TASKS:
1. In `backend/app/core/neo4j_client.py`:
   - Initialize the `neo4j.AsyncGraphDatabase` driver using `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`.
   - Add database connection lifecycle handlers (connect on startup, close on shutdown).
   - Implement schema setup: Create unique constraints for `User(id)`, `Skill(normalized_name)`, `Project(id)`, `Goal(id)`.
2. In `backend/app/services/graph_engine.py`:
   - Implement `upsert_user_node(user_id: str, name: str, email: str)`.
   - Implement `upsert_skill(user_id: str, skill_name: str, category: str, proficiency: str)`.
   - Implement `link_project_skill(user_id: str, project_title: str, skill_name: str)`.
   - Implement `get_user_subgraph(user_id: str, depth: int = 2) -> dict` returning nodes and links in the format:
     `{"nodes": [{"id": ..., "name": ..., "label": ..., "color": ...}], "links": [{"source": ..., "target": ..., "label": ...}]}`.
   - Seed default benchmark role ontologies (e.g. "AI Systems Engineer", "Full-Stack ML Engineer").
3. In `backend/app/routers/graph.py`:
   - `GET /api/v1/graph/subgraph`: Return the user's graph for the frontend visualizer.
   - `POST /api/v1/graph/nodes`: Manually create a node.
   - `POST /api/v1/graph/relationships`: Manually create a relationship.
   - `DELETE /api/v1/graph/nodes/{id}`: Delete a node.

VERIFICATION:
Create `backend/tests/test_graph.py` verifying that adding a user and two connected skills correctly produces the expected nodes and links JSON.
```

---

## Phase 5: Unstructured Ingestion Pipeline & LLM Entity Extraction

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 5 - AUTOMATED GRAPH & ENTITY EXTRACTION

Connect the document parser to an LLM extraction engine to automatically construct the knowledge graph from uploaded documents.

Please reference:
- plan/03_AI_RAG_AND_GRAPHRAG_ENGINE.md (Section 2)

TASKS:
1. In `backend/app/services/entity_extractor.py`:
   - Implement `extract_knowledge_triples(text: str) -> KnowledgeExtractionResult` using Ollama (`llama3.2` or `mistral`) with JSON mode / structured output.
   - Support extraction of `Skill`, `Project`, `Goal`, `Topic`, `Person`, and relationships (`HAS_SKILL`, `USED_IN`, `ADVANCES`, `REQUIRES_SKILL`).
   - Add normalization to ensure case-insensitive deduplication (e.g., 'fastapi' -> 'FastAPI').
2. In `backend/app/services/graph_engine.py`:
   - Implement `ingest_extracted_triples(user_id: str, extraction: KnowledgeExtractionResult)`:
     Executes transactional Cypher statements to MERGE extracted entities and relationships directly connected to the user.
3. Update `backend/app/routers/memory.py`:
   - When a document is uploaded to `/api/v1/memory/upload`, asynchronously trigger the entity extractor and ingest the discovered graph nodes/edges into Neo4j.

VERIFICATION:
Run extraction on a sample text: *"I built a distributed RAG pipeline in Python with FastAPI and ChromaDB to achieve my goal of mastering GenAI systems."* Verify that Neo4j has User, Project, Skills, and Goal nodes created and linked.
```

---

## Phase 6: Hybrid GraphRAG Context Fusion & Streaming Chat Engine

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 6 - HYBRID RETRIEVAL & DUAL-MODE STREAMING CHAT

Implement the core cognitive intelligence: Hybrid Vector + Graph Context Fusion and the Server-Sent Events (SSE) streaming chat router with Dual-Mode (Mentor vs. Clone) toggling.

Please reference:
- plan/03_AI_RAG_AND_GRAPHRAG_ENGINE.md (Section 1 & 3)
- plan/04_API_SPECIFICATION_AND_ENDPOINTS.md (Section 2.5)

TASKS:
1. In `backend/app/services/hybrid_retriever.py`:
   - Create `retrieve_hybrid_context(query: str, user_id: str, db_session) -> dict`:
     1. Retrieve top-4 semantic chunks from ChromaDB.
     2. Query Neo4j for 1-hop and 2-hop connected nodes to the user and query entities.
     3. Fetch active user goals from PostgreSQL.
     4. Format into a structured, unified prompt context block.
2. In `backend/app/services/clone_engine.py`:
   - Build system prompt generator for `Mode.MENTOR` (2nd person, strategic career advisor).
   - Build system prompt generator for `Mode.CLONE` (1st person "I", user voice, mimicking communication style and traits).
3. In `backend/app/routers/chat.py`:
   - `POST /api/v1/chat/sessions`: Create new session.
   - `GET /api/v1/chat/sessions`: List sessions.
   - `GET /api/v1/chat/sessions/{id}`: Get session history.
   - `POST /api/v1/chat/stream`: Accept `{session_id, query, mode}` and return a `StreamingResponse(..., media_type="text/event-stream")`.
   - Call local Ollama (`ollama/llama3.2`) with streaming enabled.
   - Stream context sources first (`event: context`), then token deltas (`event: message`), and finalize with message save to PostgreSQL (`event: done`).

VERIFICATION:
Create `backend/tests/test_chat.py` testing the SSE generator and asserting valid token output and database persistence.
```

---

## Phase 7: Goal Management, Kanban Task Engine & AI Roadmap Decomposer

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 7 - GOAL TREE, KANBAN & AI DECOMPOSITION

Implement the hierarchical goal tracking engine, Kanban task board, and the AI roadmap decomposer.

Please reference:
- plan/01_FEATURE_SPECIFICATION_AND_SYSTEM_MODULES.md (Module 5)
- plan/04_API_SPECIFICATION_AND_ENDPOINTS.md (Section 2.6)

TASKS:
1. In `backend/app/routers/goals.py`:
   - CRUD for `Goal` (title, description, category, target_date, status, progress_percent).
   - CRUD for `Milestone` (sequence_order, is_completed, due_date).
   - CRUD for `Task` (status: TODO / IN_PROGRESS / BLOCKED / DONE, priority, estimated_hours).
   - `PATCH /api/v1/tasks/{id}/status`: Move task across Kanban columns; automatically recalculate parent Goal `progress_percent`.
2. Implement AI Auto-Decompose (`POST /api/v1/goals/{id}/decompose`):
   - Query user's current skills from Neo4j.
   - Call local Ollama with JSON output to break the goal into 3-5 sequential Milestones and 2-4 actionable Tasks per milestone.
   - Atomically commit the generated milestones and tasks to PostgreSQL.
   - Create `(:Goal)-[:REQUIRES_SKILL]->(:Skill)` relationships in Neo4j for any new skills identified.

VERIFICATION:
Create a test goal, trigger `/decompose`, and assert that 3+ milestones and tasks are created and linked to the goal.
```

---

## Phase 8: Career Compass & Skill Gap Analyzer Engine

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 8 - CAREER COMPASS & SKILL GAP ANALYZER

Implement the quantitative skill gap analyzer and personalized learning sprint generator.

Please reference:
- plan/03_AI_RAG_AND_GRAPHRAG_ENGINE.md (Section 4)
- plan/04_API_SPECIFICATION_AND_ENDPOINTS.md (Section 2.7)

TASKS:
1. In `backend/app/services/career_engine.py`:
   - Implement `get_benchmark_roles() -> list[dict]`.
   - Implement `compute_skill_gap(user_id: str, role_id: str) -> dict`:
     - Runs Cypher match comparing user's skills vs. role requirements.
     - Calculates match percentage: `(mastered_skills / total_required_skills) * 100`.
     - Returns: `match_percent`, `mastered_skills` list, `in_progress_skills` list, and `missing_skills` list.
   - Implement `generate_curated_roadmap(user_id: str, role_id: str, weeks: int = 4) -> dict`:
     - Uses LLM to synthesize a step-by-step project specification engineered to bridge the highest-priority missing skills.
2. In `backend/app/routers/career.py`:
   - Expose endpoints:
     - `GET /api/v1/career/benchmark-roles`
     - `GET /api/v1/career/gap-analysis?role_id=...`
     - `POST /api/v1/career/generate-roadmap`

VERIFICATION:
Run gap analysis for a mock user against "AI Systems Engineer" and assert accurate missing skill breakdown and match score.
```

---

## Phase 9: Frontend Foundation, Design System & Next.js Shell

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 9 - FRONTEND SETUP & APP SHELL

Initialize the Next.js 14+ frontend application, install Tailwind CSS, configure Shadcn UI components, and establish the main dashboard layout.

Please reference:
- plan/05_FRONTEND_ARCHITECTURE_AND_UI_SPEC.md

TASKS:
1. In `frontend/`:
   - Install required dependencies: `lucide-react`, `clsx`, `tailwind-merge`, `zustand`, `axios`, `react-markdown`, `rehype-highlight`, `react-force-graph-2d`.
   - Configure `tailwind.config.ts` with dark theme palette, slate surfaces, and brand colors (indigo, emerald, amber, rose).
   - Create `src/lib/api.ts` with Axios client configured with base URL `http://localhost:8000/api/v1` and automatic JWT header injection.
   - Create `src/lib/store.ts` Zustand store for auth user, active twin mode (`MENTOR` vs `CLONE`), and notifications.
2. Build Auth Views:
   - `src/app/login/page.tsx` with email/password form and "Quick Demo Login" button.
   - `src/app/register/page.tsx`.
3. Build App Shell (`src/app/dashboard/layout.tsx`):
   - Responsive dark-mode Sidebar with links:
     - 📊 Overview (`/dashboard`)
     - 💬 Twin Chat (`/dashboard/chat`)
     - 🕸️ Knowledge Graph (`/dashboard/graph`)
     - 🧠 Memory Vault (`/dashboard/memory`)
     - 🎯 Goals & Kanban (`/dashboard/goals`)
     - 🧭 Career Compass (`/dashboard/career`)
     - 📈 Analytics (`/dashboard/analytics`)
   - Header with active User Avatar, Mode indicator badge, and Quick Voice trigger.
4. Build Dashboard Overview (`src/app/dashboard/page.tsx`):
   - Quick KPI cards: Total Memories, Mastered Skills, Active Goals, Twin Mode.
   - Recent activity stream and quick chat prompt launcher.

VERIFICATION:
Start frontend dev server (`npm run dev`) and verify that `/dashboard` renders cleanly in dark mode.
```

---

## Phase 10: Interactive UI Views & End-to-End System Integration

### 🤖 Copy-Paste Prompt for AI:
```text
PROMPT: PHASE 10 - INTERACTIVE VIEWS & E2E INTEGRATION

Implement all remaining interactive dashboard views and integrate them with the FastAPI backend.

Please reference:
- plan/05_FRONTEND_ARCHITECTURE_AND_UI_SPEC.md (Section 3)

TASKS:
1. Twin Chat View (`src/app/dashboard/chat/page.tsx`):
   - Mode Toggle at top: `Digital Mentor` (advisor) vs `Digital Clone` (first-person).
   - Real-time SSE streaming reader appending deltas to the chat bubble.
   - Source pill citations at the bottom of messages.
   - Web Speech API microphone button for speech-to-text input.
2. Knowledge Graph View (`src/app/dashboard/graph/page.tsx`):
   - Client-side dynamic import of `react-force-graph-2d`.
   - Fetch data from `/api/v1/graph/subgraph`.
   - Color code nodes: Purple (User), Green (Skill), Amber (Project), Blue (Goal).
   - Side drawer on node click showing node details, connected edges, and actions.
3. Memory Vault View (`src/app/dashboard/memory/page.tsx`):
   - Drag-and-drop dropzone uploading files to `/api/v1/memory/upload`.
   - Table of indexed memory chunks with search bar and delete button.
4. Goal Tree & Kanban View (`src/app/dashboard/goals/page.tsx`):
   - Goal list with progress bar.
   - One-click `[ ✨ AI Auto-Decompose ]` button calling `/goals/{id}/decompose`.
   - Kanban board columns (TODO, IN PROGRESS, DONE) with task status update controls.
5. Career Compass View (`src/app/dashboard/career/page.tsx`):
   - Benchmark role selector.
   - Circular readiness gauge.
   - Mastered vs. Missing skill pill matrix.
   - "Generate 4-Week Learning Sprint" action.
6. Behavioral Analytics View (`src/app/dashboard/analytics/page.tsx`):
   - Daily reflection logger modal.
   - Weekly AI debrief card.

VERIFICATION:
Execute full E2E flow:
1. Register user.
2. Upload sample resume/notes in Memory Vault.
3. Verify nodes appear in Knowledge Graph.
4. Chat with Digital Twin in Mentor and Clone modes and observe context citations.
5. Decompose a goal and move a task on the Kanban board.
6. Verify career match calculation.
```
