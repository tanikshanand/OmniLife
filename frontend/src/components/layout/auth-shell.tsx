import Link from "next/link";
import { BrainCircuit, Network, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-neutral-800 bg-black p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <Link href="/" className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">
            OmniLife
          </span>
        </Link>

        <div className="relative z-10 max-w-md space-y-6">
          <Badge variant="info" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            100% local inference
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-100">
            Your life, indexed into a{" "}
            <span className="gradient-text">living digital twin</span>.
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            OmniLife fuses semantic memory, a personal knowledge graph and your
            goals into one cognitive operating system. Chat with your clone, map
            your career, and turn intentions into shipped work.
          </p>
          <div className="grid gap-3 pt-2">
            {[
              { icon: Network, text: "Hybrid vector + graph retrieval (GraphRAG)" },
              { icon: ShieldCheck, text: "Hard multi-tenant isolation and data export" },
              { icon: BrainCircuit, text: "Mentor and first-person clone modes" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3"
              >
                <item.icon className="h-4 w-4 text-white" />
                <span className="text-xs text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-slate-600">
          Local Ollama · ChromaDB · Neo4j · FastAPI · Next.js
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-in">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-300 lg:hidden"
          >
            <BrainCircuit className="h-4 w-4" /> OmniLife
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
