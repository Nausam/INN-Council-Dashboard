"use client";

import {
  assignAnnualLeavePerson,
  approveAnnualLeaveRequest,
  deleteAnnualLeaveRequest,
  listAnnualLeaveEmployeeOptions,
  listAnnualLeaveRequests,
  type AnnualLeaveEmployeeOption,
  type AnnualLeaveRequest,
} from "@/lib/actions/annual-leave.actions";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LEAVE_SUPERVISORS } from "@/lib/leave/supervisors";
import {
  ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Download,
  FileText, RefreshCw, Trash2, X,
} from "lucide-react";
import { useEffect, useState } from "react";

const PAGE_SIZE = 12;

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function AnnualLeaveRequestsPanel() {
  const [page, setPage] = useState<{ requests: AnnualLeaveRequest[]; totalCount: number } | null>(null);
  const [employees, setEmployees] = useState<AnnualLeaveEmployeeOption[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([listAnnualLeaveRequests(pageIndex * PAGE_SIZE), listAnnualLeaveEmployeeOptions()])
      .then(([nextPage, roster]) => {
        if (!active) return;
        setPage(nextPage);
        setEmployees(roster);
        setSelectedId((current) => nextPage.requests.some((request) => request.$id === current) ? current : null);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load annual leave forms."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pageIndex, revision]);

  const selected = page?.requests.find((request) => request.$id === selectedId) ?? null;
  const refresh = () => setRevision((value) => value + 1);

  async function assign(role: "approver" | "collector", employeeId: string) {
    if (!selected || !employeeId) return;
    setBusy(true);
    setError("");
    try {
      await assignAnnualLeavePerson(selected.$id, role, employeeId);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the form.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await approveAnnualLeaveRequest(selected.$id);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve annual leave.");
    } finally {
      setBusy(false);
    }
  }

  const approvers = employees.filter((employee) => LEAVE_SUPERVISORS.some((supervisor) => supervisor.employeeId === employee.employeeId));

  async function remove(request: AnnualLeaveRequest) {
    if (!window.confirm(`Delete ${request.fullName}'s annual leave form permanently?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteAnnualLeaveRequest(request.$id);
      setSelectedId(null);
      if (page?.requests.length === 1 && pageIndex > 0) setPageIndex(pageIndex - 1);
      else refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the form.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-[#243635]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-[#e4e9e6] pb-8">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#408d75]">Requests / Annual leave</p>
          <h1 className="text-4xl font-black tracking-[-0.045em] text-[#1b302e] sm:text-5xl">Annual leave forms<span className="text-[#8cc9b1]">.</span></h1>
          <p className="mt-2 text-sm text-[#84918e]">Employee requests and their completed forms</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right"><strong className="block text-3xl font-black leading-none text-[#24443b]">{page?.totalCount ?? "—"}</strong><span className="text-xs font-semibold text-[#86968e]">forms</span></div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh forms" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe6df] bg-white text-[#527668] hover:bg-[#f2f8f3] disabled:opacity-50"><RefreshCw size={17} /></button>
        </div>
      </header>

      {error && !selected ? <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading annual leave forms">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[220px] animate-pulse rounded-[24px] bg-[#f1f5f2]" />)}</div>
      ) : page?.requests.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {page.requests.map((request, index) => (
            <button key={request.$id} type="button" onClick={() => { setError(""); setSelectedId(request.$id); }} className="group relative flex min-h-[220px] w-full flex-col rounded-[24px] border border-[#d9ebe5] bg-[#f1faf6] p-5 text-left transition hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(34,49,50,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#158577]">
              <span className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.16em] text-[#7a8987]">{String(pageIndex * PAGE_SIZE + index + 1).padStart(2, "0")}</span><span className="rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[#167a67]">{request.approvalStatus || "Pending"}</span></span>
              <span className="mt-8 flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#c8ebdd] text-lg font-black text-[#126a5b]">{request.fullName?.trim().charAt(0).toUpperCase() || "?"}</span><span className="min-w-0"><strong className="block truncate text-lg font-black tracking-tight text-[#1c2d2e]">{request.fullName}</strong><span className="mt-0.5 block text-xs font-medium text-[#7b8a8b]">{dateLabel(request.startDate)} – {dateLabel(request.endDate)} · {request.totalDays} days</span></span></span>
              <span className="mt-auto flex items-center justify-between gap-3 border-t border-[#243b3b]/10 pt-4 text-xs font-semibold text-[#526c6a]"><span className="truncate">{request.takeover?.name ? `Handover: ${request.takeover.name}` : "Earlier request"}</span><span className="inline-flex items-center gap-1 text-[#1e4642]">Open <ArrowUpRight size={15} /></span></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#dae6dd] bg-[#fbfdfb] p-8 text-center"><FileText size={30} className="mb-4 text-[#91b9a3]" /><h2 className="text-lg font-bold">No forms yet</h2><p className="mt-1 text-sm text-[#83918b]">Submitted annual leave requests will appear here.</p></div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#e4e9e6] pt-5"><span className="text-xs font-semibold text-[#84948d]">{page?.totalCount ? `Showing ${pageIndex * PAGE_SIZE + 1}–${Math.min((pageIndex + 1) * PAGE_SIZE, page.totalCount)} of ${page.totalCount}` : "0 forms"}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPageIndex(Math.max(0, pageIndex - 1))} disabled={loading || pageIndex === 0} className="flex h-10 items-center gap-1 rounded-full border border-[#dce7df] bg-white px-4 text-xs font-bold text-[#47695b] disabled:opacity-35"><ChevronLeft size={15} />Previous</button><span className="px-2 text-xs font-bold text-[#547065]">{pageIndex + 1}</span><button type="button" onClick={() => setPageIndex(pageIndex + 1)} disabled={loading || (pageIndex + 1) * PAGE_SIZE >= (page?.totalCount ?? 0)} className="flex h-10 items-center gap-1 rounded-full border border-[#dce7df] bg-white px-4 text-xs font-bold text-[#47695b] disabled:opacity-35">Next<ChevronRight size={15} /></button></div></div>

      <DialogPrimitive.Root open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        {selected ? <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#102c2a]/45 backdrop-blur-[4px]" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(12,39,34,0.24)] focus:outline-none">
            <div className="flex shrink-0 items-start justify-between gap-4 bg-[#f5faf7] px-5 py-5 sm:px-7 sm:py-6"><div className="flex min-w-0 items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dff3e8] text-[#217b60]"><FileText size={22} /></span><div className="min-w-0"><span className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-[#4e8e76]">Annual leave request</span><DialogPrimitive.Title className="mt-1 break-words text-2xl font-black tracking-tight text-[#152c2b]">{selected.fullName}</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm text-[#70857b]">Submitted {dateLabel(selected.submittedDate || selected.createdAt?.slice(0, 10))}</DialogPrimitive.Description></div></div><DialogPrimitive.Close aria-label="Close form details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dfebe3] bg-white text-[#54736d]"><X size={18} /></DialogPrimitive.Close></div>
            <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-3.5"><CalendarDays size={18} className="text-[#398c7a]" /><span><span className="block text-[10px] font-bold uppercase text-[#82918d]">Leave dates</span><strong className="text-sm text-[#263d39]">{dateLabel(selected.startDate)} – {dateLabel(selected.endDate)}</strong></span></div><div className="rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-3.5"><span className="block text-[10px] font-bold uppercase text-[#82918d]">Total days</span><strong className="text-sm text-[#263d39]">{selected.totalDays}</strong></div></div>
              <div className="rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-4"><span className="block text-[10px] font-bold uppercase text-[#82918d]">Reason for leave</span><p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-[#263d39]">{selected.reason && selected.reason.toLowerCase() !== "annual leave" ? selected.reason : "Not provided on this earlier request"}</p></div>
              <div className="rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-4"><span className="block text-[10px] font-bold uppercase text-[#82918d]">Responsibilities taken over by</span><strong className="mt-1 block text-sm text-[#263d39]">{selected.takeover?.name || "Not recorded on this earlier request"}</strong></div>
              <div className="grid grid-cols-2 gap-3 border-t border-[#e8eeea] pt-5">
                <label className="min-w-0 text-sm font-extrabold text-[#203b35]">Approved by<select aria-label="Approved by" value={selected.approver?.employeeId ?? ""} onChange={(event) => void assign("approver", event.target.value)} disabled={busy} className="mt-3 h-12 w-full rounded-xl border border-[#d9e4dd] bg-white px-3 text-sm font-semibold text-[#25423a] disabled:opacity-50"><option value="">Choose a supervisor</option>{approvers.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.name}</option>)}</select></label>
                <label className="min-w-0 text-sm font-extrabold text-[#203b35]">Form collected by<select aria-label="Form collected by" value={selected.collector?.employeeId ?? ""} onChange={(event) => void assign("collector", event.target.value)} disabled={busy} className="mt-3 h-12 w-full rounded-xl border border-[#d9e4dd] bg-white px-3 text-sm font-semibold text-[#25423a] disabled:opacity-50"><option value="">Choose an employee</option>{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.name}</option>)}</select></label>
              </div>
              {!selected.takeover ? <p className="text-sm text-[#83918b]">This request predates the handover form. Its original details remain listed here.</p> : null}
              <section className="border-t border-[#e8eeea] pt-5">
                <h3 className="text-sm font-extrabold text-[#203b35]">Leave chit approval</h3>
                <p className="mt-1 text-xs text-[#70857b]">The selected supervisor’s signature is added to the PDF when you approve this request.</p>
                <button type="button" onClick={() => void approve()} disabled={busy || !selected.approver || (selected.approvalStatus === "Approved" && selected.signatureReady)} className="mt-3 h-11 rounded-xl bg-[#1e8066] px-5 text-sm font-bold text-white disabled:opacity-40">{selected.approvalStatus === "Approved" && selected.signatureReady ? "Approved" : "Approve and create chit"}</button>
                {selected.approvalStatus === "Approved" && selected.signatureReady ? <a href={`/api/employee-requests/annual/${encodeURIComponent(selected.$id)}/chit`} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1e8066] hover:underline"><Download size={16} /> Download PDF chit</a> : null}
              </section>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf0ed] bg-white px-5 py-4 sm:px-7"><button type="button" onClick={() => void remove(selected)} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={17} />Delete</button>{selected.takeover ? <a href={`/api/admin/annual-leave-requests/${encodeURIComponent(selected.$id)}/form`} aria-disabled={busy} className={`inline-flex h-11 items-center gap-2 rounded-xl bg-[#182b29] px-5 text-sm font-bold text-white hover:bg-[#286b5c] ${busy ? "pointer-events-none opacity-50" : ""}`}><Download size={17} />Download form</a> : null}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal> : null}
      </DialogPrimitive.Root>
    </div>
  );
}
