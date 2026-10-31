"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BatteryCharging,
  CheckCircle2,
  Flame,
  Loader2,
  NotebookPen,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  analyticsApi,
  apiErrorMessage,
} from "@/lib/api";
import type { DailyLog, Metrics, WeeklyDebrief } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const energyLabels = ["Drained", "Low", "Steady", "Good", "Charged"];

function energyTone(level: number): string {
  if (level >= 4) return "bg-emerald-400";
  if (level === 3) return "bg-amber-400";
  return "bg-rose-400";
}

function EnergyDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <span
          key={value}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            value <= level ? energyTone(level) : "bg-slate-800"
          )}
        />
      ))}
    </span>
  );
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [debrief, setDebrief] = useState<WeeklyDebrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [logDate, setLogDate] = useState("");
  const [energy, setEnergy] = useState(3);
  const [accomplishments, setAccomplishments] = useState("");
  const [blockers, setBlockers] = useState("");
  const [priorities, setPriorities] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMetrics, nextLogs] = await Promise.all([
        analyticsApi.metrics(30),
        analyticsApi.logs(30),
      ]);
      setMetrics(nextMetrics);
      setLogs(nextLogs);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLog(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await analyticsApi.dailyLog({
        log_date: logDate || undefined,
        energy_level: energy,
        accomplishments: accomplishments.trim() || undefined,
        blockers: blockers.trim() || undefined,
        tomorrow_priorities: priorities.trim() || undefined,
      });
      setNotice("Daily log saved. Your twin can now spot patterns in your energy.");
      setAccomplishments("");
      setBlockers("");
      setPriorities("");
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function generateDebrief() {
    setDebriefLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.debrief();
      setDebrief(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDebriefLoading(false);
    }
  }

  const velocity = useMemo(() => {
    if (!metrics) return [];
    return metrics.velocity.slice(-21);
  }, [metrics]);

  const maxVelocity = Math.max(1, ...velocity.map((point) => point.completed));
  const maxFocus = Math.max(
    1,
    ...(metrics?.focus_distribution.map((item) => item.count) || [0])
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="info" className="gap-1.5">
            <Activity className="h-3 w-3" /> Last 30 days
          </Badge>
          <Badge variant="muted">{logs.length} daily logs</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="danger" className="flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" className="flex items-center justify-between gap-3">
          <span>{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Completion rate",
            value: `${metrics?.completion_rate ?? 0}%`,
            detail: `${metrics?.tasks_completed ?? 0}/${metrics?.tasks_total ?? 0} tasks`,
            icon: CheckCircle2,
          },
          {
            label: "Completed this period",
            value: metrics?.tasks_completed_recent ?? 0,
            detail: `${metrics?.period_days ?? 30}-day window`,
            icon: TrendingUp,
          },
          {
            label: "Day streak",
            value: metrics?.streak_days ?? 0,
            detail: "Consecutive reflection days",
            icon: Flame,
          },
          {
            label: "Average energy",
            value: metrics?.energy_average ? `${metrics.energy_average}/5` : "—",
            detail: `${metrics?.daily_logs.length ?? 0} recent entries`,
            icon: BatteryCharging,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
              <stat.icon className="h-4 w-4 text-slate-700 dark:text-white" />
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {stat.value}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">{stat.detail}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /> Completion velocity
            </CardTitle>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Last 21 days</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : velocity.length ? (
              <div>
                <div className="flex h-36 items-end gap-[3px] border-b border-slate-200 dark:border-slate-800/70 pb-1">
                  {velocity.map((point) => (
                    <div
                      key={point.date}
                      className="group relative flex h-full flex-1 items-end"
                      title={`${point.date}: ${point.completed} completed`}
                    >
                      {point.completed ? (
                        <div
                          className="w-full rounded-t-sm bg-slate-900 transition hover:bg-slate-700 dark:bg-white/80 dark:hover:bg-white"
                          style={{
                            height: `${Math.max(
                              (point.completed / maxVelocity) * 100,
                              6
                            )}%`,
                          }}
                        />
                      ) : (
                        <span className="mx-auto mb-0.5 h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 transition group-hover:bg-cyan-500" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[9px] font-medium text-slate-600 dark:text-slate-400">
                  <span>{velocity[0]?.date}</span>
                  <span>{velocity[velocity.length - 1]?.date}</span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" />}
                title="No velocity data yet"
                description="Complete tasks to populate your velocity chart."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-300" /> Focus distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {loading ? (
              <>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </>
            ) : metrics?.focus_distribution.length ? (
              metrics.focus_distribution.slice(0, 7).map((item) => (
                <div key={item.skill}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-300">{item.skill}</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{item.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-900 dark:bg-white"
                      style={{ width: `${(item.count / maxFocus) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-[11px] text-slate-600 dark:text-slate-400">
                Add skill tags to tasks to see where your attention goes.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-slate-700 dark:text-white" /> Daily reflection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={saveLog}>
              <div>
                <Label htmlFor="log-date">Date</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={logDate}
                  onChange={(event) => setLogDate(event.target.value)}
                />
              </div>

              <div>
                <Label>Energy level</Label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEnergy(value)}
                      className={cn(
                        "flex-1 rounded-lg border px-1 py-2 text-[10px] transition",
                        energy === value
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white/40 dark:bg-white/10 dark:text-white"
                          : "border-neutral-300 text-neutral-600 hover:text-neutral-900 dark:border-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-600">
                  {energyLabels[energy - 1]}
                </p>
              </div>

              <div>
                <Label htmlFor="accomplishments">Accomplishments</Label>
                <Textarea
                  id="accomplishments"
                  value={accomplishments}
                  onChange={(event) => setAccomplishments(event.target.value)}
                  placeholder="What moved forward today?"
                  className="min-h-[64px] text-xs"
                />
              </div>
              <div>
                <Label htmlFor="blockers">Blockers</Label>
                <Textarea
                  id="blockers"
                  value={blockers}
                  onChange={(event) => setBlockers(event.target.value)}
                  placeholder="What slowed you down?"
                  className="min-h-[56px] text-xs"
                />
              </div>
              <div>
                <Label htmlFor="priorities">Tomorrow&apos;s priorities</Label>
                <Textarea
                  id="priorities"
                  value={priorities}
                  onChange={(event) => setPriorities(event.target.value)}
                  placeholder="The one thing that matters most tomorrow"
                  className="min-h-[56px] text-xs"
                />
              </div>
              <Button type="submit" className="w-full gap-1.5" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <NotebookPen className="h-3.5 w-3.5" />
                )}
                Save reflection
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-300" /> Recent reflections
            </CardTitle>
            <span className="text-[10px] text-slate-600">{logs.length} entries</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : logs.length ? (
              logs.slice(0, 8).map((log) => (
                <details
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-200">
                      {formatDate(log.log_date)}
                    </span>
                    <EnergyDots level={log.energy_level} />
                    <span className="ml-auto text-[10px] font-medium text-slate-600 dark:text-slate-400">
                      {energyLabels[log.energy_level - 1]}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed">
                    {log.accomplishments ? (
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">Done: </span>
                        {log.accomplishments}
                      </p>
                    ) : null}
                    {log.blockers ? (
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">Blocked: </span>
                        {log.blockers}
                      </p>
                    ) : null}
                    {log.tomorrow_priorities ? (
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">Next: </span>
                        {log.tomorrow_priorities}
                      </p>
                    ) : null}
                  </div>
                </details>
              ))
            ) : (
              <EmptyState
                icon={<NotebookPen className="h-6 w-6" />}
                title="No reflections yet"
                description="Log your energy and progress to unlock weekly debriefs."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-700 dark:text-white" /> Weekly debrief
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void generateDebrief()}
            disabled={debriefLoading}
          >
            {debriefLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        </CardHeader>
        <CardContent>
          {debrief ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  {debrief.week_start} → {debrief.week_end}
                </Badge>
                <Badge variant="muted">{debrief.tasks_completed} tasks completed</Badge>
                <Badge variant={debrief.generated_by === "ollama" ? "default" : "muted"}>
                  {debrief.generated_by}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{debrief.summary}</p>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Highlights",
                    items: debrief.highlights,
                    icon: CheckCircle2,
                    color: "text-emerald-400",
                  },
                  {
                    title: "Blockers",
                    items: debrief.blockers,
                    icon: TriangleAlert,
                    color: "text-rose-400",
                  },
                  {
                    title: "Recommendations",
                    items: debrief.recommendations,
                    icon: TrendingUp,
                    color: "text-cyan-400",
                  },
                ].map((section) => (
                  <div
                    key={section.title}
                    className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3"
                  >
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      <section.icon className={cn("h-3.5 w-3.5", section.color)} />
                      {section.title}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {section.items.length ? (
                        section.items.map((item) => (
                          <li
                            key={item}
                            className="text-[10px] leading-relaxed text-slate-400"
                          >
                            {item}
                          </li>
                        ))
                      ) : (
                        <li className="text-[10px] text-slate-600">Nothing recorded.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="Your week, synthesized"
              description="Generate an honest retrospective from your tasks, goals and daily reflections."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void generateDebrief()}
                  disabled={debriefLoading}
                >
                  {debriefLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Generate debrief
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
