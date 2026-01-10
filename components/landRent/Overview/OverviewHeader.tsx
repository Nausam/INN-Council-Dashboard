"use client";

import { Landmark, Search, X } from "lucide-react";

export default function OverviewHeader({
  q,
  setQ,
  loading,
  filteredCount,
  totalCount,
}: {
  q: string;
  setQ: (v: string) => void;
  loading: boolean;
  filteredCount: number;
  totalCount: number;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-100 text-slate-700">
              <Landmark className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-tight text-slate-900">
                Land rent leases
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Search and open the latest statement for each lease.
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[520px]">
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="h-4.5 w-4.5" />
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search land, renter, agreement…"
              className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-10 text-slate-900
                ring-1 ring-slate-100 shadow-sm transition
                focus:outline-none focus:ring-2 focus:ring-sky-200"
            />

            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl
                  bg-white ring-1 ring-slate-200 p-2 shadow-sm transition
                  hover:-translate-y-[calc(50%+2px)]"
                aria-label="Clear search"
                title="Clear"
              >
                <X className="h-4 w-4 text-slate-600" />
              </button>
            ) : null}
          </div>

          <div className="mt-2 text-[12px] text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {loading ? "…" : filteredCount}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {loading ? "…" : totalCount}
            </span>{" "}
            leases.
          </div>
        </div>
      </div>
    </div>
  );
}
