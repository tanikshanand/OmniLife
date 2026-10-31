import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Compass,
  KanbanSquare,
  Mic,
  Network,
  ShieldCheck,
  Sparkles,
  Vault,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BrainCircuit,
    title: "Dual-mode twin",
    description:
      "Switch between a strategic Digital Mentor and a first-person Digital Clone that speaks in your voice.",
  },
  {
    icon: Network,
    title: "Hybrid GraphRAG",
    description:
      "Every answer fuses ChromaDB semantic memory with Neo4j multi-hop graph traversal.",
  },
  {
    icon: Vault,
    title: "Memory vault",
    description:
      "Drop resumes, notes and journals. OmniLife chunks, embeds and extracts typed entities automatically.",
  },
  {
    icon: Compass,
    title: "Career compass",
    description:
      "Quantify role readiness against benchmark skill graphs and generate a tailored learning sprint.",
  },
  {
    icon: KanbanSquare,
    title: "Goals and Kanban",
    description:
      "AI decomposes ambitions into milestones and tasks, then syncs completed work back into your skill graph.",
  },
  {
    icon: Mic,
    title: "Voice suite",
    description:
      "Hands-free conversation with browser speech recognition and free neural text-to-speech.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -right-40 top-40 h-[28rem] w-[28rem] rounded-full bg-white/5 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs dark:border-white/20 dark:bg-white/10 dark:text-white">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">OmniLife</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="gap-1.5">
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-14 text-center sm:pt-24">
        <Badge variant="info" className="mx-auto gap-1.5">
          <Sparkles className="h-3 w-3" />
          Local-first AI · no cloud keys required
        </Badge>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl">
          Build a living <span className="gradient-text">digital twin</span> of
          your mind, memory and career.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
          OmniLife turns your documents, projects and goals into a persistent
          knowledge graph plus semantic memory. Then it reasons over both - as
          your mentor, or as you.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register">
            <Button size="lg" className="w-full gap-2 sm:w-auto">
              Create your twin <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Explore the demo
            </Button>
          </Link>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Demo account: demo@omnilife.ai / demo1234
        </p>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Memory layers", value: "3" },
            { label: "Benchmark roles", value: "10+" },
            { label: "Twin modes", value: "2" },
            { label: "Cloud API keys", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="glass-panel px-4 py-5 border border-slate-200/80 bg-slate-50/80 dark:border-neutral-800/80 dark:bg-[#0f0f12]">
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{stat.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            One cognitive operating system
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nine modules working together, from ingestion to career simulation.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-card group p-6 transition hover:border-slate-300 dark:hover:border-neutral-600"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800 ring-1 ring-slate-200 transition group-hover:bg-slate-900 group-hover:text-white dark:bg-neutral-900 dark:text-white dark:ring-neutral-700 dark:group-hover:bg-white dark:group-hover:text-black">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {feature.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="glass-card flex flex-col items-center gap-5 overflow-hidden p-10 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Your data stays yours
          </h2>
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Run the entire stack on your machine with Docker Compose and Ollama.
            Strict user-scoped filters guard every vector and graph query, and a
            full JSON export is one click away.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Start building <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-200 py-8 dark:border-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-[11px] text-slate-500 sm:flex-row">
          <span>OmniLife Digital Twin · local-first cognitive OS</span>
          <span>FastAPI · Neo4j · ChromaDB · Ollama · Next.js</span>
        </div>
      </footer>
    </main>
  );
}
