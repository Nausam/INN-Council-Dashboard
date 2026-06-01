"use client";

import {
  CouncilCard,
  CouncilPopoverSelect,
  PageHeader,
  PageShell,
} from "@/components/design-system";
import { Button } from "@/components/ui/button";
import SkeletonUploadSlipsPage from "@/components/skeletons/SkeletonUploadSlipsPage";
import {
  useEmployeeOptionsQuery,
  useQueryInvalidation,
  useUploadedSlipsQuery,
} from "@/hooks/queries";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Files,
  Loader2,
  Upload,
  User,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getYearRange() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 3; y <= current + 1; y++) years.push(y);
  return years;
}

const YEARS = getYearRange();

function getCurrentMonthAndYear() {
  const now = new Date();
  return { month: MONTHS[now.getMonth()], year: String(now.getFullYear()) };
}

function ControlField({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        <Icon className="h-3.5 w-3.5 text-teal-600" aria-hidden />
        {label}
      </label>
      {children}
    </div>
  );
}

export default function UploadSalarySlipPage() {
  const { month: defaultMonth, year: defaultYear } = getCurrentMonthAndYear();
  const { data: employees = [], isLoading: employeesLoading } =
    useEmployeeOptionsQuery();
  const { invalidateSalarySlips } = useQueryInvalidation();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [year, setYear] = useState<string>(defaultYear);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    periodLabel: string;
    recordCardNumber: string;
  } | null>(null);

  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{
    ok: Array<{
      fileName: string;
      recordCardNumber: string;
      employeeName: string;
    }>;
    failed: Array<{ fileName: string; error: string; detail?: string }>;
    summary: { uploaded: number; failed: number; total: number };
  } | null>(null);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const periodLabel = useMemo(() => {
    if (!month || !year) return "";
    const monthNum = MONTHS.indexOf(month) + 1;
    if (monthNum < 1) return "";
    return `${year}-${String(monthNum).padStart(2, "0")}`;
  }, [month, year]);

  const { data: uploadedRecordCardNumbers = new Set<string>() } =
    useUploadedSlipsQuery(periodLabel);

  const periodDisplayLabel = useMemo(() => {
    if (!month || !year) return "";
    return `${month} ${year}`;
  }, [month, year]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );
  const recordCardNumber = selectedEmployee?.recordCardNumber ?? "";

  const monthOptions = MONTHS.map((m) => ({ value: m, label: m }));
  const yearOptions = YEARS.map((y) => ({
    value: String(y),
    label: String(y),
  }));

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => {
        const hasSlip = uploadedRecordCardNumbers.has(emp.recordCardNumber);
        return {
          value: emp.id,
          label: `${hasSlip ? "✓ " : ""}${emp.name} (${emp.recordCardNumber})`,
        };
      }),
    [employees, uploadedRecordCardNumbers],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedRecord = recordCardNumber.trim();
    if (!trimmedRecord) {
      setError("Please select an employee.");
      return;
    }
    if (!periodLabel) {
      setError("Please select month and year.");
      return;
    }
    if (!file) {
      setError("Please select a PDF file.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("recordCardNumber", trimmedRecord);
      formData.set("periodLabel", periodLabel);
      formData.set("file", file);
      const res = await fetch("/api/salary-slips/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Upload failed. Please try again.");
        return;
      }
      setSuccess({
        periodLabel: periodDisplayLabel || periodLabel,
        recordCardNumber: trimmedRecord,
      });
      setFile(null);
      setMonth("");
      setYear("");
      await invalidateSalarySlips(periodLabel, trimmedRecord);
    } catch {
      setError("Failed to upload. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodLabel) {
      setBatchError("Please select month and year.");
      return;
    }
    if (batchFiles.length === 0) {
      setBatchError("Choose one or more PDF files from your folder.");
      return;
    }
    setBatchError(null);
    setBatchResult(null);
    setBatchLoading(true);
    try {
      const formData = new FormData();
      formData.set("periodLabel", periodLabel);
      for (const f of batchFiles) {
        formData.append("files", f);
      }
      const res = await fetch("/api/salary-slips/upload-batch", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setBatchError(data?.error ?? "Batch upload failed.");
        return;
      }
      setBatchResult({
        ok: data.ok ?? [],
        failed: data.failed ?? [],
        summary: data.summary ?? {
          uploaded: 0,
          failed: 0,
          total: batchFiles.length,
        },
      });
      setBatchFiles([]);
      await invalidateSalarySlips(periodLabel);
    } catch {
      setBatchError("Batch upload failed. Please try again.");
    } finally {
      setBatchLoading(false);
    }
  };

  if (employeesLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl">
          <SkeletonUploadSlipsPage />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <Button
          variant="council-outline"
          className="mb-6 h-11 rounded-xl px-4"
          asChild
        >
          <Link href="/salary-slips" aria-label="Back to Salary Slips">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <PageHeader
          icon={Upload}
          title="Upload Salary Slip"
          subtitle="Upload salary slip PDFs for the selected month. Use one file per employee, or upload a whole folder at once by matching each filename to an employee name."
          className="mb-8"
        />

        <CouncilCard interactive="none" className="mb-6 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="council-page-icon h-11 w-11">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Salary period</h2>
              <p className="text-sm font-medium text-slate-500">
                Applies to both single and batch uploads below.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ControlField label="Month" icon={CalendarDays}>
              <CouncilPopoverSelect
                value={month}
                onValueChange={setMonth}
                options={monthOptions}
                icon={CalendarDays}
                placeholder="Month"
                disabled={loading || batchLoading}
              />
            </ControlField>

            <ControlField label="Year" icon={Clock}>
              <CouncilPopoverSelect
                value={year}
                onValueChange={setYear}
                options={yearOptions}
                icon={Clock}
                placeholder="Year"
                disabled={loading || batchLoading}
              />
            </ControlField>
          </div>

          {periodDisplayLabel ? (
            <p className="mt-4 text-sm text-slate-600">
              Period label stored as{" "}
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-slate-900">
                {periodLabel}
              </span>{" "}
              ({periodDisplayLabel})
            </p>
          ) : null}
        </CouncilCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <CouncilCard interactive="none" className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Single upload
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  Pick the employee, then one PDF (max 10MB).
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <ControlField label="Employee" icon={User}>
                <CouncilPopoverSelect
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                  options={employeeOptions}
                  icon={User}
                  placeholder="Select employee"
                  disabled={loading}
                />
              </ControlField>

              <ControlField label="PDF file" icon={Files}>
                <input
                  id="file"
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={loading}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="council-input h-11 w-full cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-700"
                />
                {file ? (
                  <p className="text-sm text-slate-500">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                ) : null}
              </ControlField>

              <Button
                type="submit"
                variant="council"
                className="h-11 rounded-xl px-5"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload slip
                  </>
                )}
              </Button>
            </form>
          </CouncilCard>

          <CouncilCard interactive="none" className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <Files className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Batch upload
                </h2>
                <p className="text-sm font-medium text-slate-500">
                  Select many PDFs at once. Each file must be named like the
                  employee, e.g.{" "}
                  <span className="font-semibold text-slate-700">
                    Ahmed Azmeen.pdf
                  </span>
                  .
                </p>
              </div>
            </div>

            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <ControlField label="PDF files" icon={Files}>
                <input
                  id="batch-files"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  disabled={batchLoading || !periodLabel}
                  onChange={(e) =>
                    setBatchFiles(Array.from(e.target.files ?? []))
                  }
                  className="council-input h-11 w-full cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-700"
                />
                {batchFiles.length > 0 ? (
                  <p className="text-sm text-slate-500">
                    {batchFiles.length} file
                    {batchFiles.length !== 1 ? "s" : ""} selected
                  </p>
                ) : null}
              </ControlField>

              <Button
                type="submit"
                variant="council-outline"
                className="h-11 rounded-xl px-5"
                disabled={
                  batchLoading || !periodLabel || batchFiles.length === 0
                }
              >
                {batchLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Files className="h-4 w-4" />
                    Upload all matched
                  </>
                )}
              </Button>
            </form>

            {batchError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {batchError}
              </div>
            ) : null}

            {batchResult ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-semibold text-slate-900">
                  Done: {batchResult.summary.uploaded} uploaded,{" "}
                  {batchResult.summary.failed} failed (of{" "}
                  {batchResult.summary.total}).
                </p>
                {batchResult.failed.length > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Needs attention
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-slate-600">
                      {batchResult.failed.map((f) => (
                        <li key={f.fileName}>
                          <span className="font-medium text-slate-900">
                            {f.fileName}
                          </span>
                          : {f.error}
                          {f.detail ? (
                            <span className="block pl-4 text-xs">{f.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {batchResult.ok.length > 0 ? (
                  <details className="rounded-xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer font-semibold text-emerald-800">
                      {batchResult.ok.length} matched and uploaded
                    </summary>
                    <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-slate-600">
                      {batchResult.ok.map((row) => (
                        <li key={row.fileName}>
                          <span className="font-medium text-slate-900">
                            {row.fileName}
                          </span>{" "}
                          → {row.employeeName} ({row.recordCardNumber})
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
          </CouncilCard>
        </div>

        {error ? (
          <CouncilCard
            interactive="none"
            className="mt-6 border-rose-200 bg-rose-50 p-4"
          >
            <p className="text-sm font-medium text-rose-800">{error}</p>
          </CouncilCard>
        ) : null}

        {success ? (
          <CouncilCard
            interactive="none"
            className="mt-6 border-emerald-200 bg-emerald-50 p-4"
          >
            <p className="flex items-start gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Slip for period &quot;{success.periodLabel}&quot; (record card{" "}
                {success.recordCardNumber}) uploaded successfully. The employee
                can view it on the{" "}
                <Link
                  href="/salary-slips"
                  className="font-semibold underline underline-offset-2"
                >
                  Salary Slips
                </Link>{" "}
                page.
              </span>
            </p>
          </CouncilCard>
        ) : null}

        {uploadedRecordCardNumbers.size > 0 && periodLabel ? (
          <CouncilCard interactive="none" className="mt-6 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Check className="h-4 w-4 text-emerald-600" />
              {uploadedRecordCardNumbers.size} employee
              {uploadedRecordCardNumbers.size !== 1 ? "s" : ""} already have a
              slip for {periodDisplayLabel}
            </p>
            <p className="text-xs text-slate-500">
              Marked with ✓ in the employee dropdown above.
            </p>
          </CouncilCard>
        ) : null}
      </div>
    </PageShell>
  );
}
