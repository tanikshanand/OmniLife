import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline"
  | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
  warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
  danger: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
  info: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-800",
  outline: "border-slate-300 bg-white text-slate-800 dark:border-neutral-800 dark:bg-black/40 dark:text-neutral-300",
  muted: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-950 dark:text-neutral-400 dark:border-neutral-850",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
