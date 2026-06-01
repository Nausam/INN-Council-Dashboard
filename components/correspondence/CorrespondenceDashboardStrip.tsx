"use client";

import { CouncilCard } from "@/components/design-system";
import { getCorrespondenceDashboardStats } from "@/lib/actions/correspondence.actions";
import { typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function CorrespondenceDashboardStrip() {
  const { isLoaded, isSignedIn } = useAuth();
  const [stats, setStats] = useState<{
    pending: number;
    overdue: number;
    answeredThisWeek: number;
  } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    (async () => {
      try {
        const raw = await getCorrespondenceDashboardStats();
        if (!raw) {
          if (!cancelled) setHidden(true);
          return;
        }
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
  }, [isLoaded, isSignedIn]);

  if (hidden || !stats) return null;

  const items = [
    {
      label: "Pending",
      value: stats.pending,
      className: "border-slate-200/80 bg-slate-50/80 text-slate-900",
      labelClass: "text-slate-500",
    },
    {
      label: "Overdue",
      value: stats.overdue,
      className: "border-amber-200/80 bg-amber-50/80 text-amber-950",
      labelClass: "text-amber-800/70",
    },
    {
      label: "Answered (week)",
      value: stats.answeredThisWeek,
      className: "border-emerald-200/80 bg-emerald-50/80 text-emerald-950",
      labelClass: "text-emerald-800/70",
    },
  ];

  return (
    <CouncilCard interactive="none" className="mb-8 p-0">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="council-page-icon h-11 w-11 rounded-xl">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-slate-900">
              Document receiver
            </h2>
            <p className={cn(typography.body, "text-xs font-medium")}>
              Track documents received by the council
            </p>
          </div>
        </div>
        <Link
          href="/document-reciever"
          className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 transition-colors duration-200 hover:text-teal-800"
        >
          Open registry
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-6">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-xl border px-4 py-3 ring-1 ring-black/[0.03]",
              item.className,
            )}
          >
            <p
              className={cn(
                "text-[11px] font-bold uppercase tracking-wide",
                item.labelClass,
              )}
            >
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>
    </CouncilCard>
  );
}
