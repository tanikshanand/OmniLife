"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn, relativeTime } from "@/lib/utils";
import type { ChatSession } from "@/types";

export function SessionList({
  sessions,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  loading: boolean;
  onSelect: (session: ChatSession) => void;
  onNew: () => void;
  onDelete: (session: ChatSession) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 dark:border-slate-800/70 p-3">
        <Button className="w-full justify-start gap-2" size="sm" onClick={onNew}>
          <MessageSquarePlus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin">
        {loading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : sessions.length ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-start gap-2 rounded-xl px-2.5 py-2.5 transition",
                activeId === session.id
                  ? "bg-slate-100 text-slate-900 font-medium border border-slate-200/80 shadow-xs dark:bg-white/10 dark:ring-1 dark:ring-white/20 dark:text-white dark:border-transparent"
                  : "hover:bg-slate-50 text-slate-600 dark:hover:bg-neutral-900 dark:text-neutral-400"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(session)}
                className="min-w-0 flex-1 text-left"
              >
                <p
                  className={cn(
                    "truncate text-xs font-medium",
                    activeId === session.id ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-neutral-300"
                  )}
                >
                  {session.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant={session.active_mode === "CLONE" ? "info" : "default"}
                    className="px-1.5 py-0 text-[9px]"
                  >
                    {session.active_mode}
                  </Badge>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {relativeTime(session.updated_at)}
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(session)}
                className="rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-rose-400 group-hover:opacity-100 focus:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        ) : (
          <p className="px-3 py-8 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            No conversations yet.
            <br />
            Start one below.
          </p>
        )}
      </div>
    </div>
  );
}
