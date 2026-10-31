"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KanbanBoard as Board, Task, TaskStatus } from "@/types";

const columns: { id: TaskStatus; label: string; accent: string; dot: string }[] = [
  { id: "TODO", label: "To do", accent: "border-slate-700", dot: "bg-slate-500" },
  {
    id: "IN_PROGRESS",
    label: "In progress",
    accent: "border-amber-500/40",
    dot: "bg-amber-400",
  },
  {
    id: "BLOCKED",
    label: "Blocked",
    accent: "border-rose-500/40",
    dot: "bg-rose-400",
  },
  {
    id: "DONE",
    label: "Done",
    accent: "border-emerald-500/40",
    dot: "bg-emerald-400",
  },
];

const priorityVariant: Record<string, "danger" | "warning" | "muted"> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "muted",
};

function moveTask(
  board: Board,
  source: { droppableId: string; index: number },
  destination: { droppableId: string; index: number }
): Board {
  const from = source.droppableId as TaskStatus;
  const to = destination.droppableId as TaskStatus;
  const fromTasks = [...(board.columns[from] || [])];
  const [moved] = fromTasks.splice(source.index, 1);
  if (!moved) return board;

  if (from === to) {
    fromTasks.splice(destination.index, 0, moved);
    return {
      ...board,
      columns: { ...board.columns, [from]: fromTasks },
    };
  }

  const toTasks = [...(board.columns[to] || [])];
  toTasks.splice(destination.index, 0, { ...moved, status: to });
  return {
    ...board,
    columns: { ...board.columns, [from]: fromTasks, [to]: toTasks },
  };
}

export function KanbanBoard({
  board,
  milestoneTitles,
  onStatusChange,
  onDeleteTask,
  onCreateTask,
}: {
  board: Board;
  milestoneTitles: Record<string, string>;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDeleteTask: (task: Task) => void;
  onCreateTask: () => void;
}) {
  const [localBoard, setLocalBoard] = useState<Board>(board);

  useEffect(() => {
    setLocalBoard(board);
  }, [board]);

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    const next = moveTask(localBoard, source, destination);
    setLocalBoard(next);
    if (source.droppableId !== destination.droppableId) {
      onStatusChange(draggableId, destination.droppableId as TaskStatus);
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const tasks = localBoard.columns[column.id] || [];
          return (
            <div
              key={column.id}
              className={cn(
                "flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-neutral-800 dark:bg-slate-950/40",
                column.accent
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", column.dot)} />
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-400">
                    {column.label}
                  </p>
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] text-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                    {tasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCreateTask}
                  className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Add task"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex min-h-[140px] flex-1 flex-col gap-2 p-2 transition",
                      snapshot.isDraggingOver && "bg-slate-200/50 dark:bg-slate-800/20"
                    )}
                  >
                    {tasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              "rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-card",
                              dragSnapshot.isDragging &&
                                "border-slate-900 shadow-md dark:border-white/50 dark:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                            )}
                          >
                            <div className="flex items-start gap-1.5">
                              <span
                                {...dragProvided.dragHandleProps}
                                className="mt-0.5 cursor-grab text-slate-400 active:cursor-grabbing dark:text-slate-600"
                                aria-label="Drag task"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium leading-snug text-slate-900 dark:text-slate-200">
                                  {task.title}
                                </p>
                                {task.milestone_id && milestoneTitles[task.milestone_id] ? (
                                  <p className="mt-1 truncate text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                                    {milestoneTitles[task.milestone_id]}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={() => onDeleteTask(task)}
                                className="rounded p-1 text-slate-400 transition hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <Badge
                                variant={priorityVariant[task.priority] || "muted"}
                                className="px-1.5 py-0 text-[9px]"
                              >
                                {task.priority}
                              </Badge>
                              <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                                {task.estimated_hours}h
                              </Badge>
                              {(task.skill_tags || "")
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="info"
                                    className="px-1.5 py-0 text-[9px]"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {!tasks.length ? (
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-800/60 px-3 py-6 text-center">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Drop tasks here
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-slate-600">
          Drag cards between columns to update status. Completed tasks sync
          practiced skills into your graph.
        </p>
        <Button size="sm" variant="ghost" onClick={onCreateTask} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Task
        </Button>
      </div>
    </DragDropContext>
  );
}
