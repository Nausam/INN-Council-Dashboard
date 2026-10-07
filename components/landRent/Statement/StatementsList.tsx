"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
import React, { useMemo, useState } from "react";

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
  const rendered = useMemo(() => {
    if (!statements.length) return null;

    return (
      <div className="space-y-8">
        {statements.map((s, idx) => {
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
              <div className="flex items-center justify-between gap-3">
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

                <div className="flex flex-wrap gap-2">
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
        })}
      </div>
    );
  }, [statements, latestInvoiceRef, onCollectRemaining, onStatementDeleted, onPaymentUpdated]);

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
