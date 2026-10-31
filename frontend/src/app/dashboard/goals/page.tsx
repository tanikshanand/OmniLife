"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

import { Alert, EmptyState, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { apiErrorMessage, goalsApi } from "@/lib/api";
import type { Goal, KanbanBoard as Board, Task, TaskStatus } from "@/types";
import { clampPercent, formatDate, titleCase } from "@/lib/utils";

const KanbanBoard = dynamic(
  () =>
    import("@/components/goals/kanban-board").then((module) => module.KanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    ),
  }
);

const GOAL_CATEGORIES = ["Career", "Skill", "Project", "Health", "Finance", "Personal"];

function statusVariant(status: string): "success" | "default" | "muted" {
  if (status === "COMPLETED") return "success";
  if (status === "ACTIVE") return "default";
  return "muted";
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decomposing, setDecomposing] = useState<string | null>(null);

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalCategory, setGoalCategory] = useState("Career");
  const [goalDate, setGoalDate] = useState("");
  const [decomposeAfter, setDecomposeAfter] = useState(true);
  const [savingGoal, setSavingGoal] = useState(false);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskMilestone, setTaskMilestone] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskHours, setTaskHours] = useState("2");
  const [taskTags, setTaskTags] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextGoals, nextBoard] = await Promise.all([
        goalsApi.list(),
        goalsApi.kanban(),
      ]);
      setGoals(nextGoals);
      setBoard(nextBoard);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allMilestones = useMemo(
    () =>
      goals.flatMap((goal) =>
        goal.milestones.map((milestone) => ({
          id: milestone.id,
          label: `${goal.title} · ${milestone.title}`,
        }))
      ),
    [goals]
  );

  const milestoneTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const goal of goals) {
      for (const milestone of goal.milestones) {
        map[milestone.id] = milestone.title;
      }
    }
    return map;
  }, [goals]);

  const stats = useMemo(() => {
    const tasks = board
      ? Object.values(board.columns).flatMap((column) => column)
      : [];
    const done = board?.columns.DONE.length ?? 0;
    const active = goals.filter((goal) => goal.status !== "COMPLETED");
    const average = active.length
      ? Math.round(
          active.reduce((sum, goal) => sum + goal.progress_percent, 0) /
            active.length
        )
      : 0;
    return { tasks: tasks.length, done, active: active.length, average };
  }, [board, goals]);

  async function createGoal(event?: React.FormEvent) {
    event?.preventDefault();
    if (!goalTitle.trim()) return;
    setSavingGoal(true);
    setError(null);
    setNotice(null);
    try {
      const goal = await goalsApi.create({
        title: goalTitle.trim(),
        description: goalDescription.trim() || undefined,
        category: goalCategory,
        target_date: goalDate || undefined,
      });
      if (decomposeAfter) {
        try {
          await goalsApi.decompose(goal.id);
          setNotice(`"${goal.title}" created and decomposed into milestones.`);
        } catch (err) {
          setError(`Goal created, but AI decomposition failed: ${apiErrorMessage(err)}`);
        }
      } else {
        setNotice(`"${goal.title}" created. Run AI decompose when ready.`);
      }
      setGoalOpen(false);
      setGoalTitle("");
      setGoalDescription("");
      setGoalDate("");
      setDecomposeAfter(true);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingGoal(false);
    }
  }

  async function decomposeGoal(goal: Goal) {
    if (
      goal.milestones.length &&
      !window.confirm(
        `"${goal.title}" already has milestones. Re-planning will replace them and their tasks. Continue?`
      )
    ) {
      return;
    }
    setDecomposing(goal.id);
    setError(null);
    setNotice(null);
    try {
      await goalsApi.decompose(goal.id);
      setNotice(`"${goal.title}" decomposed into a new milestone plan.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDecomposing(null);
    }
  }

  async function deleteGoal(goal: Goal) {
    if (!window.confirm(`Delete "${goal.title}" and all its milestones and tasks?`)) {
      return;
    }
    try {
      await goalsApi.remove(goal.id);
      setNotice(`Deleted "${goal.title}".`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function createTask(event?: React.FormEvent) {
    event?.preventDefault();
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    setError(null);
    setNotice(null);
    try {
      await goalsApi.createTask({
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        milestone_id: taskMilestone || undefined,
        priority: taskPriority,
        estimated_hours: taskHours || "2",
        skill_tags: taskTags,
      });
      setTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskMilestone("");
      setTaskPriority("MEDIUM");
      setTaskHours("2");
      setTaskTags("");
      setNotice("Task added to the Kanban board.");
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingTask(false);
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await goalsApi.deleteTask(task.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    try {
      await goalsApi.updateTaskStatus(taskId, status);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
      await load();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">{stats.active} active goals</Badge>
          <Badge variant="muted">{stats.tasks} tasks</Badge>
          <Badge variant="success">{stats.done} done</Badge>
          <Badge variant="info">{stats.average}% avg progress</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New task
          </Button>
          <Button size="sm" onClick={() => setGoalOpen(true)} className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> New goal
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
      {notice ? (
        <Alert variant="success" className="flex items-center justify-between gap-3">
          <span>{notice}</span>
          <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-300" /> Goals
          </CardTitle>
          <span className="text-[10px] uppercase tracking-wider text-slate-600">
            {goals.length} total
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : goals.length ? (
            goals.map((goal) => {
              const tasks = goal.milestones.flatMap((milestone) => milestone.tasks);
              const done = tasks.filter((task) => task.status === "DONE").length;
              return (
                <div
                  key={goal.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800/70 dark:bg-slate-950/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{goal.title}</p>
                        <Badge variant={statusVariant(goal.status)}>
                          {titleCase(goal.status)}
                        </Badge>
                        <Badge variant="muted">{goal.category}</Badge>
                      </div>
                      {goal.description ? (
                        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                          {goal.description}
                        </p>
                      ) : null}
                      <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {goal.target_date ? formatDate(goal.target_date) : "No deadline"}
                        </span>
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3 w-3" />
                          {goal.milestones.length} milestones · {done}/{tasks.length} tasks
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={decomposing === goal.id}
                        onClick={() => void decomposeGoal(goal)}
                      >
                        {decomposing === goal.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {goal.milestones.length ? "Re-plan" : "AI decompose"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                        onClick={() => void deleteGoal(goal)}
                        aria-label={`Delete ${goal.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <Progress
                      value={goal.progress_percent}
                      className="flex-1"
                      indicatorClassName="from-amber-500 to-emerald-400"
                    />
                    <span className="w-10 text-right text-[11px] font-semibold text-slate-800 dark:text-slate-300">
                      {clampPercent(goal.progress_percent)}%
                    </span>
                  </div>

                  {goal.milestones.length ? (
                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none text-[10px] uppercase tracking-wider text-slate-500 transition hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300">
                        View milestones and tasks
                      </summary>
                      <div className="mt-2 space-y-2">
                        {[...goal.milestones]
                          .sort((a, b) => a.sequence_order - b.sequence_order)
                          .map((milestone) => (
                            <div
                              key={milestone.id}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800/60 dark:bg-slate-900/40"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                  {milestone.sequence_order + 1}
                                </span>
                                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-800 dark:text-slate-300">
                                  {milestone.title}
                                </p>
                                {milestone.is_completed ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : null}
                              </div>
                              <div className="mt-1.5 space-y-1 pl-7">
                                {milestone.tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400"
                                  >
                                    <span
                                      className={
                                        task.status === "DONE"
                                          ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
                                          : task.status === "IN_PROGRESS"
                                            ? "h-1.5 w-1.5 rounded-full bg-amber-500"
                                            : task.status === "BLOCKED"
                                              ? "h-1.5 w-1.5 rounded-full bg-rose-500"
                                              : "h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-600"
                                      }
                                    />
                                    <span className="truncate">{task.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="No goals yet"
              description="Create a goal and let the twin turn it into milestones, tasks and required skills."
              action={
                <Button size="sm" variant="outline" onClick={() => setGoalOpen(true)}>
                  Create your first goal
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-cyan-300" /> Execution board
          </CardTitle>
          <span className="text-[10px] uppercase tracking-wider text-slate-600">
            Drag to update
          </span>
        </CardHeader>
        <CardContent>
          {loading || !board ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-48 w-full" />
              ))}
            </div>
          ) : (
            <KanbanBoard
              board={board}
              milestoneTitles={milestoneTitles}
              onStatusChange={(taskId, status) =>
                void handleStatusChange(taskId, status)
              }
              onDeleteTask={(task) => void deleteTask(task)}
              onCreateTask={() => setTaskOpen(true)}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        title="Create a goal"
        description="The twin can immediately decompose it into milestones and tasks."
        footer={
          <>
            <Button variant="ghost" onClick={() => setGoalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createGoal()}
              disabled={savingGoal || !goalTitle.trim()}
              className="gap-1.5"
            >
              {savingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Create goal
            </Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={createGoal}>
          <div>
            <Label htmlFor="goal-title">Goal title</Label>
            <Input
              id="goal-title"
              value={goalTitle}
              onChange={(event) => setGoalTitle(event.target.value)}
              placeholder="e.g. Become an AI Systems Engineer"
            />
          </div>
          <div>
            <Label htmlFor="goal-description">Description (optional)</Label>
            <Textarea
              id="goal-description"
              value={goalDescription}
              onChange={(event) => setGoalDescription(event.target.value)}
              placeholder="Why does this matter, and what does success look like?"
              className="min-h-[80px] text-xs"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="goal-category">Category</Label>
              <Select
                id="goal-category"
                value={goalCategory}
                onChange={(event) => setGoalCategory(event.target.value)}
              >
                {GOAL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="goal-date">Target date</Label>
              <Input
                id="goal-date"
                type="date"
                value={goalDate}
                onChange={(event) => setGoalDate(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
            <input
              type="checkbox"
              checked={decomposeAfter}
              onChange={(event) => setDecomposeAfter(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 bg-white accent-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:accent-white"
            />
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              Decompose with AI immediately
            </span>
          </label>
        </form>
      </Dialog>

      <Dialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        title="Add a task"
        description="Tasks can be linked to a milestone or live standalone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createTask()}
              disabled={savingTask || !taskTitle.trim()}
              className="gap-1.5"
            >
              {savingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Add task
            </Button>
          </>
        }
      >
        <form className="space-y-3" onSubmit={createTask}>
          <div>
            <Label htmlFor="task-title">Task title</Label>
            <Input
              id="task-title"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="e.g. Build the retrieval evaluation harness"
            />
          </div>
          <div>
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea
              id="task-description"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              className="min-h-[70px] text-xs"
            />
          </div>
          <div>
            <Label htmlFor="task-milestone">Milestone</Label>
            <Select
              id="task-milestone"
              value={taskMilestone}
              onChange={(event) => setTaskMilestone(event.target.value)}
            >
              <option value="">Standalone task</option>
              {allMilestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                id="task-priority"
                value={taskPriority}
                onChange={(event) => setTaskPriority(event.target.value)}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-hours">Estimated hours</Label>
              <Input
                id="task-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={taskHours}
                onChange={(event) => setTaskHours(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="task-tags">Skill tags (comma separated)</Label>
            <Input
              id="task-tags"
              value={taskTags}
              onChange={(event) => setTaskTags(event.target.value)}
              placeholder="Python, FastAPI, RAG"
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
