"use client";

import { submitFamilyLeaveRequest } from "@/lib/actions/family-leave.actions";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import {
  SALAAM_FAMILY_LEAVE_TYPES,
  type SalaamFamilyLeaveType,
} from "@/lib/leave/salaam-family-types";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import styles from "./family-leave-request.module.css";

export function FamilyLeaveRequestDialog({
  employeeId,
  presetLeaveType,
  open,
  onOpenChange,
  onSubmitted,
}: {
  employeeId: string;
  presetLeaveType?: SalaamFamilyLeaveType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  const [clock, setClock] = useState({ time: "—" });
  const [leaveType, setLeaveType] = useState<SalaamFamilyLeaveType | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function changeOpen(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setSubmitted(false);
      setError("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const today = maldivesDateTime();
    setStartDate((current) => current || today.date);
    setEndDate((current) => current || today.date);
    const updateClock = () => setClock({ time: maldivesDateTime().time });
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!isDhivehiText(reason, 300)) {
      setError("ސަބަބު ދިވެހިން ލިޔުއްވާ.");
      return;
    }
    try {
      parseLeaveDateRange(startDate, endDate);
    } catch {
      setError("ފެށޭ ތާރީޚާއި ނިމޭ ތާރީޚު ރަނގަޅަށް ހޮވާ. 365 ދުވަހަށްވުރެ ދިގު ނުކުރައްވާ.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await submitFamilyLeaveRequest({
        employeeId,
        leaveType: presetLeaveType ?? leaveType,
        reason,
        startDate,
        endDate,
      });
      if (!result.ok) {
        setError("މުވައްޒަފުގެ ނަން، އެޑްރެސް އަދި މަގާމް ދިވެހިން އެޑިޓް ފޯމުން ފުރަމަ ޖެހޭ.");
        return;
      }
      setClock({ time: result.reportedTime });
      setSubmitted(true);
      onSubmitted?.();
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch {
      setError("ފޯމު ފޮނުވަން ނުކުޅުނު. އަލުން ކޮށްލައްވާ.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
    >
      <DialogContent
        dir="rtl"
        lang="dv"
        className={styles.dialog}
        overlayClassName="bg-black/40"
      >
        <DialogHeader className={styles.header}>
          <DialogTitle className={styles.title}>
            {presetLeaveType
              ? `${SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === presetLeaveType)?.labelDv} ޗުއްޓީ`
              : "ޗުއްޓީ އެދޭ ފޯމު"}
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className={styles.success} role="status">
            <p>ފޯމު ފޮނުވުނު.</p>
            <button type="button" onClick={() => changeOpen(false)}>
              ނިންމާ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {!presetLeaveType ? (
              <>
                <label htmlFor="family-leave-type">ޗުއްޓީގެ ބާވަތް</label>
                <select
                  id="family-leave-type"
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value as SalaamFamilyLeaveType | "")}
                  required
                >
                  <option value="" disabled>ބާވަތް ހޮވާ</option>
                  {SALAAM_FAMILY_LEAVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.labelDv}</option>
                  ))}
                </select>
              </>
            ) : null}

            <label htmlFor="family-leave-start-date">ފެށޭ ތާރީޚު</label>
            <input
              id="family-leave-start-date"
              type="date"
              value={startDate}
              onChange={(event) => {
                const nextStart = event.target.value;
                setStartDate(nextStart);
                setEndDate((current) => !current || current < nextStart ? nextStart : current);
              }}
              required
              dir="ltr"
            />

            <label htmlFor="family-leave-end-date">ނިމޭ ތާރީޚު</label>
            <input
              id="family-leave-end-date"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
              dir="ltr"
            />

            <label htmlFor="family-leave-time">އެންގި ގަޑި</label>
            <input
              id="family-leave-time"
              type="text"
              value={clock.time}
              readOnly
              dir="ltr"
            />

            <label htmlFor="family-leave-reason">ސަބަބު</label>
            <textarea
              id="family-leave-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={2}
              maxLength={300}
              rows={4}
              dir="rtl"
            />

            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <button className={styles.submit} type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              ފޮނުވާ
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
