import { cn, clampPercent } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const percent = clampPercent(value);
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full bg-slate-900 dark:bg-white transition-all duration-500",
          indicatorClassName
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
