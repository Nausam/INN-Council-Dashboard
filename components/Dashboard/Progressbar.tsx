import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

interface ProgressBarProps {
  value: number;
  label: string;
  gradient: string;
  icon: React.ReactNode;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  gradient,
  icon,
}) => (
  <div className="group">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200 transition-all group-hover:scale-105 group-hover:ring-slate-300">
          {icon}
        </div>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        <span className="text-sm font-medium text-slate-500">%</span>
      </div>
    </div>
    <div className="relative h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/50">
      <div
        className={cn(
          "absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
        )}
        style={{
          width: `${value}%`,
          background: gradient,
        }}
      >
        {/* Shimmer effect */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{
            animation: "shimmer 2s infinite",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
      {/* Highlight on top edge */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-px rounded-full bg-white/40 transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
    <style jsx>{`
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
    `}</style>
  </div>
);

const ProgressSection: React.FC<{
  onTimePercent: number;
  latePercent: number;
  absentPercent: number;
}> = ({ onTimePercent, latePercent, absentPercent }) => {
  return (
    <Card className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-sm ring-1 ring-slate-900/5 transition-all hover:shadow-md">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-16 -translate-y-16 rounded-full bg-violet-100/30 blur-3xl transition-transform group-hover:scale-125" />

      <CardHeader className="relative border-b border-slate-100 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
              Attendance Overview
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Daily attendance breakdown
            </p>
          </div>
          {/* Summary indicator */}
          <div className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 ring-1 ring-slate-200">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-700">Live</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6 p-6">
        <ProgressBar
          value={onTimePercent}
          label="On Time"
          gradient="linear-gradient(90deg, #10b981 0%, #34d399 100%)"
          icon={
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <ProgressBar
          value={latePercent}
          label="Late"
          gradient="linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
          icon={
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
        />
        <ProgressBar
          value={absentPercent}
          label="On Leave"
          gradient="linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)"
          icon={
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          }
        />
      </CardContent>
    </Card>
  );
};

export default ProgressSection;
