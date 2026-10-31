# Document 05: Frontend Architecture & UI Specification

This document details the frontend implementation using **Next.js 14+ (App Router)**, **TypeScript**, **Tailwind CSS**, **Shadcn UI**, and **`react-force-graph-2d`**.

---

## 1. Design System & Aesthetic Principles

- **Theme**: Dark mode native (`bg-slate-950`, text `text-slate-100`, cards `bg-slate-900/60` with glassmorphic borders `border-slate-800`).
- **Color Semantics**:
  - **Indigo / Violet (`#6366f1` / `#8b5cf6`)**: AI Digital Twin, intelligence, conversational core.
  - **Emerald (`#10b981`)**: Mastered skills, completed tasks, high confidence.
  - **Amber (`#f59e0b`)**: Active projects, in-progress goals, pending milestones.
  - **Rose (`#f43f5e`)**: Missing skills (gaps), blockers, critical alerts.
  - **Cyan (`#06b6d4`)**: Relational knowledge graph nodes and entities.

---

## 2. Route Hierarchy & Page Architecture

```text
src/app/
├── (auth)/
│   ├── login/page.tsx           # Email/password login with demo quick-fill
│   └── register/page.tsx        # Registration and initial profile setup
│
├── dashboard/
│   ├── layout.tsx               # Collapsible Sidebar, Header, Global Audio Bar
│   ├── page.tsx                 # Command Center Overview (KPIs, active goals, recent activity)
│   ├── chat/
│   │   └── page.tsx             # Digital Twin Dual-Mode Chat (Mentor vs Clone)
│   ├── graph/
│   │   └── page.tsx             # Interactive Knowledge Graph Visualizer & Inspector
│   ├── memory/
│   │   └── page.tsx             # Memory Vault (File Dropzone, Search Chunks, Extracted Triples)
│   ├── goals/
│   │   └── page.tsx             # Hierarchical Goals & Task Kanban Board
│   ├── career/
│   │   └── page.tsx             # Career Compass (Role Match % & Skill Gap Matrix)
│   └── analytics/
│       └── page.tsx             # Productivity Analytics & Daily Reflections
```

---

## 3. Core Component Wireframes & Specifications

### 3.1 Digital Twin Dual-Mode Chat (`/dashboard/chat`)
The interface features a prominent cognitive mode toggle at the top of the chat panel.

```text
+------------------------------------------------------------------------------------+
|  [OmniLife Twin]   [ Mode: ( ) Digital Mentor   (•) Digital Clone ]   [ Voice Mode ]|
+------------------------------------------------------------------------------------+
|                                                                                    |
|  [Twin]: "Hey Taniksh! Looking at your latest projects, you recently finalized     |
|          the FastAPI hybrid retriever. Your target milestone for Distributed     |
|          Systems is due in 12 days. What should we tackle today?"                  |
|          [Source: Project Notes] [Source: Goal #2]                                 |
|                                                                                    |
|  [You]:  "Can you review my architectural design for the Neo4j GraphRAG integration?"|
|                                                                                    |
|  [Twin]: [Streaming response with code snippets and graph cross-references]...      |
|                                                                                    |
+------------------------------------------------------------------------------------+
| [ 🎤 Speak ] [ Type message or request assistance...                       ] [ Send ]|
+------------------------------------------------------------------------------------+
```

#### Key Chat Features:
- **Streaming Parser**: Real-time markdown rendering using `react-markdown` and `rehype-highlight`.
- **Source Citation Chips**: Clicking a chip pops open a modal displaying the exact indexed chunk in ChromaDB or node in Neo4j.
- **Mode Switcher**: Dynamically alters the prompt injected into the backend SSE stream.

---

### 3.2 Interactive Knowledge Graph Visualizer (`/dashboard/graph`)
Utilizes `react-force-graph-2d` for responsive, physics-based exploration of the user's personal ontology.

```tsx
// Example integration pattern for react-force-graph-2d
import dynamic from "next/dynamic";
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export function KnowledgeGraphView({ data, onNodeClick }: GraphViewProps) {
  return (
    <div className="relative w-full h-[calc(100vh-120px)] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      <ForceGraph2D
        graphData={data}
        nodeLabel={(node: any) => `${node.label}: ${node.name}`}
        nodeColor={(node: any) => node.color}
        nodeRelSize={6}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.15}
        linkColor={() => "#334155"}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
```

#### Key Graph Features:
- **Node Filter Bar**: Toggle visibility of `Skills`, `Projects`, `Goals`, `Topics`, `People`.
- **Node Inspector Sheet**: Clicking any node opens a right-hand slide-over drawer showing connected relationships, date created, and associated memories.

---

### 3.3 Memory Vault & File Dropzone (`/dashboard/memory`)
- **Drag-and-Drop Ingestor**: Accepts `.pdf`, `.md`, `.txt` files with immediate progress indicators (`Parsing` -> `Extracting Entities` -> `Indexing Embeddings`).
- **Memory Explorer**: Live full-text search against both vector chunks and extracted graph triples.
- **Manual Fact Ingestion**: Quick form to inject standalone facts (e.g., *"Won 1st place at HackMAIT 2026 for autonomous robotics"*).

---

### 3.4 Goal Tree & Task Kanban Board (`/dashboard/goals`)
- **Dual View**: Switch between **Tree / Roadmap View** (Objectives -> Milestones) and **Kanban Board** (`TODO`, `IN_PROGRESS`, `DONE`).
- **AI Breakdown Action**: A magic wand button `[ ✨ AI Auto-Decompose ]` on any goal automatically generates actionable tasks matching the user's skill level.
- **Drag-and-Drop**: Built using `@hello-pangea/dnd` for smooth task transitions across columns.

---

### 3.5 Career Compass & Skill Gap Analyzer (`/dashboard/career`)
- **Role Selector Dropdown**: Select target role (e.g., `AI Systems Engineer`, `Full-Stack ML Engineer`, `Autonomous Systems Architect`).
- **Match Gauge**: Circular SVG progress gauge showing exact percentage match.
- **Comparative Skill Matrix**:
  - Green Pills: Mastered skills backed by verified projects in Neo4j.
  - Yellow Pills: Beginner skills in progress.
  - Red Outlined Pills: Missing prerequisite skills.
- **Sprint Generator Button**: One-click generation of a 4-week tailored learning sprint to bridge top 3 gaps.

---

### 3.6 Voice Interaction Widget
- Integrated directly into the main layout header and chat input.
- Displays dynamic Web Audio API frequency bars when listening.
- Natural speech playback via browser audio streaming or Edge-TTS audio payloads.

---

## 4. Global State Architecture (Zustand)

```typescript
// src/lib/store.ts
import { create } from 'zustand';

interface TwinState {
  activeMode: 'MENTOR' | 'CLONE';
  setActiveMode: (mode: 'MENTOR' | 'CLONE') => void;
  isVoiceActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  selectedGraphNode: any | null;
  setSelectedGraphNode: (node: any | null) => void;
}

export const useTwinStore = create<TwinState>((set) => ({
  activeMode: 'MENTOR',
  setActiveMode: (mode) => set({ activeMode: mode }),
  isVoiceActive: false,
  setIsVoiceActive: (active) => set({ isVoiceActive: active }),
  selectedGraphNode: null,
  setSelectedGraphNode: (node) => set({ selectedGraphNode: node }),
}));
```
