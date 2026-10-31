# Document 00: System Architecture & Technology Stack

## 1. System Vision & Architecture Overview

**OmniLife Digital Twin** is an intelligent personal cognitive clone and life-career operating system. Unlike conventional chatbots that suffer from amnesia and isolated context windows, OmniLife constructs a persistent, dual-layer cognitive architecture:
1. **Semantic Episodic & Document Memory**: Stored as high-dimensional dense vector embeddings in ChromaDB.
2. **Structural & Associative Knowledge Graph**: Stored as connected entities, concepts, skills, and relationships in Neo4j.
3. **Structured Relational Storage**: Stored in PostgreSQL for transactional data (user auth, goal milestones, task Kanban status, focus logs, and configuration).

```mermaid
flowchart TD
    subgraph Client["Frontend Layer (Next.js 14+ / React / Tailwind)"]
        UI["Dashboard & Command Center"]
        Chat["Digital Twin Chat (Dual-Mode: Mentor & Clone)"]
        GraphUI["Interactive 2D/3D Force Graph Visualizer"]
        Voice["Voice I/O Interface (STT/TTS)"]
        Goals["Goal & Career Compass Board"]
        MemoryVault["Memory Vault & Document Ingestor"]
    end

    subgraph Gateway["API & Application Layer (FastAPI Backend)"]
        Router["FastAPI Gateway & Route Handlers"]
        AuthMiddleware["JWT Authentication & Session Management"]
        Orchestrator["Cognitive Orchestrator (LangChain / Instructor)"]
        
        subgraph Subsystems["Core AI Engines"]
            HybridRAG["Hybrid Retrieval Engine (Vector + Graph)"]
            KGExtractor["Entity & Relation Extractor"]
            CloneEngine["Personality & Communication Style Engine"]
            CareerRecommender["Career & Skill Gap Recommender"]
            ProductivityEngine["Behavioral & Focus Analytics Engine"]
        end
    end

    subgraph Storage["Storage & Knowledge Infrastructure"]
        PG[("PostgreSQL\n(User, Goals, Tasks, Metrics)")]
        Chroma[("ChromaDB\n(Dense Vector Embeddings)")]
        Neo[("Neo4j Graph DB\n(Entities, Skills, Projects, Relations)")]
    end

    subgraph LocalAI["100% Local AI & Inference Layer (No Cloud API Keys)"]
        OllamaEngine["Ollama Runtime (http://localhost:11434)\n(llama3.2 / mistral / qwen2.5)"]
        LocalEmbedder["Local Embeddings\n(all-MiniLM-L6-v2 via ONNX / nomic-embed-text)"]
        LocalVoice["Edge-TTS (Free Neural Audio) + Web Speech API"]
    end

    Client <-->|REST & Server-Sent Events| Gateway
    Router --> Orchestrator
    Orchestrator --> Subsystems
    Subsystems <--> PG
    Subsystems <--> Chroma
    Subsystems <--> Neo
    Subsystems <--> OllamaEngine
    Subsystems <--> LocalEmbedder
    Client <--> LocalVoice
```

---

## 2. Definitive Technology Stack

| Layer | Chosen Technology | Version / Specification | Rationale & Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (App Router)** | `v14.2+` or `v15` (TypeScript) | Server components, API proxying, blazing fast client hydration, robust routing. |
| **Styling & Components**| **Tailwind CSS + Shadcn UI**| `Tailwind v3.4+`, Radix Primitives | High-polish, modern, dark-mode native dashboard components with accessible primitives. |
| **Graph Visualization** | **`react-force-graph-2d`** | Latest npm | Smooth canvas rendering of personal knowledge graphs with zoom, filter, and drag support. |
| **Backend Framework** | **Python FastAPI** | `v0.111+` (Python 3.11+) | Asynchronous high-throughput REST API, native Pydantic v2 validation, SSE streaming. |
| **Relational Database** | **PostgreSQL** | `v16-alpine` (SQLAlchemy 2.0 Async / Alembic) | ACID compliance for authentication, goals, milestones, tasks, and system logs. |
| **Vector Database** | **ChromaDB** | `v0.5+` (Persistent Client) | Native Python embedding storage, metadata filtering, cosine similarity search for episodic memory. |
| **Knowledge Graph** | **Neo4j Community Edition**| `v5.20+` (Neo4j Python Driver / Cypher) | Industry standard labeled property graph for deep multi-hop relational modeling. |
| **LLM & Inference** | **Ollama + LiteLLM / Instructor** | `v0.3+` (Local `llama3.2` / `mistral`) | 100% free, local, private execution on laptop CPU/GPU. Zero API key requirement. |
| **Vector Embeddings** | **FastEmbed / ChromaDB Native (ONNX)** | `all-MiniLM-L6-v2` / `nomic-embed-text` | High-efficiency local embeddings without network calls or rate limits. |
| **Voice Processing** | **Web Speech API + Edge-TTS** | Browser native STT + Free Python edge-tts | Zero-cost natural voice interaction with realistic Microsoft neural voices. |
| **Containerization** | **Docker & Docker Compose** | Docker v26+, Compose v2+ | Single command local multi-service container orchestration. |

---

## 3. Repository Directory Structure

```text
OmniLife/
├── docker-compose.yml              # Multi-container orchestration (FastAPI, Postgres, Neo4j, Chroma)
├── .env.example                    # Template environment variables
├── README.md                       # Project overview and run instructions
├── plan/                           # AI Implementation blueprints & prompts
│   ├── README.md
│   ├── 00_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md
│   ├── 01_FEATURE_SPECIFICATION_AND_SYSTEM_MODULES.md
│   ├── 02_DATA_MODELS_AND_GRAPH_SCHEMAS.md
│   ├── 03_AI_RAG_AND_GRAPHRAG_ENGINE.md
│   ├── 04_API_SPECIFICATION_AND_ENDPOINTS.md
│   ├── 05_FRONTEND_ARCHITECTURE_AND_UI_SPEC.md
│   └── 06_AI_BUILD_EXECUTION_PROMPTS.md
│
├── backend/                        # FastAPI Application
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application factory & lifespan
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic BaseSettings config
│   │   │   ├── database.py         # SQLAlchemy async engine & sessionmaker
│   │   │   ├── neo4j_client.py     # Neo4j connection pool & query helpers
│   │   │   ├── vector_client.py    # ChromaDB persistent collection client
│   │   │   └── security.py         # JWT generation, password hashing (bcrypt)
│   │   ├── models/                 # SQLAlchemy ORM Models
│   │   │   ├── user.py
│   │   │   ├── goal.py
│   │   │   ├── task.py
│   │   │   ├── memory.py
│   │   │   └── analytics.py
│   │   ├── schemas/                # Pydantic v2 Request/Response Schemas
│   │   │   ├── user_schema.py
│   │   │   ├── chat_schema.py
│   │   │   ├── graph_schema.py
│   │   │   ├── goal_schema.py
│   │   │   └── analytics_schema.py
│   │   ├── services/               # Core Logic & AI Engines
│   │   │   ├── llm_service.py      # LiteLLM / Provider wrappers
│   │   │   ├── rag_engine.py       # Dense vector semantic retrieval
│   │   │   ├── graph_engine.py     # Neo4j Cypher querying & graph traversal
│   │   │   ├── hybrid_retriever.py # Unified GraphRAG Context Fusion
│   │   │   ├── entity_extractor.py # Unstructured text -> Neo4j triples
│   │   │   ├── clone_engine.py     # Digital Clone vs. Digital Mentor prompts
│   │   │   ├── career_engine.py    # Skill gap analysis & career path simulation
│   │   │   ├── doc_parser.py       # PDF/Markdown/TXT resume and notes parser
│   │   │   └── voice_service.py    # TTS audio generation
│   │   ├── routers/                # FastAPI Endpoints
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── chat.py             # Streaming SSE chat endpoints
│   │   │   ├── memory.py           # Document ingestion & memory vault
│   │   │   ├── graph.py            # Graph query & visualization nodes/edges
│   │   │   ├── goals.py            # Goals & Kanban milestones
│   │   │   ├── career.py           # Skill gap & path recommendations
│   │   │   └── analytics.py        # Productivity logs & metrics
│   │   └── tests/                  # Pytest test suite
│   │       ├── test_auth.py
│   │       ├── test_rag.py
│   │       ├── test_graph.py
│   │       └── test_chat.py
│   └── migrations/                 # Alembic database migrations
│
└── frontend/                       # Next.js 14+ App Router
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── next.config.mjs
    ├── src/
    │   ├── app/                    # Next.js App Routes
    │   │   ├── layout.tsx          # Root layout with ThemeProvider & Providers
    │   │   ├── page.tsx            # Landing & Hero
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   ├── dashboard/          # Protected Dashboard Layout
    │   │   │   ├── layout.tsx      # Sidebar, topbar, user status
    │   │   │   ├── page.tsx        # Overview / Quick Stats / Activity Stream
    │   │   │   ├── chat/page.tsx   # Twin Chat (Mentor vs Clone toggle)
    │   │   │   ├── graph/page.tsx  # Interactive Force Graph Visualization
    │   │   │   ├── memory/page.tsx # Memory Vault & File Dropzone
    │   │   │   ├── goals/page.tsx  # Goal Tree & Kanban Board
    │   │   │   ├── career/page.tsx # Career Compass & Skill Gap Analyzer
    │   │   │   └── analytics/page.tsx # Productivity Patterns & Logs
    │   ├── components/
    │   │   ├── ui/                 # Shadcn UI primitives (Button, Dialog, Card...)
    │   │   ├── chat/               # Chat bubbles, message stream, mode switcher
    │   │   ├── graph/              # ForceGraph2D wrapper, node details sheet
    │   │   ├── voice/              # Mic button, audio visualizer, TTS playback
    │   │   ├── memory/             # Document upload card, memory search bar
    │   │   ├── goals/              # Milestone stepper, Kanban task cards
    │   │   └── layout/             # Sidebar, Header, Notification Drawer
    │   ├── lib/
    │   │   ├── api.ts              # Axios / Fetch client with JWT interceptor
    │   │   ├── auth.ts             # Auth tokens & local storage helpers
    │   │   ├── store.ts            # Zustand global state (user, chat, activeMode)
    │   │   └── utils.ts            # ClassNames, date formatters
    │   └── types/                  # TypeScript interface contracts
    │       ├── user.d.ts
    │       ├── chat.d.ts
    │       ├── graph.d.ts
    │       ├── goal.d.ts
    │       └── memory.d.ts
```

---

## 4. Docker Compose Infrastructure Specification

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: omnilife-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-omnilife}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-omnilife_secret}
      POSTGRES_DB: ${POSTGRES_DB:-omnilife_db}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnilife -d omnilife_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  neo4j:
    image: neo4j:5.20.0-community
    container_name: omnilife-neo4j
    restart: unless-stopped
    environment:
      NEO4J_AUTH: ${NEO4J_AUTH:-neo4j/omnilife_graph_secret}
      NEO4J_PLUGINS: '["apoc"]'
      NEO4J_dbms_security_procedures_unrestricted: "apoc.*"
    ports:
      - "7474:7474" # Browser UI
      - "7687:7687" # Bolt protocol
    volumes:
      - neo4jdata:/data

  chromadb:
    image: chromadb/chroma:0.5.3
    container_name: omnilife-chroma
    restart: unless-stopped
    environment:
      IS_PERSISTENT: "TRUE"
      PERSIST_DIRECTORY: "/chroma/data"
      ANONYMIZED_TELEMETRY: "FALSE"
    ports:
      - "8001:8000"
    volumes:
      - chromadata:/chroma/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: omnilife-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_started
      chromadb:
        condition: service_started
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-omnilife}:${POSTGRES_PASSWORD:-omnilife_secret}@postgres:5432/${POSTGRES_DB:-omnilife_db}
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: ${NEO4J_PASSWORD:-omnilife_graph_secret}
      CHROMA_HOST: chromadb
      CHROMA_PORT: 8000
      SECRET_KEY: ${SECRET_KEY:-super_secret_jwt_key_32_characters}
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      PRIMARY_MODEL: ${PRIMARY_MODEL:-ollama/llama3.2}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: omnilife-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000/api/v1
    depends_on:
      - backend

volumes:
  pgdata:
  neo4jdata:
  chromadata:
```

---

## 5. Environment Variables Template (`.env.example`)

```bash
# === Database & Services ===
POSTGRES_USER=omnilife
POSTGRES_PASSWORD=omnilife_secret
POSTGRES_DB=omnilife_db
DATABASE_URL=postgresql+asyncpg://omnilife:omnilife_secret@localhost:5432/omnilife_db

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=omnilife_graph_secret

CHROMA_HOST=localhost
CHROMA_PORT=8001

# === Security & Auth ===
SECRET_KEY=change_this_to_a_secure_random_64_character_hex_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080 # 7 days

# === Local Ollama & Embeddings Configuration (100% Free - No API Keys) ===
OLLAMA_BASE_URL=http://localhost:11434
PRIMARY_MODEL=ollama/llama3.2
EMBEDDING_MODEL=all-MiniLM-L6-v2

# (Optional fallback if ever using cloud models)
# OPENAI_API_KEY=
```
