"use client";

import {
  listEmployeeRequestHistory,
  type RequestHistoryEntry,
  type RequestHistoryKind,
} from "@/lib/actions/request-history.actions";
import { ArrowDownToLine, Hourglass, PencilLine, RefreshCw } from "lucide-react";
import motifs from "./portal-motifs.module.css";
import { REQUEST_VISUALS } from "@/lib/employees/request-visuals";
import { useEffect, useMemo, useState } from "react";
import { FamilyLeaveRequestDialog } from "@/components/Leave/FamilyLeaveRequestDialog";
import { EmployeeRequestDialog } from "./EmployeeRequestDialog";
import styles from "./EmployeeRequestHistory.module.css";

type Filter = "all" | RequestHistoryKind;
const TABS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "salaam", label: "Salaam" },
  { key: "family", label: "Family" },
  { key: "annual", label: "Annual" },
  { key: "ot", label: "OT" },
];
const REQUEST_TYPES = {
  salaam: "Salaam leave",
  family: "Family leave",
  annual: "Annual leave",
  ot: "Overtime",
} as const;

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Indian/Maldives",
  }).format(date);
}

/** Parses a YYYY-MM-DD or ISO string as a local date for the calendar page. */
function localDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "29 Sept 2026" → "29 Sept" for the compact progress line. */
function shortDate(value?: string): string {
  return dateLabel(value).replace(/\s\d{4}$/, "");
}

function HistoryCard({ entry, onEdit }: { entry: RequestHistoryEntry; onEdit: (entry: RequestHistoryEntry) => void }) {
  const isDhivehiReason = /[ހ-޿]/u.test(entry.reason ?? "");
  // Same color as the request card above, so each entry is recognisable by type.
  const visual = REQUEST_VISUALS[entry.kind];
  const pageDate = localDate(entry.startDate) ?? localDate(entry.submittedAt);
  const range = entry.startDate
    ? `${dateLabel(entry.startDate)}${entry.endDate && entry.endDate !== entry.startDate ? ` – ${dateLabel(entry.endDate)}` : ""}`
    : `Submitted ${dateLabel(entry.submittedAt)}`;
  const days = entry.totalDays ? `${entry.totalDays} ${entry.totalDays === 1 ? "day" : "days"}` : null;
  // The reviewer's name goes in the tooltip so the progress line stays on one row.
  const reviewTitle = entry.reviewer ? `${entry.status} by ${entry.reviewer}` : undefined;
  const showChit = entry.kind === "annual" && entry.status === "Approved";

  return (
    <article className={styles.card} data-status={entry.status} data-tone={visual.tone}>
      <div className={styles.cardHeader}>
        {pageDate ? (
          <div className={`${motifs.calendarPage} ${styles.datePage}`} data-tone={visual.tone} aria-hidden="true">
            <span className={motifs.calendarPageTop}>
              {pageDate.toLocaleDateString("en-US", { month: "short" })}
            </span>
            <strong>{pageDate.getDate()}</strong>
          </div>
        ) : null}
        <div className={styles.cardMain}>
          <div className={styles.titleRow}>
            <h3>{REQUEST_TYPES[entry.kind]}</h3>
            <span className={styles.statusBadge}>
              <span className={styles.statusDot} aria-hidden="true" />{entry.status}
            </span>
          </div>
          <p className={styles.dateLine}>
            {range}
            {days ? <span className={styles.duration}>{days}</span> : null}
          </p>
          {entry.reason ? (
            <p
              dir={isDhivehiReason ? "rtl" : "auto"}
              lang={isDhivehiReason ? "dv" : undefined}
              className={isDhivehiReason ? styles.dhivehiReason : styles.reason}
              title={entry.reason}
            >{entry.reason}</p>
          ) : null}
        </div>
      </div>

      <div className={styles.cardFooter}>
        <ol className={styles.progress} aria-label="Request progress">
          <li className={styles.progressStep} data-step-status="done">
            <span className={styles.progressDot} aria-hidden="true" />
            Requested <span>{shortDate(entry.submittedAt)}</span>
          </li>
          <li className={styles.progressStep} data-step-status={entry.status} title={reviewTitle}>
            <span className={styles.progressDot} aria-hidden="true" />
            {entry.status === "Pending" ? "Awaiting approval" : entry.status}
            {entry.status !== "Pending" && entry.reviewedAt ? <span>{shortDate(entry.reviewedAt)}</span> : null}
          </li>
        </ol>
        {entry.editable || showChit ? (
          <div className={styles.actions}>
            {entry.editable ? (
              <button type="button" onClick={() => onEdit(entry)} className={styles.editButton} aria-label="Edit request">
                <PencilLine size={14} aria-hidden="true" /><span>Edit</span>
              </button>
            ) : null}
            {showChit ? (
              entry.chitAvailable ? (
                <a
                  href={`/api/employee-requests/annual/${encodeURIComponent(entry.id)}/chit`}
                  className={styles.chitLink}
                  aria-label="Download leave chit"
                >
                  <ArrowDownToLine size={14} aria-hidden="true" /><span>Chit</span>
                </a>
              ) : <span className={styles.chitPending} title="Leave chit is being prepared"><Hourglass size={12} aria-hidden="true" /> Chit soon</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function EmployeeRequestHistory({ employeeId, revision }: { employeeId: string; revision: number }) {
  const [entries, setEntries] = useState<RequestHistoryEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(10);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<RequestHistoryEntry | null>(null);
  // Kept stable per entry so the open dialog doesn't reset while typing.
  const editRequest = useMemo(() => editing ? {
    id: editing.id,
    startDate: editing.startDate ?? "",
    endDate: editing.endDate ?? editing.startDate ?? "",
    reason: editing.reason ?? "",
    takeoverEmployeeId: editing.takeoverEmployeeId,
    startTime: editing.startTime,
    endTime: editing.endTime,
  } : undefined, [editing]);
  const closeEdit = (open: boolean) => { if (!open) setEditing(null); };
  const afterEdit = () => setRefresh((value) => value + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void listEmployeeRequestHistory(employeeId)
      .then((history) => { if (active) setEntries(history); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load request history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employeeId, revision, refresh]);

  const filtered = filter === "all" ? entries : entries.filter((entry) => entry.kind === filter);
  return (
    <section className={styles.section} aria-labelledby="request-history-title">
      <div className={styles.sectionHeader}>
        <div><h2 id="request-history-title">Request history</h2><p className={styles.subtitle}>Track what you&apos;ve asked for</p></div>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} aria-label="Refresh request history" className={styles.refreshButton}><RefreshCw size={17} aria-hidden="true" /></button>
      </div>
      <div role="tablist" aria-label="Request types" className={styles.tabs}>
        {TABS.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={filter === tab.key} onClick={() => { setFilter(tab.key); setLimit(10); }} className={styles.tab}>
            {tab.label}<span>{tab.key === "all" ? entries.length : entries.filter((entry) => entry.kind === tab.key).length}</span>
          </button>
        ))}
      </div>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {loading ? (
        <div className={styles.cards}>{Array.from({ length: 2 }).map((_, index) => <div key={index} className={styles.skeleton} />)}</div>
      ) : filtered.length ? (
        <div role="tabpanel" className={styles.cards}>{filtered.slice(0, limit).map((entry) => <HistoryCard key={`${entry.kind}-${entry.id}`} entry={entry} onEdit={setEditing} />)}</div>
      ) : <p role="tabpanel" className={styles.empty}>No requests in this tab yet.</p>}
      {!loading && filtered.length > limit ? <button type="button" onClick={() => setLimit((current) => current + 10)} className={styles.showMore}>Show more requests</button> : null}

      {editing && editRequest && (editing.kind === "salaam" || editing.kind === "family") ? (
        <FamilyLeaveRequestDialog
          employeeId={employeeId}
          presetLeaveType={editing.kind}
          editRequest={editRequest}
          open
          onOpenChange={closeEdit}
          onSubmitted={afterEdit}
        />
      ) : null}
      {editing && editRequest && (editing.kind === "annual" || editing.kind === "ot") ? (
        <EmployeeRequestDialog
          employeeId={employeeId}
          mode={editing.kind}
          editRequest={editRequest}
          open
          onOpenChange={closeEdit}
          onSubmitted={afterEdit}
        />
      ) : null}
    </section>
  );
}
