"use client";

import {
  submitEmployeeAnnualLeaveRequest,
  submitEmployeeOvertimeRequest,
} from "@/lib/actions/employee-portal-requests.actions";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

type Mode = "annual" | "ot";

const fieldClass =
  "mt-2 w-full rounded-2xl border border-[#ebe8ef] bg-white px-4 py-3 text-sm text-[#17191d] outline-none focus:border-[#9f98c0] focus:ring-4 focus:ring-[#eae5f4]";

export function EmployeeRequestDialog({
  employeeId,
  mode,
  open,
  onOpenChange,
}: {
  employeeId: string;
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalDays, setTotalDays] = useState("");
  const [reason, setReason] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStartDate("");
    setEndDate("");
    setTotalDays("");
    setReason("");
    setWorkDate(maldivesDateTime().date);
    setStartTime("");
    setEndTime("");
    setDetails("");
    setSuccess(false);
    setError("");
  }, [open, mode]);

  function changeOpen(next: boolean) {
    if (!pending) onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      if (mode === "annual") {
        await submitEmployeeAnnualLeaveRequest({
          employeeId,
          startDate,
          endDate,
          totalDays: Number(totalDays),
          reason,
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
    } catch {
      setError("Could not submit this request. Check the dates and details, then try again.");
    } finally {
      setPending(false);
    }
  }

  const annual = mode === "annual";
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[28px] border border-white bg-[#fcfafd] p-6 shadow-2xl" overlayClassName="bg-black/40">
        <DialogHeader>
          <DialogTitle className="text-left text-2xl font-extrabold tracking-tight text-[#17191d]">
            {annual ? "Annual leave" : "Overtime request"}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">Your request has been submitted.</p>
            <button type="button" onClick={() => changeOpen(false)} className="w-full rounded-full bg-[#17191d] px-5 py-3 text-sm font-bold text-white">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            {annual ? (
              <>
                <label className="text-sm font-bold text-slate-700">
                  Start date
                  <input className={fieldClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  End date
                  <input className={fieldClass} type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  Total days
                  <input className={fieldClass} type="number" min="1" max="366" step="1" value={totalDays} onChange={(event) => setTotalDays(event.target.value)} required />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  Reason
                  <textarea className={fieldClass} rows={3} maxLength={500} minLength={2} value={reason} onChange={(event) => setReason(event.target.value)} required />
                </label>
              </>
            ) : (
              <>
                <label className="text-sm font-bold text-slate-700">
                  Date
                  <input className={fieldClass} type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-bold text-slate-700">
                    Start time
                    <input className={fieldClass} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    End time
                    <input className={fieldClass} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                  </label>
                </div>
                <label className="text-sm font-bold text-slate-700">
                  Work details
                  <textarea className={fieldClass} rows={3} maxLength={500} minLength={2} value={details} onChange={(event) => setDetails(event.target.value)} required />
                </label>
              </>
            )}
            {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending} className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17191d] px-5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Submit request
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
