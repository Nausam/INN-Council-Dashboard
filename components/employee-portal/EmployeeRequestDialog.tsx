"use client";

import {
  submitEmployeeOvertimeRequest,
  updateEmployeeOvertimeRequest,
} from "@/lib/actions/employee-portal-requests.actions";
import {
  listAnnualLeaveEmployeeOptions,
  submitAnnualLeaveRequest,
  updateAnnualLeaveRequest,
  type AnnualLeaveEmployeeOption,
} from "@/lib/actions/annual-leave.actions";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import styles from "@/components/Leave/family-leave-request.module.css";
import motifs from "./portal-motifs.module.css";
import { LeaveRangePreview } from "./LeaveRangePreview";
import { REQUEST_VISUALS } from "@/lib/employees/request-visuals";
import { cn } from "@/lib/utils";

type Mode = "annual" | "ot";

/** A pending request being changed instead of a new one being submitted. */
export type EmployeeRequestEdit = {
  id: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  takeoverEmployeeId?: string;
  startTime?: string;
  endTime?: string;
};

const MAX_TEXT_LENGTH = 500;
const MAX_OVERTIME_MINUTES = 16 * 60;

function minutesFromTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function EmployeeRequestDialog({
  employeeId,
  mode,
  editRequest,
  open,
  onOpenChange,
  onSubmitted,
}: {
  employeeId: string;
  mode: Mode;
  editRequest?: EmployeeRequestEdit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [annualReason, setAnnualReason] = useState("");
  const [takeoverEmployeeId, setTakeoverEmployeeId] = useState("");
  const [employees, setEmployees] = useState<AnnualLeaveEmployeeOption[]>([]);
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const editing = Boolean(editRequest);

  useEffect(() => {
    if (!open) return;
    setStartDate(editRequest?.startDate ?? "");
    setEndDate(editRequest?.endDate ?? "");
    setAnnualReason(mode === "annual" ? editRequest?.reason ?? "" : "");
    setTakeoverEmployeeId(editRequest?.takeoverEmployeeId ?? "");
    setWorkDate(editRequest?.startDate ?? maldivesDateTime().date);
    setStartTime(editRequest?.startTime ?? "");
    setEndTime(editRequest?.endTime ?? "");
    setDetails(mode === "ot" ? editRequest?.reason ?? "" : "");
    setSuccess(false);
    setError("");
  }, [open, mode, editRequest]);

  useEffect(() => {
    if (!open || mode !== "annual") return;
    let active = true;
    void listAnnualLeaveEmployeeOptions()
      .then((options) => { if (active) setEmployees(options.filter((option) => option.employeeId !== employeeId)); })
      .catch(() => { if (active) setError("ޒިންމާ ހަވާލުކުރާނެ މުވައްޒަފުންގެ ލިސްޓު ލޯޑު ނުކުރެވުނު."); });
    return () => { active = false; };
  }, [open, mode, employeeId]);

  function changeOpen(next: boolean) {
    if (!pending) onOpenChange(next);
  }

  function validate(): string | null {
    if (mode === "annual") {
      try {
        parseLeaveDateRange(startDate, endDate);
      } catch {
        return "ފެށޭ ތާރީޚާއި ނިމޭ ތާރީޚު ރަނގަޅަށް ހޮވާ. 365 ދުވަހަށްވުރެ ދިގު ނުކުރައްވާ.";
      }
      if (!isDhivehiText(annualReason, MAX_TEXT_LENGTH)) return "ސަބަބު ދިވެހިން ލިޔުއްވާ.";
      if (!takeoverEmployeeId) return "ޒިންމާތައް ހަވާލުކުރާނެ މުވައްޒަފަކު ހޮވާ.";
      return null;
    }
    const start = minutesFromTime(startTime);
    const end = minutesFromTime(endTime);
    // Matches the server: an end time earlier than the start runs past midnight.
    const duration = start === null || end === null ? 0 : (end - start + 1_440) % 1_440;
    if (!workDate || duration < 1 || duration > MAX_OVERTIME_MINUTES) {
      return "ފެށި ގަޑިއާއި ނިމުނު ގަޑި ރަނގަޅަށް ހޮވާ. 16 ގަޑިއިރަށްވުރެ ދިގު ނުކުރައްވާ.";
    }
    if (!isDhivehiText(details, MAX_TEXT_LENGTH)) return "ކުރި މަސައްކަތް ދިވެހިން ލިޔުއްވާ.";
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setPending(true);
    try {
      if (editRequest) {
        const result = mode === "annual"
          ? await updateAnnualLeaveRequest({
            employeeId,
            requestId: editRequest.id,
            startDate,
            endDate,
            reason: annualReason,
            takeoverEmployeeId,
          })
          : await updateEmployeeOvertimeRequest({
            employeeId,
            requestId: editRequest.id,
            workDate,
            startTime,
            endTime,
            details,
          });
        if (!result.ok) {
          setError("މި ފޯމު ރިވިއު ކުރެވިފައިވާތީ ބަދަލެއް ނުގެނެވޭނެ.");
          return;
        }
      } else if (mode === "annual") {
        await submitAnnualLeaveRequest({
          employeeId,
          startDate,
          endDate,
          reason: annualReason,
          takeoverEmployeeId,
        });
      } else {
        await submitEmployeeOvertimeRequest({
          employeeId,
          workDate,
          startTime,
          endTime,
          details,
        });
      }
      setSuccess(true);
      onSubmitted?.();
    } catch {
      setError(editing ? "ބަދަލުތައް ރައްކާ ނުކުރެވުނު. އަލުން ކޮށްލައްވާ." : "ފޯމު ފޮނުވަން ނުކުޅުނު. އަލުން ކޮށްލައްވާ.");
    } finally {
      setPending(false);
    }
  }

  const annual = mode === "annual";
  const visual = REQUEST_VISUALS[mode];
  const HeaderIcon = visual.icon;
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        dir="rtl"
        lang="dv"
        className={styles.dialog}
        overlayClassName="bg-black/40"
      >
        <DialogHeader className={styles.header}>
          <div className={styles.headRow}>
          <span className={cn(motifs.glossIcon, styles.headIcon)} data-tone={visual.tone} aria-hidden="true">
            <HeaderIcon />
          </span>
          <DialogTitle className={styles.title}>
            {annual ? "އަހަރީ ޗުއްޓީ" : "އިތުރުގަޑީގެ މަސައްކަތް"}
          </DialogTitle>
          </div>
        </DialogHeader>

        {success ? (
          <div className={styles.success} role="status">
            <span className={cn(motifs.glossIcon, styles.successIcon)} data-tone="present" aria-hidden="true">
              <Check />
            </span>
            <p>{editing ? "ބަދަލުތައް ރައްކާކުރެވިއްޖެ." : "ފޯމު ފޮނުވުނު."}</p>
            <button type="button" onClick={() => changeOpen(false)}>
              ނިންމާ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {annual ? (
              <>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label htmlFor="annual-leave-start-date">ފެށޭ ތާރީޚު</label>
                    <input
                      id="annual-leave-start-date"
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
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="annual-leave-end-date">ނިމޭ ތާރީޚު</label>
                    <input
                      id="annual-leave-end-date"
                      type="date"
                      min={startDate || undefined}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      required
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Shows the total days once both dates are picked. */}
                <LeaveRangePreview startDate={startDate} endDate={endDate} tone={visual.tone} />

                <div className={styles.field}>
                  <label htmlFor="annual-leave-reason">ސަބަބު</label>
                  <textarea
                    id="annual-leave-reason"
                    value={annualReason}
                    onChange={(event) => setAnnualReason(event.target.value)}
                    required
                    minLength={2}
                    maxLength={MAX_TEXT_LENGTH}
                    rows={4}
                    dir="rtl"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="annual-leave-takeover">ޒިންމާތައް ހަވާލުކުރާނީ ކާކަށް؟</label>
                  <select
                    id="annual-leave-takeover"
                    value={takeoverEmployeeId}
                    onChange={(event) => setTakeoverEmployeeId(event.target.value)}
                    required
                  >
                    <option value="" disabled>މުވައްޒަފަކު ހޮވާ</option>
                    {employees.map((employee) => (
                      <option key={employee.employeeId} value={employee.employeeId}>
                        {employee.nameDv || employee.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="overtime-date">ތާރީޚު</label>
                  <input
                    id="overtime-date"
                    type="date"
                    value={workDate}
                    onChange={(event) => setWorkDate(event.target.value)}
                    required
                    dir="ltr"
                  />
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label htmlFor="overtime-start-time">ފެށި ގަޑި</label>
                    <input
                      id="overtime-start-time"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="overtime-end-time">ނިމުނު ގަޑި</label>
                    <input
                      id="overtime-end-time"
                      type="time"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      required
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="overtime-details">ކުރި މަސައްކަތް</label>
                  <textarea
                    id="overtime-details"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    required
                    minLength={2}
                    maxLength={MAX_TEXT_LENGTH}
                    rows={4}
                    dir="rtl"
                  />
                </div>
              </>
            )}

            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <button className={styles.submit} type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              {editing ? "ސޭވް" : "ސަބްމިޓް"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
