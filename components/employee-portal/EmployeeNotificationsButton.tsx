"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getMyNotifications,
  markMyNotificationsRead,
  type MyNotifications,
} from "@/lib/actions/employee-push.actions";
import {
  disableEmployeePush,
  employeePushEnabled,
  employeePushSupported,
  enableEmployeePush,
  syncEmployeePush,
} from "@/lib/employee-push";
import { cn } from "@/lib/utils";
import { ArrowRight, Bell, BellOff, BellRing, CalendarCheck, Loader2, MessageSquare, Send, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import headerStyles from "./EmployeePortalHeader.module.css";
import motifs from "./portal-motifs.module.css";
import styles from "./EmployeeNotifications.module.css";

type AlertsState = "loading" | "on" | "off" | "blocked" | "unsupported";

// Only HR send reminders, so its dialog loads on first use.
const LeaveReminderDialog = dynamic(() => import("./LeaveReminder").then((mod) => mod.LeaveReminderDialog));

// The header remounts on every tab change; reuse what the bell loaded for a few minutes.
const CACHE_MS = 5 * 60_000;
let cached: { employeeId: string; at: number; value: MyNotifications } | null = null;

function sentLabel(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "Indian/Maldives" });
}

function dayParts(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: date.getUTCDate(),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

async function readAlertsState(): Promise<AlertsState> {
  if (!employeePushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return (await employeePushEnabled()) ? "on" : "off";
}

/**
 * The signed-in employee's notification bell. The badge counts HR's unread
 * reminders (a dot when only forms are missing); the panel lists the missing
 * forms, HR's reminders, and this phone's alert setting.
 */
export function EmployeeNotificationsButton({
  employeeId,
  onOpenRequests,
  reminderEmployeeName,
}: {
  employeeId: string;
  /** Opens the Requests screen; the bell links there when not given. */
  onOpenRequests?: () => void;
  /** Set for HR: the panel also sends this employee a leave form reminder. */
  reminderEmployeeName?: string;
}) {
  const [data, setData] = useState<MyNotifications | null>(() =>
    cached?.employeeId === employeeId ? cached.value : null,
  );
  const [open, setOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const remember = useCallback((value: MyNotifications) => {
    cached = { employeeId, at: Date.now(), value };
    setData(value);
  }, [employeeId]);

  const load = useCallback(async () => remember(await getMyNotifications(employeeId)), [employeeId, remember]);

  useEffect(() => {
    if (cached?.employeeId === employeeId && Date.now() - cached.at < CACHE_MS) return;
    // Offline: the bell still opens; the panel loads again.
    void load().catch(() => undefined);
  }, [employeeId, load]);

  // Keeps this phone's saved push address current, as before.
  useEffect(() => {
    void syncEmployeePush(employeeId).catch(() => undefined);
  }, [employeeId]);

  const unread = data?.unread ?? 0;
  const missingCount = data?.missing.length ?? 0;
  const label = [
    unread ? `${unread} new from HR` : "",
    missingCount ? `${missingCount} missing leave ${missingCount === 1 ? "form" : "forms"}` : "",
  ].filter(Boolean).join(", ");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(headerStyles.actionButton, styles.bell)}
        aria-label={label ? `Notifications, ${label}` : "Notifications"}
      >
        {unread || missingCount ? <BellRing /> : <Bell />}
        <span>Notifications</span>
        {unread ? (
          <b className={styles.badge} aria-hidden="true">{unread > 9 ? "9+" : unread}</b>
        ) : missingCount ? (
          <b className={styles.dot} aria-hidden="true" />
        ) : null}
      </button>
      {open ? (
        <NotificationsDialog
          employeeId={employeeId}
          data={data}
          load={load}
          remember={remember}
          onOpenRequests={onOpenRequests}
          onRemind={
            reminderEmployeeName
              ? () => {
                  setOpen(false);
                  setReminderOpen(true);
                }
              : undefined
          }
          onClose={() => setOpen(false)}
        />
      ) : null}
      {reminderOpen && reminderEmployeeName ? (
        <LeaveReminderDialog
          employeeId={employeeId}
          employeeName={reminderEmployeeName}
          onClose={() => setReminderOpen(false)}
        />
      ) : null}
    </>
  );
}

function NotificationsDialog({
  employeeId,
  data,
  load,
  remember,
  onOpenRequests,
  onRemind,
  onClose,
}: {
  employeeId: string;
  data: MyNotifications | null;
  load: () => Promise<void>;
  remember: (value: MyNotifications) => void;
  onOpenRequests?: () => void;
  /** HR only: opens the leave form reminder for this employee. */
  onRemind?: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [loadFailed, setLoadFailed] = useState(false);
  const [alerts, setAlerts] = useState<AlertsState>("loading");
  const [busy, setBusy] = useState(false);

  // The reminders that were new when the panel opened stay highlighted.
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // Fresh each time it opens: a form sent a minute ago clears its day.
    void load().catch(() => setLoadFailed(true));
    void readAlertsState().then(setAlerts).catch(() => setAlerts("unsupported"));
  }, [load]);

  // Opening the panel reads HR's reminders; clear the badge.
  const unread = data?.unread ?? 0;
  useEffect(() => {
    if (!data || !unread) return;
    setNewIds((current) => new Set([...current, ...data.items.slice(0, unread).map((item) => item.id)]));
    remember({ ...data, unread: 0 });
    void markMyNotificationsRead(employeeId).catch(() => undefined);
  }, [data, employeeId, remember, unread]);

  const missing = data?.missing ?? null;
  const items = data?.items ?? [];

  const turnOn = async () => {
    setBusy(true);
    try {
      const permission = await enableEmployeePush(employeeId);
      setAlerts(permission === "granted" ? "on" : permission === "denied" ? "blocked" : "off");
      if (permission === "granted") toast({ title: "Notifications on", description: "HR reminders will now come to this phone." });
    } catch {
      toast({ variant: "destructive", title: "Couldn't turn on notifications", description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disableEmployeePush();
      setAlerts("off");
    } finally {
      setBusy(false);
    }
  };

  const openRequests = () => {
    onClose();
    if (onOpenRequests) onOpenRequests();
    else window.location.assign(`/employees/details/${encodeURIComponent(employeeId)}?tab=requests`);
  };

  const missingCount = missing?.length ?? 0;
  const summary =
    missing === null
      ? loadFailed ? "Couldn't load. Check your connection." : "Checking your attendance…"
      : missingCount
        ? `${missingCount} leave ${missingCount === 1 ? "form" : "forms"} to submit`
        : "You're all caught up";
  const alertsOn = alerts === "on";

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={styles.dialog} overlayClassName="bg-black/40">
        <DialogHeader className={styles.header}>
          <span
            className={cn(motifs.glossIcon, styles.headIcon)}
            data-tone={missingCount ? "late" : "annual"}
            aria-hidden="true"
          >
            {missingCount ? <BellRing /> : <Bell />}
          </span>
          <div className={styles.headText}>
            <DialogTitle className={styles.title}>Notifications</DialogTitle>
            <DialogDescription className={styles.subtitle}>{summary}</DialogDescription>
          </div>
        </DialogHeader>

        {/* Leave forms: the one thing to act on, so it leads. */}
        <section
          className={styles.forms}
          data-state={missing === null ? "loading" : missingCount ? "todo" : "done"}
          aria-label="Missing leave forms"
        >
          {missing === null ? (
            <span className={styles.note}>
              {loadFailed ? "Couldn't load your leave forms." : "Checking your attendance…"}
            </span>
          ) : missingCount ? (
            <>
              <div className={styles.formsHead}>
                <strong>
                  {missingCount === 1 ? "1 absent day" : `${missingCount} absent days`} without a leave form
                </strong>
                <small>Last 30 days</small>
              </div>
              <div className={styles.dayPages}>
                {missing.map((date) => {
                  const parts = dayParts(date);
                  return (
                    <span key={date} className={cn(motifs.calendarPage, styles.dayPage)} data-tone="late" title={date}>
                      <span className={motifs.calendarPageTop}>{parts.weekday}</span>
                      <strong>{parts.day}</strong>
                      <small>{parts.month}</small>
                    </span>
                  );
                })}
              </div>
              <div className={styles.formsActions}>
                <button type="button" onClick={openRequests} className={styles.primary}>
                  Submit {missingCount === 1 ? "leave form" : "leave forms"} <ArrowRight />
                </button>
                {onRemind ? (
                  <button
                    type="button"
                    onClick={onRemind}
                    className={styles.remind}
                    aria-label="Send a leave form reminder to this employee"
                  >
                    <Send /> Remind
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className={styles.done}>
              <span className={cn(motifs.glossIcon, styles.doneIcon)} data-tone="present" aria-hidden="true">
                <CalendarCheck />
              </span>
              <span className={styles.doneText}>
                <strong>No missing leave forms</strong>
                <small>Every absence in the last 30 days is covered.</small>
              </span>
            </div>
          )}
        </section>

        <section className={styles.inboxSection} aria-label="From HR">
          <p className={styles.sectionLabel}>
            From HR
            {items.length ? <span className={styles.sectionCount}>{items.length}</span> : null}
          </p>
          {!data ? (
            <span className={styles.note}>{loadFailed ? "Couldn't load messages." : "Loading…"}</span>
          ) : items.length ? (
            <ul className={styles.inbox}>
              {items.map((item) => (
                <li key={item.id} className={styles.inboxItem} data-new={newIds.has(item.id) ? "" : undefined}>
                  <span className={cn(motifs.glossIcon, styles.inboxIcon)} data-tone="late" aria-hidden="true">
                    <BellRing />
                  </span>
                  <span className={styles.inboxText}>
                    <span className={styles.inboxHead}>
                      <strong>{item.title}</strong>
                      <time dateTime={item.sentAt}>{sentLabel(item.sentAt)}</time>
                    </span>
                    <span>{item.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              <MessageSquare aria-hidden="true" />
              No messages yet. HR reminders will show here.
            </p>
          )}
        </section>

        <section className={styles.alerts} data-state={alerts} aria-label="Alerts on this phone">
          <span
            className={cn(motifs.glossIcon, styles.alertsIcon)}
            data-tone={alertsOn ? "present" : alerts === "blocked" ? "late" : "neutral"}
            aria-hidden="true"
          >
            {alertsOn ? <BellRing /> : alerts === "blocked" ? <BellOff /> : <Smartphone />}
          </span>
          <span className={styles.alertsText}>
            <strong>Alerts on this phone</strong>
            <small>
              {alerts === "loading"
                ? "Checking this phone…"
                : alertsOn
                  ? "HR reminders come to this phone."
                  : alerts === "off"
                    ? "Turn on to get HR reminders here."
                    : alerts === "blocked"
                      ? "Blocked. Allow notifications for this app in your phone's settings."
                      : "On iPhone, add Employee Profile to your Home Screen and open it from there."}
            </small>
          </span>
          {alerts === "on" || alerts === "off" ? (
            <button
              type="button"
              role="switch"
              aria-checked={alertsOn}
              aria-label="Alerts on this phone"
              onClick={() => void (alertsOn ? turnOff() : turnOn())}
              disabled={busy}
              className={styles.switch}
            >
              <span className={styles.switchKnob}>{busy ? <Loader2 className="animate-spin" /> : null}</span>
            </button>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
