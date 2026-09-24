"use client";

import { useEmployeesQuery } from "@/hooks/queries";
import { ArrowRight, IdCard, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { EmployeePwaInstallPrompt } from "./EmployeePwaInstallPrompt";
import styles from "./employee-login.module.css";

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
  const { data, isPending, isError } = useEmployeesQuery();

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
      setError("Enter your ID or record card number.");
      return;
    }

    if (isPending) {
      setError("Records are loading. Try again shortly.");
      return;
    }

    if (isError) {
      setError("Records are unavailable. Try again shortly.");
      return;
    }

    setSubmitting(true);
    const match = employees.find((employee) =>
      employee.identifiers.includes(lookupValue),
    );

    if (!match) {
      setSubmitting(false);
      setError("No matching employee found.");
      return;
    }

    router.push(`/employees/details/${match.id}`);
  };

  const loading = isPending || submitting;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Image src="/council-logo.png" alt="" width={116} height={65} unoptimized />
          </div>
          <span className={styles.brandName}>Innamaadhoo Council</span>
        </div>

        <section className={styles.panel} aria-labelledby="employee-portal-title">
          <h1 id="employee-portal-title">Employee Portal</h1>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="employee-identifier" className={styles.fieldLabel}>
              ID card or record card number
            </label>
            <div className={styles.inputWrap}>
              <IdCard className={styles.inputIcon} aria-hidden="true" />
              <input
                id="employee-identifier"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter your number"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "employee-login-error" : undefined}
              />
            </div>

            {error ? (
              <p id="employee-login-error" className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className={styles.submit}>
              <span>{isPending ? "Loading…" : submitting ? "Opening…" : "Continue"}</span>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
          </form>
        </section>
        <EmployeePwaInstallPrompt />
      </div>
    </div>
  );
}
