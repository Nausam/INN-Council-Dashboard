"use client";

import { fetchOvertimeRequests } from "@/lib/actions/hr.actions";
import { reviewOvertimeRequest } from "@/lib/actions/overtime-requests.actions";
import type { OvertimeRequest } from "@/lib/firebase/types";
import AdminOvertimeRequestCard from "@/components/overtime/AdminOvertimeRequestCard";
import { OvertimeRequestForm } from "@/components/overtime/OvertimeRequestForm";
import { ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const PAGE_SIZE = 12;

export function OvertimeRequestsPanel() {
  const [data, setData] = useState<{ requests: OvertimeRequest[]; totalCount: number } | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchOvertimeRequests(PAGE_SIZE, pageIndex * PAGE_SIZE)
      .then((result) => { if (active) setData(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load OT requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pageIndex, revision]);

  const refresh = () => setRevision((current) => current + 1);

  async function review(requestId: string, status: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError("");
    try {
      await reviewOvertimeRequest(requestId, status);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the OT request.");
    } finally {
      setBusyId(null);
    }
  }

  const requests = data?.requests ?? [];
  const total = data?.totalCount ?? 0;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-[#e4e9e6] pb-8">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#408d75]"><Clock3 size={15} /> Requests / Overtime</p>
          <h1 className="text-4xl font-black tracking-[-0.045em] text-[#1b302e] sm:text-5xl">Overtime requests<span className="text-[#8cc9b1]">.</span></h1>
          <p className="mt-2 text-sm text-[#84918e]">Submitted OT requests for council staff</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right"><strong className="block text-3xl font-black leading-none text-[#24443b]">{total}</strong><span className="text-xs font-semibold text-[#86968e]">requests</span></div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh OT requests" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe6df] bg-white text-[#527668] disabled:opacity-50"><RefreshCw size={17} /></button>
          <button type="button" onClick={() => setShowForm((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#182b29] px-5 text-sm font-bold text-white hover:bg-[#286b5c]"><Plus size={17} />{showForm ? "Hide form" : "New OT request"}</button>
        </div>
      </header>

      {showForm ? <section className="mb-8 rounded-[28px] border border-[#dce8e0] bg-[#f8fbf9] p-4 sm:p-6" aria-label="New overtime request"><OvertimeRequestForm onSubmitted={() => { setShowForm(false); setPageIndex(0); refresh(); }} /></section> : null}
      {error ? <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading OT requests">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[260px] animate-pulse rounded-[24px] bg-[#f1f5f2]" />)}</div>
      ) : requests.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((request) => <AdminOvertimeRequestCard
            key={request.$id}
            requestId={request.$id}
            workDate={request.workDate}
            details={request.details}
            startTime={request.startTime}
            endTime={request.endTime}
            durationMinutes={request.durationMinutes}
            employees={request.employees ?? []}
            status={request.approvalStatus as "Approved" | "Rejected" | "Pending"}
            actionBy={request.actionBy}
            busy={busyId !== null}
            onApprove={(id) => void review(id, "Approved")}
            onReject={(id) => void review(id, "Rejected")}
          />)}
        </div>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#dae6dd] bg-[#fbfdfb] p-8 text-center"><Clock3 size={30} className="mb-4 text-[#91b9a3]" /><h2 className="text-lg font-bold">No OT requests yet</h2><p className="mt-1 text-sm text-[#83918b]">Submitted overtime requests will appear here.</p></div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#e4e9e6] pt-5">
        <span className="text-xs font-semibold text-[#84948d]">{total ? `Showing ${pageIndex * PAGE_SIZE + 1}–${Math.min((pageIndex + 1) * PAGE_SIZE, total)} of ${total}` : "0 requests"}</span>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setPageIndex((current) => Math.max(0, current - 1))} disabled={loading || pageIndex === 0} className="flex h-10 items-center gap-1 rounded-full border border-[#dce7df] bg-white px-4 text-xs font-bold text-[#47695b] disabled:opacity-35"><ChevronLeft size={15} />Previous</button><span className="px-2 text-xs font-bold text-[#547065]">{pageIndex + 1}</span><button type="button" onClick={() => setPageIndex((current) => current + 1)} disabled={loading || (pageIndex + 1) * PAGE_SIZE >= total} className="flex h-10 items-center gap-1 rounded-full border border-[#dce7df] bg-white px-4 text-xs font-bold text-[#47695b] disabled:opacity-35">Next<ChevronRight size={15} /></button></div>
      </div>
    </div>
  );
}
