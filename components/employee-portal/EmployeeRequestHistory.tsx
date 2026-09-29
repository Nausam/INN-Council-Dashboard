"use client";

import {
  listEmployeeRequestHistory,
  type RequestHistoryEntry,
  type RequestHistoryKind,
} from "@/lib/actions/request-history.actions";
import {
  ArrowDownToLine, ArrowRight, CalendarDays, RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./EmployeeRequestHistory.module.css";

type Filter = "all" | RequestHistoryKind;
const TABS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "salaam", label: "Salaam" },
  { key: "family", label: "Family" },
  { key: "annual", label: "Annual leave" },
  { key: "ot", label: "Overtime" },
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

function HistoryCard({ entry }: { entry: RequestHistoryEntry }) {
  const isDhivehiReason = /[\u0780-\u07bf]/u.test(entry.reason ?? "");
  const reviewed = entry.status !== "Pending";
  const reviewDetail = [
    entry.reviewer ? `by ${entry.reviewer}` : null,
    entry.reviewedAt ? dateLabel(entry.reviewedAt) : null,
  ].filter(Boolean).join(" · ");

  return (
    <article className={styles.card} data-status={entry.status}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <h3>{REQUEST_TYPES[entry.kind]}</h3>
        </div>
        <span className={styles.statusBadge}>
          <span className={styles.statusDot} aria-hidden="true" />{entry.status}
        </span>
      </div>

      {entry.startDate ? (
        <div className={styles.dateLine}>
          <CalendarDays size={15} aria-hidden="true" />
          <span>{dateLabel(entry.startDate)}{entry.endDate && entry.endDate !== entry.startDate ? ` – ${dateLabel(entry.endDate)}` : ""}</span>
          {entry.totalDays ? <span className={styles.duration}>{entry.totalDays} {entry.totalDays === 1 ? "day" : "days"}</span> : null}
        </div>
      ) : null}
      {entry.reason ? (
        <div className={styles.reasonLine}>
          <span className={styles.reasonLabel}>Reason</span>
          <p
            dir={isDhivehiReason ? "rtl" : "auto"}
            lang={isDhivehiReason ? "dv" : undefined}
            className={isDhivehiReason ? styles.dhivehiReason : styles.reason}
          >{entry.reason}</p>
        </div>
      ) : null}

      <div className={styles.progress} aria-label="Request progress">
        <div className={styles.progressStep}>
          <span className={styles.progressMarker} aria-hidden="true" />
          <div className={styles.progressCopy}><strong>Requested</strong><span>{dateLabel(entry.submittedAt)}</span></div>
        </div>
        <ArrowRight className={styles.progressArrow} size={15} aria-hidden="true" />
        <div className={styles.progressStep} data-step-status={entry.status}>
          <span className={styles.progressMarker} aria-hidden="true" />
          <div className={styles.progressCopy}>
            <strong>{entry.status === "Pending" ? "Awaiting approval" : entry.status}</strong>
            {reviewed && reviewDetail ? <span>{reviewDetail}</span> : null}
          </div>
        </div>
      </div>

      {entry.kind === "annual" && entry.status === "Approved" ? (
        entry.chitAvailable ? (
          <a href={`/api/employee-requests/annual/${encodeURIComponent(entry.id)}/chit`} className={styles.chitLink}>
            <ArrowDownToLine size={15} aria-hidden="true" /><span>Download leave chit PDF</span>
          </a>
        ) : <p className={styles.chitPending}>Leave chit is being prepared.</p>
      ) : null}
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
        <div><p className={styles.eyebrow}>Your requests</p><h2 id="request-history-title">Request history</h2></div>
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
        <div role="tabpanel" className={styles.cards}>{filtered.slice(0, limit).map((entry) => <HistoryCard key={`${entry.kind}-${entry.id}`} entry={entry} />)}</div>
      ) : <p role="tabpanel" className={styles.empty}>No requests in this tab yet.</p>}
      {!loading && filtered.length > limit ? <button type="button" onClick={() => setLimit((current) => current + 10)} className={styles.showMore}>Show more requests</button> : null}
    </section>
  );
}
