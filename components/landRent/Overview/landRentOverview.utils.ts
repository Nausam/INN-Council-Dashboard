/* eslint-disable @typescript-eslint/no-explicit-any */

import { LandRentOverviewRow } from "@/lib/landrent/landRent.types";

export type LandRentOverviewUIRow = LandRentOverviewRow & {
  landName?: string | null;
  tenantName?: string | null;
  agreementNumber?: string | null;

  monthlyRent?: number | null;

  startDate?: string | null;
  endDate?: string | null;
  lastPaymentDate?: string | null;

  outstandingNow?: number | null;
  currentOutstanding?: number | null;
  outstandingTotal?: number | null;
  openingOutstandingTotal?: number | null;
};

export function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtCompact(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return fmtMoney(n);
}

export function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export function getThisMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function statSafeNumber(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Uses the best available "current outstanding" field, with fallbacks. */
export function getOutstandingNow(r: LandRentOverviewUIRow) {
  return statSafeNumber(
    r?.outstandingNow ??
      r?.currentOutstanding ??
      r?.outstandingTotal ??
      r?.openingOutstandingTotal
  );
}

export function buildStatementHref(leaseId: string, monthKey: string) {
  return `/landRent/statement?leaseId=${encodeURIComponent(
    leaseId
  )}&monthKey=${encodeURIComponent(monthKey)}`;
}

export function filterOverviewRows(rows: LandRentOverviewUIRow[], q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return rows;

  return rows.filter((r) => {
    const hay = `${r.landName ?? ""} ${r.tenantName ?? ""} ${
      r.agreementNumber ?? ""
    }`.toLowerCase();
    return hay.includes(s);
  });
}

export function calcOverviewTotals(rows: LandRentOverviewUIRow[]) {
  const totalLeases = rows.length;

  const totalMonthly = rows.reduce(
    (sum, r) => sum + statSafeNumber(r.monthlyRent),
    0
  );

  const totalOutstanding = rows.reduce(
    (sum, r) => sum + getOutstandingNow(r),
    0
  );

  const missingLastPaid = rows.reduce((sum, r) => {
    return sum + (r.lastPaymentDate ? 0 : 1);
  }, 0);

  return { totalLeases, totalMonthly, totalOutstanding, missingLastPaid };
}
