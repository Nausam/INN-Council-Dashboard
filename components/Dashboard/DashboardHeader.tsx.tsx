"use client";
import React from "react";

const DashboardHeader: React.FC = () => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl">
      {/* Cyan background */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            // soft cyan glows
            "radial-gradient(900px 380px at -10% -10%, rgba(34, 211, 238, 0.35) 0%, transparent 60%)," + // cyan-400
            "radial-gradient(700px 420px at 110% 20%, rgba(6, 182, 212, 0.35) 0%, transparent 60%)," + // cyan-500
            // main sweep
            "linear-gradient(135deg, #22d3ee 0%, #06b6d4 45%, #0e7490 100%)", // cyan-400 -> cyan-600 -> cyan-800/teal
          filter: "saturate(115%)",
        }}
      />

      {/* Liquid blobs (cyan/teal) */}
      <div
        className="pointer-events-none absolute -left-10 top-0 h-56 w-56 rounded-full blur-2xl"
        style={{ background: "linear-gradient(135deg, #67e8f959, #22d3ee59)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 top-8 h-44 w-44 rounded-full blur-2xl"
        style={{ background: "linear-gradient(135deg, #06b6d459, #0e749059)" }}
        aria-hidden
      />

      {/* Glass panel */}
      <div className="relative px-6 py-8 lg:py-12">
        <div className="mx-auto rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)]" />
          <div className="relative flex items-start justify-between gap-4 px-6 py-8 lg:flex-row lg:items-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-sm lg:text-4xl">
                Welcome to your dashboard
              </h1>
              <p className="mt-1 text-sm text-white/90">{currentDate}</p>
            </div>
            <p className="text-base font-medium text-white/95 lg:text-lg">
              Innamaadhoo Council
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
