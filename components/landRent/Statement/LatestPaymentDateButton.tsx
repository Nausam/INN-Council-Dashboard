"use client";

import { CouncilDatePicker } from "@/components/design-system/council-date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setLandStatementLatestPaymentDate } from "@/lib/landrent/landRent.actions";
import { useState, type FormEvent } from "react";

export default function LatestPaymentDateButton({ statement, currentDate, latestPaidAt, onSaved }: {
  statement: { statementId: string; leaseId: string; monthKey: string };
  /** Date the statement shows now. */
  currentDate: string | null;
  /** Newest payment on this statement, offered as a one-click choice. */
  latestPaidAt: string | null;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestPaidDay = latestPaidAt ? latestPaidAt.slice(0, 10) : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !date) return;
    setSaving(true);
    setError(null);
    try {
      await setLandStatementLatestPaymentDate({ ...statement, date });
      setOpen(false);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the date.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button
      type="button"
      onClick={() => { setError(null); setDate(currentDate ? currentDate.slice(0, 10) : ""); setOpen(true); }}
      className="h-11 rounded-xl bg-sky-50 px-5 text-sm font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
    >
      Latest payment date
    </button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(event) => { if (saving) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Latest payment date</DialogTitle>
          <DialogDescription>
            Change the latest payment date shown on statement {statement.monthKey}. Rent and fine amounts stay the same.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <CouncilDatePicker value={date} onChange={setDate} required disabled={saving} />
          {latestPaidDay && latestPaidDay !== date ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => setDate(latestPaidDay)}
              className="text-sm font-medium text-sky-700 hover:underline disabled:opacity-50"
            >
              Use the newest payment on this statement ({latestPaidDay})
            </button>
          ) : null}
          {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || !date} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save date"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
