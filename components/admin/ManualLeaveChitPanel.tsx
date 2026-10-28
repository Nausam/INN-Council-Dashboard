"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  listAnnualLeaveEmployeeOptions,
  previewManualAnnualLeaveChit,
  type AnnualLeaveEmployeeOption,
} from "@/lib/actions/annual-leave.actions";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import type { ManualChitPreview } from "@/lib/leave/manual-chit";
import { LEAVE_SUPERVISORS } from "@/lib/leave/supervisors";

const FIELD = "h-10 w-full rounded-xl border border-[#dbe6df] bg-white px-3 text-sm font-semibold text-[#243635] outline-none focus:border-[#8cc9b1] focus:ring-2 focus:ring-[#dff4e8]";
const LABEL = "grid gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#6f7f7b]";

/**
 * Makes an annual leave chit by hand: for leave agreed outside the app. The
 * chit is downloaded only; no request is saved and no leave is deducted.
 */
export function ManualLeaveChitPanel() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<AnnualLeaveEmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(maldivesTodayIso);
  const [endDate, setEndDate] = useState(maldivesTodayIso);
  const [approverId, setApproverId] = useState<string>(LEAVE_SUPERVISORS[0].employeeId);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<ManualChitPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [balanceAfter, setBalanceAfter] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void listAnnualLeaveEmployeeOptions().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  // Working days and balances for the chosen employee and dates.
  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    if (!employeeId || !startDate || !endDate || endDate < startDate) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void previewManualAnnualLeaveChit({ employeeId, startDate, endDate })
        .then((result) => {
          if (!active) return;
          if ("error" in result) {
            setPreviewError(result.error);
            return;
          }
          setPreview(result);
          setBalanceAfter(result.balance === null ? "" : String(Math.max(0, result.balance - result.days)));
        })
        .catch(() => { if (active) setPreviewError("Couldn't count the days. Try again."); });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [employeeId, startDate, endDate]);

  const canGenerate = Boolean(preview && preview.days > 0 && approverId) && !generating;

  const generate = async () => {
    setGenerating(true);
    try {
      const balance = balanceAfter.trim() === "" ? undefined : Number(balanceAfter);
      const response = await fetch("/api/admin/annual-leave-chit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, startDate, endDate, approverEmployeeId: approverId, reason, balanceAfter: balance }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't make the chit");
      }
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "Annual-Leave-Chit.pdf";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast({ title: "Chit downloaded", description: name });
    } catch (caught) {
      toast({
        variant: "destructive",
        title: "Chit not made",
        description: caught instanceof Error ? caught.message : "Try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-[#e4ece8] bg-white p-5 shadow-[0_12px_32px_rgba(34,49,50,0.06)] sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d6c9fb] to-[#7d64c9] text-white shadow-[0_8px_16px_-10px_rgba(125,100,201,0.9)]">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-[#1b302e]">Create annual leave chit</h2>
          <p className="text-xs font-medium text-[#84918e]">
            For leave agreed outside the app. Downloads the chit only; no leave is deducted.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${LABEL} sm:col-span-2`}>
            Employee
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={FIELD}>
              <option value="">Choose an employee</option>
              {employees.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>{employee.name}</option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            From
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                const next = event.target.value;
                setStartDate(next);
                if (!endDate || endDate < next) setEndDate(next);
              }}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            To
            <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className={FIELD} />
          </label>
          <label className={LABEL}>
            Signed by
            <select value={approverId} onChange={(event) => setApproverId(event.target.value)} className={FIELD}>
              {LEAVE_SUPERVISORS.map((supervisor) => (
                <option key={supervisor.key} value={supervisor.employeeId}>{supervisor.label}</option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Annual leave left (printed)
            <input
              type="number"
              min={0}
              value={balanceAfter}
              onChange={(event) => setBalanceAfter(event.target.value)}
              disabled={!preview}
              className={FIELD}
            />
          </label>
          <label className={`${LABEL} sm:col-span-2`}>
            Reason (optional)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={2}
              dir="auto"
              className="min-h-[64px] w-full rounded-xl border border-[#dbe6df] bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[#243635] outline-none focus:border-[#8cc9b1] focus:ring-2 focus:ring-[#dff4e8]"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-[#eef2ef] bg-[#fbfcfb] p-4">
          {!employeeId ? (
            <p className="text-sm font-medium text-[#93a29b]">Choose an employee and the leave dates.</p>
          ) : previewError ? (
            <p className="text-sm font-semibold text-rose-700">{previewError}</p>
          ) : !preview ? (
            <p className="flex items-center gap-2 text-sm font-medium text-[#93a29b]">
              <Loader2 className="h-4 w-4 animate-spin" /> Counting working days…
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[#ece6ff] px-3 py-2.5 text-[#6a55b8]">
                  <strong className="block text-2xl font-black leading-none">{preview.days}</strong>
                  <span className="text-[11px] font-bold">working {preview.days === 1 ? "day" : "days"}</span>
                </div>
                <div className="rounded-2xl bg-[#dcf5e7] px-3 py-2.5 text-[#1f7a55]">
                  <strong className="block text-2xl font-black leading-none">{preview.balance ?? "—"}</strong>
                  <span className="text-[11px] font-bold">annual left now</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-[#84918e]">
                Weekends and public holidays aren&rsquo;t counted. The chit prints the annual leave left
                after this leave; if it&rsquo;s already been deducted in the system, set it to {preview.balance ?? "the current balance"}.
              </p>
              {preview.missing.length ? (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Missing {preview.missing.join(", ")} on the employee&rsquo;s record; those spots use English or stay blank.
                </p>
              ) : null}
              {preview.days === 0 ? (
                <p className="text-xs font-semibold text-rose-700">These dates have no working days.</p>
              ) : null}
            </>
          )}
          <Button
            type="button"
            variant="council"
            className="mt-auto h-11 rounded-full"
            onClick={() => void generate()}
            disabled={!canGenerate}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download chit
          </Button>
        </div>
      </div>
    </section>
  );
}
