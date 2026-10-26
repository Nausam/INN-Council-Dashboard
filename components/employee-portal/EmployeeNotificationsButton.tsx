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
import { ArrowRight, Bell, BellOff, BellRing, CalendarCheck, Loader2, Smartphone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import headerStyles from "./EmployeePortalHeader.module.css";
import motifs from "./portal-motifs.module.css";
import styles from "./EmployeeNotifications.module.css";

type AlertsState = "loading" | "on" | "off" | "blocked" | "unsupported";

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
}: {
  employeeId: string;
  /** Opens the Requests screen; the bell links there when not given. */
  onOpenRequests?: () => void;
}) {
  const [data, setData] = useState<MyNotifications | null>(() =>
    cached?.employeeId === employeeId ? cached.value : null,
  );
  const [open, setOpen] = useState(false);

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
          onClose={() => setOpen(false)}
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
  onClose,
}: {
  employeeId: string;
  data: MyNotifications | null;
  load: () => Promise<void>;
  remember: (value: MyNotifications) => void;
  onOpenRequests?: () => void;
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

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={styles.dialog} overlayClassName="bg-black/40">
        <DialogHeader className={styles.header}>
          <span className={cn(motifs.glossIcon, styles.headIcon)} data-tone="leave" aria-hidden="true">
            <Bell />
          </span>
          <div className={styles.headText}>
            <DialogTitle className={styles.title}>Notifications</DialogTitle>
            <DialogDescription className={styles.subtitle}>Leave forms and alerts on this phone</DialogDescription>
          </div>
        </DialogHeader>

        <section className={styles.card} aria-label="Missing leave forms">
          <span className={styles.cardLabel}>
            Missing leave forms <small>Last 30 days</small>
          </span>
          {missing === null ? (
            <span className={styles.note}>{loadFailed ? "Couldn't load them. Check your connection." : "Checking your attendance…"}</span>
          ) : missing.length ? (
            <>
              <p className={styles.lead}>
                You were absent on {missing.length === 1 ? "this day" : `these ${missing.length} days`} with no leave form.
                Please submit {missing.length === 1 ? "one" : "them"} in Requests.
              </p>
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
              <button type="button" onClick={openRequests} className={styles.primary}>
                Submit leave forms <ArrowRight />
              </button>
            </>
          ) : (
            <span className={styles.note} data-tone="done">
              <CalendarCheck aria-hidden="true" /> You&rsquo;re all caught up. No missing leave forms.
            </span>
          )}
        </section>

        <section className={styles.card} aria-label="From HR">
          <span className={styles.cardLabel}>From HR</span>
          {!data ? (
            <span className={styles.note}>{loadFailed ? "Couldn't load them. Check your connection." : "Loading…"}</span>
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
            <span className={styles.note}>No messages from HR yet.</span>
          )}
        </section>

        <section className={styles.alerts} data-state={alerts} aria-label="Alerts on this phone">
          <span className={styles.alertsIcon} aria-hidden="true">
            {alerts === "on" ? <BellRing /> : alerts === "blocked" ? <BellOff /> : <Smartphone />}
          </span>
          <span className={styles.alertsText}>
            {alerts === "loading"
              ? "Checking this phone…"
              : alerts === "on"
                ? "Alerts are on. HR reminders come to this phone."
                : alerts === "off"
                  ? "Turn on alerts to get HR reminders on this phone."
                  : alerts === "blocked"
                    ? "Notifications are blocked. Allow them for this app in your phone's settings."
                    : "To get alerts on iPhone, add Employee Profile to your Home Screen and open it from there."}
          </span>
          {alerts === "on" || alerts === "off" ? (
            <button
              type="button"
              onClick={() => void (alerts === "on" ? turnOff() : turnOn())}
              disabled={busy}
              className={alerts === "on" ? styles.secondary : styles.primarySmall}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              {alerts === "on" ? "Turn off" : "Turn on"}
            </button>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
