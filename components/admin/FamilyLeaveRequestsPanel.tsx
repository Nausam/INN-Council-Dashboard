"use client";

import {
  assignFamilyLeaveAcceptor,
  assignFamilyLeaveSupervisor,
  deleteFamilyLeaveRequest,
  listFamilyLeaveFormFiles,
  listFamilyLeaveRequests,
  listLeaveAcceptors,
  listLeaveSupervisors,
  reviewFamilyLeaveRequest,
  type FamilyLeaveFormFile,
  type FamilyLeaveRequestPage,
  type FamilyLeaveRequestSummary,
  type LeaveAcceptorOption,
  type LeaveSupervisorOption,
} from "@/lib/actions/family-leave.actions";
import type { FamilyLeaveEdit } from "@/components/Leave/FamilyLeaveRequestDialog";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { fileProxyUrl } from "@/lib/files";
import { isSalaamKind, SALAAM_FAMILY_LEAVE_TYPES, type SalaamFamilyLeaveType } from "@/lib/leave/salaam-family-types";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { zipSync } from "fflate";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileBadge,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useState } from "react";

const FamilyLeaveRequestDialog = dynamic(() =>
  import("@/components/Leave/FamilyLeaveRequestDialog").then((module) => module.FamilyLeaveRequestDialog),
);

const PAGE_SIZE = 12;
const VIEW_STORAGE_KEY = "leave-forms-view";
const dhivehiFont = { fontFamily: "Faruma, sans-serif" };

type ViewMode = "grid" | "list";

/** A pending form opened in the leave form dialog, kept apart from the page so a refresh doesn't reset it. */
type EditingForm = { employeeId: string; leaveType: SalaamFamilyLeaveType; edit: FamilyLeaveEdit };

function leaveTypeLabel(leaveType: SalaamFamilyLeaveType | undefined) {
  return SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === leaveType)?.labelEn ?? "Leave";
}

function typeLabel(request: FamilyLeaveRequestSummary) {
  return leaveTypeLabel(request.leaveType);
}

/** The list's narrow Type column fits only short names. */
function shortTypeLabel(request: FamilyLeaveRequestSummary) {
  return request.leaveType === "family" ? "Family Leave" : typeLabel(request);
}

function formUrl(requestId: string) {
  return `/api/admin/family-leave-requests/${encodeURIComponent(requestId)}/form`;
}

/** Any form can change except the oldest ones, which don't record their leave type. */
function canEdit(request: FamilyLeaveRequestSummary) {
  return Boolean(request.leaveType);
}

function statusPillClass(status: FamilyLeaveRequestSummary["approvalStatus"]) {
  return status === "Approved"
    ? "bg-[#e0f2e9] text-[#167a67]"
    : status === "Rejected"
      ? "bg-rose-100 text-rose-700"
      : "bg-amber-100 text-amber-800";
}

/** File-system safe name, unique within the zip. */
function formFileName(form: FamilyLeaveFormFile, taken: Set<string>) {
  const base = [form.employeeName || form.id, leaveTypeLabel(form.leaveType), form.date]
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  let name = `${base}.docx`;
  for (let n = 2; taken.has(name); n += 1) name = `${base} (${n}).docx`;
  taken.add(name);
  return name;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const ACCEPTOR_SELECT_ID = "leave-form-acceptor";

function reasonLabel(request: FamilyLeaveRequestSummary, reason: string) {
  const leaveType = SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === request.leaveType)?.labelDv;
  return leaveType ? `${leaveType} - ${reason}` : reason;
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

function leaveRangeLabel(request: FamilyLeaveRequestSummary) {
  if (!request.leaveStartDate || !request.leaveEndDate) return dateLabel(request.requestDate);
  const start = dateLabel(request.leaveStartDate);
  const end = dateLabel(request.leaveEndDate);
  return start === end ? start : `${start} – ${end}`;
}

function FormCard({
  request,
  number,
  onOpen,
  onDelete,
  busy,
}: {
  request: FamilyLeaveRequestSummary;
  number: number;
  onOpen: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const salaam = isSalaamKind(request.leaveType);
  return (
    <div className="relative">
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
      <span className="relative flex w-full items-center justify-between gap-2 pr-10">
        <span className="text-xs font-bold tracking-[0.16em] text-[#7a8987]">{String(number).padStart(2, "0")}</span>
        <span className="flex items-center gap-1.5">
          <span className={cn("rounded-full bg-white/80 px-3 py-1 text-[11px] font-extrabold", salaam ? "text-[#167a67]" : "text-[#8059a2]")}>{typeLabel(request)}</span>
          <span className={cn("rounded-full px-3 py-1 text-[11px] font-extrabold", statusPillClass(request.approvalStatus))}>{request.approvalStatus || "Pending"}</span>
        </span>
      </span>

      <span className="relative mt-8 flex min-w-0 items-center gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black", salaam ? "bg-[#c8ebdd] text-[#126a5b]" : "bg-[#e9d8f5] text-[#774b9b]")}>
          {request.employeeName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-black tracking-tight text-[#1c2d2e]">{request.employeeName}</span>
          <span className="mt-0.5 block text-xs font-medium text-[#7b8a8b]">{leaveRangeLabel(request)}{request.durationDays && request.durationDays > 1 ? ` · ${request.durationDays} days` : ""}</span>
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
    <button type="button" onClick={onDelete} disabled={busy} aria-label={`Delete ${request.employeeName}'s leave form`} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-rose-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={15} /></button>
    </div>
  );
}

const LIST_COLUMNS = "lg:grid-cols-[2.5rem_minmax(0,1.6fr)_8.5rem_minmax(0,1.4fr)_6.5rem_minmax(0,1fr)_auto]";
const rowIconButton = "flex h-9 w-9 items-center justify-center rounded-full border border-[#e1ebe5] bg-white transition disabled:pointer-events-none disabled:opacity-35";

function FormRow({
  request,
  number,
  onOpen,
  onEdit,
  onDownload,
  onDelete,
  busy,
  downloading,
}: {
  request: FamilyLeaveRequestSummary;
  number: number;
  onOpen: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
  busy: boolean;
  downloading: boolean;
}) {
  const salaam = isSalaamKind(request.leaveType);
  const editable = canEdit(request);
  const range = `${leaveRangeLabel(request)}${request.durationDays && request.durationDays > 1 ? ` · ${request.durationDays} days` : ""}`;
  return (
    <li className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-[#f7fbf9] sm:px-5", LIST_COLUMNS)}>
      <span className="hidden text-xs font-bold tracking-[0.16em] text-[#7a8987] lg:block">{String(number).padStart(2, "0")}</span>
      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#158577]" aria-label={`Open ${typeLabel(request)} form for ${request.employeeName}`}>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black", salaam ? "bg-[#c8ebdd] text-[#126a5b]" : "bg-[#e9d8f5] text-[#774b9b]")}>
          {request.employeeName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-[#1c2d2e] hover:underline">{request.employeeName}</span>
          <span className="mt-0.5 block truncate text-xs font-medium text-[#7b8a8b] lg:hidden">{shortTypeLabel(request)} · {range}</span>
        </span>
      </button>
      <span className="hidden lg:block"><span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold", salaam ? "bg-[#f1faf6] text-[#167a67]" : "bg-[#f8f4fb] text-[#8059a2]")}>{shortTypeLabel(request)}</span></span>
      <span className="hidden truncate text-sm font-semibold text-[#3c5553] lg:block">{range}</span>
      <span className="hidden lg:block"><span className={cn("rounded-full px-3 py-1 text-[11px] font-extrabold", statusPillClass(request.approvalStatus))}>{request.approvalStatus || "Pending"}</span></span>
      <span className="hidden min-w-0 items-center gap-2 truncate text-xs font-semibold text-[#526c6a] lg:flex">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", request.supervisor ? "bg-[#25a880]" : "bg-[#dcab6d]")} />
        <span className="truncate">{request.supervisor ? request.supervisor.name : "Needs supervisor"}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold lg:hidden", statusPillClass(request.approvalStatus))}>{request.approvalStatus || "Pending"}</span>
        <button type="button" onClick={onEdit} disabled={busy || !editable} title={editable ? "Edit form" : "This form is too old to edit"} aria-label={`Edit ${request.employeeName}'s leave form`} className={cn(rowIconButton, "text-[#3f6f62] hover:bg-[#eef7f2]")}><Pencil size={15} /></button>
        <button type="button" onClick={onDownload} disabled={busy || downloading} title={downloading ? "Downloading…" : "Download form"} aria-label={downloading ? `Downloading ${request.employeeName}'s leave form` : `Download ${request.employeeName}'s leave form`} aria-busy={downloading} className={cn(rowIconButton, "text-[#1e4642] hover:bg-[#eef7f2]", downloading && "disabled:opacity-100")}>{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}</button>
        <button type="button" onClick={onDelete} disabled={busy} title="Delete form" aria-label={`Delete ${request.employeeName}'s leave form`} className={cn(rowIconButton, "text-rose-500 hover:bg-rose-50 hover:text-rose-600")}><Trash2 size={15} /></button>
      </span>
    </li>
  );
}

function FormList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#e4ece7] bg-white">
      <div className={cn("hidden gap-x-4 border-b border-[#edf2ef] bg-[#f8fbf9] px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#82918d] lg:grid", LIST_COLUMNS)}>
        <span>#</span><span>Employee</span><span>Type</span><span>Leave dates</span><span>Status</span><span>Supervisor</span><span className="w-[7.5rem] text-right">Actions</span>
      </div>
      <ul className="divide-y divide-[#edf2ef]">{children}</ul>
    </div>
  );
}

function ReceiverPrompt({
  request,
  acceptors,
  busy,
  error,
  onConfirm,
}: {
  request: FamilyLeaveRequestSummary;
  acceptors: LeaveAcceptorOption[];
  busy: boolean;
  error: string;
  onConfirm: (employeeId: string) => void;
}) {
  const [choice, setChoice] = useState("");
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#102c2a]/45 backdrop-blur-[4px]" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 shadow-[0_28px_90px_rgba(12,39,34,0.24)] focus:outline-none sm:p-7">
        <form onSubmit={(event) => { event.preventDefault(); if (choice) onConfirm(choice); }}>
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dff3e8] text-[#217b60]"><UserRound size={22} /></span>
            <DialogPrimitive.Close className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dfebe3] bg-white text-[#54736d] transition hover:bg-[#e8f2ec]" aria-label="Cancel"><X size={18} /></DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="mt-4 text-xl font-black tracking-tight text-[#152c2b]">Who received this form?</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-[#70857b]">{request.employeeName}&apos;s {typeLabel(request).toLowerCase()} form needs the receiving employee before it can be downloaded.</DialogPrimitive.Description>
          {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
          <div className="relative mt-5">
            <select
              aria-label="Select employee who received the form"
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              disabled={busy}
              autoFocus
              className="h-12 w-full appearance-none rounded-xl border border-[#d9e4dd] bg-white px-4 pr-10 text-sm font-semibold text-[#25423a] outline-none focus:border-[#5aa48a] focus:ring-2 focus:ring-[#e2f4e9] disabled:opacity-50"
            >
              <option value="">Choose an employee</option>
              {acceptors.map((acceptor) => <option key={acceptor.employeeId} value={acceptor.employeeId} disabled={!acceptor.ready}>{acceptor.name}{acceptor.ready ? "" : " · Dhivehi details needed"}</option>)}
            </select>
            <ChevronDown size={17} className="pointer-events-none absolute right-4 top-4 text-[#78958a]" />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <DialogPrimitive.Close type="button" disabled={busy} className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-bold text-[#54736d] hover:bg-[#eef7f2] disabled:opacity-50">Cancel</DialogPrimitive.Close>
            <button type="submit" disabled={busy || !choice} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#182b29] px-5 text-sm font-bold text-white hover:bg-[#286b5c] disabled:opacity-50">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Save &amp; download
            </button>
          </div>
        </form>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function FormDrawer({
  request,
  supervisors,
  acceptors,
  busy,
  downloading,
  pendingSupervisorSelection,
  pendingAcceptorSelection,
  error,
  onAssignSupervisor,
  onAssignAcceptor,
  onReview,
  onEdit,
  onDownload,
  onDelete,
}: {
  request: FamilyLeaveRequestSummary;
  supervisors: LeaveSupervisorOption[];
  acceptors: LeaveAcceptorOption[];
  busy: boolean;
  downloading: boolean;
  pendingSupervisorSelection: string | null;
  pendingAcceptorSelection: string | null;
  error: string;
  onAssignSupervisor: (supervisorKey: string) => void;
  onAssignAcceptor: (employeeId: string) => void;
  onReview: (status: "Approved" | "Rejected") => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
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
            <div className="flex items-center gap-3 rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-3.5"><CalendarDays size={18} className="shrink-0 text-[#398c7a]" /><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#82918d]">{request.leaveStartDate ? "Leave dates" : "Date"}</span><strong className="block text-sm text-[#263d39]">{leaveRangeLabel(request)}</strong></span></div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#e7efea] bg-[#fafcfb] p-3.5"><Clock3 size={18} className="shrink-0 text-[#398c7a]" /><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#82918d]">Reported time</span><strong className="block text-sm text-[#263d39]">{request.reportedTime} MVT</strong></span></div>
          </div>

          {request.employeeNameDv ? <p dir="rtl" lang="dv" style={dhivehiFont} className="rounded-2xl border border-[#e7ede9] px-4 py-3 text-right text-xl leading-relaxed text-[#314c46]">{request.employeeNameDv}</p> : null}

          <section>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#778b85]">Reason</h3>
            <p dir="rtl" lang="dv" style={dhivehiFont} className="min-h-[76px] whitespace-pre-wrap break-words rounded-2xl border border-[#e7ede9] bg-white px-5 py-4 text-right text-xl leading-loose text-[#243c38]">{reasonLabel(request, request.reason)}</p>
          </section>

          {!request.leaveStartDate && request.secondDay ? (
            <section>
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#778b85]">Day 2 · {dateLabel(request.secondDay.date)} · {request.secondDay.time}</h3>
              <p dir="rtl" lang="dv" style={dhivehiFont} className="whitespace-pre-wrap break-words rounded-2xl border border-[#e7ede9] bg-white px-5 py-4 text-right text-xl leading-loose text-[#243c38]">{reasonLabel(request, request.secondDay.reason)}</p>
            </section>
          ) : null}

          {!request.leaveStartDate && request.additionalDetails ? (
            <section>
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#778b85]">More than 2 days · {dateLabel(request.additionalDetails.date)} · {request.additionalDetails.time}</h3>
              <p dir="rtl" lang="dv" style={dhivehiFont} className="whitespace-pre-wrap break-words rounded-2xl border border-[#e7ede9] bg-white px-5 py-4 text-right text-xl leading-loose text-[#243c38]">{reasonLabel(request, request.additionalDetails.reason)}</p>
            </section>
          ) : null}

          <div className="grid grid-cols-2 gap-3 border-t border-[#e8eeea] pt-5">
            <section className="min-w-0">
              <div className="mb-3 flex min-h-10 items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#203b35] sm:text-base"><UserRound size={19} className="hidden shrink-0 text-[#458e7a] sm:block" /> Supervisor</h3>
                <span className={cn("hidden rounded-full px-3 py-1 text-[11px] font-bold sm:inline-flex", request.supervisor ? "bg-[#e6f5ed] text-[#1e8066]" : "bg-[#fff3df] text-[#a66a29]")}>{request.supervisor ? "Assigned" : "Pending"}</span>
              </div>
              <div className="relative">
                <select
                  aria-label="Select supervisor"
                  value={busy && pendingSupervisorSelection ? pendingSupervisorSelection : request.supervisor?.key ?? ""}
                  onChange={(event) => onAssignSupervisor(event.target.value)}
                  disabled={busy}
                  className="h-12 w-full appearance-none rounded-xl border border-[#d9e4dd] bg-white px-3 pr-8 text-sm font-semibold text-[#25423a] outline-none focus:border-[#5aa48a] focus:ring-2 focus:ring-[#e2f4e9] disabled:opacity-50 sm:px-4 sm:pr-10"
                >
                  <option value="">Choose a supervisor</option>
                  {supervisors.map((supervisor) => <option key={supervisor.key} value={supervisor.key} disabled={!supervisor.ready}>{supervisor.label}{supervisor.ready ? "" : " · Dhivehi details needed"}</option>)}
                </select>
                <ChevronDown size={17} className="pointer-events-none absolute right-3 top-4 text-[#78958a] sm:right-4" />
              </div>
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex min-h-10 items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#203b35] sm:text-base"><UserRound size={19} className="hidden shrink-0 text-[#458e7a] sm:block" /> Form received by</h3>
                <span className={cn("hidden rounded-full px-3 py-1 text-[11px] font-bold sm:inline-flex", request.acceptor ? "bg-[#e6f5ed] text-[#1e8066]" : "bg-[#fff3df] text-[#a66a29]")}>{request.acceptor ? "Assigned" : "Pending"}</span>
              </div>
              <div className="relative">
                <select
                  id={ACCEPTOR_SELECT_ID}
                  aria-label="Select employee who receives the form"
                  value={busy && pendingAcceptorSelection ? pendingAcceptorSelection : request.acceptor?.employeeId ?? ""}
                  onChange={(event) => onAssignAcceptor(event.target.value)}
                  disabled={busy}
                  className="h-12 w-full appearance-none rounded-xl border border-[#d9e4dd] bg-white px-3 pr-8 text-sm font-semibold text-[#25423a] outline-none focus:border-[#5aa48a] focus:ring-2 focus:ring-[#e2f4e9] disabled:opacity-50 sm:px-4 sm:pr-10"
                >
                  <option value="">Choose an employee</option>
                  {acceptors.map((acceptor) => <option key={acceptor.employeeId} value={acceptor.employeeId} disabled={!acceptor.ready}>{acceptor.name}{acceptor.ready ? "" : " · Dhivehi details needed"}</option>)}
                </select>
                <ChevronDown size={17} className="pointer-events-none absolute right-3 top-4 text-[#78958a] sm:right-4" />
              </div>
            </section>
          </div>
          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8eeea] pt-5">
            <div><h3 className="text-sm font-extrabold text-[#203b35]">Approval</h3><p className="mt-1 text-xs text-[#70857b]">{request.approvalStatus || "Pending"}{request.reviewedAt ? ` · ${dateLabel(request.reviewedAt.slice(0, 10))}` : ""}</p></div>
            <div className="flex gap-2">
              {request.approvalStatus !== "Approved" ? <button type="button" onClick={() => onReview("Approved")} disabled={busy || !request.supervisor} className="rounded-xl bg-[#1e8066] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Approve</button> : null}
              {request.approvalStatus !== "Rejected" ? <button type="button" onClick={() => onReview("Rejected")} disabled={busy} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">Reject</button> : null}
            </div>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#edf0ed] bg-white px-5 py-4 sm:px-7">
          <p className="hidden min-w-0 flex-1 truncate text-xs text-[#93a29b] sm:block">Submitted by {request.submittedBy}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onDelete} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={17} /> Delete</button>
            {canEdit(request) ? (
              <button type="button" onClick={onEdit} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#dfebe3] bg-white px-4 text-sm font-bold text-[#2f5f53] hover:bg-[#eef7f2] disabled:opacity-50"><Pencil size={16} /> Edit</button>
            ) : null}
            {request.certificate ? (
              <a href={fileProxyUrl(request.certificate.key)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d9ebe5] bg-[#f1faf6] px-4 text-sm font-bold text-[#167a67] hover:bg-[#e4f4ec]"><FileBadge size={17} /> Certificate</a>
            ) : null}
            <button type="button" onClick={onDownload} disabled={busy || downloading} aria-busy={downloading} className={cn("inline-flex h-11 items-center gap-2 rounded-xl bg-[#182b29] px-5 text-sm font-bold text-white hover:bg-[#286b5c] disabled:opacity-50", downloading && "cursor-progress disabled:opacity-80")}>{downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} {downloading ? "Downloading…" : "Download form"}</button>
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
  const [acceptors, setAcceptors] = useState<LeaveAcceptorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pendingSupervisorSelection, setPendingSupervisorSelection] = useState<string | null>(null);
  const [pendingAcceptorSelection, setPendingAcceptorSelection] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<ViewMode>("grid");
  const [editing, setEditing] = useState<EditingForm | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [receiverFor, setReceiverFor] = useState<FamilyLeaveRequestSummary | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_STORAGE_KEY) === "list") setView("list");
    } catch {
      // Storage can be blocked; the grid is the default.
    }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Only a convenience.
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([listFamilyLeaveRequests(cursors[pageIndex]), listLeaveSupervisors(), listLeaveAcceptors()])
      .then(([nextPage, roster, employeeRoster]) => {
        if (!active) return;
        setPage(nextPage);
        setSupervisors(roster);
        setAcceptors(employeeRoster);
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
  const queryClient = useQueryClient();
  // Approvals mark attendance and change leave balances, so drop those caches too.
  const refresh = () => {
    setRevision((value) => value + 1);
    for (const queryKey of [["attendance"], ["employees"], ["dashboard"]]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const assignSupervisor = async (requestId: string, supervisorKey: string) => {
    if (!supervisorKey) return;
    const choice = supervisors.find((supervisor) => supervisor.key === supervisorKey);
    if (!choice?.ready) {
      setError(`Add ${choice?.label ?? "the supervisor"}'s Dhivehi details in the employee edit form first.`);
      return;
    }
    setBusyId(requestId);
    setPendingSupervisorSelection(supervisorKey);
    setError("");
    try {
      await assignFamilyLeaveSupervisor(requestId, supervisorKey);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign supervisor.");
    } finally {
      setBusyId(null);
      setPendingSupervisorSelection(null);
    }
  };

  const assignAcceptor = async (requestId: string, employeeId: string) => {
    if (!employeeId) return false;
    const choice = acceptors.find((acceptor) => acceptor.employeeId === employeeId);
    if (!choice?.ready) {
      setError(`Add ${choice?.name ?? "the employee"}'s Dhivehi name and designation in the employee edit form first.`);
      return false;
    }
    setBusyId(requestId);
    setPendingAcceptorSelection(employeeId);
    setError("");
    try {
      await assignFamilyLeaveAcceptor(requestId, employeeId);
      refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign the receiving employee.");
      return false;
    } finally {
      setBusyId(null);
      setPendingAcceptorSelection(null);
    }
  };

  // Fetched here rather than by a plain link, so the button can show it is working.
  const fetchForm = async (request: FamilyLeaveRequestSummary) => {
    setDownloadingId(request.id);
    try {
      const response = await fetch(formUrl(request.id), { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `Leave-form-${request.id}.docx`;
      saveBlob(await response.blob(), filename);
    } catch {
      setError(`Could not download ${request.employeeName}'s form. Try again.`);
    } finally {
      setDownloadingId(null);
    }
  };

  // The printed form has a "received by" slot, so ask for it before handing the form out.
  const downloadForm = (request: FamilyLeaveRequestSummary) => {
    setError("");
    if (request.acceptor) {
      void fetchForm(request);
      return;
    }
    if (selectedId === request.id) {
      setError("Select who received the form before downloading it.");
      document.getElementById(ACCEPTOR_SELECT_ID)?.focus();
      return;
    }
    setReceiverFor(request);
  };

  const assignReceiverAndDownload = async (request: FamilyLeaveRequestSummary, employeeId: string) => {
    // The form is rebuilt with the receiver on it before it is downloaded.
    if (!(await assignAcceptor(request.id, employeeId))) return;
    setReceiverFor(null);
    await fetchForm(request);
  };

  const deleteRequest = async (request: FamilyLeaveRequestSummary) => {
    const note = request.attendanceLeave
      ? " Its leave days will be removed from attendance, returned to the balance and fingerprint sign-ins restored."
      : "";
    if (!window.confirm(`Delete ${request.employeeName}'s leave form permanently?${note}`)) return;
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

  const reviewRequest = async (requestId: string, status: "Approved" | "Rejected") => {
    setBusyId(requestId);
    setError("");
    try {
      const result = await reviewFamilyLeaveRequest(requestId, status);
      if (!result.ok) setError(result.message);
      else refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review leave request.");
    } finally {
      setBusyId(null);
    }
  };

  const editRequest = (request: FamilyLeaveRequestSummary) => {
    if (!request.leaveType || !canEdit(request)) return;
    if (
      request.approvalStatus === "Approved" &&
      request.attendanceLeave &&
      !window.confirm(`${request.employeeName}'s form is approved. Changing its dates will move the leave in attendance and adjust the leave balance. Continue?`)
    ) {
      return;
    }
    const startDate = request.leaveStartDate ?? request.requestDate;
    setError("");
    setSelectedId(null);
    setEditing({
      employeeId: request.employeeId,
      leaveType: request.leaveType,
      edit: {
        id: request.id,
        startDate,
        endDate: request.leaveEndDate ?? startDate,
        reason: request.reason,
        certificateUrl: request.certificate ? fileProxyUrl(request.certificate.key) : undefined,
      },
    });
  };

  const downloadAll = async () => {
    if (zipProgress) return;
    setError("");
    setZipProgress({ done: 0, total: 0 });
    try {
      const forms = await listFamilyLeaveFormFiles();
      if (!forms.length) {
        setError("There are no forms to download.");
        return;
      }
      const noReceiver = forms.filter((form) => !form.hasReceiver).map((form) => form.employeeName || form.id);
      if (noReceiver.length) {
        const names = noReceiver.slice(0, 5).join(", ") + (noReceiver.length > 5 ? ` and ${noReceiver.length - 5} more` : "");
        const proceed = window.confirm(
          `${noReceiver.length} of ${forms.length} forms don't say who received them yet (${names}). Choose the receiver on those forms first, or download them anyway without it?

OK downloads anyway.`,
        );
        if (!proceed) return;
      }
      setZipProgress({ done: 0, total: forms.length });
      const files: Record<string, Uint8Array> = {};
      const taken = new Set<string>();
      const failed: string[] = [];
      let next = 0;
      let done = 0;
      // A few at a time keeps the browser and the server from queueing dozens of requests.
      const worker = async () => {
        while (next < forms.length) {
          const form = forms[next++];
          try {
            const response = await fetch(formUrl(form.id), { cache: "no-store" });
            if (!response.ok) throw new Error(String(response.status));
            files[formFileName(form, taken)] = new Uint8Array(await response.arrayBuffer());
          } catch {
            failed.push(form.employeeName || form.id);
          }
          setZipProgress({ done: ++done, total: forms.length });
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, forms.length) }, worker));
      if (!Object.keys(files).length) {
        setError("Could not download any of the forms.");
        return;
      }
      // The forms are already compressed, so storing them is as small and much faster.
      const zip = zipSync(files, { level: 0 });
      saveBlob(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), `Leave-forms-${maldivesDateTime().date}.zip`);
      if (failed.length) setError(`Downloaded ${forms.length - failed.length} of ${forms.length} forms. Missing: ${failed.join(", ")}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the forms.");
    } finally {
      setZipProgress(null);
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
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="text-right"><strong className="block text-3xl font-black leading-none text-[#24443b]">{page?.totalCount ?? "—"}</strong><span className="text-xs font-semibold text-[#86968e]">forms</span></div>
          <div role="group" aria-label="Layout" className="flex h-11 items-center rounded-full border border-[#dbe6df] bg-white p-1">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([mode, Icon, label]) => (
              <button key={mode} type="button" onClick={() => changeView(mode)} aria-pressed={view === mode} aria-label={label} title={label} className={cn("flex h-9 w-9 items-center justify-center rounded-full transition", view === mode ? "bg-[#e3f3ea] text-[#1e6b58]" : "text-[#7b958b] hover:bg-[#f2f8f3]")}><Icon size={16} /></button>
            ))}
          </div>
          <button type="button" onClick={() => void downloadAll()} disabled={Boolean(zipProgress) || !page?.totalCount} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#182b29] px-4 text-sm font-bold text-white hover:bg-[#286b5c] disabled:opacity-50">
            {zipProgress ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {zipProgress ? (zipProgress.total ? `${zipProgress.done}/${zipProgress.total}` : "Preparing…") : "Download all"}
          </button>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh forms" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe6df] bg-white text-[#527668] hover:bg-[#f2f8f3] disabled:opacity-50"><RefreshCw size={17} /></button>
        </div>
      </header>

      {error && !selected && !receiverFor ? <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      {loading ? (
        view === "list" ? (
          <div className="space-y-2" aria-label="Loading leave forms">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-2xl bg-[#f1f5f2]" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading leave forms">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[232px] animate-pulse rounded-[24px] bg-[#f1f5f2]" />)}
          </div>
        )
      ) : page?.requests.length ? (
        view === "list" ? (
          <FormList>
            {page.requests.map((request, index) => <FormRow key={request.id} request={request} number={firstNumber + index} busy={busyId === request.id} downloading={downloadingId === request.id} onOpen={() => { setError(""); setSelectedId(request.id); }} onEdit={() => editRequest(request)} onDownload={() => downloadForm(request)} onDelete={() => void deleteRequest(request)} />)}
          </FormList>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {page.requests.map((request, index) => <FormCard key={request.id} request={request} number={firstNumber + index} busy={busyId === request.id} onOpen={() => { setError(""); setSelectedId(request.id); }} onDelete={() => void deleteRequest(request)} />)}
          </div>
        )
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
        {selected ? <FormDrawer request={selected} supervisors={supervisors} acceptors={acceptors} busy={busyId === selected.id} downloading={downloadingId === selected.id} pendingSupervisorSelection={pendingSupervisorSelection} pendingAcceptorSelection={pendingAcceptorSelection} error={error} onAssignSupervisor={(key) => void assignSupervisor(selected.id, key)} onAssignAcceptor={(employeeId) => void assignAcceptor(selected.id, employeeId)} onReview={(status) => void reviewRequest(selected.id, status)} onEdit={() => editRequest(selected)} onDownload={() => downloadForm(selected)} onDelete={() => void deleteRequest(selected)} /> : null}
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={Boolean(receiverFor)} onOpenChange={(open) => { if (!open && busyId !== receiverFor?.id) { setReceiverFor(null); setError(""); } }}>
        {receiverFor ? <ReceiverPrompt key={receiverFor.id} request={receiverFor} acceptors={acceptors} busy={busyId === receiverFor.id} error={error} onConfirm={(employeeId) => void assignReceiverAndDownload(receiverFor, employeeId)} /> : null}
      </DialogPrimitive.Root>

      {editing ? (
        <FamilyLeaveRequestDialog
          employeeId={editing.employeeId}
          presetLeaveType={editing.leaveType}
          editRequest={editing.edit}
          open
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSubmitted={refresh}
        />
      ) : null}
    </div>
  );
}
