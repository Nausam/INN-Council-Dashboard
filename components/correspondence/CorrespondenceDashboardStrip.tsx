"use client";

import { getCorrespondenceDashboardStats } from "@/lib/actions/correspondence.actions";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

export function CorrespondenceDashboardStrip() {
  const [stats, setStats] = useState<{
    pending: number;
    overdue: number;
    answeredThisWeek: number;
  } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await getCorrespondenceDashboardStats();
        const data = raw as {
          pending: number;
          overdue: number;
          answeredThisWeek: number;
        };
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setHidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || !stats) return null;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Document receiver
            </h2>
            <p className="text-xs text-slate-500">
              Track documents received by the council
            </p>
          </div>
        </div>
        <Link
          href="/document-reciever"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          Open registry
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pending
          </p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">
            {stats.pending}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">
            Overdue
          </p>
          <p className="text-2xl font-semibold tabular-nums text-amber-950">
            {stats.overdue}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/70">
            Answered (week)
          </p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-950">
            {stats.answeredThisWeek}
          </p>
        </div>
      </div>
    </div>
  );
}
