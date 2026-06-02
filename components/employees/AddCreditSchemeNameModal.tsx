"use client";

import { EmployeeModalShell } from "@/components/Modals/EmployeeModalShell";
import { Button } from "@/components/ui/button";
import { CreditCard, Tag } from "lucide-react";
import { useEffect, useState } from "react";

type AddCreditSchemeNameModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
};

export function AddCreditSchemeNameModal({
  open,
  onOpenChange,
  onConfirm,
}: AddCreditSchemeNameModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for this credit scheme.");
      return;
    }
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <EmployeeModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="New credit scheme"
      description="Name this scheme before adding dates and amounts"
      size="md"
      header={
        <div className="flex items-start gap-4 pr-12">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Name credit scheme
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              e.g. Housing loan, Staff advance
            </p>
          </div>
        </div>
      }
    >
      <div className="animate-in fade-in duration-300 fill-mode-both p-6 sm:p-8">
        <label
          htmlFor="credit-scheme-name"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Scheme name
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Tag className="h-4 w-4" />
          </div>
          <input
            id="credit-scheme-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
            placeholder="Enter scheme name"
            className="council-input h-11 w-full pl-10 pr-4 text-sm font-medium"
            autoFocus
          />
        </div>
        {error ? (
          <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="council-outline"
            className="h-11 rounded-xl px-6"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="council"
            className="h-11 rounded-xl px-6"
            onClick={handleConfirm}
          >
            Continue
          </Button>
        </div>
      </div>
    </EmployeeModalShell>
  );
}
