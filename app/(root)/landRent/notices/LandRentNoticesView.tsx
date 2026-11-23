"use client";

import { PageHeader } from "@/components/design-system/page-header";
import { PageShell } from "@/components/design-system/page-shell";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import LandRentNoticeLetter from "@/components/landRent/Notices/LandRentNoticeLetter";
import { downloadLandNoticePdfs } from "@/components/landRent/Notices/landRentNoticePdf";
import {
  filterOverviewRows,
  fmtMoney,
  getOutstandingNow,
  type LandRentOverviewUIRow,
} from "@/components/landRent/Overview/landRentOverview.utils";
import { useLandNoticesQuery, useLandRentOverviewQuery } from "@/hooks/queries";
import { createLandNotices, deleteLandNotice } from "@/lib/landrent/landRentNotice.actions";
import {
  LAND_NOTICE_TYPE_LABELS,
  LAND_NOTICE_TYPES,
  nextLandNoticeType,
  type LandNotice,
  type LandNoticeLeaseSnapshot,
  type LandNoticeType,
} from "@/lib/landrent/landRentNotice.types";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { useUser } from "@/Providers/UserProvider";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  Download,
  Eye,
  FileStack,
  Gavel,
  Loader2,
  PartyPopper,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import styles from "./notices.module.css";

type TypeMode = "AUTO" | LandNoticeType;
type Icon = React.ComponentType<{ className?: string }>;
type GlossTone = "leave" | "late" | "rose" | "annual" | "present" | "pending";

const HISTORY_PAGE = 20;
const DUE_IN_OPTIONS = [7, 14, 30];

const LEVEL: Record<LandNoticeType, { icon: Icon; tone: GlossTone; rung: string; short: string }> = {
  REMINDER: { icon: Bell, tone: "leave", rung: "1", short: "Reminder" },
  SECOND: { icon: TriangleAlert, tone: "late", rung: "2", short: "Second" },
  FINAL: { icon: Gavel, tone: "rose", rung: "F", short: "Final" },
};

/* ------------------------------ helpers ------------------------------ */

function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : null;
}

function ymdOrNull(value: string | null | undefined) {
  const s = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function fmtDay(ymd: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const s = ymdOrNull(ymd);
  if (!s) return "-";
  return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}

function hasBalance(row: LandRentOverviewUIRow) {
  return getOutstandingNow(row) > 0.005;
}

function snapshotOf(row: LandRentOverviewUIRow): LandNoticeLeaseSnapshot {
  return {
    leaseId: row.leaseId,
    landName: row.landName ?? "",
    tenantName: row.tenantName ?? "",
    agreementNumber: row.agreementNumber ?? "",
    monthlyRent: Number(row.monthlyRent ?? 0),
    outstanding: Math.round(getOutstandingNow(row) * 100) / 100,
    lastPaymentDate: ymdOrNull(row.lastPaymentDate),
    paymentDueDay: Number(row.paymentDueDay ?? 10),
  };
}

/* --------------------------- small pieces ---------------------------- */

function GlossTile({ tone, icon: IconCmp, className }: { tone: GlossTone; icon: Icon; className?: string }) {
  return (
    <span
      className={cn(motifs.glossIcon, tone === "rose" && styles.roseTone, className)}
      data-tone={tone === "rose" ? undefined : tone}
      aria-hidden
    >
      <IconCmp />
    </span>
  );
}

function LevelPill({ type }: { type: LandNoticeType }) {
  return (
    <span className={styles.pill} data-level={type}>
      {LAND_NOTICE_TYPE_LABELS[type]}
    </span>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  unit,
  detail,
  meter,
}: {
  icon: Icon;
  tone: GlossTone;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  meter?: number;
}) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <GlossTile tone={tone} icon={icon} className={styles.statIcon} />
      <div className={styles.statBody}>
        <p className={styles.label}>{label}</p>
        <p className={styles.statValue}>
          {value}
          {unit ? <small dir="auto">{unit}</small> : null}
        </p>
        {meter !== undefined ? (
          <div className={styles.meter} aria-hidden>
            <span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
          </div>
        ) : null}
        <p className={styles.statDetail}>{detail}</p>
      </div>
    </div>
  );
}

function CalendarPage({ ymd, band, due }: { ymd: string; band: string; due?: boolean }) {
  return (
    <div className={cn(motifs.calendarPage, styles.calendarPage, due && styles.calendarDue)}>
      <span className={motifs.calendarPageTop}>{band}</span>
      <strong dir="auto">{fmtDay(ymd, { day: "numeric" })}</strong>
      <small dir="auto">{fmtDay(ymd, { month: "short", year: "numeric" })}</small>
    </div>
  );
}

/** Reached steps of the current run are glossy; the step this notice would take is dashed. */
function Ladder({ reached, next }: { reached: LandNoticeType | null; next: LandNoticeType | null }) {
  const reachedIndex = reached ? LAND_NOTICE_TYPES.indexOf(reached) : -1;
  return (
    <span className={styles.ladder} aria-label={reached ? `Latest: ${LAND_NOTICE_TYPE_LABELS[reached]}` : "No notices in this run"}>
      {LAND_NOTICE_TYPES.map((type, index) => (
        <span key={type} className="contents">
          {index ? <span className={styles.rungLine} aria-hidden /> : null}
          <span
            className={styles.rung}
            data-level={type}
            data-state={index <= reachedIndex ? "done" : type === next ? "next" : "todo"}
            title={LAND_NOTICE_TYPE_LABELS[type]}
          >
            {LEVEL[type].rung}
          </span>
        </span>
      ))}
    </span>
  );
}

function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className={styles.backdrop} />
      <div className={styles.dialog} style={{ maxWidth: wide ? 1024 : 520 }}>
        <div className={styles.dialogHead}>
          <div className={styles.dialogTitle}>{title}</div>
          <button type="button" onClick={onClose} className={styles.iconBtn} aria-label="Close">
            <X />
          </button>
        </div>
        <div className={styles.dialogBody}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- page -------------------------------- */

export function LandRentNoticesView() {
  const { isAdmin } = useUser();
  const queryClient = useQueryClient();
  const overview = useLandRentOverviewQuery();
  const noticesQuery = useLandNoticesQuery();

  const rows = useMemo(() => (overview.data ?? []) as LandRentOverviewUIRow[], [overview.data]);
  const notices = useMemo(() => noticesQuery.data ?? [], [noticesQuery.data]);

  const [q, setQ] = useState("");
  const [onlyWithBalance, setOnlyWithBalance] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [typeMode, setTypeMode] = useState<TypeMode>("AUTO");
  const [issueDate, setIssueDate] = useState(() => localYmd());
  const [dueDate, setDueDate] = useState(() => addDays(localYmd(), 7));
  const [note, setNote] = useState("");

  const [previewRow, setPreviewRow] = useState<LandRentOverviewUIRow | null>(null);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState<LandNotice | null>(null);
  const [previewNotice, setPreviewNotice] = useState<LandNotice | null>(null);

  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ tone: "ok" | "warn" | "error"; text: string; details: string[] } | null>(null);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const cancelled = useRef(false);

  // Notices arrive newest first, so the first one seen per lease is its latest.
  const { latestByLease, countByLease } = useMemo(() => {
    const latest = new Map<string, LandNotice>();
    const count = new Map<string, number>();
    for (const notice of notices) {
      if (!latest.has(notice.leaseId)) latest.set(notice.leaseId, notice);
      count.set(notice.leaseId, (count.get(notice.leaseId) ?? 0) + 1);
    }
    return { latestByLease: latest, countByLease: count };
  }, [notices]);

  const typeFor = (row: LandRentOverviewUIRow): LandNoticeType =>
    typeMode === "AUTO" ? nextLandNoticeType(latestByLease.get(row.leaseId), row.lastPaymentDate) : typeMode;

  /** The level this lease has reached in its current run, or null if it paid since. */
  const reachedFor = (row: LandRentOverviewUIRow): LandNoticeType | null => {
    const latest = latestByLease.get(row.leaseId);
    if (!latest) return null;
    const paid = ymdOrNull(row.lastPaymentDate);
    return paid && paid > latest.issueDate ? null : latest.noticeType;
  };

  const rowsWithBalance = useMemo(() => rows.filter(hasBalance), [rows]);
  const visibleRows = useMemo(() => {
    const base = onlyWithBalance ? rowsWithBalance : rows;
    return filterOverviewRows(base, q).slice().sort((a, b) => getOutstandingNow(b) - getOutstandingNow(a));
  }, [rows, rowsWithBalance, onlyWithBalance, q]);
  const selectableVisible = visibleRows.filter(hasBalance);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((r) => selected.has(r.leaseId));

  const rowsById = useMemo(() => new Map(rows.map((r) => [r.leaseId, r])), [rows]);
  const selectedRows = Array.from(selected)
    .map((id) => rowsById.get(id))
    .filter((r): r is LandRentOverviewUIRow => !!r && hasBalance(r));
  const selectedTotal = selectedRows.reduce((sum, r) => sum + getOutstandingNow(r), 0);

  const thisMonth = localYmd().slice(0, 7);
  const stats = {
    leases: rowsWithBalance.length,
    outstanding: rowsWithBalance.reduce((sum, r) => sum + getOutstandingNow(r), 0),
    noticesThisMonth: notices.filter((n) => n.issueDate.startsWith(thisMonth)).length,
    finals: rowsWithBalance.filter((r) => reachedFor(r) === "FINAL").length,
  };

  const busy = progress !== null;
  const dateError =
    !issueDate || !dueDate
      ? "Choose both dates."
      : dueDate < issueDate
        ? "The pay-by date can't be before the issue date."
        : null;
  const dueInDays = daysBetween(issueDate, dueDate);

  const toggle = (leaseId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(leaseId)) next.delete(leaseId);
      else next.add(leaseId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) selectableVisible.forEach((r) => next.delete(r.leaseId));
      else selectableVisible.forEach((r) => next.add(r.leaseId));
      return next;
    });
  };

  const changeIssueDate = (value: string) => {
    const gap = daysBetween(issueDate, dueDate);
    setIssueDate(value);
    if (value && gap !== null && gap >= 0) setDueDate(addDays(value, gap));
  };

  const confirmRows = (confirmIds ?? [])
    .map((id) => rowsById.get(id))
    .filter((r): r is LandRentOverviewUIRow => !!r && hasBalance(r));
  const confirmTypeCounts = LAND_NOTICE_TYPES.map((type) => ({
    type,
    count: confirmRows.filter((r) => typeFor(r) === type).length,
  })).filter((entry) => entry.count > 0);

  const downloadNotices = async (list: LandNotice[], label: string) => {
    cancelled.current = false;
    setProgress({ label, done: 0, total: list.length });
    try {
      return await downloadLandNoticePdfs(list, {
        onProgress: (done) => setProgress({ label, done, total: list.length }),
        isCancelled: () => cancelled.current,
      });
    } finally {
      setProgress(null);
    }
  };

  const createNotices = async () => {
    if (!confirmRows.length || dateError || busy) return;
    const leases = confirmRows;
    setConfirmIds(null);
    setResult(null);
    setProgress({ label: "Saving notices", done: 0, total: leases.length });
    let created: LandNotice[] = [];
    try {
      created = await createLandNotices({
        issueDate,
        dueDate,
        note,
        notices: leases.map((row) => ({ ...snapshotOf(row), noticeType: typeFor(row) })),
      });
      queryClient.setQueryData<LandNotice[]>(queryKeys.landRent.notices, (current) => [...created, ...(current ?? [])]);
      setSelected((current) => {
        const next = new Set(current);
        leases.forEach((r) => next.delete(r.leaseId));
        return next;
      });
    } catch (error) {
      setProgress(null);
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Could not create the notices.", details: [] });
      return;
    }

    try {
      const { saved, failed } = await downloadNotices(created, "Preparing PDF");
      const first = created[0].noticeNumber;
      const last = created[created.length - 1].noticeNumber;
      const range = created.length === 1 ? first : `${first} to ${last}`;
      const stopped = cancelled.current ? " Download stopped early; download the rest from the history below." : "";
      setResult({
        tone: failed.length || cancelled.current ? "warn" : "ok",
        text: `Created ${created.length} ${created.length === 1 ? "notice" : "notices"} (${range}) and downloaded ${saved} PDF${saved === 1 ? "" : "s"}.${stopped}`,
        details: failed,
      });
    } catch (error) {
      setResult({
        tone: "warn",
        text: `The notices were saved, but the PDF download failed: ${error instanceof Error ? error.message : "unknown error"}. Download them from the history below.`,
        details: [],
      });
    }
  };

  const redownload = async (notice: LandNotice) => {
    if (busy) return;
    setResult(null);
    try {
      const { failed } = await downloadNotices([notice], "Preparing PDF");
      if (failed.length) setResult({ tone: "error", text: "Could not create the PDF.", details: failed });
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Could not create the PDF.", details: [] });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await deleteLandNotice(target.$id);
      queryClient.setQueryData<LandNotice[]>(queryKeys.landRent.notices, (current) =>
        (current ?? []).filter((n) => n.$id !== target.$id),
      );
      setResult({ tone: "ok", text: `Deleted notice ${target.noticeNumber}.`, details: [] });
    } catch (error) {
      setResult({ tone: "error", text: error instanceof Error ? error.message : "Could not delete the notice.", details: [] });
    }
  };

  const loading = overview.isLoading;
  const balancesAt = overview.dataUpdatedAt
    ? new Date(overview.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const modeOptions: Array<{ value: TypeMode; label: string; icon: Icon; tone: GlossTone }> = [
    { value: "AUTO", label: "Next step for each", icon: Sparkles, tone: "annual" },
    ...LAND_NOTICE_TYPES.map((type) => ({ value: type, label: LAND_NOTICE_TYPE_LABELS[type], icon: LEVEL[type].icon, tone: LEVEL[type].tone })),
  ];

  return (
    <PageShell>
      <div className={styles.page}>
        <PageHeader
          icon={BellRing}
          title="Rent Notices"
          subtitle="Send payment notices to lease holders who haven't paid, or paid late and owe fines"
          className="mb-8"
          actions={
            <button
              type="button"
              onClick={() => void overview.refetch()}
              disabled={overview.isFetching || busy}
              className={styles.btn}
            >
              <RefreshCw className={cn(overview.isFetching && "animate-spin")} />
              {balancesAt ? `Balances as of ${balancesAt}` : "Refresh balances"}
            </button>
          }
        />

        {/* Stats */}
        <div className={styles.stats}>
          <StatCard
            icon={Wallet}
            tone="late"
            label="Leases owing"
            value={loading ? "…" : String(stats.leases)}
            unit={loading ? undefined : `of ${rows.length}`}
            meter={rows.length ? (stats.leases / rows.length) * 100 : 0}
            detail="Unpaid rent or late-payment fines"
          />
          <StatCard
            icon={CalendarClock}
            tone="rose"
            label="Total outstanding"
            value={loading ? "…" : fmtMoney(stats.outstanding)}
            unit="MVR"
            detail="Across every lease that owes"
          />
          <StatCard
            icon={FileStack}
            tone="leave"
            label="Notices this month"
            value={noticesQuery.isLoading ? "…" : String(stats.noticesThisMonth)}
            detail={`${notices.length} issued in total`}
          />
          <StatCard
            icon={Gavel}
            tone="annual"
            label="Past final notice"
            value={loading || noticesQuery.isLoading ? "…" : String(stats.finals)}
            detail="Still owing after a final notice"
          />
        </div>

        {overview.error ? (
          <div className={styles.status} data-tone="error" role="alert">
            {overview.error.message || "Could not load the leases."}
          </div>
        ) : null}

        {/* Compose */}
        <section className={styles.compose} aria-label="Notice details">
          <div className={styles.composeMain}>
            <div>
              <h2 className={styles.composeTitle}>Notice details</h2>
              <p className={styles.composeSub}>These apply to every notice you create below.</p>
            </div>

            <div>
              <p className={styles.label}>Notice type</p>
              <div className={styles.presets} role="radiogroup" aria-label="Notice type">
                {modeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={typeMode === option.value}
                    data-active={typeMode === option.value}
                    onClick={() => setTypeMode(option.value)}
                    className={styles.preset}
                  >
                    <GlossTile tone={option.tone} icon={option.icon} className={styles.presetIcon} />
                    {option.label}
                  </button>
                ))}
              </div>
              <p className={styles.presetHint}>
                {typeMode === "AUTO"
                  ? "First reminder, then second, then final. A lease starts over at a reminder once it pays."
                  : `Every notice will be a ${LAND_NOTICE_TYPE_LABELS[typeMode].toLowerCase()}.`}
              </p>
            </div>

            <div>
              <p className={styles.label}>When</p>
              <div className={styles.dates}>
                <label className={styles.dateField} htmlFor="notice-issue-date">
                  <span>Issued</span>
                  <input
                    id="notice-issue-date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => changeIssueDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </label>
                <span className={styles.dateArrow} aria-hidden>→</span>
                <label className={styles.dateField} htmlFor="notice-due-date">
                  <span>Pay by</span>
                  <input
                    id="notice-due-date"
                    type="date"
                    value={dueDate}
                    min={issueDate || undefined}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </label>
                <div className={styles.presets} style={{ marginTop: 0 }}>
                  {DUE_IN_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      data-plain="true"
                      data-active={dueInDays === days}
                      onClick={() => setDueDate(addDays(issueDate, days))}
                      className={styles.preset}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
              {dateError ? <p className={cn(styles.hint, "mt-2")} role="alert">{dateError}</p> : null}
            </div>

            <label className="block">
              <span className={styles.label}>Extra note · optional, in Dhivehi</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                dir="rtl"
                rows={2}
                maxLength={1000}
                placeholder="ނޯޓިހުގައި ހިމަނަންވީ އިތުރު މަޢުލޫމާތު"
                className={cn(styles.note, "font-dh1")}
              />
            </label>
          </div>

          {issueDate && dueDate && !dateError ? (
            <div className={styles.calendars} aria-label={`Issued ${fmtDay(issueDate)}, pay by ${fmtDay(dueDate)}`}>
              <CalendarPage ymd={issueDate} band="Issued" />
              <div className={styles.calendarJoin}>
                <strong dir="auto">{dueInDays}</strong>
                {dueInDays === 1 ? "day" : "days"}
                <span aria-hidden>→</span>
              </div>
              <CalendarPage ymd={dueDate} band="Pay by" due />
            </div>
          ) : null}
        </section>

        {/* Progress / result */}
        {progress ? (
          <div className={styles.status} role="status">
            <Loader2 className="h-4 w-4 animate-spin text-[#2f9c80]" />
            <span>
              {progress.label}
              {progress.total > 1 ? ` ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ""}…
            </span>
            <div className={styles.progress} aria-hidden>
              <span style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
            {progress.label !== "Saving notices" && progress.total > 1 ? (
              <button type="button" onClick={() => { cancelled.current = true; }} className={styles.linkBtn}>
                Stop
              </button>
            ) : null}
          </div>
        ) : null}
        {result ? (
          <div className={styles.status} data-tone={result.tone} role={result.tone === "error" ? "alert" : "status"}>
            <div className="min-w-0 flex-1">
              {result.text}
              {result.details.length ? (
                <ul>
                  {result.details.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : null}
            </div>
            <button type="button" onClick={() => setResult(null)} aria-label="Dismiss" className={styles.iconBtn}>
              <X />
            </button>
          </div>
        ) : null}

        {/* Leases */}
        <section className={styles.register} aria-label="Leases">
          <div className={styles.registerHead}>
            <div>
              <h2 className={styles.registerTitle}>Leases</h2>
              <p className={styles.registerSub}>
                {isAdmin ? "Tap leases to pick them, or send to everyone who owes." : "Leases and the notice each would get next."}
              </p>
            </div>
            <div className={styles.tools}>
              <div className={styles.search}>
                <Search />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search land, renter, agreement…"
                  aria-label="Search leases"
                />
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={onlyWithBalance}
                data-on={onlyWithBalance}
                onClick={() => setOnlyWithBalance((v) => !v)}
                className={styles.toggle}
              >
                <span className={styles.switch} aria-hidden />
                Owing only
              </button>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allVisibleSelected}
                    onClick={toggleAllVisible}
                    disabled={selectableVisible.length === 0 || busy}
                    className={styles.selectAll}
                  >
                    <span className={styles.check} data-on={allVisibleSelected} aria-hidden>
                      {allVisibleSelected ? <Check /> : null}
                    </span>
                    Select all ({selectableVisible.length})
                  </button>
                  <button
                    type="button"
                    data-tone="rose"
                    onClick={() => setConfirmIds(rowsWithBalance.map((r) => r.leaseId))}
                    disabled={rowsWithBalance.length === 0 || busy || !!dateError || loading}
                    className={styles.btn}
                  >
                    <BellRing />
                    Send to all {loading ? "" : rowsWithBalance.length} owing
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className={styles.registerBody}>
            {loading ? (
              <div className={styles.empty}>
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading leases…
              </div>
            ) : visibleRows.length === 0 ? (
              <div className={styles.empty}>
                <GlossTile tone="present" icon={PartyPopper} className={styles.emptyIcon} />
                {onlyWithBalance && !q ? "Every lease is paid up. No notices needed." : "No leases match your search."}
              </div>
            ) : (
              <ul className={styles.list}>
                {visibleRows.map((row) => {
                  const owes = hasBalance(row);
                  const isSelected = selected.has(row.leaseId);
                  const selectable = isAdmin && owes && !busy;
                  const nextType = typeFor(row);
                  const level = LEVEL[nextType];
                  const latest = latestByLease.get(row.leaseId);
                  const count = countByLease.get(row.leaseId) ?? 0;
                  const label = row.agreementNumber || row.landName || "lease";
                  return (
                    <li
                      key={row.leaseId}
                      dir="rtl"
                      className={styles.lease}
                      data-selectable={selectable}
                      data-selected={isSelected}
                      data-paid={!owes}
                      onClick={(e) => {
                        if (!selectable || (e.target as HTMLElement).closest("button")) return;
                        toggle(row.leaseId);
                      }}
                    >
                      <div className={styles.leaseLead}>
                        {isAdmin ? (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Select ${label}`}
                            disabled={!selectable}
                            onClick={() => toggle(row.leaseId)}
                            className={styles.check}
                            data-on={isSelected}
                            data-disabled={!selectable}
                          >
                            {isSelected ? <Check /> : null}
                          </button>
                        ) : null}
                        <GlossTile
                          tone={owes ? level.tone : "present"}
                          icon={owes ? level.icon : Check}
                          className={styles.levelIcon}
                        />
                      </div>

                      <div className={styles.who} dir="rtl">
                        <div className={cn(styles.whoLand, "font-dh1")}>{row.landName || "-"}</div>
                        <div className={cn(styles.whoTenant, "font-dh1")}>{row.tenantName || "-"}</div>
                        <span className={styles.whoAgreement} dir="ltr">{row.agreementNumber || "No agreement no."}</span>
                      </div>

                      <div className={styles.facts}>
                        <div className={styles.fact}>
                          <span className={styles.label}>Owes</span>
                          <strong dir="auto" data-tone={owes ? "owes" : "clear"}>{fmtMoney(getOutstandingNow(row))}</strong>
                          <small dir="auto">MVR</small>
                        </div>
                        <div className={styles.fact}>
                          <span className={styles.label}>Last paid</span>
                          <strong dir="auto">{ymdOrNull(row.lastPaymentDate) ? fmtDay(row.lastPaymentDate) : "Never"}</strong>
                          <small>Due by day {row.paymentDueDay ?? 10}</small>
                        </div>
                        <div className={styles.fact}>
                          <span className={styles.label}>Notices</span>
                          <Ladder reached={reachedFor(row)} next={owes ? nextType : null} />
                          <small dir="auto" title={latest ? `${latest.noticeNumber} · ${LAND_NOTICE_TYPE_LABELS[latest.noticeType]}` : undefined}>
                            {latest ? `${count} sent · last ${fmtDay(latest.issueDate, { day: "numeric", month: "short" })}` : "None yet"}
                          </small>
                        </div>
                      </div>

                      <div className={styles.actions}>
                        {owes ? <LevelPill type={nextType} /> : <span className={styles.pill} data-level="PAID">Paid up</span>}
                        {owes ? (
                          <button
                            type="button"
                            onClick={() => setPreviewRow(row)}
                            className={styles.iconBtn}
                            aria-label={`Preview notice for ${label}`}
                            title="Preview notice"
                          >
                            <Eye />
                          </button>
                        ) : null}
                        {owes && isAdmin ? (
                          <button
                            type="button"
                            data-tone="green"
                            data-size="sm"
                            onClick={() => setConfirmIds([row.leaseId])}
                            disabled={busy || !!dateError}
                            className={styles.btn}
                          >
                            <Send />
                            Create
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {isAdmin && selectedRows.length > 0 ? (
            <div className={styles.selectBar}>
              <div>
                <p>
                  {selectedRows.length} {selectedRows.length === 1 ? "lease" : "leases"} picked · MVR {fmtMoney(selectedTotal)}
                </p>
                <small>
                  <button type="button" onClick={() => setSelected(new Set())} className={styles.linkBtn}>
                    Clear selection
                  </button>
                </small>
              </div>
              <button
                type="button"
                data-tone="green"
                onClick={() => setConfirmIds(selectedRows.map((r) => r.leaseId))}
                disabled={busy || !!dateError}
                className={styles.btn}
              >
                <Send />
                Create {selectedRows.length} {selectedRows.length === 1 ? "notice" : "notices"}
              </button>
            </div>
          ) : null}
        </section>

        {/* History */}
        <section className={styles.register} aria-label="Notices issued">
          <div className={styles.registerHead}>
            <div>
              <h2 className={styles.registerTitle}>Notices issued</h2>
              <p className={styles.registerSub}>Each keeps the figures it was created with. Download it again any time.</p>
            </div>
          </div>
          <div className={styles.registerBody}>
            {noticesQuery.isLoading ? (
              <div className={styles.empty}>
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading notices…
              </div>
            ) : noticesQuery.error ? (
              <div className={styles.status} data-tone="error" role="alert">
                {noticesQuery.error.message || "Could not load notices."}
              </div>
            ) : notices.length === 0 ? (
              <div className={styles.empty}>
                <GlossTile tone="pending" icon={FileStack} className={styles.emptyIcon} />
                No notices issued yet.
              </div>
            ) : (
              <>
                <ul className={styles.list}>
                  {notices.slice(0, historyLimit).map((notice) => (
                    <li key={notice.$id} dir="rtl" className={styles.notice}>
                      <div
                        className={cn(motifs.calendarPage, styles.noticeDate)}
                        data-tone={notice.noticeType === "REMINDER" ? "leave" : notice.noticeType === "SECOND" ? "late" : undefined}
                        style={notice.noticeType === "FINAL" ? ({ "--band": "#ffe4ea", "--band-ink": "#b23a55" } as React.CSSProperties) : undefined}
                      >
                        <span className={motifs.calendarPageTop}>{fmtDay(notice.issueDate, { weekday: "short" })}</span>
                        <strong dir="auto">{fmtDay(notice.issueDate, { day: "numeric" })}</strong>
                        <small dir="auto">{fmtDay(notice.issueDate, { month: "short", year: "2-digit" })}</small>
                      </div>

                      <div className="min-w-0">
                        <div className={styles.noticeHead}>
                          <span dir="ltr" className={styles.noticeNumber}>{notice.noticeNumber}</span>
                          <LevelPill type={notice.noticeType} />
                        </div>
                        <div className={cn(styles.noticeWho, "font-dh1")} dir="rtl">
                          {notice.landName || "-"} · {notice.tenantName || "-"}
                        </div>
                      </div>

                      <div className={styles.facts}>
                        <div className={styles.fact}>
                          <span className={styles.label}>Asked for</span>
                          <strong dir="auto">{fmtMoney(notice.outstanding)}</strong>
                          <small dir="auto">MVR</small>
                        </div>
                        <div className={styles.fact}>
                          <span className={styles.label}>Pay by</span>
                          <strong dir="auto">{fmtDay(notice.dueDate, { day: "numeric", month: "short" })}</strong>
                          <small dir="auto">{fmtDay(notice.dueDate, { year: "numeric" })}</small>
                        </div>
                        <div className={styles.fact}>
                          <span className={styles.label}>Agreement</span>
                          <strong dir="auto">{notice.agreementNumber || "-"}</strong>
                          <small dir="auto">{notice.createdBy ? `By ${notice.createdBy}` : " "}</small>
                        </div>
                      </div>

                      <div className={styles.actions}>
                        <button
                          type="button"
                          onClick={() => setPreviewNotice(notice)}
                          className={styles.iconBtn}
                          aria-label={`View ${notice.noticeNumber}`}
                          title="View"
                        >
                          <Eye />
                        </button>
                        <button
                          type="button"
                          onClick={() => void redownload(notice)}
                          disabled={busy}
                          className={styles.iconBtn}
                          aria-label={`Download ${notice.noticeNumber}`}
                          title="Download PDF"
                        >
                          <Download />
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            data-tone="rose"
                            onClick={() => setDeleting(notice)}
                            disabled={busy}
                            className={styles.iconBtn}
                            aria-label={`Delete ${notice.noticeNumber}`}
                            title="Delete"
                          >
                            <Trash2 />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {notices.length > historyLimit ? (
                  <div className={styles.more}>
                    <button type="button" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)} className={styles.btn}>
                      Show {Math.min(HISTORY_PAGE, notices.length - historyLimit)} older
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        {/* Preview a new notice */}
        {previewRow ? (
          <Modal title="Notice preview" onClose={() => setPreviewRow(null)} wide>
            <p className={styles.previewNote}>The notice number is assigned when you create it.</p>
            <LandRentNoticeLetter
              notice={{ ...snapshotOf(previewRow), noticeNumber: null, noticeType: typeFor(previewRow), issueDate, dueDate, note }}
            />
          </Modal>
        ) : null}

        {/* View an issued notice */}
        {previewNotice ? (
          <Modal title={`Notice ${previewNotice.noticeNumber}`} onClose={() => setPreviewNotice(null)} wide>
            <LandRentNoticeLetter notice={previewNotice} />
          </Modal>
        ) : null}

        {/* Confirm create */}
        {confirmIds ? (
          <Modal title="Create notices" onClose={() => setConfirmIds(null)}>
            {confirmRows.length === 0 ? (
              <p>None of these leases owe anything now, so there is nothing to send.</p>
            ) : (
              <>
                <p>
                  Each notice gets the next number and is saved, then the{" "}
                  {confirmRows.length === 1 ? "PDF downloads" : "PDFs download as one zip"}.
                </p>
                <div className={styles.summary}>
                  {confirmTypeCounts.map(({ type, count }) => (
                    <div key={type} className={styles.summaryRow}>
                      <LevelPill type={type} />
                      <strong>× {count}</strong>
                    </div>
                  ))}
                  <div className={styles.summaryRow}>
                    <span>Issued → pay by</span>
                    <strong>
                      {fmtDay(issueDate)} → {fmtDay(dueDate)}
                      {dueInDays !== null ? ` · ${dueInDays} days` : ""}
                    </strong>
                  </div>
                  <div className={cn(styles.summaryRow, styles.summaryTotal)}>
                    <span>Total asked for</span>
                    <strong>MVR {fmtMoney(confirmRows.reduce((s, r) => s + getOutstandingNow(r), 0))}</strong>
                  </div>
                </div>
              </>
            )}
            <div className={styles.dialogFoot}>
              <button type="button" onClick={() => setConfirmIds(null)} className={styles.btn}>
                Cancel
              </button>
              <button
                type="button"
                data-tone="green"
                onClick={() => void createNotices()}
                disabled={confirmRows.length === 0 || !!dateError || busy}
                className={styles.btn}
              >
                <Send />
                Create {confirmRows.length > 1 ? confirmRows.length : ""} and download
              </button>
            </div>
          </Modal>
        ) : null}

        {/* Confirm delete */}
        {deleting ? (
          <Modal title="Delete notice" onClose={() => setDeleting(null)}>
            <p>
              Delete notice <strong dir="auto">{deleting.noticeNumber}</strong>? It is removed from the history and its number is not
              reused. This can&apos;t be undone.
            </p>
            <div className={styles.dialogFoot}>
              <button type="button" onClick={() => setDeleting(null)} className={styles.btn}>
                Cancel
              </button>
              <button type="button" data-tone="rose" onClick={() => void confirmDelete()} className={styles.btn}>
                <Trash2 />
                Delete
              </button>
            </div>
          </Modal>
        ) : null}
      </div>
    </PageShell>
  );
}
