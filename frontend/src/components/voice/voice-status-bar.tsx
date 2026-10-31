"use client";

import { Mic, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VoiceStatusBar({
  listening,
  speaking,
  onStop,
}: {
  listening: boolean;
  speaking: boolean;
  onStop: () => void;
}) {
  if (!listening && !speaking) return null;

  return (
    <div
      className={cn(
        "mx-3 mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] sm:mx-4",
        listening
          ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
      )}
    >
      {listening ? (
        <Mic className="h-3.5 w-3.5 animate-pulse" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      <span className="flex-1">
        {listening
          ? "Listening... speak naturally, then pause."
          : "Twin is speaking. Press stop to interrupt."}
      </span>
      <div className="flex items-end gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={cn(
              "h-3 w-0.5 origin-bottom animate-wave-bar rounded-full",
              listening ? "bg-rose-300" : "bg-cyan-300"
            )}
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1 px-2 text-[10px]"
        onClick={onStop}
      >
        <Square className="h-3 w-3" /> Stop
      </Button>
    </div>
  );
}
