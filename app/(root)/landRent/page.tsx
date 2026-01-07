/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  fetchLandRentOverview,
  type LandRentOverviewRow,
} from "@/lib/landrent/landRent.actions";
import {
  AlertTriangle,
  CalendarDays,
  Coins,
  FileText,
  Landmark,
  Search,
  User2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getThisMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function fmtDateShort(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function statSafeNumber(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtCompact(n: number) {
  if (!Number.isFinite(n)) return "-";
  // safe, readable compact display for large totals
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return fmtMoney(n);
}

export default function Page() {
  const [rows, setRows] = useState<LandRentOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);

    fetchLandRentOverview()
      .then((r) => {
        if (!alive) return;
        setRows(r);
      })
      .catch((e: any) => {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load land rents.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay =
        `${r.landName} ${r.tenantName} ${r.agreementNumber}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  const totals = useMemo(() => {
    const totalLeases = filtered.length;

    const totalMonthly = filtered.reduce(
      (sum, r) => sum + statSafeNumber((r as any).monthlyRent),
      0
    );

    const totalOutstanding = filtered.reduce(
      (sum, r) => sum + statSafeNumber((r as any).openingOutstandingTotal),
      0
    );

    const missingLastPaid = filtered.reduce((sum, r) => {
      const v = (r as any).lastPaymentDate ?? null;
      return sum + (v ? 0 : 1);
    }, 0);

    return { totalLeases, totalMonthly, totalOutstanding, missingLastPaid };
  }, [filtered]);

  const monthKey = useMemo(() => getThisMonthKey(), []);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 space-y-6">
      {/* Header / Controls */}
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-sky-500/25 via-fuchsia-500/15 to-emerald-500/20">
        <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-[0_10px_30px_-20px_rgba(0,0,0,.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_20%_-10%,rgba(56,189,248,.12),transparent_60%),radial-gradient(900px_420px_at_90%_0%,rgba(217,70,239,.10),transparent_55%)]" />

          <div className="relative p-4 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black/[0.04] ring-1 ring-black/10">
                    <Landmark className="h-5 w-5 text-black/70" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xl font-semibold tracking-tight">
                      Land rent leases
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      Search and open the latest statement for each lease.
                    </div>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="w-full lg:w-[520px]">
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/45">
                    <Search className="h-4.5 w-4.5" />
                  </div>

                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search land, renter, agreement…"
                    className="h-12 w-full rounded-2xl bg-white pl-10 pr-10
                      ring-1 ring-black/10 shadow-sm transition
                      focus:outline-none focus:ring-2 focus:ring-black/15"
                  />

                  {q ? (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl
                        bg-black/[0.03] ring-1 ring-black/10 p-2 transition
                        hover:bg-black/[0.05] hover:-translate-y-[calc(50%+2px)]"
                      aria-label="Clear search"
                      title="Clear"
                    >
                      <X className="h-4 w-4 text-black/70" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 text-[11px] text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-black/70 tabular-nums">
                    {loading ? "…" : filtered.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-black/70 tabular-nums">
                    {loading ? "…" : rows.length}
                  </span>{" "}
                  leases.
                </div>
              </div>
            </div>

            {/* Stats (redesigned) */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Total leases */}
              <div className="relative overflow-hidden rounded-2xl bg-white/80 ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_360px_at_20%_-10%,rgba(56,189,248,.10),transparent_60%)]" />
                <div className="relative p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground">
                      Total leases
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black/[0.04] ring-1 ring-black/10">
                      <FileText className="h-4.5 w-4.5 text-black/70" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {loading ? "—" : totals.totalLeases}
                  </div>
                </div>
              </div>

              {/* Total monthly */}
              <div className="relative overflow-hidden rounded-2xl bg-white/80 ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_360px_at_20%_-10%,rgba(16,185,129,.10),transparent_60%)]" />
                <div className="relative p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground">
                      Total monthly
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black/[0.04] ring-1 ring-black/10">
                      <Coins className="h-4.5 w-4.5 text-black/70" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {loading ? "—" : fmtMoney(totals.totalMonthly)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Compact:{" "}
                    <span className="tabular-nums text-black/70">
                      {loading ? "—" : fmtCompact(totals.totalMonthly)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total outstanding */}
              <div className="relative overflow-hidden rounded-2xl bg-white/80 ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_360px_at_20%_-10%,rgba(245,158,11,.12),transparent_60%)]" />
                <div className="relative p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground">
                      Total outstanding
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black/[0.04] ring-1 ring-black/10">
                      <AlertTriangle className="h-4.5 w-4.5 text-black/70" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {loading ? "—" : fmtMoney(totals.totalOutstanding)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Compact:{" "}
                    <span className="tabular-nums text-black/70">
                      {loading ? "—" : fmtCompact(totals.totalOutstanding)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Missing last paid (NOT black anymore) */}
              {/* <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_360px_at_20%_-10%,rgba(217,70,239,.10),transparent_60%)]" />
                <div className="relative p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground">
                      Missing “Last paid”
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-black/[0.04] ring-1 ring-black/10">
                      <CalendarDays className="h-4.5 w-4.5 text-black/70" />
                    </div>
                  </div>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-2xl font-semibold tabular-nums tracking-tight">
                      {loading ? "—" : totals.missingLastPaid}
                    </div>

                    <span className="inline-flex items-center rounded-full bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/70 ring-1 ring-black/10">
                      {loading || totals.totalLeases === 0
                        ? "—"
                        : `${Math.round(
                            (totals.missingLastPaid / totals.totalLeases) * 100
                          )}%`}
                    </span>
                  </div>

                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Leases with no recorded last payment date.
                  </div>
                </div>
              </div> */}
            </div>

            {err ? (
              <div className="mt-5 rounded-2xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-700">
                {err}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-black/10 to-black/5">
          <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-sm">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_420px_at_15%_-10%,rgba(0,0,0,.04),transparent_60%)]" />
            <div className="relative p-6">
              <div className="h-5 w-52 rounded-lg bg-black/[0.06]" />
              <div className="mt-3 h-4 w-80 rounded-lg bg-black/[0.05]" />
              <div className="mt-6 grid gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 rounded-2xl bg-black/[0.03] ring-1 ring-black/5"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table (cleaner + correct columns) */}
          <div className="hidden md:block relative rounded-2xl p-[1px] bg-gradient-to-br from-black/10 to-black/5">
            <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-sm">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_420px_at_15%_-10%,rgba(0,0,0,.04),transparent_60%)]" />

              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/[0.03]">
                    <tr className="text-left text-black/70">
                      <th className="px-4 py-3 font-bold">Tenant</th>
                      <th className="px-4 py-3 font-bold">Agreement</th>
                      <th className="px-4 py-3 font-bold">Outstanding</th>
                      <th className="px-4 py-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-10 text-muted-foreground"
                          colSpan={5}
                        >
                          No results.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => (
                        <tr
                          key={r.leaseId}
                          className="border-t border-black/10 hover:bg-black/[0.02] transition"
                        >
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-lg font-dh1 text-black/85">
                                {r.landName}
                              </div>
                              <div className="mt-2 text-md text-muted-foreground font-dh1 truncate">
                                {r.tenantName}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-xl bg-black/[0.02] px-3 py-1.5 ring-1 ring-black/10">
                              <User2 className="mr-2 h-4 w-4 text-black/55" />
                              <span className="tabular-nums">
                                {r.agreementNumber}
                              </span>
                            </span>
                          </td>

                          <td className="px-4 py-3 tabular-nums font-semibold">
                            {fmtMoney((r as any).openingOutstandingTotal)}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <Link
                                href={`/landRent/statement?leaseId=${encodeURIComponent(
                                  r.leaseId
                                )}&monthKey=${encodeURIComponent(monthKey)}`}
                                className="inline-flex items-center gap-2 h-10 rounded-2xl bg-black text-white px-4 text-sm font-semibold
                                  ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                              >
                                <FileText className="h-4 w-4" />
                                Statement
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="relative flex items-center justify-between gap-3 px-4 py-3 border-t border-black/10 text-xs text-muted-foreground">
                <span>Total: {filtered.length}</span>
                <span className="tabular-nums">
                  Month key used:{" "}
                  <span className="text-black/70">{monthKey}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Mobile cards (kept) */}
          <div className="md:hidden grid gap-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-black/10 p-6 text-sm text-muted-foreground">
                No results.
              </div>
            ) : (
              filtered.map((r) => (
                <div
                  key={r.leaseId}
                  className="relative rounded-2xl p-[1px] bg-gradient-to-br from-black/10 to-black/5"
                >
                  <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-sm">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_15%_-10%,rgba(0,0,0,.04),transparent_60%)]" />

                    <div className="relative p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold font-dh1 truncate">
                            {r.landName}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground font-dh1 truncate">
                            {r.tenantName}
                          </div>
                        </div>

                        <Link
                          href={`/landRent/statement?leaseId=${encodeURIComponent(
                            r.leaseId
                          )}&monthKey=${encodeURIComponent(monthKey)}`}
                          className="shrink-0 inline-flex items-center gap-2 h-10 rounded-2xl bg-black text-white px-4 text-sm font-semibold
                            ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <FileText className="h-4 w-4" />
                          Statement
                        </Link>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs">
                        <div className="flex items-center gap-2 text-black/70">
                          <User2 className="h-4 w-4" />
                          <span className="truncate">{r.agreementNumber}</span>
                        </div>

                        <div className="flex items-center gap-2 text-black/70">
                          <CalendarDays className="h-4 w-4" />
                          <span className="tabular-nums">
                            {fmtDateShort(r.startDate)} →{" "}
                            {fmtDateShort(r.endDate)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-2">
                          <div className="rounded-xl bg-black/[0.03] ring-1 ring-black/10 px-3 py-2">
                            <div className="text-[10px] text-muted-foreground">
                              Monthly
                            </div>
                            <div className="text-sm font-semibold tabular-nums">
                              {fmtMoney((r as any).monthlyRent)}
                            </div>
                          </div>

                          <div className="rounded-xl bg-black/[0.03] ring-1 ring-black/10 px-3 py-2">
                            <div className="text-[10px] text-muted-foreground">
                              Outstanding
                            </div>
                            <div className="text-sm font-semibold tabular-nums">
                              {fmtMoney((r as any).openingOutstandingTotal)}
                            </div>
                          </div>
                        </div>

                        <div className="pt-1 text-[11px] text-muted-foreground">
                          Last paid:{" "}
                          <span className="tabular-nums text-black/70">
                            {fmtDateShort((r as any).lastPaymentDate ?? null)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="text-xs text-muted-foreground px-1">
              Total: {filtered.length}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
