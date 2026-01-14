"use client";
import React from "react";

const DashboardHeader: React.FC = () => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="relative mb-12 overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 1200px 600px at 50% -20%, rgba(99, 102, 241, 0.15), transparent)",
        }}
      />

      {/* Main header content */}
      <div className="relative">
        {/* Date badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 shadow-sm">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs font-medium tracking-wide text-slate-600 uppercase">
            {currentDate}
          </span>
        </div>

        {/* Title section */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1
              className="text-5xl font-bold tracking-tight text-slate-900 lg:text-6xl"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Dashboard
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              Innamaadhoo Council — Real-time attendance overview
            </p>
          </div>

          {/* Decorative element */}
          <div className="flex items-center gap-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-300" />
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              <div className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="mt-6 h-px w-full bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-purple-500/20" />
    </div>
  );
};

export default DashboardHeader;
