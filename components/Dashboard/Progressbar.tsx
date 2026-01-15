import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React from "react";

interface ProgressBarProps {
  value: number;
  label: string;
  gradient: string;
  icon: React.ReactNode;
  color: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  gradient,
  icon,
  color,
}) => (
  <div className="group relative">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Glass Icon Container */}
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg backdrop-blur-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6"
          style={{
            background: `linear-gradient(135deg, ${color}20, ${color}10)`,
            border: `1px solid ${color}30`,
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-0 blur-xl"
            style={{ background: color }}
          />
          <div className="relative" style={{ color }}>
            {icon}
          </div>
        </div>

        {/* Label */}
        <div>
          <span className="text-base font-bold text-slate-800">{label}</span>
          <p className="text-xs font-medium text-slate-500">Current status</p>
        </div>
      </div>

      {/* Percentage Badge */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-2.5 shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        }}
      >
        <div className="absolute inset-0 bg-white/10" />
        <div className="relative flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{value}</span>
          <span className="text-sm font-bold text-white/80">%</span>
        </div>
      </div>
    </div>

    {/* Modern Progress Track */}
    <div className="relative">
      <div
        className="h-4 overflow-hidden rounded-full backdrop-blur-sm"
        style={{
          background: `${color}15`,
          boxShadow: `inset 0 2px 8px ${color}10`,
        }}
      >
        {/* Progress Fill */}
        <div
          className="relative h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${value}%`,
            background: gradient,
            boxShadow: `0 2px 8px ${color}20`,
          }}
        >
          {/* Animated Shimmer */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              animation: "shimmer 2s infinite",
              backgroundSize: "200% 100%",
            }}
          />

          {/* Glow Effect - Removed */}
        </div>
      </div>

      {/* Progress Dots */}
      <div className="absolute -top-1 flex w-full justify-between px-2">
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-300 transition-all duration-500"
            style={{
              background: i * 10 <= value ? color : "rgb(203 213 225)",
              transform: i * 10 <= value ? "scale(1.5)" : "scale(1)",
              boxShadow: i * 10 <= value ? `0 0 8px ${color}` : "none",
            }}
          />
        ))}
      </div>
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
    <div className="group relative w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/90 to-white/60 p-8 shadow-2xl backdrop-blur-2xl transition-all duration-700 hover:shadow-3xl">
      {/* Floating Orbs Background - Static (no hover grow) */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-400/20 blur-3xl" />

      {/* Header */}
      <div className="relative mb-8 flex items-center justify-between border-b border-slate-200/50 pb-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Attendance Overview
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Real-time performance metrics
          </p>
        </div>

        {/* Live Indicator */}
        <div className="flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 shadow-lg">
          <div className="relative">
            <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
            <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-white/50" />
          </div>
          <span className="text-sm font-bold text-white">Live Data</span>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="relative space-y-8">
        <ProgressBar
          value={onTimePercent}
          label="On Time"
          gradient="linear-gradient(90deg, #10b981 0%, #34d399 100%)"
          color="#10b981"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <ProgressBar
          value={latePercent}
          label="Late"
          gradient="linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)"
          color="#f59e0b"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
        />
        <ProgressBar
          value={absentPercent}
          label="On Leave"
          gradient="linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)"
          color="#f43f5e"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          }
        />
      </div>

      {/* Decorative Border Glow - Removed */}
    </div>
  );
};

export default ProgressSection;
