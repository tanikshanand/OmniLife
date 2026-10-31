"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  Compass,
  Loader2,
  Map,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";

import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { apiErrorMessage, careerApi } from "@/lib/api";
import { useTwinStore } from "@/lib/store";
import type {
  BenchmarkRole,
  GapAnalysis,
  RoadmapResponse,
  SkillGapItem,
} from "@/types";
import { cn, clampPercent } from "@/lib/utils";

function ReadinessGauge({ percent, isDark = true }: { percent: number; isDark?: boolean }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const value = clampPercent(percent);
  const offset = circumference * (1 - value / 100);
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
        <defs>
          <linearGradient id="readiness-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={isDark ? "#1e293b" : "#e2e8f0"}
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="url(#readiness-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {value}%
        </span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400">
          readiness
        </span>
      </div>
    </div>
  );
}

function SkillList({
  items,
  tone,
  icon,
  empty,
}: {
  items: SkillGapItem[];
  tone: "success" | "warning" | "danger";
  icon: React.ReactNode;
  empty: string;
}) {
  const border = {
    success: "border-emerald-500/25 bg-emerald-500/5",
    warning: "border-amber-500/25 bg-amber-500/5",
    danger: "border-rose-500/25 bg-rose-500/5",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3", border)}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {tone === "success"
            ? "Mastered"
            : tone === "warning"
              ? "In progress"
              : "Gaps"}
        </p>
        <span className="ml-auto text-[10px] font-medium text-slate-600 dark:text-slate-400">{items.length}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 shadow-xs dark:border-slate-800/80 dark:bg-slate-950/50"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-900 dark:text-slate-200">{item.name}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">{item.category}</p>
              </div>
              <Badge variant={tone} className="shrink-0 px-1.5 py-0 text-[9px]">
                {item.proficiency}
              </Badge>
            </div>
          ))
        ) : (
          <p className="py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

export default function CareerPage() {
  const theme = useTwinStore((state) => state.theme);
  const isDark = theme === "dark";

  const [roles, setRoles] = useState<BenchmarkRole[]>([]);
  const [roleId, setRoleId] = useState("");
  const [gap, setGap] = useState<GapAnalysis | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [weeks, setWeeks] = useState(4);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingGap, setLoadingGap] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRoles(true);
      try {
        const data = await careerApi.roles();
        if (cancelled) return;
        setRoles(data);
        if (data.length) setRoleId(data[0].id);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGap = useCallback(async (id: string) => {
    setLoadingGap(true);
    setError(null);
    try {
      const data = await careerApi.gap(id);
      setGap(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingGap(false);
    }
  }, []);

  useEffect(() => {
    if (!roleId) return;
    setRoadmap(null);
    void loadGap(roleId);
  }, [roleId, loadGap]);

  async function generateRoadmap() {
    if (!roleId) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await careerApi.roadmap(roleId, weeks);
      setRoadmap(data);
      if (data.gap) setGap(data.gap);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Compass className="h-4 w-4 text-slate-700 dark:text-white" /> Benchmark yourself
          </h2>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-500">
            Readiness is computed from your graph&apos;s skill proficiency against a
            role&apos;s required skill set.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            className="h-9 w-56 text-xs"
            disabled={loadingRoles}
            aria-label="Benchmark role"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.title}
              </option>
            ))}
          </Select>
          <Select
            value={weeks}
            onChange={(event) => setWeeks(Number(event.target.value))}
            className="h-9 w-28 text-xs"
            aria-label="Sprint length"
          >
            <option value={2}>2 weeks</option>
            <option value={4}>4 weeks</option>
            <option value={6}>6 weeks</option>
            <option value={8}>8 weeks</option>
          </Select>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!roleId || generating}
            onClick={() => void generateRoadmap()}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate roadmap
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="danger" className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}

      {loadingRoles || loadingGap ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full lg:col-span-2" />
        </div>
      ) : gap ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center p-6">
              <ReadinessGauge percent={gap.match_percent} isDark={isDark} />
              <p className="mt-2 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                {gap.role_title}
              </p>
              <p className="mt-1 text-center text-[10px] text-slate-600 dark:text-slate-400">
                {gap.mastered_skills.length} mastered · {gap.in_progress_skills.length}{" "}
                in progress · {gap.missing_skills.length} missing
              </p>
              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-800/70 dark:bg-slate-950/50">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {gap.total_required}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider font-medium text-slate-600 dark:text-slate-400">
                    Required skills
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-800/70 dark:bg-slate-950/50">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {gap.mastered_skills.length}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider font-medium text-slate-600 dark:text-slate-400">
                    Mastered
                  </p>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-cyan-500 dark:text-cyan-300" /> Skill gap breakdown
                </CardTitle>
                <Link
                  href="/dashboard/graph"
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
                >
                  Open graph <ArrowUpRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <SkillList
                  items={gap.mastered_skills}
                  tone="success"
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  empty="No mastered skills yet."
                />
                <SkillList
                  items={gap.in_progress_skills}
                  tone="warning"
                  icon={<CircleDashed className="h-3.5 w-3.5 text-amber-400" />}
                  empty="Nothing in progress."
                />
                <SkillList
                  items={gap.missing_skills}
                  tone="danger"
                  icon={<TriangleAlert className="h-3.5 w-3.5 text-rose-400" />}
                  empty="No gaps for this role."
                />
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Map className="h-4 w-4 text-slate-700 dark:text-white" /> Learning sprint
              </CardTitle>
              {roadmap ? (
                <Badge variant="info">{roadmap.weeks} weeks</Badge>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-slate-600">
                  Not generated
                </span>
              )}
            </CardHeader>
            <CardContent>
              {roadmap ? (
                <div className="space-y-4">
                  <Alert variant="info">{roadmap.roadmap.summary}</Alert>
                  <div className="space-y-3">
                    {roadmap.roadmap.weeks.map((week) => (
                      <div
                        key={week.week}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default">Week {week.week}</Badge>
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {week.theme}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {week.focus_skills.map((skill) => (
                            <Badge key={skill} variant="info" className="px-2 py-0 text-[9px]">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400">
                              Deliverables
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {week.deliverables.map((item) => (
                                <li
                                  key={item}
                                  className="flex gap-1.5 text-[10px] leading-relaxed text-slate-700 dark:text-slate-300"
                                >
                                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-400">
                              Resources
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {week.resources.map((item) => (
                                <li
                                  key={item}
                                  className="flex gap-1.5 text-[10px] leading-relaxed text-slate-700 dark:text-slate-300"
                                >
                                  <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Map className="h-6 w-6" />}
                  title="No sprint generated yet"
                  description="Pick a sprint length and generate a project-based roadmap that closes your highest-leverage gaps."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => void generateRoadmap()}
                      disabled={generating}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Generate roadmap
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={<Compass className="h-7 w-7" />}
          title="No benchmark role selected"
          description="Choose a role to compare your skill graph against its requirements."
        />
      )}
    </div>
  );
}
