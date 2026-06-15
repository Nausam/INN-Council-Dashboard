"use client";

import {
  CouncilCard,
  CouncilPopoverSelect,
  PageHeader,
  PageShell,
} from "@/components/design-system";
import { SalaryPeriodHolidaysPanel } from "@/components/salary-slips/SalaryPeriodHolidaysPanel";
import { SalarySlipDocument } from "@/components/salary-slips/SalarySlipDocument";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalarySlipComputed } from "@/lib/salary-slips/compute-slip";
import { periodLabelFromMonthYear } from "@/lib/salary-slips/format";
import { formatPayPeriodRange } from "@/lib/salary-slips/pay-period";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Loader2,
  Printer,
  User,
  Wallet,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getYearRange() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 3; y <= current + 1; y++) years.push(y);
  return years;
}

const YEARS = getYearRange();

function getCurrentMonthAndYear() {
  const now = new Date();
  return { month: MONTHS[now.getMonth()], year: String(now.getFullYear()) };
}

function employeeOptionLabel(slip: SalarySlipComputed): string {
  const card =
    slip.staff.recordCardNumber !== "-"
      ? ` · #${slip.staff.recordCardNumber}`
      : "";
  return `${slip.staff.name} — ${slip.staff.designation}${card}`;
}

export default function ViewSalarySlipsPage() {
  const { month: defaultMonth, year: defaultYear } = getCurrentMonthAndYear();
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [selectedId, setSelectedId] = useState<string>("");
  const [slips, setSlips] = useState<SalarySlipComputed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printScope, setPrintScope] = useState<"single" | "all" | null>(null);

  const periodLabel = useMemo(
    () => periodLabelFromMonthYear(month, year),
    [month, year],
  );

  const periodRange = useMemo(
    () => (periodLabel ? formatPayPeriodRange(periodLabel) : ""),
    [periodLabel],
  );

  const loadSlips = useCallback(async () => {
    if (!periodLabel) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/salary-slips/generated?period=${encodeURIComponent(periodLabel)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load salary slips.");
        setSlips([]);
        return;
      }
      const list = (data.slips ?? []) as SalarySlipComputed[];
      setSlips(list);
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.employeeId === prev)) return prev;
        return list[0]?.employeeId ?? "";
      });
    } catch {
      setError("Failed to load salary slips.");
      setSlips([]);
    } finally {
      setLoading(false);
    }
  }, [periodLabel]);

  useEffect(() => {
    loadSlips();
  }, [loadSlips]);

  useEffect(() => {
    const reset = () => setPrintScope(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const employeeOptions = useMemo(
    () =>
      slips.map((slip) => ({
        value: slip.employeeId,
        label: employeeOptionLabel(slip),
      })),
    [slips],
  );

  const selectedSlip = useMemo(
    () => slips.find((s) => s.employeeId === selectedId) ?? null,
    [slips, selectedId],
  );

  const handlePrint = () => {
    if (!selectedSlip) return;
    flushSync(() => setPrintScope("single"));
    window.print();
  };

  const handlePrintAll = () => {
    if (slips.length === 0) return;
    flushSync(() => setPrintScope("all"));
    window.print();
  };

  return (
    <PageShell maxWidth="full">
      <div
        className={cn(
          "view-salary-slips-page space-y-6",
          printScope === "single" && "salary-slip-print-mode-single",
          printScope === "all" && "salary-slip-print-mode-all",
        )}
      >
        <div className="print:hidden">
          <PageHeader icon={Wallet} title="View Salary Slip" />
        </div>

        <CouncilCard interactive="none" className="p-4 sm:p-5 print:hidden">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_auto_auto_minmax(0,1.4fr)]">
                <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Pay period
                  </p>
                  {periodRange && (
                    <p className="mt-0.5 text-base font-black tracking-tight text-slate-900">
                      {periodRange}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 min-w-[7rem]">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Month
                  </span>
                  <CouncilPopoverSelect
                    icon={CalendarDays}
                    value={month}
                    options={MONTHS.map((m) => ({ value: m, label: m }))}
                    onValueChange={setMonth}
                  />
                </div>

                <div className="space-y-1.5 min-w-[5.5rem]">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Year
                  </span>
                  <CouncilPopoverSelect
                    icon={CalendarDays}
                    value={year}
                    options={YEARS.map((y) => ({
                      value: String(y),
                      label: String(y),
                    }))}
                    onValueChange={setYear}
                  />
                </div>

                <div className="space-y-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Employee
                  </span>
                  <CouncilPopoverSelect
                    icon={User}
                    value={selectedId}
                    placeholder={
                      loading
                        ? "Loading…"
                        : slips.length === 0
                          ? "No employees"
                          : "Select employee"
                    }
                    options={employeeOptions}
                    onValueChange={setSelectedId}
                    disabled={loading || slips.length === 0}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                <SalaryPeriodHolidaysPanel
                  periodLabel={periodLabel}
                  employeeId={selectedId || undefined}
                  employeeName={selectedSlip?.staff.name}
                  onSaved={loadSlips}
                />
                <Button
                  type="button"
                  variant="council-outline"
                  className="h-11 rounded-xl"
                  onClick={loadSlips}
                  disabled={loading || !periodLabel}
                  aria-label="Refresh slips"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="council-outline"
                  className="h-11 rounded-xl"
                  onClick={handlePrint}
                  disabled={!selectedSlip}
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  variant="council"
                  className="h-11 rounded-xl"
                  onClick={handlePrintAll}
                  disabled={slips.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  All ({slips.length})
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-600" role="alert">
                {error}
              </p>
            )}
          </div>
        </CouncilCard>

        <main className="min-w-0">
          {loading && !selectedSlip && (
            <CouncilCard interactive="none" className="p-8">
              <Skeleton className="mx-auto h-8 w-48" />
              <Skeleton className="mx-auto mt-4 h-4 w-64" />
              <Skeleton className="mt-8 h-96 w-full max-w-2xl mx-auto" />
            </CouncilCard>
          )}

          {!loading && selectedSlip && (
            <div
              className={cn(
                "salary-slip-print-area salary-slip-print-single rounded-lg bg-slate-100/80 p-4 sm:p-8",
                printScope === "all" && "hidden",
              )}
            >
              <SalarySlipDocument slip={selectedSlip} />
            </div>
          )}

          {!loading && !selectedSlip && slips.length > 0 && (
            <CouncilCard interactive="none" className="p-10 text-center">
              <p className="text-sm font-medium text-slate-600">
                Select an employee to view their salary slip.
              </p>
            </CouncilCard>
          )}

          {!loading && slips.length === 0 && !error && (
            <CouncilCard interactive="none" className="p-10 text-center">
              <p className="text-sm font-medium text-slate-600">
                No employees found to generate slips.
              </p>
            </CouncilCard>
          )}

          <div
            className={cn(
              "salary-slip-print-area salary-slip-print-all",
              printScope === "all" ? "block" : "hidden",
            )}
          >
            {slips.map((slip) => (
              <div key={slip.employeeId} className="salary-slip-print-page">
                <SalarySlipDocument slip={slip} className="mx-auto" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </PageShell>
  );
}
