"use client";

import { AvatarGlow, EmptyState } from "@/components/design-system";
import { EmployeePortalMobileNav } from "@/components/employee-portal/EmployeePortalMobileNav";
import { EmployeePortalHeader } from "@/components/employee-portal/EmployeePortalHeader";
import mobileNavStyles from "@/components/employee-portal/EmployeePortalMobileNav.module.css";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { SalarySlipDocument } from "@/components/salary-slips/SalarySlipDocument";
import {
  useEmployeeQuery,
  useGeneratedSlipForEmployeeQuery,
  useSalarySlipsByRecordQuery,
} from "@/hooks/queries";
import { employeePhotoUrl } from "@/lib/employees/photo";
import { formatMvr } from "@/lib/salary-slips/format";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Minus,
  Plus,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import surface from "../employee-portal-surface.module.css";
import styles from "./salary-slips.module.css";

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

/** "2026-08" → "Aug 2026" */
function formatPeriodShort(periodLabel: string): string {
  const display = formatPeriodDisplay(periodLabel);
  const [month, year] = display.split(" ");
  return year ? `${month.slice(0, 3)} ${year}` : display;
}

const MONTH_TONES = ["annual", "present", "late", "leave"] as const;

/** Rotates the calendar-page colors month by month so the history list varies. */
function monthTone(periodLabel: string): (typeof MONTH_TONES)[number] {
  const month = parseInt(periodLabel.slice(5, 7), 10);
  return MONTH_TONES[(Number.isFinite(month) ? month - 1 : 0) % MONTH_TONES.length];
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

  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const slipRef = useRef<HTMLDivElement>(null);

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

  const loadPdfTooling = async () => {
    // Make sure the slip's custom (Latin + Dhivehi) fonts are loaded before
    // html2canvas snapshots the DOM, otherwise it captures fallback fonts.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }
    return (await import("html2pdf.js")).default;
  };

  const pdfOptions = () => ({
    margin: 0,
    filename: `${slip!.staff.name} - ${slip!.periodTitle}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 794,
      windowHeight: 1123,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  });

  const handleDownload = async () => {
    if (!slipRef.current || !slip) return;
    setBusy("download");
    try {
      const html2pdf = await loadPdfTooling();
      await html2pdf().set(pdfOptions()).from(slipRef.current).save();
    } finally {
      setBusy(null);
    }
  };

  const handleView = async () => {
    if (!slipRef.current || !slip) return;
    setBusy("view");
    try {
      const html2pdf = await loadPdfTooling();
      const url: string = await html2pdf()
        .set(pdfOptions())
        .from(slipRef.current)
        .output("bloburl");
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(null);
    }
  };

  if (isError || (!employeePending && !employee)) {
    return (
      <div className={cn(surface.page, "px-4 py-6")}>
        <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>
        <div className="mx-auto max-w-3xl">
          <BackButton onClick={() => router.push("/employees/details")} />
          <EmptyState
            icon={User}
            title="Employee not found"
            description="The employee you're looking for doesn't exist or has been removed."
          />
        </div>
      </div>
    );
  }

  const photoUrl = employee ? employeePhotoUrl(id, employee.photoKey) : undefined;
  const [currentYear] = currentPeriod.split("-");
  const latestPeriod = uploadedCurrent.length || (slip && hasAttendance) ? currentPeriod : history[0]?.periodLabel;

  // Group the visible page of history by year for the year dividers.
  const historyByYear = pageItems.reduce<Array<{ year: string; slips: UploadedSlip[] }>>((groups, item) => {
    const year = item.periodLabel.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.slips.push(item);
    else groups.push({ year, slips: [item] });
    return groups;
  }, []);

  return (
    <div className={cn(surface.page, mobileNavStyles.pageWithMobileNav, "px-4")}>
      {/* Hide the app's mobile header on this page only */}
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>

      <div className={cn(surface.shell, "max-w-3xl space-y-5")}>
        <EmployeePortalHeader backHref={`/employees/details/${id}?tab=pay`} />

        {/* Hero */}
        <section className={cn(surface.hero, styles.hero)}>
          <p className={styles.eyebrow}>
            <Wallet className="h-4 w-4" />
            Salary slips
          </p>
          <div className={styles.heroMain}>
            {employee ? (
              <AvatarGlow
                name={employee.name}
                size="lg"
                src={photoUrl}
                className={cn(surface.avatar, styles.heroAvatar)}
              />
            ) : (
              <div className={cn(styles.heroAvatar, "animate-pulse rounded-full bg-white/70")} />
            )}
            <div className="min-w-0">
              <h1 className={styles.heroName}>{employee?.name ?? "Loading"}</h1>
              {recordCard ? <span className={styles.recordPill}>Record card #{recordCard}</span> : null}
            </div>
          </div>
          <div className={styles.heroStats}>
            <div className={cn(surface.softTile, styles.heroStat)}>
              <span className={cn(motifs.glossIcon, styles.heroStatIcon)} data-tone="annual">
                <FileText />
              </span>
              <strong>{allUploaded.length}</strong>
              <small>Slips on file</small>
            </div>
            <div className={cn(surface.softTile, styles.heroStat)}>
              <span className={cn(motifs.glossIcon, styles.heroStatIcon)} data-tone="leave">
                <CalendarDays />
              </span>
              <strong>{latestPeriod ? formatPeriodShort(latestPeriod) : "—"}</strong>
              <small>Latest slip</small>
            </div>
          </div>
        </section>

        {/* Pinned: current month slip */}
        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.monthHead}>
            <div className={cn(motifs.calendarPage, styles.monthPage)} data-tone="present" aria-hidden="true">
              <span className={motifs.calendarPageTop}>{currentYear}</span>
              <strong>{MONTH_NAMES[now.getMonth()]?.slice(0, 3)}</strong>
            </div>
            <div className="min-w-0">
              <span className={styles.thisMonthTag}>This month</span>
              <h2 className={styles.panelTitle}>{currentMonthTitle}</h2>
            </div>
          </div>

          {/* Uploaded PDF for current month, if any */}
          {uploadedCurrent.length > 0 ? (
            <div className={styles.uploadedList}>
              {uploadedCurrent.map((u, index) => (
                <UploadedRow key={`${u.periodLabel}-${u.fileName ?? index}`} slip={u} />
              ))}
            </div>
          ) : null}

          {slipPending ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
              <div className="h-11 animate-pulse rounded-full bg-slate-100" />
            </div>
          ) : slip && hasAttendance ? (
            <>
              <div className={styles.netTile}>
                <span className={cn(motifs.glossIcon, styles.netIcon)} data-tone="present">
                  <Wallet />
                </span>
                <div className="min-w-0">
                  <small>Net pay</small>
                  <p className={styles.netAmount}>
                    <span>MVR</span>
                    {formatMvr(slip.netIncome)}
                  </p>
                </div>
              </div>
              <div className={styles.summaryTiles}>
                <SummaryTile icon={Plus} tone="leave" label="Allowances" value={slip.totalAllowances} />
                <SummaryTile icon={Minus} tone="late" label="Deductions" value={slip.totalDeductions} />
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={handleView}
                  disabled={busy !== null}
                  className={styles.viewButton}
                >
                  {busy === "view" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  View
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={busy !== null}
                  className={styles.downloadButton}
                >
                  {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download
                </button>
              </div>

              {/* Off-screen capture node — A4-sized so the PDF fills one page like print */}
              <div
                aria-hidden
                className="pointer-events-none fixed left-[-10000px] top-0 -z-10"
              >
                <div ref={slipRef} className="slip-pdf-export">
                  <SalarySlipDocument slip={slip} />
                </div>
              </div>
            </>
          ) : uploadedCurrent.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={cn(motifs.glossIcon, styles.emptyIcon)} data-tone="pending">
                <FileText />
              </span>
              <p>No slip for {currentMonthTitle} yet</p>
              <small>
                Attendance for this month hasn&apos;t been added yet. The slip will appear here once
                attendance is recorded.
              </small>
            </div>
          ) : null}
        </section>

        {/* History */}
        <section className={cn(surface.surface, styles.panel)}>
          <div className={styles.historyHead}>
            <h2 className={styles.panelTitle}>Slip history</h2>
            {history.length ? (
              <span className={styles.countPill}>
                {history.length} {history.length === 1 ? "slip" : "slips"}
              </span>
            ) : null}
          </div>

          {history.length > 0 ? (
            <>
              <div className={styles.historyGroups}>
                {historyByYear.map((group) => (
                  <div key={group.year}>
                    <p className={styles.yearLabel}>{group.year}</p>
                    <div className={styles.historyList}>
                      {group.slips.map((u, index) => (
                        <div key={`${u.periodLabel}-${u.fileName ?? index}`} className={styles.historyRow}>
                          <div className={cn(motifs.calendarPage, styles.historyPage)} data-tone={monthTone(u.periodLabel)}>
                            <span className={motifs.calendarPageTop}>{u.periodLabel.slice(0, 4)}</span>
                            <strong>{formatPeriodDisplay(u.periodLabel).slice(0, 3)}</strong>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={styles.historyTitle}>{formatPeriodDisplay(u.periodLabel)}</p>
                            {u.fileName ? <p className={styles.historyFile}>{u.fileName}</p> : null}
                          </div>
                          <SlipActions slip={u} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {pageCount > 1 ? (
                <div className={styles.pager}>
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={safePage === 0}
                    onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                    className={styles.pagerButton}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className={styles.pagerLabel}>
                    Page {safePage + 1} of {pageCount}
                  </p>
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setHistoryPage((p) => Math.min(pageCount - 1, p + 1))}
                    className={styles.pagerButton}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.emptyHistory}>No earlier slips available yet.</p>
          )}
        </section>
      </div>
      {id ? <EmployeePortalMobileNav employeeId={id} active="pay" /> : null}
    </div>
  );
}

function SlipActions({ slip }: { slip: UploadedSlip }) {
  return (
    <div className={styles.rowActions}>
      {slip.viewUrl ? (
        <a
          href={slip.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.circleButton}
          aria-label="View slip"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      {slip.downloadUrl ? (
        <a
          href={slip.downloadUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={cn(styles.circleButton, styles.circleButtonDark)}
          aria-label="Download slip"
        >
          <Download className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}

function UploadedRow({ slip }: { slip: UploadedSlip }) {
  return (
    <div className={styles.historyRow}>
      <span className={cn(motifs.glossIcon, styles.uploadedIcon)} data-tone="annual">
        <FileText />
      </span>
      <div className="min-w-0 flex-1">
        <p className={styles.historyTitle}>Uploaded PDF</p>
        {slip.fileName ? <p className={styles.historyFile}>{slip.fileName}</p> : null}
      </div>
      <SlipActions slip={slip} />
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: "leave" | "late";
  label: string;
  value: number;
}) {
  return (
    <div className={styles.summaryTile} data-tone={tone}>
      <span className={cn(motifs.glossIcon, styles.summaryIcon)} data-tone={tone}>
        <Icon />
      </span>
      <div className="min-w-0">
        <small>{label}</small>
        <strong>{formatMvr(value)}</strong>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(surface.back, "flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95")}
      aria-label="Back"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
