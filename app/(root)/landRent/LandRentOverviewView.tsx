/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  calcOverviewTotals,
  filterOverviewRows,
  getThisMonthKey,
} from "@/components/landRent/Overview/landRentOverview.utils";
import OverviewCards from "@/components/landRent/Overview/OverviewCards";
import OverviewHeader from "@/components/landRent/Overview/OverviewHeader";
import OverviewSkeleton from "@/components/landRent/Overview/OverviewSkeleton";
import OverviewStats from "@/components/landRent/Overview/OverviewStats";
import OverviewTable from "@/components/landRent/Overview/OverviewTable";
import { useLandRentOverview } from "@/components/landRent/Overview/useLandRentOverview";
import type { LandRentOverviewUIRow } from "@/components/landRent/Overview/landRentOverview.utils";
import { useUser } from "@/Providers/UserProvider";
import {
  deleteLandRentLease,
  updateLandRentLease,
} from "@/lib/landrent/landRent.actions";
import { useMemo, useState } from "react";

type LeaseFormState = {
  landName: string;
  renterName: string;
  agreementNumber: string;
  rentStartDate: string;
  rentEndDate: string;
  letGoDate: string;
  lastPaymentDate: string;
  sizeSqft: string;
  rate: string;
  paymentDueDay: string;
  finePerDay: string;
};

function dateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function numberText(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n !== 0 ? String(n) : "";
}

function formFromLease(row: LandRentOverviewUIRow): LeaseFormState {
  return {
    landName: row.landName ?? "",
    renterName: row.tenantName ?? "",
    agreementNumber: row.agreementNumber ?? "",
    rentStartDate: dateInputValue(row.startDate),
    rentEndDate: dateInputValue(row.endDate),
    letGoDate: dateInputValue(row.releasedDate),
    lastPaymentDate: dateInputValue(row.lastPaymentDate),
    sizeSqft: numberText(row.sizeSqft),
    rate: numberText(row.rateLariPerSqft),
    paymentDueDay: numberText(row.paymentDueDay ?? 10) || "10",
    finePerDay: numberText(row.fineLariPerDay),
  };
}

function parseNumber(value: string) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function LandRentOverviewView({
  initialRows,
}: {
  initialRows?: LandRentOverviewUIRow[];
}) {
  const { rows, loading, error, refetch } = useLandRentOverview(initialRows);
  const { isAdmin } = useUser();
  const [q, setQ] = useState("");
  const [editingLease, setEditingLease] =
    useState<LandRentOverviewUIRow | null>(null);
  const [deleteLease, setDeleteLease] =
    useState<LandRentOverviewUIRow | null>(null);
  const [form, setForm] = useState<LeaseFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const monthKey = useMemo(() => getThisMonthKey(), []);
  const filtered = useMemo(() => filterOverviewRows(rows, q), [rows, q]);
  const totals = useMemo(() => calcOverviewTotals(filtered), [filtered]);

  const openEdit = (row: LandRentOverviewUIRow) => {
    setEditingLease(row);
    setForm(formFromLease(row));
    setActionError(null);
  };

  const closeEdit = () => {
    if (busy) return;
    setEditingLease(null);
    setForm(null);
    setActionError(null);
  };

  const saveEdit = async () => {
    if (!editingLease || !form) return;

    setBusy(true);
    setActionError(null);
    try {
      await updateLandRentLease({
        leaseId: editingLease.leaseId,
        landName: form.landName,
        renterName: form.renterName,
        agreementNumber: form.agreementNumber,
        rentStartDate: form.rentStartDate,
        rentEndDate: form.rentEndDate,
        letGoDate: form.letGoDate || null,
        lastPaymentDate: form.lastPaymentDate || null,
        sizeSqft: parseNumber(form.sizeSqft),
        rate: parseNumber(form.rate),
        paymentDueDay: parseNumber(form.paymentDueDay),
        finePerDay: parseNumber(form.finePerDay),
      });
      await refetch();
      setEditingLease(null);
      setForm(null);
      setActionError(null);
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to update lease.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteLease) return;

    setBusy(true);
    setActionError(null);
    try {
      await deleteLandRentLease({ leaseId: deleteLease.leaseId });
      await refetch();
      setDeleteLease(null);
    } catch (e: any) {
      setActionError(e?.message ?? "Failed to delete lease.");
    } finally {
      setBusy(false);
    }
  };

  const updateForm = (patch: Partial<LeaseFormState>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 space-y-6">
      {/* Clean card (no gradient frame) */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <OverviewHeader
          q={q}
          setQ={setQ}
          loading={loading}
          filteredCount={filtered.length}
          totalCount={rows.length}
        />

        <div className="mt-5">
          <OverviewStats
            loading={loading}
            totals={{
              totalLeases: totals.totalLeases,
              totalMonthly: totals.totalMonthly,
              totalOutstanding: totals.totalOutstanding,
            }}
          />
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        ) : null}
      </div>

      {loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <OverviewTable
            rows={filtered}
            monthKey={monthKey}
            isAdmin={isAdmin}
            onEditLease={openEdit}
            onDeleteLease={(row) => {
              setDeleteLease(row);
              setActionError(null);
            }}
          />
          <OverviewCards
            rows={filtered}
            monthKey={monthKey}
            isAdmin={isAdmin}
            onEditLease={openEdit}
            onDeleteLease={(row) => {
              setDeleteLease(row);
              setActionError(null);
            }}
          />
        </>
      )}

      {editingLease && form ? (
        <LeaseModal title="Edit Lease" onClose={closeEdit}>
          <div className="grid gap-4 md:grid-cols-2">
            <EditField label="Land name">
              <input
                value={form.landName}
                onChange={(e) => updateForm({ landName: e.target.value })}
                className={editInputClass}
              />
            </EditField>
            <EditField label="Renter name">
              <input
                value={form.renterName}
                onChange={(e) => updateForm({ renterName: e.target.value })}
                className={editInputClass}
              />
            </EditField>
            <EditField label="Agreement number">
              <input
                value={form.agreementNumber}
                onChange={(e) =>
                  updateForm({ agreementNumber: e.target.value })
                }
                className={editInputClass}
              />
            </EditField>
            <EditField label="Let go date">
              <input
                type="date"
                value={form.letGoDate}
                onChange={(e) => updateForm({ letGoDate: e.target.value })}
                className={editInputClass}
              />
            </EditField>
            <EditField label="Last payment date">
              <input
                type="date"
                value={form.lastPaymentDate}
                onChange={(e) =>
                  updateForm({ lastPaymentDate: e.target.value })
                }
                className={editInputClass}
              />
            </EditField>
            <EditField label="Rent start">
              <input
                type="date"
                value={form.rentStartDate}
                onChange={(e) =>
                  updateForm({ rentStartDate: e.target.value })
                }
                className={editInputClass}
              />
            </EditField>
            <EditField label="Rent end">
              <input
                type="date"
                value={form.rentEndDate}
                onChange={(e) => updateForm({ rentEndDate: e.target.value })}
                className={editInputClass}
              />
            </EditField>
            <EditField label="Size">
              <input
                value={form.sizeSqft}
                onChange={(e) => updateForm({ sizeSqft: e.target.value })}
                className={editInputClass}
              />
            </EditField>
            <EditField label="Rate">
              <input
                value={form.rate}
                onChange={(e) => updateForm({ rate: e.target.value })}
                className={editInputClass}
              />
            </EditField>
            <EditField label="Payment due day">
              <input
                value={form.paymentDueDay}
                onChange={(e) =>
                  updateForm({ paymentDueDay: e.target.value })
                }
                className={editInputClass}
              />
            </EditField>
            <EditField label="Fine per day">
              <input
                value={form.finePerDay}
                onChange={(e) => updateForm({ finePerDay: e.target.value })}
                className={editInputClass}
              />
            </EditField>
          </div>

          {actionError ? (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {actionError}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEdit}
              disabled={busy}
              className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy}
              className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </LeaseModal>
      ) : null}

      {deleteLease ? (
        <LeaseModal
          title="Delete Lease"
          onClose={() => {
            if (!busy) {
              setDeleteLease(null);
              setActionError(null);
            }
          }}
        >
          <p className="text-sm leading-6 text-slate-600">
            This will permanently delete the lease for{" "}
            <span className="font-semibold text-slate-900">
              {deleteLease.landName}
            </span>
            , including its statements and payments.
          </p>

          {actionError ? (
            <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
              {actionError}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteLease(null)}
              disabled={busy}
              className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {busy ? "Deleting..." : "Delete lease"}
            </button>
          </div>
        </LeaseModal>
      ) : null}
    </div>
  );
}

const editInputClass =
  "h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition focus:outline-none focus:ring-2 focus:ring-emerald-200";

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-semibold text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function LeaseModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35"
      />
      <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="text-lg font-bold text-slate-900">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-100"
            >
              Close
            </button>
          </div>
          <div className="max-h-[76vh] overflow-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
