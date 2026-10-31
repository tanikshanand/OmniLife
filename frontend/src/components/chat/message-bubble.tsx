"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Quote,
  Sparkles,
  Square,
  UserRound,
  Volume2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMessage, SourceCitation, TwinMode } from "@/types";
import { Markdown } from "./markdown";

function SourceList({ sources }: { sources: SourceCitation[] }) {
  if (!sources.length) return null;
  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-800/80 dark:bg-slate-950/50 transition-colors">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
        <Quote className="h-3 w-3" />
        Grounded in {sources.length} source{sources.length === 1 ? "" : "s"}
      </summary>
      <div className="mt-2 space-y-2">
        {sources.map((source, index) => (
          <div
            key={`${source.title}-${index}`}
            className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-slate-900 dark:text-slate-200">
                {source.title}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {typeof source.score === "number" ? (
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                    {Math.round(source.score * 100)}%
                  </span>
                ) : null}
                <Badge variant="muted" className="px-1.5 py-0 text-[9px]">
                  {source.type}
                </Badge>
              </div>
            </div>
            {source.chunk ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">
                {source.chunk}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
}

export function MessageBubble({
  message,
  mode,
  streaming,
  speaking,
  onSpeak,
  onStopSpeaking,
}: {
  message: ChatMessage;
  mode: TwinMode;
  streaming?: boolean;
  speaking?: boolean;
  onSpeak?: (text: string) => void;
  onStopSpeaking?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-slate-200 bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100">
          {message.content}
        </div>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          <UserRound className="h-4 w-4" />
        </span>
      </div>
    );
  }

  const isEmpty = !message.content && streaming;

  return (
    <div className="flex gap-2.5">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <Sparkles className="h-4 w-4" />
      </span>

      <div className="min-w-0 max-w-[88%] flex-1">
        <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm dark:border-neutral-800 dark:bg-[#0a0a0a] dark:text-neutral-100">
          {isEmpty ? (
            <div className="flex items-center gap-1.5 py-1">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-900 dark:bg-white"
                  style={{ animationDelay: `${index * 150}ms` }}
                />
              ))}
            </div>
          ) : (
            <Markdown content={message.content} />
          )}
          {streaming && message.content ? (
            <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-slate-900 align-middle dark:bg-white" />
          ) : null}
        </div>

        <SourceList sources={message.sources_cited || []} />

        {!streaming && message.content ? (
          <div className="mt-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
              aria-label="Copy message"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {onSpeak ? (
              <button
                type="button"
                onClick={() =>
                  speaking ? onStopSpeaking?.() : onSpeak(message.content)
                }
                className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
                aria-label={speaking ? "Stop speaking" : "Read aloud"}
              >
                {speaking ? (
                  <Square className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {mode === "MENTOR" ? "Mentor" : "Clone"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
