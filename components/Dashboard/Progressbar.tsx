import { CouncilCard } from "@/components/design-system";
import { statTones, typography, type StatTone } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import React from "react";

type ProgressBarProps = {
  value: number;
  label: string;
  tone: StatTone;
  icon: React.ReactNode;
};

function ProgressBar({ value, label, tone, icon }: ProgressBarProps) {
  const colors = statTones[tone];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              colors.light,
            )}
            style={{ color: colors.from }}
          >
            {icon}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{label}</p>
            <p className="text-xs font-medium text-slate-500">Of total employees</p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-black tabular-nums text-white",
          )}
          style={{
            backgroundImage: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
          }}
        >
          {value}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${value}%`,
            backgroundImage: `linear-gradient(to right, ${colors.from}, ${colors.to})`,
          }}
        />
      </div>
    </div>
  );
}

const ProgressSection: React.FC<{
  onTimePercent: number;
  latePercent: number;
  absentPercent: number;
}> = ({ onTimePercent, latePercent, absentPercent }) => {
  return (
    <CouncilCard interactive="none" className="w-full p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-3 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">
            Attendance Overview
          </h2>
          <p className={cn(typography.body, "mt-1 font-medium")}>
            Breakdown for the selected date
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Live metrics
        </span>
      </div>

      <div className="space-y-8">
        <ProgressBar
          value={onTimePercent}
          label="On Time"
          tone="emerald"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <ProgressBar
          value={latePercent}
          label="Late"
          tone="amber"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <ProgressBar
          value={absentPercent}
          label="On Leave"
          tone="rose"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        />
      </div>
    </CouncilCard>
  );
};

export default ProgressSection;
