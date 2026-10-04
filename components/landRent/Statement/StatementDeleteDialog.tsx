"use client";

import { deleteLandRentStatement } from "@/lib/landrent/landRent.actions";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

export type DeletableLandStatement = {
  statementId: string;
  leaseId: string;
  monthKey: string;
  paymentCount: number;
  paymentsTotal: string;
};

export default function StatementDeleteDialog({ statement, onClose, onDeleted }: {
  statement: DeletableLandStatement;
  onClose: () => void;
  onDeleted: (statementId: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteLandRentStatement({ statementId: statement.statementId, leaseId: statement.leaseId });
      await onDeleted(statement.statementId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete statement.");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !deleting) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete statement {statement.monthKey}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the statement and any linked payment records. The lease is kept.
            {statement.paymentCount > 0 ? (
              <span className="mt-2 block font-semibold text-rose-700">
                {statement.paymentCount} payment {statement.paymentCount === 1 ? "record" : "records"} totalling {statement.paymentsTotal} MVR will also be deleted.
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={deleting} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            Cancel
          </AlertDialogCancel>
          <button type="button" onClick={confirmDelete} disabled={deleting} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete statement"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
