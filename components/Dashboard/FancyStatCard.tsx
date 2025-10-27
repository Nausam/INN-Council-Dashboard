import React from "react";

type FancyStatCardProps = {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  gradient?: string; // for the glow + accent
};

export default function FancyStatCard({
  title,
  value,
  icon,
  gradient = "linear-gradient(135deg, #7C3AED, #DB2777)",
}: FancyStatCardProps) {
  return (
    <div className="relative group">
      {/* Glow border */}
      <div
        className="absolute -inset-0.5 rounded-2xl opacity-80 blur-xl transition-opacity group-hover:opacity-100"
        style={{ background: gradient }}
        aria-hidden
      />
      {/* Card */}
      <div className="relative rounded-2xl bg-white/80 backdrop-blur border border-white/70 shadow-xl p-5 overflow-hidden">
        {/* Animated accent bar */}
        <div
          className="absolute -top-1 right-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
          style={{ background: gradient }}
          aria-hidden
        />
        <div className="flex items-start justify-between relative">
          <div className="size-11 rounded-xl grid place-items-center text-white shadow-md"
               style={{ background: gradient }}>
            {icon}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-gray-900">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

