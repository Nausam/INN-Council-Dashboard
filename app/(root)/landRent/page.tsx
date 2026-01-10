/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  calcOverviewTotals,
  filterOverviewRows,
  getThisMonthKey,
} from "@/components/landRent/Overview/landRentOverview.utils";
import OverviewCards from "@/components/landRent/Overview/OverviewCards";
import OverviewHeader from "@/components/landRent/Overview/OverviewHeader";
import OverviewSkeleton from "@/components/landRent/Overview/OverviewSkeleton";
import OverviewStats from "@/components/landRent/Overview/OverviewStats";
import OverviewTable from "@/components/landRent/Overview/OverviewTable";
import { useLandRentOverview } from "@/components/landRent/Overview/useLandRentOverview";
import { useMemo, useState } from "react";

export default function Page() {
  const { rows, loading, error } = useLandRentOverview();
  const [q, setQ] = useState("");

  const monthKey = useMemo(() => getThisMonthKey(), []);
  const filtered = useMemo(() => filterOverviewRows(rows, q), [rows, q]);
  const totals = useMemo(() => calcOverviewTotals(filtered), [filtered]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 space-y-6">
      {/* Clean card (no gradient frame) */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <OverviewHeader
          q={q}
          setQ={setQ}
          loading={loading}
          filteredCount={filtered.length}
          totalCount={rows.length}
        />

        <div className="mt-5">
          <OverviewStats
            loading={loading}
            totals={{
              totalLeases: totals.totalLeases,
              totalMonthly: totals.totalMonthly,
              totalOutstanding: totals.totalOutstanding,
            }}
          />
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        ) : null}
      </div>

      {loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <OverviewTable rows={filtered} monthKey={monthKey} />
          <OverviewCards rows={filtered} monthKey={monthKey} />
        </>
      )}
    </div>
  );
}
