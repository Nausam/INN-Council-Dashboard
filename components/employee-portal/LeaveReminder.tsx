"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getLeaveReminderStatus,
  sendLeaveFormReminder,
  type LeaveReminderStatus,
} from "@/lib/actions/employee-push.actions";
import { leaveReminderMessage } from "@/lib/employees/leave-reminder";
import { cn } from "@/lib/utils";
import { BellRing, CalendarCheck, Loader2, Send, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import headerStyles from "./EmployeePortalHeader.module.css";
import motifs from "./portal-motifs.module.css";
import styles from "./LeaveReminder.module.css";

/** HR's header button: ask the employee, on their phone, to submit their missing leave forms. */
export function LeaveReminderButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={headerStyles.actionButton}
        aria-label="Remind to submit leave forms"
      >
        <BellRing />
        <span>Remind</span>
      </button>
      {open ? (
        <LeaveReminderDialog employeeId={employeeId} employeeName={employeeName} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function dayParts(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: date.getUTCDate(),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

function LeaveReminderDialog({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<LeaveReminderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const firstName = employeeName.trim().split(/\s+/)[0] || "This employee";

  useEffect(() => {
    let active = true;
    getLeaveReminderStatus(employeeId)
      .then((value) => { if (active) setStatus(value); })
      .catch(() => { if (active) setError("Couldn't load their missing forms. Try again."); });
    return () => { active = false; };
  }, [employeeId]);

  const dates = status?.dates ?? [];
  const message = dates.length ? leaveReminderMessage(dates) : null;
  const canSend = Boolean(status?.configured && status.devices > 0 && dates.length) && !sending;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendLeaveFormReminder(employeeId);
      if (result.blockedReason) {
        setError(result.blockedReason);
        return;
      }
      if (result.sent > 0) {
        toast({ title: "Reminder sent", description: `${employeeName} will get it on their phone.` });
        onClose();
        return;
      }
      setStatus((current) => (current ? { ...current, devices: 0 } : current));
      setError(`${firstName}'s phone has stopped accepting notifications. Ask them to turn alerts on again.`);
    } catch {
      setError("Couldn't send the reminder. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={styles.dialog} overlayClassName="bg-black/40">
        <DialogHeader className={styles.header}>
          <span className={cn(motifs.glossIcon, styles.headIcon)} data-tone="leave" aria-hidden="true">
            <BellRing />
          </span>
          <div className={styles.headText}>
            <DialogTitle className={styles.title}>Leave form reminder</DialogTitle>
            <DialogDescription className={styles.subtitle}>
              Sends a notification to {employeeName}&rsquo;s phone
            </DialogDescription>
          </div>
        </DialogHeader>

        <section className={styles.days} aria-label="Missing leave forms">
          <span className={styles.daysLabel}>
            Missing leave forms <small>Last 30 days</small>
          </span>
          {!status ? (
            <span className={styles.daysEmpty}>{error ? "—" : "Checking attendance…"}</span>
          ) : dates.length ? (
            <div className={styles.dayPages}>
              {dates.map((date) => {
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
          ) : (
            <span className={styles.daysEmpty}>
              <CalendarCheck aria-hidden="true" /> None. Every absence has leave recorded or requested.
            </span>
          )}
        </section>

        {message ? (
          <div className={styles.preview} aria-label="Notification preview">
            <span className={styles.previewIcon} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pwa/icon-v2-192.png" alt="" />
            </span>
            <span className={styles.previewText}>
              <strong>{message.title}</strong>
              <span>{message.body}</span>
            </span>
          </div>
        ) : null}

        <p className={styles.status} data-state={statusState(status, error)} role={error ? "alert" : undefined}>
          <Smartphone aria-hidden="true" />
          <span>
            {error ??
              (!status
                ? "Checking their phone…"
                : !status.configured
                  ? "Notifications aren't set up on the server yet."
                  : !dates.length
                    ? "Nothing to remind them about."
                    : status.devices === 0
                      ? `${firstName} hasn't turned on alerts yet. Ask them to open Employee Profile and tap Turn on alerts. On iPhone, the app must be added to the Home Screen first.`
                      : `One notification listing ${dates.length === 1 ? "this day" : `all ${dates.length} days`} goes to ${status.devices === 1 ? "their phone" : `${status.devices} phones`}.`)}
          </span>
        </p>

        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.cancel}>Cancel</button>
          <button type="button" onClick={() => void send()} disabled={!canSend} className={styles.send}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            Send reminder
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function statusState(status: LeaveReminderStatus | null, error: string | null): string {
  if (error) return "error";
  if (!status) return "loading";
  return status.configured && status.devices > 0 && status.dates.length ? "ready" : "off";
}
