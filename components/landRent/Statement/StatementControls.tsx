"use client";

import type { LandLeaseOption } from "@/lib/landrent/landRent.actions";

export default function StatementControls({
  options,
  loadingOptions,
  leaseId,
  setLeaseId,
  monthKey,
  setMonthKey,
  monthPickerDisabled,
  error,
}: {
  options: LandLeaseOption[];
  loadingOptions: boolean;
  leaseId: string;
  setLeaseId: (v: string) => void;
  monthKey: string;
  setMonthKey: (v: string) => void;
  monthPickerDisabled: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-50 ring-1 ring-slate-100 text-slate-700">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 12h6" />
                <path d="M9 16h6" />
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="text-xl font-bold text-slate-900">
                Land Rent Statement
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Select land/owner, choose month, then create statement.
              </div>
            </div>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">
          Controls
        </span>
      </div>

      {/* Fields */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Month */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-slate-600">
            Month
          </label>

          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            disabled={monthPickerDisabled}
            className="h-11 w-full rounded-xl bg-slate-50 px-4 text-slate-900
              ring-1 ring-slate-100 shadow-sm transition
              focus:outline-none focus:ring-2 focus:ring-sky-200
              disabled:opacity-60"
          />

          <div className="text-[12px] text-slate-500">
            {monthPickerDisabled
              ? "Month is locked because an OPEN statement exists."
              : "Pick the month to generate the statement period."}
          </div>
        </div>

        {/* Lease */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-slate-600">
            Land / Owner
          </label>

          <div className="relative">
            <select
              value={leaseId}
              onChange={(e) => setLeaseId(e.target.value)}
              disabled={loadingOptions || options.length === 0}
              className="h-11 w-full appearance-none rounded-xl bg-slate-50 px-4 pr-10 font-dh1 leading-tight text-slate-900
                ring-1 ring-slate-100 shadow-sm transition
                focus:outline-none focus:ring-2 focus:ring-sky-200
                disabled:opacity-60"
            >
              {loadingOptions ? (
                <option value="">Loading...</option>
              ) : options.length === 0 ? (
                <option value="">No leases found</option>
              ) : (
                options.map((o) => (
                  <option
                    className="text-right"
                    key={o.leaseId}
                    value={o.leaseId}
                  >
                    {o.landName}
                  </option>
                ))
              )}
            </select>

            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="text-[12px] text-slate-500">
            Choose the lease you want to generate a statement for.
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
