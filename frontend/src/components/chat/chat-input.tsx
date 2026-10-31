"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  listening,
  sttSupported,
  onToggleMic,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  listening: boolean;
  sttSupported: boolean;
  onToggleMic: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [value]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!streaming) onSend();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3 dark:border-neutral-800/80 dark:bg-black/90">
      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/5 dark:border-neutral-800 dark:bg-[#0c0c0e] dark:focus-within:border-neutral-500 dark:focus-within:ring-white/20">
        <Textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your twin anything, or give it a new goal..."
          className="max-h-[180px] min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />

        {sttSupported ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMic}
            disabled={disabled || streaming}
            className={cn(
              "h-9 w-9 shrink-0",
              listening && "bg-rose-500/15 text-rose-300"
            )}
            aria-label={listening ? "Stop recording" : "Speak to your twin"}
          >
            <Mic className={cn("h-4 w-4", listening && "animate-pulse")} />
          </Button>
        ) : null}

        {streaming ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onStop}
            className="h-9 w-9 shrink-0"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="h-9 w-9 shrink-0"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          Enter to send · Shift+Enter for newline
        </p>
        {listening ? (
          <p className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Listening...
          </p>
        ) : null}
      </div>
    </div>
  );
}
