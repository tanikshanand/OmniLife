# OmniLife Digital Twin: Master AI Implementation Blueprint

Welcome to the **OmniLife Digital Twin** engineering blueprint. This directory contains an exhaustive, production-grade architectural specification and step-by-step implementation guide. 

This plan is specifically engineered so that **any advanced AI coding agent (e.g., Claude 3.7 Sonnet, GPT-4o, Gemini 2.0 / Antigravity)** or human developer can ingest these documents sequentially and build the complete, end-to-end working system without ambiguity.

---

## 📑 Blueprint Structure

| Document | Purpose & Contents |
| :--- | :--- |
| **[`00_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md`](./00_SYSTEM_ARCHITECTURE_AND_TECH_STACK.md)** | High-level system architecture, component boundaries, complete tech stack justification, deployment topology, and full repository directory structure. |
| **[`01_FEATURE_SPECIFICATION_AND_SYSTEM_MODULES.md`](./01_FEATURE_SPECIFICATION_AND_SYSTEM_MODULES.md)** | Comprehensive breakdown of all 9 core subsystems, user journeys, edge cases, and functional requirements. |
| **[`02_DATA_MODELS_AND_GRAPH_SCHEMAS.md`](./02_DATA_MODELS_AND_GRAPH_SCHEMAS.md)** | Complete PostgreSQL DDL (SQLAlchemy/SQLModel), Neo4j Node & Edge Ontology with Cypher constraints, and ChromaDB vector collection schemas. |
| **[`03_AI_RAG_AND_GRAPHRAG_ENGINE.md`](./03_AI_RAG_AND_GRAPHRAG_ENGINE.md)** | Hybrid Vector-Graph RAG retrieval pipeline, entity extraction pipeline, personality clone prompting, career simulation algorithms, and memory compaction. |
| **[`04_API_SPECIFICATION_AND_ENDPOINTS.md`](./04_API_SPECIFICATION_AND_ENDPOINTS.md)** | Comprehensive FastAPI endpoint reference with request/response payloads, validation schemas, status codes, and streaming SSE endpoints. |
| **[`05_FRONTEND_ARCHITECTURE_AND_UI_SPEC.md`](./05_FRONTEND_ARCHITECTURE_AND_UI_SPEC.md)** | Next.js/React component architecture, Tailwind CSS design system, Interactive Graph Viewer (`react-force-graph-2d`), Voice Assistant UI, and State Management. |
| **[`06_AI_BUILD_EXECUTION_PROMPTS.md`](./06_AI_BUILD_EXECUTION_PROMPTS.md)** | **The Golden Execution Sequence**: 10 sequential, highly detailed copy-paste prompts designed for feeding into an AI coding assistant to construct the app phase-by-phase. |

---

## 💡 Inference Setup: 100% Free & Local with Ollama
This plan is tailored to run **100% locally on your machine with zero cloud API keys**:
- **LLM**: Local [Ollama](https://ollama.com/) running `llama3.2` (or `mistral` / `qwen2.5`).
- **Vector Embeddings**: Local ONNX `all-MiniLM-L6-v2` in ChromaDB (no OpenAI embeddings needed).
- **Voice**: Free Microsoft Edge Neural Voices (`edge-tts`) + Browser Web Speech API.
- **Databases**: Local PostgreSQL, Neo4j, and ChromaDB via Docker Compose.

---

## 🚀 Quick AI Execution Instructions

If you are an AI model tasked with implementing OmniLife:
1. **DO NOT** try to generate the entire codebase in a single step.
2. Open [`06_AI_BUILD_EXECUTION_PROMPTS.md`](./06_AI_BUILD_EXECUTION_PROMPTS.md).
3. Execute **Phase 1** first. Verify files and dependencies before moving to **Phase 2**.
4. Reference the corresponding schema files (`02_DATA_MODELS_AND_GRAPH_SCHEMAS.md`) and API contracts (`04_API_SPECIFICATION_AND_ENDPOINTS.md`) for exact data structures.
5. Ensure all database migrations, fallback mocks (for local development without live Neo4j/Postgres if needed), and environment variables are strictly adhered to.
