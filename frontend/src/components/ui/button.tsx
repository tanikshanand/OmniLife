"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  default:
    "bg-slate-900 text-white font-medium hover:bg-slate-800 border border-slate-900 shadow-sm focus-visible:ring-slate-900/20 dark:bg-white dark:text-black dark:font-semibold dark:hover:bg-neutral-200 dark:border-white dark:shadow-[0_0_20px_rgba(255,255,255,0.15)] dark:focus-visible:ring-white/40 active:scale-[0.98] transition-all",
  secondary:
    "bg-slate-100 text-slate-900 font-medium border border-slate-200 hover:bg-slate-200/90 focus-visible:ring-slate-300 dark:bg-neutral-900 dark:text-white dark:border-neutral-800 dark:hover:bg-neutral-800 dark:hover:border-neutral-700 dark:focus-visible:ring-neutral-700/40 active:scale-[0.98] transition-all",
  outline:
    "border border-slate-300 bg-white text-slate-800 font-medium hover:bg-slate-100/80 hover:text-slate-900 hover:border-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:bg-neutral-900 dark:hover:text-white dark:hover:border-neutral-600 focus-visible:ring-slate-300 active:scale-[0.98] transition-all",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white focus-visible:ring-slate-300 transition-colors",
  destructive:
    "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/80 dark:hover:bg-rose-900 focus-visible:ring-rose-500/40 active:scale-[0.98] transition-all",
  subtle:
    "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white dark:hover:border-neutral-700 focus-visible:ring-slate-300 transition-colors",
};

const sizes: Record<Size, string> = {
  sm: "h-8.5 px-3 text-xs min-h-[34px]",
  md: "h-10 px-4 text-sm min-h-[40px]",
  lg: "h-12 px-6 text-base min-h-[48px]",
  icon: "h-9 w-9 shrink-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
