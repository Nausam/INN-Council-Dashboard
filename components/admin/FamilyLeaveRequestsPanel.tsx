"use client";

import {
  assignFamilyLeaveSupervisor,
  deleteFamilyLeaveRequest,
  listFamilyLeaveRequests,
  listLeaveSupervisors,
  type FamilyLeaveRequestPage,
  type FamilyLeaveRequestSummary,
  type LeaveSupervisorOption,
} from "@/lib/actions/family-leave.actions";
import { SALAAM_FAMILY_LEAVE_TYPES } from "@/lib/leave/salaam-family-types";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const PAGE_SIZE = 12;
const dhivehiFont = { fontFamily: "Faruma, sans-serif" };

function typeLabel(request: FamilyLeaveRequestSummary) {
  return SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === request.leaveType)?.labelEn ?? "Leave";
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function FormCard({
  request,
  number,
  onOpen,
}: {
  request: FamilyLeaveRequestSummary;
  number: number;
  onOpen: () => void;
}) {
  const salaam = request.leaveType === "salaam";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex min-h-[200px] w-full flex-col overflow-hidden rounded-[24px] border p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(34,49,50,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#158577] sm:min-h-[232px]",
        salaam ? "border-[#d9ebe5] bg-[#f1faf6]" : "border-[#e8e1f0] bg-[#f8f4fb]",
      )}
      aria-label={`Open ${typeLabel(request)} form for ${request.employeeName}`}
    >
      <span className={cn("absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-70", salaam ? "bg-[#dff4e8]" : "bg-[#f0e6f8]")} />
      <span className="relative flex w-full items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-[0.16em] text-[#7a8987]">{String(number).padStart(2, "0")}</span>
        <span className={cn("rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold", salaam ? "text-[#167a67]" : "text-[#8059a2]")}>{typeLabel(request)}</span>
      </span>

      <span className="relative mt-8 flex min-w-0 items-center gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black", salaam ? "bg-[#c8ebdd] text-[#126a5b]" : "bg-[#e9d8f5] text-[#774b9b]")}>
          {request.employeeName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-black tracking-tight text-[#1c2d2e]">{request.employeeName}</span>
          <span className="mt-0.5 block text-xs font-medium text-[#7b8a8b]">{dateLabel(request.requestDate)} · {request.reportedTime}</span>
        </span>
      </span>

      <span className="relative mt-auto flex w-full items-center justify-between gap-3 border-t border-[#243b3b]/10 pt-4 text-xs font-semibold text-[#526c6a]">
        <span className="inline-flex min-w-0 items-center gap-2 truncate">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", request.supervisor ? "bg-[#25a880]" : "bg-[#dcab6d]")} />
          {request.supervisor ? request.supervisor.name : "Needs supervisor"}
        </span>
        <span className="inline-flex items-center gap-1 text-[#1e4642]">Open <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
      </span>
    </button>
  );
}

function FormDrawer({
  request,
  supervisors,
  busy,
  pendingSelection,
  error,
  onAssign,
  onDelete,
}: {
  request: FamilyLeaveRequestSummary;
  supervisors: LeaveSupervisorOption[];
  busy: boolean;
  pendingSelection: string | null;
  error: string;
  onAssign: (supervisorKey: string) => void;
  onDelete: () => void;
}) {
  const incomplete = supervisors.filter((supervisor) => !supervisor.ready);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#102c2a]/45 backdrop-blur-[4px]" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(12,39,34,0.24)] focus:outline-none">
        <div className="flex shrink-0 items-start justify-between gap-4 bg-[#f5faf7] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dff3e8] text-[#217b60]"><FileText size={22} /></span>
            <div className="min-w-0">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.17em] text-[#4e8e76]">{typeLabel(request)} request</span>
              <DialogPrimitive.Title className="mt-1 break-words text-2xl font-black tracking-tight text-[#152c2b] sm:text-[28px]">{request.employeeName}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-[#70857b]">Submitted {dateLabel(request.requestDate)}</DialogPrimitive.Description>
            </div>
          </div>
          <DialogPrimitive.Close className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dfebe3] bg-white text-[#54736d] transition hover:bg-[#e8f2ec]" aria-label="Close form details"><X size={18} /></DialogPrimitive.Close>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-3.5"><CalendarDays size={18} className="shrink-0 text-[#398c7a]" /><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#82918d]">Date</span><strong className="block text-sm text-[#263d39]">{dateLabel(request.requestDate)}</strong></span></div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-3.5"><Clock3 size={18} className="shrink-0 text-[#398c7a]" /><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#82918d]">Time</span><strong className="block text-sm text-[#263d39]">{request.reportedTime} MVT</strong></span></div>
          </div>

          {request.employeeNameDv ? <p dir="rtl" lang="dv" style={dhivehiFont} className="rounded-2xl border border-[#e7ede9] px-4 py-3 text-right text-xl leading-relaxed text-[#314c46]">{request.employeeNameDv}</p> : null}

          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#778b85]">Reason</h3>
            <p dir="rtl" lang="dv" style={dhivehiFont} className="min-h-[76px] whitespace-pre-wrap break-words rounded-2xl border border-[#e7ede9] bg-white px-5 py-4 text-right text-xl leading-loose text-[#243c38]">{request.reason}</p>
          </section>

          <section className="border-t border-[#e8eeea] pt-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-[#203b35]"><UserRound size={19} className="text-[#458e7a]" /> Supervisor</h3>
              <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", request.supervisor ? "bg-[#e6f5ed] text-[#1e8066]" : "bg-[#fff3df] text-[#a66a29]")}>{request.supervisor ? "Assigned" : "Pending"}</span>
            </div>
            <div className="relative">
              <select
                aria-label="Select supervisor"
                value={busy && pendingSelection ? pendingSelection : request.supervisor?.key ?? ""}
                onChange={(event) => onAssign(event.target.value)}
                disabled={busy}
                className="h-12 w-full appearance-none rounded-xl border border-[#d9e4dd] bg-white px-4 pr-10 text-sm font-semibold text-[#25423a] outline-none focus:border-[#5aa48a] focus:ring-2 focus:ring-[#e2f4e9] disabled:opacity-50"
              >
                <option value="">Choose a supervisor</option>
                {supervisors.map((supervisor) => <option key={supervisor.key} value={supervisor.key} disabled={!supervisor.ready}>{supervisor.label}{supervisor.ready ? "" : " · Dhivehi details needed"}</option>)}
              </select>
              <ChevronDown size={17} className="pointer-events-none absolute right-4 top-4 text-[#78958a]" />
            </div>
            {request.supervisor ? (
              <div className="mt-4 space-y-2 rounded-2xl bg-[#f5faf7] p-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-[#769087]">Name</span><strong className="text-right text-[#28463c]">{request.supervisor.name}</strong></div>
                <p dir="rtl" lang="dv" style={dhivehiFont} className="text-right text-lg leading-relaxed text-[#3e6959]">{request.supervisor.nameDv}</p>
                <div className="flex justify-between gap-3"><span className="text-[#769087]">Informed</span><strong className="text-right text-[#28463c]">{request.supervisor.reportedDate} · {request.supervisor.reportedTime}</strong></div>
                <p dir="rtl" lang="dv" style={dhivehiFont} className="border-t border-[#e1ece5] pt-2 text-right text-lg leading-relaxed text-[#3e6959]">{request.supervisor.designationDv} · {request.supervisor.sectionDv}</p>
              </div>
            ) : null}
            {incomplete.length > 0 ? (
              <details className="mt-4 text-xs text-[#6b8278]">
                <summary className="cursor-pointer font-semibold">{incomplete.length} supervisor profiles need Dhivehi details</summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incomplete.map((supervisor) => <Link key={supervisor.key} href={`/employees/${supervisor.employeeId}/edit`} className="rounded-full bg-[#f1f7f2] px-3 py-1.5 font-semibold text-[#24765f] hover:bg-[#e4f1e6]">Edit {supervisor.label}</Link>)}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#edf0ed] bg-white px-5 py-4 sm:px-7">
          <p className="hidden min-w-0 flex-1 truncate text-xs text-[#93a29b] sm:block">Submitted by {request.submittedBy}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onDelete} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={17} /> Delete</button>
            <a href={`/api/admin/family-leave-requests/${encodeURIComponent(request.id)}/form`} aria-disabled={busy} className={cn("inline-flex h-11 items-center gap-2 rounded-xl bg-[#182b29] px-5 text-sm font-bold text-white hover:bg-[#286b5c]", busy && "pointer-events-none opacity-50")}><Download size={17} /> Download form</a>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function FamilyLeaveRequestsPanel() {
  const [page, setPage] = useState<FamilyLeaveRequestPage | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supervisors, setSupervisors] = useState<LeaveSupervisorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([listFamilyLeaveRequests(cursors[pageIndex]), listLeaveSupervisors()])
      .then(([nextPage, roster]) => {
        if (!active) return;
        setPage(nextPage);
        setSupervisors(roster);
        setSelectedId((current) =>
          nextPage.requests.some((request) => request.id === current) ? current : null,
        );
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof Error && cause.message === "Page cursor no longer exists") {
          setCursors([undefined]);
          setPageIndex(0);
          return;
        }
        setError(cause instanceof Error ? cause.message : "Could not load leave forms.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cursors, pageIndex, revision]);

  const selected = page?.requests.find((request) => request.id === selectedId) ?? null;
  const firstNumber = pageIndex * PAGE_SIZE + 1;
  const lastNumber = Math.min((pageIndex + 1) * PAGE_SIZE, page?.totalCount ?? 0);
  const refresh = () => setRevision((value) => value + 1);

  const assignSupervisor = async (requestId: string, supervisorKey: string) => {
    if (!supervisorKey) return;
    const choice = supervisors.find((supervisor) => supervisor.key === supervisorKey);
    if (!choice?.ready) {
      setError(`Add ${choice?.label ?? "the supervisor"}'s Dhivehi details in the employee edit form first.`);
      return;
    }
    setBusyId(requestId);
    setPendingSelection(supervisorKey);
    setError("");
    try {
      await assignFamilyLeaveSupervisor(requestId, supervisorKey);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign supervisor.");
    } finally {
      setBusyId(null);
      setPendingSelection(null);
    }
  };

  const deleteRequest = async (request: FamilyLeaveRequestSummary) => {
    if (!window.confirm(`Delete ${request.employeeName}'s leave form permanently?`)) return;
    setBusyId(request.id);
    setError("");
    try {
      await deleteFamilyLeaveRequest(request.id);
      setSelectedId(null);
      if (page?.requests.length === 1 && pageIndex > 0) setPageIndex((index) => index - 1);
      else refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete leave form.");
    } finally {
      setBusyId(null);
    }
  };

  const nextPage = () => {
    if (!page?.nextCursor) return;
    setCursors((current) => [...current.slice(0, pageIndex + 1), page.nextCursor!]);
    setPageIndex((index) => index + 1);
  };

  return (
    <div className="text-[#243635]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-[#e4e9e6] pb-8">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#408d75]">Requests / Leave</p>
          <h1 className="text-4xl font-black tracking-[-0.045em] text-[#1b302e] sm:text-5xl">Leave forms<span className="text-[#8cc9b1]">.</span></h1>
          <p className="mt-2 text-sm text-[#84918e]">Salaam &amp; Family leave</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right"><strong className="block text-3xl font-black leading-none text-[#24443b]">{page?.totalCount ?? "—"}</strong><span className="text-xs font-semibold text-[#86968e]">forms</span></div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh forms" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe6df] bg-white text-[#527668] hover:bg-[#f2f8f3] disabled:opacity-50"><RefreshCw size={17} /></button>
        </div>
      </header>

      {error && !selected ? <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading leave forms">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[232px] animate-pulse rounded-[24px] bg-[#f1f5f2]" />)}
        </div>
      ) : page?.requests.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {page.requests.map((request, index) => <FormCard key={request.id} request={request} number={firstNumber + index} onOpen={() => { setError(""); setSelectedId(request.id); }} />)}
        </div>
      ) : (
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#dae6dd] bg-[#fbfdfb] p-8 text-center">
          <FileText size={30} className="mb-4 text-[#91b9a3]" />
          <h2 className="text-lg font-bold">No forms yet</h2>
          <p className="mt-1 text-sm text-[#83918b]">Submitted forms will appear here.</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#e4e9e6] pt-5">
        <span className="text-xs font-semibold text-[#84948d]">{page?.totalCount ? `Showing ${firstNumber}–${lastNumber} of ${page.totalCount}` : "0 forms"}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPageIndex((index) => Math.max(0, index - 1))} disabled={loading || pageIndex === 0} className="flex h-10 items-center gap-1.5 rounded-full border border-[#dce7df] bg-white px-4 text-xs font-bold text-[#47695b] hover:bg-[#f4f9f5] disabled:opacity-35"><ChevronLeft size={15} /> Previous</button>
          <span className="px-2 text-xs font-bold text-[#547065]">{pageIndex + 1}</span>
          <button type="button" onClick={nextPage} disabled={loading || !page?.nextCursor} className="flex h-10 items-center gap-1.5 rounded-full border border-[#dce7df] bg-white px-4 text-xs font-bold text-[#47695b] hover:bg-[#f4f9f5] disabled:opacity-35">Next <ChevronRight size={15} /></button>
        </div>
      </div>

      <DialogPrimitive.Root open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        {selected ? <FormDrawer request={selected} supervisors={supervisors} busy={busyId === selected.id} pendingSelection={pendingSelection} error={error} onAssign={(key) => void assignSupervisor(selected.id, key)} onDelete={() => void deleteRequest(selected)} /> : null}
      </DialogPrimitive.Root>
    </div>
  );
}
