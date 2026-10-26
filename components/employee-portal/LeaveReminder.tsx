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
import { BellRing, Loader2, Send, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import headerStyles from "./EmployeePortalHeader.module.css";
import motifs from "./portal-motifs.module.css";
import styles from "./LeaveReminder.module.css";

/** HR's header button: ask the employee, on their phone, to submit a leave form. */
export function LeaveReminderButton({
  employeeId,
  employeeName,
  defaultDate,
  maxDate,
}: {
  employeeId: string;
  employeeName: string;
  /** The day to suggest, such as their latest absence. */
  defaultDate: string;
  maxDate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={headerStyles.actionButton}
        aria-label="Remind to submit leave form"
      >
        <BellRing />
        <span>Remind</span>
      </button>
      {open ? (
        <LeaveReminderDialog
          employeeId={employeeId}
          employeeName={employeeName}
          defaultDate={defaultDate}
          maxDate={maxDate}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function LeaveReminderDialog({
  employeeId,
  employeeName,
  defaultDate,
  maxDate,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  defaultDate: string;
  maxDate: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState<LeaveReminderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const firstName = employeeName.trim().split(/\s+/)[0] || "This employee";

  useEffect(() => {
    let active = true;
    getLeaveReminderStatus(employeeId)
      .then((value) => { if (active) setStatus(value); })
      .catch(() => { if (active) setError("Couldn't check their phone. Try again."); });
    return () => { active = false; };
  }, [employeeId]);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const message = validDate ? leaveReminderMessage(date) : null;
  const day = validDate ? new Date(`${date}T00:00:00Z`) : null;
  const canSend = Boolean(status?.configured && status.devices > 0 && validDate && !sending);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendLeaveFormReminder(employeeId, date);
      if (result.sent > 0) {
        toast({ title: "Reminder sent", description: `${employeeName} will get it on their phone.` });
        onClose();
        return;
      }
      setStatus((current) => (current ? { ...current, devices: 0 } : current));
      setError(`${firstName}'s phone has stopped accepting notifications. Ask them to turn alerts on again.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't send the reminder.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className={styles.dialog}
        overlayClassName="bg-black/40"
        // Focusing the date field first would pop up the date picker on phones.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
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

        <label className={styles.dateRow}>
          <div className={cn(motifs.calendarPage, styles.datePage)} data-tone="leave" aria-hidden="true">
            <span className={motifs.calendarPageTop}>
              {day ? day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : "—"}
            </span>
            <strong>{day ? day.getUTCDate() : "?"}</strong>
            <small>{day ? day.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : ""}</small>
          </div>
          <span className={styles.dateText}>
            <span>Day of the leave</span>
            <input
              type="date"
              value={date}
              max={maxDate}
              onChange={(event) => setDate(event.target.value)}
              className={styles.dateInput}
              required
            />
          </span>
        </label>

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
                  : status.devices === 0
                    ? `${firstName} hasn't turned on alerts yet. Ask them to open Employee Profile and tap Turn on alerts. On iPhone, the app must be added to the Home Screen first.`
                    : `Goes to ${status.devices === 1 ? "their phone" : `${status.devices} phones`}.`)}
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
  return status.configured && status.devices > 0 ? "ready" : "off";
}
