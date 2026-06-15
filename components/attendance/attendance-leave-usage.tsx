"use client";

import type { LeaveUsageSummary } from "@/lib/employees/leave-usage";
import { cn } from "@/lib/utils";

type AttendanceLeaveUsageProps = {
  usage: LeaveUsageSummary;
  className?: string;
};

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "teal";
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 px-2",
        tone === "teal" ? "bg-teal-50/50" : "bg-slate-50/60",
      )}
    >
      <span
        className={cn(
          "text-[9px] font-bold uppercase tracking-[0.14em]",
          tone === "teal" ? "text-teal-600/90" : "text-slate-400",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums leading-none",
          tone === "teal" ? "text-teal-800" : "text-slate-800",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function AttendanceLeaveUsage({
  usage,
  className,
}: AttendanceLeaveUsageProps) {
  if (usage.remaining !== null) {
    return (
      <div
        className={cn(
          "council-input flex h-10 w-full overflow-hidden rounded-xl border-0 p-0 shadow-sm",
          className,
        )}
      >
        <Metric label="Used" value={usage.used} tone="neutral" />
        <div className="w-px shrink-0 self-stretch bg-slate-200/70" />
        <Metric label="Left" value={usage.remaining} tone="teal" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "council-input flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-50/60 px-3 shadow-sm",
        className,
      )}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
        Used
      </span>
      <span className="text-sm font-bold tabular-nums text-slate-800">
        {usage.used}
      </span>
    </div>
  );
}
