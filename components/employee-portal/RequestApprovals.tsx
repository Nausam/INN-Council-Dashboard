"use client";

import {
  decideApprovalRequest,
  getPendingApprovalCount,
  listApprovalInbox,
  type ApprovalInbox,
  type ApprovalRequest,
} from "@/lib/actions/request-approvals.actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REQUEST_VISUALS } from "@/lib/employees/request-visuals";
import { cn } from "@/lib/utils";
import { Check, ClipboardCheck, ClipboardList, FileBadge, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import headerStyles from "./EmployeePortalHeader.module.css";
import motifs from "./portal-motifs.module.css";
import styles from "./RequestApprovals.module.css";

const REQUEST_TYPES = {
  salaam: "Salaam leave",
  family: "Family leave",
  annual: "Annual leave",
  ot: "Overtime",
} as const;

// The header remounts on every tab change; reuse the count for a couple of minutes.
const COUNT_CACHE_MS = 2 * 60_000;
let cachedCount: { at: number; value: number | null } | null = null;

function rememberCount(value: number | null) {
  cachedCount = { at: Date.now(), value };
}

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Indian/Maldives",
  }).format(date);
}

function localDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Approvals button in the Employee Profile header for the leave supervisors
 * and other approvers. Everyone else gets nothing: the count comes back null
 * for them.
 */
export function RequestApprovalsButton() {
  const [count, setCountState] = useState<number | null>(() => cachedCount?.value ?? null);
  const [open, setOpen] = useState(false);
  const setCount = useCallback((value: number | null) => {
    rememberCount(value);
    setCountState(value);
  }, []);

  useEffect(() => {
    if (cachedCount && Date.now() - cachedCount.at < COUNT_CACHE_MS) return;
    let active = true;
    getPendingApprovalCount()
      .then((value) => { if (active) setCount(value); })
      // Offline or signed out: just leave the bell hidden.
      .catch(() => undefined);
    return () => { active = false; };
  }, [setCount]);

  if (count === null) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(headerStyles.actionButton, styles.bell)}
        aria-label={count > 0 ? `Approvals, ${count} waiting` : "Approvals"}
      >
        {count > 0 ? <ClipboardList /> : <ClipboardCheck />}
        <span>Approvals</span>
        {count > 0 ? <b className={styles.badge} aria-hidden="true">{count > 9 ? "9+" : count}</b> : null}
      </button>
      {open ? <ApprovalInboxDialog onClose={() => setOpen(false)} onCountChange={setCount} /> : null}
    </>
  );
}

function ApprovalInboxDialog({
  onClose,
  onCountChange,
}: {
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [inbox, setInbox] = useState<ApprovalInbox | null>(null);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await listApprovalInbox();
      setInbox(next);
      onCountChange(next.pending.filter((request) => !request.own).length);
    } catch {
      setError("Could not load requests. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { void load(); }, [load]);

  const list = inbox ? (tab === "pending" ? inbox.pending : inbox.reviewed) : [];

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={styles.dialog} overlayClassName="bg-black/40">
        <DialogHeader className={styles.header}>
          <span className={cn(motifs.glossIcon, styles.headIcon)} data-tone="annual" aria-hidden="true">
            <ClipboardCheck />
          </span>
          <div className={styles.headText}>
            <DialogTitle className={styles.title}>Approvals</DialogTitle>
            <DialogDescription className={styles.subtitle}>Requests from staff waiting for a decision</DialogDescription>
          </div>
        </DialogHeader>

        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Request status">
            <button type="button" role="tab" aria-selected={tab === "pending"} className={styles.tab} onClick={() => setTab("pending")}>
              Pending <span>{inbox?.pending.length ?? 0}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "reviewed"} className={styles.tab} onClick={() => setTab("reviewed")}>
              Reviewed
            </button>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className={styles.refresh} aria-label="Refresh requests">
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
          </button>
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {!inbox && loading ? (
          <div className={styles.cards}><div className={styles.skeleton} /><div className={styles.skeleton} /></div>
        ) : inbox && list.length === 0 ? (
          <p className={styles.empty}>{tab === "pending" ? "All caught up. No requests are waiting." : "Nothing reviewed yet."}</p>
        ) : inbox ? (
          <div className={styles.cards}>
            {list.map((request) => (
              <ApprovalCard
                key={`${request.kind}-${request.id}`}
                request={request}
                inbox={inbox}
                onDecided={load}
              />
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApprovalCard({
  request,
  inbox,
  onDecided,
}: {
  request: ApprovalRequest;
  inbox: ApprovalInbox;
  onDecided: () => Promise<void>;
}) {
  const visual = REQUEST_VISUALS[request.kind];
  const isLeave = request.kind !== "ot";
  const pending = request.status === "Pending";
  const [signer, setSigner] = useState<string>(request.signerKey ?? inbox.viewerSupervisorKey ?? "");
  const [busy, setBusy] = useState<"Approved" | "Rejected" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [error, setError] = useState("");

  const pageDate = localDate(request.startDate) ?? localDate(request.submittedAt);
  const isDhivehiReason = /[ހ-޿]/u.test(request.reason ?? "");
  const range = request.startDate
    ? `${dateLabel(request.startDate)}${request.endDate && request.endDate !== request.startDate ? ` – ${dateLabel(request.endDate)}` : ""}`
    : `Submitted ${dateLabel(request.submittedAt)}`;
  const extent = request.kind === "ot"
    ? request.startTime && request.endTime ? `${request.startTime} – ${request.endTime}` : null
    : request.totalDays ? `${request.totalDays} ${request.totalDays === 1 ? "day" : "days"}` : null;

  const decide = async (status: "Approved" | "Rejected") => {
    if (status === "Rejected" && !confirmReject) {
      setConfirmReject(true);
      return;
    }
    setBusy(status);
    setError("");
    try {
      const result = await decideApprovalRequest({ kind: request.kind, id: request.id, status, signerKey: signer || undefined });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await onDecided();
    } catch {
      setError("Could not update this request. Check your connection and try again.");
    } finally {
      setBusy(null);
      setConfirmReject(false);
    }
  };

  return (
    <article className={styles.card} data-tone={visual.tone} data-status={request.status}>
      <div className={styles.cardHeader}>
        {pageDate ? (
          <div className={cn(motifs.calendarPage, styles.datePage)} data-tone={visual.tone} aria-hidden="true">
            <span className={motifs.calendarPageTop}>{pageDate.toLocaleDateString("en-US", { month: "short" })}</span>
            <strong>{pageDate.getDate()}</strong>
          </div>
        ) : null}
        <div className={styles.cardMain}>
          <div className={styles.titleRow}>
            <h3>{request.certificateUrl ? "Certificate salaam" : REQUEST_TYPES[request.kind]}</h3>
            <span className={styles.statusBadge}><span className={styles.statusDot} aria-hidden="true" />{request.status}</span>
          </div>
          <p className={styles.names}>{request.employeeNames.join(", ") || "Unknown employee"}</p>
          <p className={styles.dateLine}>
            {range}
            {extent ? <span className={styles.duration}>{extent}</span> : null}
          </p>
          {request.reason ? (
            <p
              dir={isDhivehiReason ? "rtl" : "auto"}
              lang={isDhivehiReason ? "dv" : undefined}
              className={isDhivehiReason ? styles.dhivehiReason : styles.reason}
              title={request.reason}
            >{request.reason}</p>
          ) : null}
          {request.certificateUrl ? (
            <a href={request.certificateUrl} target="_blank" rel="noreferrer" className={styles.certificateLink}>
              <FileBadge size={14} aria-hidden="true" /> View certificate
            </a>
          ) : null}
        </div>
      </div>

      {!pending ? (
        <p className={styles.reviewNote}>
          {request.status}{request.reviewer ? ` by ${request.reviewer}` : ""}
          {request.reviewedAt ? ` · ${dateLabel(request.reviewedAt)}` : ""}
        </p>
      ) : request.own ? (
        <p className={styles.reviewNote}>Your own request. Another approver needs to review it.</p>
      ) : (
        <div className={styles.decision}>
          {isLeave ? (
            <label className={styles.signer}>
              <span>Signed by</span>
              <select value={signer} onChange={(event) => setSigner(event.target.value)} disabled={Boolean(busy)}>
                <option value="">Choose a supervisor</option>
                {inbox.supervisors.map((supervisor) => (
                  <option key={supervisor.key} value={supervisor.key}>{supervisor.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.reject}
              data-confirm={confirmReject || undefined}
              onClick={() => void decide("Rejected")}
              onBlur={() => setConfirmReject(false)}
              disabled={Boolean(busy)}
            >
              {busy === "Rejected" ? <Loader2 className="animate-spin" /> : <X />}
              {confirmReject ? "Tap to confirm" : "Reject"}
            </button>
            <button
              type="button"
              className={styles.approve}
              onClick={() => void decide("Approved")}
              disabled={Boolean(busy) || (isLeave && !signer)}
            >
              {busy === "Approved" ? <Loader2 className="animate-spin" /> : <Check />}
              Approve
            </button>
          </div>
          {error ? <p className={styles.cardError} role="alert">{error}</p> : null}
        </div>
      )}
    </article>
  );
}
