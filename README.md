# OmniLife Digital Twin

> **An AI-Powered Personalized Digital Twin for Intelligent Life and Career Assistance**  
> Developed for Maharaja Agrasen Institute of Technology (CSE-AIML).

OmniLife builds a persistent cognitive clone of an individual by unifying structured personal profiles, long-term episodic vector memory, and an interactive personal knowledge graph. It runs **100% locally with zero cloud API keys required** using **Ollama** and local vector embeddings.

---

## 🌟 Key Features

1. **Dual-Mode Conversational Twin**:
   - **Mode 1: The Digital Mentor** — Second-person strategic advisor analyzing past projects, active goals, and skill gaps to provide high-leverage guidance.
   - **Mode 2: The Digital Clone** — First-person singular ("I") persona mirroring the user's tone, vocabulary, and technical background.
2. **Interactive 2D Knowledge Graph Visualizer**:
   - Physics-based force-directed canvas (`react-force-graph-2d`) visualizing connections between `:User`, `:Skill`, `:Project`, `:Goal`, and `:Topic`.
3. **Memory Vault & Hybrid GraphRAG**:
   - Upload PDF resumes, markdown journals, or quick notes.
   - Ingests semantic chunks into local vector memory and automatically extracts relational graph triples.
4. **Goal Tree & Kanban Execution Board**:
   - Break down high-level objectives into milestones and daily tasks with **AI Auto-Decompose**.
   - Drag-and-drop Kanban workflow.
5. **Career Compass & Skill Gap Analyzer**:
   - Benchmarks the user's knowledge graph against target industry roles (e.g., *AI Systems Engineer*, *Full-Stack ML Engineer*).
   - Computes readiness match percentage and generates tailored 4-week learning sprints.
6. **Voice Interaction Mode**:
   - Browser Web Speech STT + Edge-TTS neural voice synthesis.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI, Zustand, `react-force-graph-2d`.
- **Backend**: Python 3.10+ FastAPI, SQLAlchemy 2.0 Async, Pydantic v2.
- **Local AI Engine**: [Ollama](https://ollama.com/) running `llama3.2:latest` (zero API keys).
- **Vector Database**: ChromaDB (with local fallback vector store and cosine distance).
- **Knowledge Graph**: Neo4j Community (with JSON-backed resilient graph engine fallback).
- **Relational Storage**: SQLite Async / PostgreSQL.

---

## 🚀 One-Click Quick Start (Windows)

### 1. Ensure Ollama is running
Open a terminal and start Ollama:
```bash
ollama run llama3.2
```

### 2. Launch OmniLife
Simply double-click **`start.bat`** (or run `.\start.ps1` in PowerShell).

It will start:
- **Backend API**: `http://localhost:8000` (Docs: `http://localhost:8000/docs`)
- **Frontend App**: `http://localhost:3000`

### 3. Demo Account
Click **"Explore the demo account"** on the login page, or sign in manually with:
- **Email**: `demo@omnilife.ai`
- **Password**: `demo1234`

---

## 🧪 Running Automated Tests

Run the backend test suite:
```bash
cd backend
.\.venv\Scripts\pytest
```
*Result: 10 passed across authentication, career analysis, chat streaming, goals, and knowledge graph.*
