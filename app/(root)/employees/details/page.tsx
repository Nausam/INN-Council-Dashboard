"use client";

import { useEmployeesQuery } from "@/hooks/queries";
import { ArrowRight, IdCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type EmployeeLookupRow = {
  id: string;
  name: string;
  recordCardNumber: string;
  identifiers: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

function toEmployeeLookupRow(value: unknown): EmployeeLookupRow | null {
  if (!isRecord(value)) return null;

  const id = asString(value.$id) || asString(value.id);
  if (!id) return null;

  const recordCardNumber = asString(value.recordCardNumber);
  const identifiers = [
    recordCardNumber,
    asString(value.idCard),
    asString(value.idCardNumber),
    asString(value.nationalId),
    asString(value.nationalIdCard),
    asString(value.identityCardNumber),
  ]
    .map(normalizeIdentifier)
    .filter(Boolean);

  return {
    id,
    name: asString(value.name) || "Employee",
    recordCardNumber,
    identifiers,
  };
}

export default function EmployeeDetailsLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data, isPending } = useEmployeesQuery();

  const employees = useMemo(
    () =>
      (Array.isArray(data) ? data : [])
        .map(toEmployeeLookupRow)
        .filter((employee): employee is EmployeeLookupRow => employee !== null),
    [data],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const lookupValue = normalizeIdentifier(identifier);
    if (!lookupValue) {
      setError("Enter your ID card number or record card number.");
      return;
    }

    if (isPending) {
      setError("Employee records are still loading. Please try again.");
      return;
    }

    setSubmitting(true);
    const match = employees.find((employee) =>
      employee.identifiers.includes(lookupValue),
    );

    if (!match) {
      setSubmitting(false);
      setError("No employee matched that ID card or record card number.");
      return;
    }

    router.push(`/employees/details/${match.id}`);
  };

  const loading = isPending || submitting;

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f4] px-4 py-6">
      {/* Hide the app's mobile header on this page only */}
      <style>{`@media (max-width: 767px){[data-council-mobile-header]{display:none !important;}}`}</style>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        {/* Hero card */}
        <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-100">
          <div className="bg-gradient-to-br from-teal-600 to-emerald-500 px-6 py-8 text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/15 ring-1 ring-white/25">
              <IdCard className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Employee Login
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
                <IdCard className="h-4 w-4 text-teal-600" />
                ID card or record card number
              </span>
              <input
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  if (error) setError("");
                }}
                placeholder="Example: A123456 or RC001"
                autoComplete="off"
                className="h-14 w-full rounded-2xl border-0 bg-slate-50 px-4 text-base font-bold text-slate-950 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
              />
            </label>

            {error ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 text-sm font-black text-white shadow-sm shadow-teal-600/25 transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Open details
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
