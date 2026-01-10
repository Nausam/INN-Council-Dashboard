"use client";

import { AlertTriangle, Coins, FileText } from "lucide-react";
import React from "react";
import { fmtCompact, fmtMoney } from "./landRentOverview.utils";

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "sky" | "mint" | "amber";
  loading: boolean;
}) {
  const toneMap = {
    sky: {
      chip: "bg-sky-50 text-sky-700 ring-sky-100",
      iconBg: "bg-sky-100",
      iconFg: "text-sky-700",
      wash: "bg-[radial-gradient(900px_360px_at_10%_-10%,rgba(56,189,248,.22),transparent_55%),radial-gradient(900px_360px_at_90%_0%,rgba(99,102,241,.10),transparent_55%)]",
    },
    mint: {
      chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      iconBg: "bg-emerald-100",
      iconFg: "text-emerald-700",
      wash: "bg-[radial-gradient(900px_360px_at_10%_-10%,rgba(16,185,129,.20),transparent_55%),radial-gradient(900px_360px_at_90%_0%,rgba(56,189,248,.10),transparent_55%)]",
    },
    amber: {
      chip: "bg-amber-50 text-amber-800 ring-amber-100",
      iconBg: "bg-amber-100",
      iconFg: "text-amber-800",
      wash: "bg-[radial-gradient(900px_360px_at_10%_-10%,rgba(245,158,11,.22),transparent_55%),radial-gradient(900px_360px_at_90%_0%,rgba(244,63,94,.08),transparent_55%)]",
    },
  } as const;

  const t = toneMap[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
      {/* subtle tint wash */}
      <div
        className={`pointer-events-none absolute inset-0 opacity-60 ${t.wash}`}
      />
      {/* top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/70 to-transparent" />
      {/* hover glow */}
      {/* <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(700px_260px_at_10%_0%,rgba(56,189,248,.12),transparent_55%),radial-gradient(700px_260px_at_90%_0%,rgba(16,185,129,.10),transparent_55%)]" /> */}

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-slate-600">
              {title}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${t.chip}`}
            >
              Live
            </span>

            <div
              className={`grid h-10 w-10 place-items-center rounded-2xl ${t.iconBg} ${t.iconFg}`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
          {loading ? (
            <div className="h-7 w-28 rounded-xl bg-slate-200/70 animate-pulse" />
          ) : (
            value
          )}
        </div>

        {sub ? (
          <div className="mt-1 text-[12px] text-slate-500">
            {loading ? (
              <div className="mt-2 h-3 w-40 rounded bg-slate-200/60 animate-pulse" />
            ) : (
              sub
            )}
          </div>
        ) : null}

        {/* accent progress bar (same vibe as your progress bars) */}
        {/* <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 transition group-hover:w-[72%]" />
        </div> */}
      </div>
    </div>
  );
}

export default function OverviewStats({
  loading,
  totals,
}: {
  loading: boolean;
  totals: {
    totalLeases: number;
    totalMonthly: number;
    totalOutstanding: number;
  };
}) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Total leases"
        value={String(totals.totalLeases)}
        icon={FileText}
        tone="sky"
        loading={loading}
      />

      <StatCard
        title="Total monthly"
        value={fmtMoney(totals.totalMonthly)}
        sub={`Compact: ${fmtCompact(totals.totalMonthly)}`}
        icon={Coins}
        tone="mint"
        loading={loading}
      />

      <StatCard
        title="Total outstanding"
        value={fmtMoney(totals.totalOutstanding)}
        sub={`Compact: ${fmtCompact(totals.totalOutstanding)}`}
        icon={AlertTriangle}
        tone="amber"
        loading={loading}
      />
    </div>
  );
}
