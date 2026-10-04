"use client";

import { toDatetimeLocalValue } from "@/components/landRent/Statement/landRentStatement.utils";
import { getPaymentSlipUrl } from "@/lib/landrent/landRent.urls";
import { updateLandRentPayment } from "@/lib/landrent/landRent.actions";
import { useEffect, useRef, useState } from "react";

export type EditableLandRentPayment = {
  $id: string;
  paidAt: string;
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
  receivedBy?: string;
  slipFileId?: string | null;
  slipFileName?: string | null;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the replacement slip."));
    reader.readAsDataURL(file);
  });
}

export default function PaymentEditDialog({ payment, onClose, onSaved }: {
  payment: EditableLandRentPayment;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [paidAt, setPaidAt] = useState(() => toDatetimeLocalValue(new Date(payment.paidAt)));
  const [method, setMethod] = useState(payment.method ?? "");
  const [reference, setReference] = useState(payment.reference ?? "");
  const [receivedBy, setReceivedBy] = useState(payment.receivedBy ?? "");
  const [note, setNote] = useState(payment.note ?? "");
  const [replacementSlip, setReplacementSlip] = useState<File | null>(null);
  const [removeSlip, setRemoveSlip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const paymentDate = new Date(paidAt);
      if (Number.isNaN(paymentDate.getTime())) throw new Error("Enter a valid payment date and time.");
      const slipDataUrl = replacementSlip ? await readFileAsDataUrl(replacementSlip) : null;
      await updateLandRentPayment({
        paymentId: payment.$id,
        paidAt: paymentDate.toISOString(),
        amount: Number(amount),
        method,
        reference,
        receivedBy,
        note,
        slipDataUrl,
        slipFilename: replacementSlip?.name ?? null,
        removeSlip,
      });
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update payment.");
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="edit-land-payment-title">
        <h2 id="edit-land-payment-title" className="text-lg font-semibold text-slate-900">Edit posted payment</h2>
        <p className="mt-1 text-sm text-slate-500">Changes to the amount update the statement balance.</p>
        <form onSubmit={save} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Amount (MVR)
              <input className={`${field} mt-1`} type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} disabled={saving} />
            </label>
            <label className="block text-sm font-medium text-slate-700">Paid at
              <input className={`${field} mt-1`} type="datetime-local" required value={paidAt} onChange={(event) => setPaidAt(event.target.value)} disabled={saving} />
            </label>
            <label className="block text-sm font-medium text-slate-700">Method
              <input className={`${field} mt-1`} value={method} onChange={(event) => setMethod(event.target.value)} disabled={saving} placeholder="Cash, bank, transfer…" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Received by
              <input className={`${field} mt-1`} value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} disabled={saving} />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">Reference
            <input className={`${field} mt-1`} value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} />
          </label>
          <label className="block text-sm font-medium text-slate-700">Note
            <textarea className={`${field} mt-1`} rows={3} value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} />
          </label>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="font-medium">Payment slip</div>
            {payment.slipFileId && !removeSlip ? (
              <a className="text-sky-700 underline" href={getPaymentSlipUrl(payment.slipFileId)} target="_blank" rel="noreferrer">View current slip{payment.slipFileName ? ` (${payment.slipFileName})` : ""}</a>
            ) : null}
            <input ref={slipInputRef} type="file" accept="image/*,application/pdf" disabled={saving} onChange={(event) => {
              setReplacementSlip(event.target.files?.[0] ?? null);
              setRemoveSlip(false);
            }} />
            {payment.slipFileId ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={removeSlip} disabled={saving} onChange={(event) => {
                  setRemoveSlip(event.target.checked);
                  if (event.target.checked) {
                    setReplacementSlip(null);
                    if (slipInputRef.current) slipInputRef.current.value = "";
                  }
                }} /> Remove current slip
              </label>
            ) : null}
          </div>
          {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
