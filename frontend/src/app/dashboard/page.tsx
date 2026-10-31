"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Compass,
  Flame,
  MessageSquare,
  Network,
  Plus,
  RefreshCw,
  Target,
  Vault,
} from "lucide-react";

import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  analyticsApi,
  apiErrorMessage,
  chatApi,
  goalsApi,
  graphApi,
  memoryApi,
} from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import type {
  ChatSession,
  Goal,
  GraphData,
  KanbanBoard,
  MemoryStats,
  Metrics,
} from "@/types";
import { clampPercent, formatDate, relativeTime, titleCase } from "@/lib/utils";

interface OverviewData {
  goals: Goal[];
  board: KanbanBoard;
  memory: MemoryStats;
  graph: GraphData;
  metrics: Metrics;
  sessions: ChatSession[];
}

export default function DashboardOverviewPage() {
  const user = useTwinStore((state) => state.user);
  const activeMode = useTwinStore((state) => state.activeMode);
  const setActiveMode = useTwinStore((state) => state.setActiveMode);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goals, board, memory, graph, metrics, sessions] = await Promise.all([
        goalsApi.list(),
        goalsApi.kanban(),
        memoryApi.stats(),
        graphApi.subgraph({ depth: 2, limit: 150 }),
        analyticsApi.metrics(30),
        chatApi.sessions(),
      ]);
      setData({ goals, board, memory, graph, metrics, sessions });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = useMemo(() => {
    const name = user?.profile?.full_name || user?.email?.split("@")[0] || "there";
    return name.split(" ")[0];
  }, [user]);

  const activeGoals = useMemo(
    () => (data ? data.goals.filter((goal) => goal.status !== "COMPLETED") : []),
    [data]
  );

  const openTasks = useMemo(() => {
    if (!data) return [];
    const columns = data.board.columns;
    return [...columns.TODO, ...columns.IN_PROGRESS, ...columns.BLOCKED].slice(0, 6);
  }, [data]);

  const doneCount = data
    ? data.board.columns.DONE.length
    : 0;
  const totalTasks = data
    ? Object.values(data.board.columns).reduce(
        (sum, tasks) => sum + tasks.length,
        0
      )
    : 0;

  return (
    <div className="space-y-6">
      <section className="glass-card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant={activeMode === "MENTOR" ? "default" : "info"} className="gap-1.5">
              <BrainCircuit className="h-3 w-3" />
              {activeMode === "MENTOR" ? "Mentor mode" : "Clone mode"}
            </Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-slate-100 sm:text-3xl">
              Welcome back, {firstName}.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-slate-400">
              Your twin has indexed{" "}
              <span className="font-medium text-neutral-900 dark:text-slate-200">
                {data?.memory.chunks ?? 0} memory chunks
              </span>{" "}
              across{" "}
              <span className="font-medium text-neutral-900 dark:text-slate-200">
                {data?.graph.nodes.length ?? 0} graph nodes
              </span>
              . {activeGoals.length > 0
                ? `${activeGoals.length} goal${activeGoals.length === 1 ? "" : "s"} need momentum this week.`
                : "Add a goal to give your twin a direction."}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href="/dashboard/chat">
                <Button className="gap-2">
                  <MessageSquare className="h-4 w-4" /> Talk to your twin
                </Button>
              </Link>
              <Link href="/dashboard/memory">
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Add memory
                </Button>
              </Link>
              <div className="ml-1 flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-neutral-800 dark:bg-black/80">
                {(["MENTOR", "CLONE"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setActiveMode(mode)}
                    className={
                      activeMode === mode
                        ? "rounded-lg bg-white text-slate-900 font-semibold shadow-sm border border-slate-200/60 px-3 py-1.5 text-[11px] dark:bg-white dark:text-black dark:border-transparent"
                        : "rounded-lg px-3 py-1.5 text-[11px] text-slate-600 hover:text-slate-900 transition dark:text-neutral-400 dark:hover:text-white"
                    }
                  >
                    {mode === "MENTOR" ? "Mentor" : "Clone"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            {[
              {
                icon: Vault,
                label: "Documents",
                value: data?.memory.documents ?? 0,
              },
              { icon: Network, label: "Graph links", value: data?.graph.links.length ?? 0 },
              { icon: Target, label: "Active goals", value: activeGoals.length },
              { icon: Flame, label: "Day streak", value: data?.metrics.streak_days ?? 0 },
            ].map((item) => (
              <div key={item.label} className="glass-panel px-4 py-3 border border-slate-200/70 bg-slate-50/70 dark:border-neutral-800/80 dark:bg-[#0f0f12]">
                <item.icon className="h-4 w-4 text-slate-700 dark:text-white" />
                <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <Alert variant="danger" className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Task completion",
            value: `${data?.metrics.completion_rate ?? 0}%`,
            detail: `${doneCount} of ${totalTasks} tasks done`,
          },
          {
            label: "Average goal progress",
            value: `${data?.metrics.average_goal_progress ?? 0}%`,
            detail: `${activeGoals.length} active goals`,
          },
          {
            label: "Skills indexed",
            value: data?.metrics.skills_indexed ?? 0,
            detail: "In your knowledge graph",
          },
          {
            label: "Energy average",
            value: data?.metrics.energy_average
              ? `${data.metrics.energy_average}/5`
              : "—",
            detail: `${data?.metrics.daily_logs.length ?? 0} recent logs`,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {stat.label}
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{stat.value}</p>
            )}
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{stat.detail}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Active goals
            </CardTitle>
            <Link
              href="/dashboard/goals"
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : activeGoals.length ? (
              activeGoals.slice(0, 4).map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {goal.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {goal.category} · {goal.milestones.length} milestones ·{" "}
                        {goal.target_date ? formatDate(goal.target_date) : "no deadline"}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {clampPercent(goal.progress_percent)}%
                    </span>
                  </div>
                  <Progress
                    value={goal.progress_percent}
                    className="mt-3"
                    indicatorClassName="from-amber-500 to-emerald-400"
                  />
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title="No active goals yet"
                description="Create a goal and let the twin decompose it into milestones and tasks."
                action={
                  <Link href="/dashboard/goals">
                    <Button size="sm" variant="outline">
                      Create a goal
                    </Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Next actions
            </CardTitle>
            <Link
              href="/dashboard/goals"
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              Kanban
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : openTasks.length ? (
              openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                >
                  <span
                    className={
                      task.status === "IN_PROGRESS"
                        ? "h-2 w-2 rounded-full bg-amber-500"
                        : task.status === "BLOCKED"
                          ? "h-2 w-2 rounded-full bg-rose-500"
                          : "h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {task.title}
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">
                      {titleCase(task.status)} · {task.priority} priority
                    </p>
                  </div>
                  <Badge variant="muted">{task.estimated_hours}h</Badge>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Inbox zero"
                description="No open tasks. Decompose a goal to generate the next steps."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /> Recent conversations
            </CardTitle>
            <Link
              href="/dashboard/chat"
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              Open chat
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : data && data.sessions.length ? (
              data.sessions.slice(0, 4).map((session) => (
                <Link
                  key={session.id}
                  href={`/dashboard/chat?session=${session.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-800 dark:bg-[#0a0a0a] dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-200">
                      {session.title}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {relativeTime(session.updated_at)}
                    </p>
                  </div>
                  <Badge variant={session.active_mode === "CLONE" ? "info" : "default"}>
                    {session.active_mode}
                  </Badge>
                </Link>
              ))
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="No conversations yet"
                description="Ask your twin about your goals, skills or recent notes."
                action={
                  <Link href="/dashboard/chat">
                    <Button size="sm" variant="outline">
                      Start chatting
                    </Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                href: "/dashboard/career",
                icon: Compass,
                label: "Run a skill gap analysis",
                hint: "Career compass",
              },
              {
                href: "/dashboard/memory",
                icon: Vault,
                label: "Upload a document",
                hint: "Memory vault",
              },
              {
                href: "/dashboard/analytics",
                icon: Flame,
                label: "Log today's energy",
                hint: "Analytics",
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-800 dark:bg-[#0a0a0a] dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
              >
                <action.icon className="h-4 w-4 text-slate-700 dark:text-white" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-200">{action.label}</p>
                  <p className="text-[10px] text-slate-500">{action.hint}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
