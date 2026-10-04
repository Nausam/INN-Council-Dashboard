"use client";

import { addLandStatementManualFine } from "@/lib/landrent/landRent.actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, type FormEvent } from "react";

export default function ManualFineButton({ statement, onSaved }: {
  statement: { statementId: string; leaseId: string; monthKey: string };
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await addLandStatementManualFine({ ...statement, amount: Number(amount), description });
      setAmount("");
      setDescription("");
      setOpen(false);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add manual fine.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button type="button" onClick={() => { setError(null); setOpen(true); }} className="h-11 rounded-xl bg-amber-50 px-5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
      Add manual fine
    </button>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(event) => { if (saving) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Add manual fine</DialogTitle>
          <DialogDescription>
            Add a separate fine to statement {statement.monthKey}. It increases the total and remaining balance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>Fine amount (MVR)</span>
            <input type="number" min="0.01" step="0.01" required autoFocus disabled={saving} value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 disabled:opacity-50" />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Description shown on statement</span>
            <textarea required maxLength={1000} disabled={saving} dir="auto" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3 disabled:opacity-50" />
          </label>
          {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Adding…" : "Add fine"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
