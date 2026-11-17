"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import LatestPaymentDateButton from "@/components/landRent/Statement/LatestPaymentDateButton";
import ManualFineButton from "@/components/landRent/Statement/ManualFineButton";
import PaymentEditDialog, { type EditableLandRentPayment } from "@/components/landRent/Statement/PaymentEditDialog";
import StatementDeleteDialog, { type DeletableLandStatement } from "@/components/landRent/Statement/StatementDeleteDialog";
import { downloadElementAsPdf } from "@/components/landRent/Statement/landRentPdf.utils";
import StatementInvoice from "@/components/landRent/Statement/StatementInvoice";
import {
    fmtDateShort,
    fmtMoney,
} from "@/components/landRent/Statement/landRentStatement.utils";
import type { StatementDetails } from "@/components/landRent/Statement/useLandRentStatementPage";
import { CouncilSelect } from "@/components/design-system/council-select";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useMemo, useState } from "react";

function statementOptionLabel(details: any) {
  const monthKey = String(details.statement.monthKey ?? "");
  let month = monthKey;
  try {
    month = format(parseISO(`${monthKey}-01`), "MMMM yyyy");
  } catch {
    // keep the raw month key
  }
  const kind = details.statement.kind === "FINE_ONLY" ? "Fine statement" : "Statement";
  return `${month} · ${kind} · ${details.statement.status}`;
}

export default function StatementsList({
  statements,
  latestInvoiceRef,
  onCollectRemaining,
  onPaymentUpdated,
  onStatementDeleted,
}: {
  statements: StatementDetails[];
  latestInvoiceRef: React.RefObject<HTMLDivElement>;
  onCollectRemaining: (statementId: string) => void;
  onPaymentUpdated: () => Promise<void>;
  onStatementDeleted?: (statementId: string) => Promise<void>;
}) {
  const [editingPayment, setEditingPayment] = useState<EditableLandRentPayment | null>(null);
  const [deletingStatement, setDeletingStatement] = useState<DeletableLandStatement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Show one statement at a time; the newest unless another is picked.
  const selectedIndex = useMemo(() => {
    const index = statements.findIndex((s) => s.statement.$id === selectedId);
    return index >= 0 ? index : statements.length - 1;
  }, [statements, selectedId]);
  const options = useMemo(
    () => statements
      .map((s) => ({ value: s.statement.$id, label: statementOptionLabel(s) }))
      .reverse(),
    [statements],
  );

  const rendered = useMemo(() => {
    if (!statements.length) return null;
    const s = statements[selectedIndex];
    const idx = selectedIndex;

    return (
      <div className="space-y-8">
        {(() => {
          const details = s as any;

          const paymentsTotal = fmtMoney(Number(details.paymentsTotal ?? 0));

          const isOpen = details.statement?.status === "OPEN";
          const isFineOnly = details.statement?.kind === "FINE_ONLY";
          const revisedBalanceDue = details.statement?.status === "PAID" &&
            Number(details.balanceRemaining ?? 0) > 0;
          const isLatest = idx === statements.length - 1;

          const invoice = (
            <StatementInvoice statement={s} onEditPayment={setEditingPayment} />
          );

          return (
            <div key={details.statement.$id} className="space-y-3 mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">
                    {isFineOnly ? "Fine statement:" : "Statement:"}{" "}
                    <span className="tabular-nums">
                      {details.statement.monthKey}
                    </span>{" "}
                    <span className="text-black/30">•</span>{" "}
                    <span
                      className={isOpen ? "text-emerald-700" : "text-black/70"}
                    >
                      {revisedBalanceDue ? "PAID · REVISED BALANCE DUE" : details.statement.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created:{" "}
                    {fmtDateShort(
                      details.statement.createdAt ??
                        details.statement.$createdAt ??
                        null
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Older statement"
                      disabled={idx === 0}
                      onClick={() => setSelectedId(statements[idx - 1].statement.$id)}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <CouncilSelect
                      value={details.statement.$id}
                      onValueChange={setSelectedId}
                      options={options}
                      icon={CalendarDays}
                      className="w-64"
                    />
                    <button
                      type="button"
                      aria-label="Newer statement"
                      disabled={idx === statements.length - 1}
                      onClick={() => setSelectedId(statements[idx + 1].statement.$id)}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                <div className="flex flex-wrap gap-2">
                <LatestPaymentDateButton
                  key={details.statement.$id}
                  statement={{ statementId: details.statement.$id, leaseId: details.statement.leaseId, monthKey: details.statement.monthKey }}
                  currentDate={details.latestPaymentDate ?? null}
                  latestPaidAt={((details.payments ?? []) as Array<{ paidAt?: string | null }>)
                    .map((payment) => payment.paidAt ?? "")
                    .reduce((latest, paidAt) => (paidAt > latest ? paidAt : latest), "") || null}
                  onSaved={onPaymentUpdated}
                />
                <ManualFineButton
                  statement={{ statementId: details.statement.$id, leaseId: details.statement.leaseId, monthKey: details.statement.monthKey }}
                  onSaved={onPaymentUpdated}
                />
                {onStatementDeleted ? (
                  <button
                    type="button"
                    onClick={() => setDeletingStatement({
                      statementId: details.statement.$id,
                      leaseId: details.statement.leaseId,
                      monthKey: details.statement.monthKey,
                      paymentCount: (details.payments ?? []).length,
                      paymentsTotal,
                    })}
                    className="h-11 rounded-xl bg-rose-50 px-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                  >
                    Delete statement
                  </button>
                ) : null}
                {revisedBalanceDue ? (
                  <button
                    type="button"
                    onClick={() => onCollectRemaining(details.statement.$id)}
                    className="h-11 rounded-xl bg-amber-50 px-5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                  >
                    Collect remaining balance
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    const container = document.getElementById(
                      `invoice-${details.statement.$id}`
                    );
                    if (!container) return;

                    await downloadElementAsPdf(
                      container,
                      `land-rent-${details.statement.leaseId}-${details.statement.monthKey}.pdf`
                    );
                  }}
                  className="h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0
                      bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600"
                >
                  Download PDF
                </button>
                </div>
              </div>

              <div
                id={`invoice-${details.statement.$id}`}
                ref={isLatest ? latestInvoiceRef : undefined}
              >
                {invoice}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }, [statements, selectedIndex, options, latestInvoiceRef, onCollectRemaining, onStatementDeleted, onPaymentUpdated]);

  return <>
    {rendered}
    {deletingStatement && onStatementDeleted ? (
      <StatementDeleteDialog
        key={deletingStatement.statementId}
        statement={deletingStatement}
        onClose={() => setDeletingStatement(null)}
        onDeleted={onStatementDeleted}
      />
    ) : null}
    {editingPayment ? (
      <PaymentEditDialog
        key={editingPayment.$id}
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSaved={onPaymentUpdated}
      />
    ) : null}
  </>;
}
