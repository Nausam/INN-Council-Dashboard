/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  fmtDateShort,
  fmtMoney,
  toDatetimeLocalValue,
} from "@/components/landRent/Statement/landRentStatement.utils";
import PaymentsPanel from "@/components/landRent/Statement/PaymentsPanel";
import type {
  PreviewDetails,
  StatementDetails,
} from "@/components/landRent/Statement/useLandRentStatementPage";
import React from "react";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default function MonthlyCalculationPanel({
  previewSource,
  capToEndDate,
  setCapToEndDate,

  openStatement,

  canCreateStatement,
  creatingStatement,
  onCreateStatement,

  canCreateNextStatement,
  nextMonthKeySuggestion,

  paymentOk,
  paymentError,

  // payment form state
  payAmount,
  setPayAmount,
  payAtLocal,
  setPayAtLocal,
  payMethod,
  setPayMethod,
  paySlipFile,
  setPaySlipFile,
  payNote,
  setPayNote,
  payReceivedBy,
  setPayReceivedBy,

  savingPayment,
  onSubmitPayment,
  onRefresh,
  onRecalculateAll,
  recalculatingFines,
  leaseId,
}: {
  previewSource: StatementDetails | PreviewDetails | null;

  capToEndDate: boolean;
  setCapToEndDate: (v: boolean) => void;

  openStatement: StatementDetails | null;

  canCreateStatement: boolean;
  creatingStatement: boolean;
  onCreateStatement: () => void;

  canCreateNextStatement: boolean;
  nextMonthKeySuggestion: string;

  paymentOk: string | null;
  paymentError: string | null;

  payAmount: string;
  setPayAmount: (v: string) => void;
  payAtLocal: string;
  setPayAtLocal: (v: string) => void;
  payMethod: string;
  setPayMethod: (v: string) => void;
  paySlipFile: File | null;
  setPaySlipFile: (v: File | null) => void;

  payNote: string;
  setPayNote: (v: string) => void;
  payReceivedBy: string;
  setPayReceivedBy: (v: string) => void;

  savingPayment: boolean;
  onSubmitPayment: (e: React.FormEvent) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRecalculateAll?: () => Promise<void>;
  recalculatingFines?: boolean;
  leaseId: string;
}) {
  const [paymentsOpen, setPaymentsOpen] = React.useState(false);

  if (!previewSource) return null;

  const landName =
    (previewSource as any).landName ??
    (previewSource as any).statement?.landName ??
    "";

  const rentingPerson =
    (previewSource as any).rentingPerson ??
    (previewSource as any).statement?.tenantName ??
    "";

  const latestPaymentDate = (previewSource as any).latestPaymentDate ?? null;

  const monthlyRent = Number(
    (previewSource as any).monthlyRentPaymentAmount ?? 0
  );
  const unpaidMonths = Number((previewSource as any).unpaidMonths ?? 0);
  const outstandingFees = Number((previewSource as any).outstandingFees ?? 0);
  const fineDays = Number((previewSource as any).numberOfFineDays ?? 0);
  const fineAmount = Number((previewSource as any).fineAmount ?? 0);
  const totalDue = Number((previewSource as any).totalRentPaymentMonthly ?? 0);

  const fineBreakdown = Array.isArray((previewSource as any).fineBreakdown)
    ? (previewSource as any).fineBreakdown
    : [];

  const paymentsTotal = openStatement
    ? Number((openStatement as any).paymentsTotal ?? 0)
    : 0;

  const remainingOutstanding = openStatement
    ? Number(
        (openStatement as any).balanceRemaining ??
          Math.max(0, totalDue - paymentsTotal)
      )
    : Math.max(0, totalDue);

  const paidRatio = totalDue > 0 ? clamp01(paymentsTotal / totalDue) : 0;

  return (
    <div className="w-full">
      {/* Page shell (matches the light dashboard ref) */}
      <div className="rounded-3xl bg-slate-50 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Monthly Calculation
              </h2>

              {openStatement ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  OPEN
                  <span className="tabular-nums text-emerald-900/90">
                    {openStatement.statement.monthKey}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">
                  No open statement
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
              <span className="font-medium font-dh1 text-slate-900/90">
                {landName}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-medium font-dh1 text-slate-900/90">
                {rentingPerson}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-100">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Latest payment:
                <span className="font-semibold tabular-nums text-slate-900">
                  {fmtDateShort(latestPaymentDate)}
                </span>
              </span>

              {/* <button
                type="button"
                onClick={() => setCapToEndDate(!capToEndDate)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                    capToEndDate ? "bg-emerald-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                      capToEndDate ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
                <span>
                  Fine cap:{" "}
                  <span className="font-semibold text-slate-900">
                    {capToEndDate ? "Up to end date" : "Up to today"}
                  </span>
                </span>
              </button> */}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateNextStatement ? (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">
                Next suggested:{" "}
                <span className="ml-1 tabular-nums text-amber-950/80">
                  {nextMonthKeySuggestion}
                </span>
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => (onRecalculateAll ?? onRefresh)()}
              disabled={savingPayment || recalculatingFines || !leaseId}
              className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 inline-flex items-center gap-2"
            >
              {recalculatingFines ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                  Recalculating…
                </>
              ) : (
                "Recalculate all"
              )}
            </button>
          </div>
        </div>

        {/* Top: Summary (left) + Progress (right) */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2 w-full">
          {/* Summary */}
          <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  Rent Summary
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Quick overview for this lease
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Monthly Rent"
                value={fmtMoney(monthlyRent)}
                hint="Base monthly payment"
                tone="rose"
                icon="receipt"
              />
              <StatCard
                title="Unpaid Months"
                value={String(unpaidMonths)}
                hint="Pending months count"
                tone="amber"
                icon="calendar"
              />
              <StatCard
                title="Total Fines Due"
                value={fmtMoney(fineAmount)}
                hint={`${fineDays} fine days`}
                tone="violet"
                icon="spark"
              />

              <StatCard
                title="Total Rent Due"
                value={fmtMoney(outstandingFees)}
                hint="Total rent due"
                tone="mint"
                icon="tag"
              />
            </div>
          </div>

          {/* Progress */}
          <div className="w-full lg:col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  Payment Progress
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Total Outstanding
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">
                {Math.round(paidRatio * 100)}% paid
              </span>
            </div>

            <div className="mt-4">
              <div className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                {fmtMoney(totalDue)}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="text-[12px] text-slate-500">Paid</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {fmtMoney(paymentsTotal)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="text-[12px] text-slate-500">Remaining</div>
                  <div className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {fmtMoney(remainingOutstanding)}
                  </div>
                </div>
              </div>

              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500"
                  style={{ width: `${Math.round(paidRatio * 100)}%` }}
                />
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Payments are applied to the OPEN statement only.
              </div>
            </div>

            {/* Total due tile (matches your old “total” info but looks like ref) */}
            {/* <div className="mt-4 rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
              <div className="text-[12px] font-semibold text-indigo-900/80">
                Fees + fine + rent total
              </div>
              <div className="mt-1 text-sm text-indigo-900/70">
                This figure includes monthly rent, outstanding fees and fine.
              </div>
            </div> */}
          </div>
        </div>

        {/* Fine Breakdown */}
        {fineBreakdown.length ? (
          <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  Fine Breakdown
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Per unpaid month (days overdue &amp; fine)
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">
                    {fineBreakdown.length} months
                  </span>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-[12px] font-semibold text-sky-700 ring-1 ring-sky-100">
                    Oldest → newest
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-[12px] font-semibold text-slate-500">
                  Total fine
                </div>
                <div className="mt-1 inline-flex rounded-xl bg-rose-100 px-3 py-2 font-semibold tabular-nums text-rose-700 ring-1 ring-rose-200">
                  {fmtMoney(fineAmount)}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="max-h-[420px] overflow-auto p-4">
              {(() => {
                const maxFine = Math.max(
                  1,
                  ...fineBreakdown.map((b: any) => Number(b.fine ?? 0))
                );

                return (
                  <div className="grid gap-3">
                    {fineBreakdown.map((b: any) => {
                      const fine = Number(b.fine ?? 0);
                      const pct = Math.max(
                        6,
                        Math.round((fine / maxFine) * 100)
                      );

                      return (
                        <div
                          key={b.key}
                          className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {b.label}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                                {b.days} days overdue
                              </div>

                              <div className="mt-3">
                                <ProgressBar pct={pct} />
                              </div>
                            </div>

                            <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-right ring-1 ring-slate-100">
                              <div className="text-[11px] text-slate-500">
                                Fine
                              </div>
                              <div className="font-semibold tabular-nums text-slate-900">
                                {fmtMoney(fine)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : null}

        {/* Actions + Payments */}
        {/* Payments panel */}
        <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {/* MAIN HEADER (replaces the mini header) */}
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xl font-semibold text-slate-900">
                Payments
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Transactions linked to the current statement
              </div>

              <div className="flex items-center gap-3 justify-start mt-2">
                <div className="text-[12px] font-semibold text-slate-500 text-left">
                  Total paid
                </div>
                <div className="mt-1 inline-flex rounded-xl bg-emerald-100 px-3 py-2 font-semibold tabular-nums text-emerald-700 ring-1 ring-emerald-200">
                  {fmtMoney(paymentsTotal)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-2 sm:justify-end">
              {/* Total paid pill (same as your mini header) */}

              <button
                type="button"
                onClick={() => setPaymentsOpen(true)}
                className="h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md
          bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600"
              >
                Statement &amp; Payments
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={savingPayment || !leaseId}
                className="h-10 rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="p-4">
            <PaymentsPanel openStatement={openStatement} />
          </div>
        </div>

        {/* Modal: Statement + Save Payment form */}
        <PaymentsModal
          open={paymentsOpen}
          title="Statement & Payments"
          onClose={() => setPaymentsOpen(false)}
        >
          <StatementAndPaymentsForm
            openStatement={openStatement}
            canCreateStatement={canCreateStatement}
            creatingStatement={creatingStatement}
            onCreateStatement={onCreateStatement}
            canCreateNextStatement={canCreateNextStatement}
            nextMonthKeySuggestion={nextMonthKeySuggestion}
            paymentOk={paymentOk}
            paymentError={paymentError}
            payAmount={payAmount}
            setPayAmount={setPayAmount}
            payAtLocal={payAtLocal}
            setPayAtLocal={setPayAtLocal}
            payMethod={payMethod}
            setPayMethod={setPayMethod}
            paySlipFile={paySlipFile}
            setPaySlipFile={setPaySlipFile}
            payNote={payNote}
            setPayNote={setPayNote}
            payReceivedBy={payReceivedBy}
            setPayReceivedBy={setPayReceivedBy}
            savingPayment={savingPayment}
            onSubmitPayment={onSubmitPayment}
            onRefresh={onRefresh}
            leaseId={leaseId}
          />
        </PaymentsModal>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  tone,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  tone: "rose" | "amber" | "mint" | "violet";
  icon: "receipt" | "calendar" | "tag" | "spark";
}) {
  const tones: Record<
    typeof tone,
    { bg: string; chip: string; iconBg: string; iconFg: string }
  > = {
    rose: {
      bg: "bg-rose-50",
      chip: "text-rose-700",
      iconBg: "bg-rose-100",
      iconFg: "text-rose-600",
    },
    amber: {
      bg: "bg-amber-50",
      chip: "text-amber-800",
      iconBg: "bg-amber-100",
      iconFg: "text-amber-600",
    },
    mint: {
      bg: "bg-emerald-50",
      chip: "text-emerald-800",
      iconBg: "bg-emerald-100",
      iconFg: "text-emerald-600",
    },
    violet: {
      bg: "bg-violet-50",
      chip: "text-violet-800",
      iconBg: "bg-violet-100",
      iconFg: "text-violet-600",
    },
  };

  const t = tones[tone];

  return (
    <div className={`rounded-2xl ${t.bg} p-4 ring-1 ring-white/60`}>
      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid h-11 w-11 place-items-center rounded-2xl ${t.iconBg} ${t.iconFg}`}
        >
          <Icon name={icon} />
        </div>

        {/* <span className={`text-xs font-semibold ${t.chip}`}>Today</span> */}
        <div className="text-sm font-medium text-slate-700">{title}</div>
      </div>

      <div className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-3 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function Icon({ name }: { name: "receipt" | "calendar" | "tag" | "spark" }) {
  // Simple inline icons (keeps this file self-contained)
  if (name === "receipt") {
    return (
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
        <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 7h6" />
        <path d="M9 11h6" />
        <path d="M9 15h4" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
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
        <path d="M8 2v3" />
        <path d="M16 2v3" />
        <path d="M3 8h18" />
        <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <path d="M8 12h.01" />
        <path d="M12 12h.01" />
        <path d="M16 12h.01" />
        <path d="M8 16h.01" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  if (name === "tag") {
    return (
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
        <path d="M20 12V7a2 2 0 0 0-2-2h-5L4 14l6 6 10-10Z" />
        <path d="M16 7h.01" />
      </svg>
    );
  }

  return (
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
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
      <path d="M5 14l.9 2.6L8.5 18l-2.6.9L5 21l-.9-2.6L1.5 18l2.6-.9L5 14Z" />
    </svg>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

function PaymentsModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
      />

      {/* Modal */}
      <div className="absolute left-1/2 top-1/2 w-[96vw] max-w-3xl -translate-x-1/2 -translate-y-1/2">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div className="text-xl font-semibold text-slate-900">{title}</div>

            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 transition hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          <div className="max-h-[75vh] overflow-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatementAndPaymentsForm({
  openStatement,
  canCreateStatement,
  creatingStatement,
  onCreateStatement,
  canCreateNextStatement,
  nextMonthKeySuggestion,
  paymentOk,
  paymentError,
  payAmount,
  setPayAmount,
  payAtLocal,
  setPayAtLocal,
  payMethod,
  setPayMethod,

  paySlipFile,
  setPaySlipFile,

  payNote,
  setPayNote,
  payReceivedBy,
  setPayReceivedBy,
  savingPayment,
  onSubmitPayment,
  onRefresh,
  leaseId,
}: {
  openStatement: any | null;

  canCreateStatement: boolean;
  creatingStatement: boolean;
  onCreateStatement: () => void;

  canCreateNextStatement: boolean;
  nextMonthKeySuggestion: string;

  paymentOk: string | null;
  paymentError: string | null;

  payAmount: string;
  setPayAmount: (v: string) => void;
  payAtLocal: string;
  setPayAtLocal: (v: string) => void;
  payMethod: string;
  setPayMethod: (v: string) => void;

  paySlipFile: File | null;
  setPaySlipFile: (v: File | null) => void;

  payNote: string;
  setPayNote: (v: string) => void;
  payReceivedBy: string;
  setPayReceivedBy: (v: string) => void;

  savingPayment: boolean;
  onSubmitPayment: (e: React.FormEvent) => Promise<void>;
  onRefresh: () => Promise<void>;
  leaseId: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mt-1 text-sm text-slate-500">
            Create a statement first. Payments are linked to the OPEN statement
            only.
          </div>
        </div>
      </div>

      {!openStatement ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                No open statement
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Pick a month and create the statement to start collecting
                payments.
              </div>

              {canCreateNextStatement ? (
                <div className="mt-2 text-sm text-slate-500">
                  Suggested month:{" "}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {nextMonthKeySuggestion}
                  </span>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onCreateStatement}
              disabled={!canCreateStatement || creatingStatement}
              className="h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0
                bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600"
            >
              {creatingStatement ? "Creating…" : "Create statement"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
          <div className="text-sm font-semibold text-emerald-900">
            Payments apply to{" "}
            <span className="tabular-nums">
              {openStatement.statement.monthKey}
            </span>
          </div>
          <div className="mt-1 text-sm text-emerald-800/80">
            Keep collecting until fully paid.
          </div>
        </div>
      )}

      {paymentOk ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {paymentOk}
        </div>
      ) : null}

      {paymentError ? (
        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {paymentError}
        </div>
      ) : null}

      {/* ✅ THIS IS THE FORM (this is what was missing) */}
      <form onSubmit={onSubmitPayment} className="mt-5 grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Collect payment
            </div>
            {/* <div className="mt-1 text-sm text-slate-500">
              Applied to the oldest unpaid months first.
            </div> */}
          </div>

          <button
            type="button"
            onClick={() => setPayAtLocal(toDatetimeLocalValue(new Date()))}
            disabled={!openStatement}
            className="h-10 rounded-xl bg-slate-50 px-4 text-xs font-semibold text-slate-700 ring-1 ring-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Set time to now
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (MVR)">
            <input
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
              disabled={savingPayment || !openStatement}
              className="h-11 w-full rounded-xl bg-slate-50 px-4 tabular-nums text-slate-900
                ring-1 ring-slate-100 shadow-sm transition
                focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
            />
          </Field>

          <Field label="Paid at">
            <input
              type="datetime-local"
              value={payAtLocal}
              onChange={(e) => setPayAtLocal(e.target.value)}
              disabled={savingPayment || !openStatement}
              className="h-11 w-full rounded-xl bg-slate-50 px-4 text-slate-900
                ring-1 ring-slate-100 shadow-sm transition
                focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Method">
            <div className="relative">
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                disabled={savingPayment || !openStatement}
                className="h-11 w-full appearance-none rounded-xl bg-slate-50 px-4 pr-10 text-slate-900
                  ring-1 ring-slate-100 shadow-sm transition
                  focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="transfer">Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
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
          </Field>

          <Field label="Received by">
            <input
              value={payReceivedBy}
              onChange={(e) => setPayReceivedBy(e.target.value)}
              placeholder="Staff name (optional)"
              disabled={savingPayment}
              className="h-11 w-full rounded-xl bg-slate-50 px-4 text-slate-900
                ring-1 ring-slate-100 shadow-sm transition
                focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
            />
          </Field>
        </div>

        <Field label="Slip upload">
          <div className="flex items-center gap-3">
            <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={savingPayment || !openStatement}
                onChange={(e) => setPaySlipFile(e.target.files?.[0] ?? null)}
              />
              Choose file
            </label>

            <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
              <div className="truncate text-sm font-medium text-slate-900">
                {paySlipFile?.name || "No file selected"}
              </div>
              <div className="text-[12px] text-slate-500">
                JPG/PNG/PDF accepted
              </div>
            </div>

            {paySlipFile ? (
              <button
                type="button"
                onClick={() => setPaySlipFile(null)}
                disabled={savingPayment || !openStatement}
                className="h-11 rounded-xl bg-slate-50 px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
              >
                Clear
              </button>
            ) : null}
          </div>
        </Field>

        <Field label="Note">
          <textarea
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            placeholder="Optional note"
            rows={3}
            disabled={savingPayment || !openStatement}
            className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-900
              ring-1 ring-slate-100 shadow-sm transition
              focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={savingPayment || !openStatement}
            className="h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0
              bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600"
          >
            {savingPayment ? "Saving…" : "Save payment"}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={savingPayment || !leaseId}
            className="h-11 rounded-xl bg-slate-50 px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Refresh
          </button>

          {canCreateNextStatement ? (
            <span className="ml-auto inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">
              Latest statement is PAID • Next:{" "}
              <span className="ml-1 tabular-nums text-amber-950/80">
                {nextMonthKeySuggestion}
              </span>
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
