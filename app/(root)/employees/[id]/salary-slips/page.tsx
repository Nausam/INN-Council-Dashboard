"use client";

import { AvatarGlow, EmptyState } from "@/components/design-system";
import { SalarySlipDocument } from "@/components/salary-slips/SalarySlipDocument";
import {
  useEmployeeQuery,
  useGeneratedSlipForEmployeeQuery,
  useSalarySlipsByRecordQuery,
} from "@/hooks/queries";
import { formatMvr } from "@/lib/salary-slips/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Printer,
  User,
  Wallet,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

type UploadedSlip = {
  periodLabel: string;
  fileName?: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

const MONTH_NAMES = [
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

const HISTORY_PAGE_SIZE = 6;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatPeriodDisplay(periodLabel: string): string {
  const m = periodLabel.match(/^(\d{4})-(\d{2})$/);
  if (!m) return periodLabel;
  const idx = parseInt(m[2], 10) - 1;
  return `${MONTH_NAMES[idx] ?? m[2]} ${m[1]}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default function EmployeeSalarySlipsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const now = new Date();
  const currentPeriod = monthKey(now);
  const currentMonthTitle = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const [printing, setPrinting] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);

  const { data: employee, isPending: employeePending, isError } =
    useEmployeeQuery(id);
  const recordCard = asString(
    (employee as { recordCardNumber?: string } | undefined)?.recordCardNumber,
  );

  const { data: slip = null, isPending: slipPending } =
    useGeneratedSlipForEmployeeQuery(currentPeriod, id);
  const { data: uploadedData } = useSalarySlipsByRecordQuery(recordCard);

  const allUploaded = useMemo(
    () => (uploadedData?.slips ?? []) as UploadedSlip[],
    [uploadedData],
  );

  const uploadedCurrent = useMemo(
    () => allUploaded.filter((s) => s.periodLabel === currentPeriod),
    [allUploaded, currentPeriod],
  );

  const history = useMemo(
    () =>
      allUploaded
        .filter((s) => s.periodLabel !== currentPeriod)
        .sort((a, b) => b.periodLabel.localeCompare(a.periodLabel)),
    [allUploaded, currentPeriod],
  );

  const pageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(historyPage, pageCount - 1);
  const pageItems = history.slice(
    safePage * HISTORY_PAGE_SIZE,
    safePage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
  );

  const hasAttendance = useMemo(() => {
    const a = slip?.attendanceSummary;
    if (!a) return false;
    return (
      a.presentDays > 0 ||
      a.absentDays > 0 ||
      a.totalMinutesLate > 0 ||
      a.benefitPresentDays > 0
    );
  }, [slip]);

  const handlePrint = () => {
    if (!slip) return;
    flushSync(() => setPrinting(true));
    window.print();
  };

  useEffect(() => {
    const reset = () => setPrinting(false);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  if (isError || (!employeePending && !employee)) {
    return (
      <div className="min-h-screen bg-[#f4f6f4] px-4 py-6">
        <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
        <div className="mx-auto max-w-3xl">
          <BackButton onClick={() => router.back()} />
          <EmptyState
            icon={User}
            title="Employee not found"
            description="The employee you're looking for doesn't exist or has been removed."
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-[#f4f6f4] px-4 pb-12 pt-6",
        printing && "salary-slip-print-mode-single",
      )}
    >
      {/* Hide the app's mobile header on this page only */}
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>

      <div className="mx-auto max-w-3xl space-y-5">
        <BackButton onClick={() => router.back()} />

        {/* Hero */}
        <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-100">
          <div className="bg-gradient-to-br from-teal-600 to-emerald-500 px-6 py-6 text-white">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white/80">
              <Wallet className="h-4 w-4" />
              Salary slips
            </p>
            <div className="mt-3 flex items-center gap-4">
              {employee ? (
                <AvatarGlow
                  name={employee.name}
                  size="lg"
                  className="h-16 w-16 rounded-[22px] text-2xl ring-4 ring-white/30"
                />
              ) : (
                <div className="h-16 w-16 animate-pulse rounded-[22px] bg-white/30" />
              )}
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black tracking-tight">
                  {employee?.name ?? "Loading"}
                </h1>
                <p className="truncate text-sm font-bold text-white/85">
                  {recordCard ? `Record card #${recordCard}` : ""}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pinned: current month slip */}
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-teal-700">
              This month
            </span>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {currentMonthTitle}
            </h2>
          </div>

          {/* Uploaded PDF for current month, if any */}
          {uploadedCurrent.length > 0 ? (
            <div className="mb-3 space-y-2">
              {uploadedCurrent.map((u, index) => (
                <UploadedRow key={`${u.periodLabel}-${u.fileName ?? index}`} slip={u} />
              ))}
            </div>
          ) : null}

          {slipPending ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : slip && hasAttendance ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <SummaryTile
                  label="Allowances"
                  value={slip.totalAllowances}
                  tone="text-emerald-600"
                />
                <SummaryTile
                  label="Deductions"
                  value={slip.totalDeductions}
                  tone="text-rose-600"
                />
                <SummaryTile
                  label="Net pay"
                  value={slip.netIncome}
                  tone="text-teal-700"
                  strong
                />
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-teal-600 text-sm font-bold text-white shadow-sm shadow-teal-600/25 transition active:scale-[0.98]"
              >
                <Printer className="h-4 w-4" />
                View / Download PDF
              </button>

              {/* Print area — off-screen on screen, fills the A4 page when printing */}
              <div className="salary-slip-print-area salary-slip-print-single fixed left-[-10000px] top-0">
                <SalarySlipDocument slip={slip} />
              </div>
            </>
          ) : uploadedCurrent.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-sm font-black text-slate-700">
                No slip for {currentMonthTitle}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                Attendance for this month hasn&apos;t been added yet. The slip
                will appear here once attendance is recorded.
              </p>
            </div>
          ) : null}
        </section>

        {/* History */}
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-4 text-lg font-black tracking-tight text-slate-900">
            Slip history
          </h2>

          {history.length > 0 ? (
            <>
              <div className="space-y-2">
                {pageItems.map((u, index) => (
                  <div
                    key={`${u.periodLabel}-${u.fileName ?? index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">
                          {formatPeriodDisplay(u.periodLabel)}
                        </p>
                        {u.fileName ? (
                          <p className="truncate text-xs font-bold text-slate-400">
                            {u.fileName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {u.viewUrl ? (
                        <a
                          href={u.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
                          aria-label="View slip"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                      {u.downloadUrl ? (
                        <a
                          href={u.downloadUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm shadow-teal-600/25 transition active:scale-95"
                          aria-label="Download slip"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {pageCount > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={safePage === 0}
                    onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="text-xs font-bold text-slate-400">
                    Page {safePage + 1} of {pageCount}
                  </p>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={safePage >= pageCount - 1}
                    onClick={() =>
                      setHistoryPage((p) => Math.min(pageCount - 1, p + 1))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-30"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">
              No earlier slips available yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function UploadedRow({ slip }: { slip: UploadedSlip }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">Uploaded PDF</p>
          {slip.fileName ? (
            <p className="truncate text-xs font-bold text-slate-400">
              {slip.fileName}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {slip.viewUrl ? (
          <a
            href={slip.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
          >
            <ExternalLink className="h-4 w-4" />
            View
          </a>
        ) : null}
        {slip.downloadUrl ? (
          <a
            href={slip.downloadUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-full bg-teal-600 px-3 text-sm font-bold text-white shadow-sm shadow-teal-600/25 transition active:scale-95"
          >
            <Download className="h-4 w-4" />
            Save
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-3 text-center",
        strong ? "bg-teal-50 ring-1 ring-teal-100" : "bg-slate-50",
      )}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={cn("mt-1 text-sm font-black tabular-nums", tone)}>
        {formatMvr(value)}
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
      aria-label="Back"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
