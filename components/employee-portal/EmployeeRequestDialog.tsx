"use client";

import {
  submitEmployeeOvertimeRequest,
  updateEmployeeOvertimeRequest,
} from "@/lib/actions/employee-portal-requests.actions";
import {
  countAnnualLeaveDays,
  listAnnualLeaveEmployeeOptions,
  submitAnnualLeaveRequest,
  updateAnnualLeaveRequest,
  type AnnualLeaveEmployeeOption,
} from "@/lib/actions/annual-leave.actions";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Clock, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
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

/** Overtime minutes between two HH:MM times; an earlier end runs past midnight. */
function overtimeMinutes(startTime: string, endTime: string): number | null {
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  if (start === null || end === null) return null;
  return (end - start + 1_440) % 1_440;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * A time field that always shows 24-hour time, with an hour and minute
 * dropdown. The native time input follows the phone's 12-hour setting.
 */
function TimeField24({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [hour = "", minute = ""] = value ? value.split(":") : [];

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div
      ref={fieldRef}
      className={styles.timeField}
      onKeyDown={(event) => {
        // Escape closes the dropdown, not the whole dialog.
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        id={id}
        type="button"
        className={styles.timeButton}
        data-empty={value ? undefined : ""}
        data-active={open ? "" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        dir="ltr"
      >
        <span>{value || "--:--"}</span>
        <Clock aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.timeDropdown} role="dialog" aria-label="24-hour time">
          <div className={styles.timeColumns}>
            <TimeColumn label="Hour" items={HOURS} value={hour} onPick={(h) => onChange(`${h}:${minute || "00"}`)} />
            <TimeColumn label="Min" items={MINUTES} value={minute} onPick={(m) => onChange(`${hour || "00"}:${m}`)} />
          </div>
          <button type="button" className={styles.timeDone} onClick={() => setOpen(false)}>ނިމުނީ</button>
        </div>
      ) : null}
    </div>
  );
}

/** One scrolling column of the 24-hour picker, opened on the picked item. */
function TimeColumn({
  label,
  items,
  value,
  onPick,
}: {
  label: string;
  items: string[];
  value: string;
  onPick: (item: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Centre the picked item without scrolling the dialog itself.
  useEffect(() => {
    const list = listRef.current;
    const picked = list?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (list && picked) list.scrollTop = picked.offsetTop - list.clientHeight / 2 + picked.clientHeight / 2;
  }, [value]);

  return (
    <div className={styles.timeColumn}>
      <small>{label}</small>
      <div ref={listRef}>
        {items.map((item) => (
          <button key={item} type="button" aria-pressed={item === value} onClick={() => onPick(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
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
  // Working days in the range; null while it is being counted or couldn't be.
  const [leaveDays, setLeaveDays] = useState<number | null>(null);
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
  const otMinutes = overtimeMinutes(startTime, endTime);
  const otOvernight = otMinutes !== null && endTime < startTime;

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

  // Council staff don't spend annual leave on weekends or holidays, so the server counts the days.
  useEffect(() => {
    setLeaveDays(null);
    if (!open || mode !== "annual") return;
    try {
      parseLeaveDateRange(startDate, endDate);
    } catch {
      return;
    }
    let active = true;
    void countAnnualLeaveDays({ employeeId, startDate, endDate })
      .then((days) => { if (active) setLeaveDays(days); })
      .catch(() => {});
    return () => { active = false; };
  }, [open, mode, employeeId, startDate, endDate]);

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
      if (leaveDays === 0) return "ހޮވި ތާރީޚުތަކުގައި މަސައްކަތު ދުވަހެއް ނެތް.";
      if (!isDhivehiText(annualReason, MAX_TEXT_LENGTH)) return "ސަބަބު ދިވެހިން ލިޔުއްވާ.";
      if (!takeoverEmployeeId) return "ޒިންމާތައް ހަވާލުކުރާނެ މުވައްޒަފަކު ހޮވާ.";
      return null;
    }
    // Matches the server: an end time earlier than the start runs past midnight.
    const duration = overtimeMinutes(startTime, endTime) ?? 0;
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

                {/* Shows the leave days once both dates are picked. */}
                <LeaveRangePreview startDate={startDate} endDate={endDate} tone={visual.tone} days={leaveDays} />

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
                    <TimeField24 id="overtime-start-time" value={startTime} onChange={setStartTime} />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="overtime-end-time">ނިމުނު ގަޑި</label>
                    <TimeField24 id="overtime-end-time" value={endTime} onChange={setEndTime} />
                  </div>
                </div>

                {otMinutes ? (
                  <div
                    className={cn(styles.otTotal, otMinutes > MAX_OVERTIME_MINUTES && styles.otTotalOver)}
                    aria-live="polite"
                  >
                    <span>
                      ޖުމްލަ އޯޓީ
                      {otOvernight ? (
                        <small>ރޭގަނޑު 12 ފަހަނަޅައި</small>
                      ) : null}
                    </span>
                    <div>
                      <strong dir="ltr">
                        {Math.floor(otMinutes / 60)}:{String(otMinutes % 60).padStart(2, "0")}
                      </strong>
                      <small>ގަޑިއިރު</small>
                    </div>
                  </div>
                ) : null}

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
