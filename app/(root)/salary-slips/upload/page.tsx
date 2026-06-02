"use client";

import {
  CouncilCard,
  CouncilPopoverSelect,
  PageHeader,
  PageShell,
} from "@/components/design-system";
import { Button, buttonVariants } from "@/components/ui/button";
import SkeletonUploadSlipsPage from "@/components/skeletons/SkeletonUploadSlipsPage";
import {
  useEmployeesQuery,
  useQueryInvalidation,
  useUploadedSlipsQuery,
} from "@/hooks/queries";
import {
  describeSlipMatchFailure,
  getSlipFileBaseName,
  matchEmployeeBySlipFileName,
  type SlipMatchEmployee,
} from "@/lib/salary-slips/matchSlipFileName";
import {
  getUploadErrorMessage,
  parseUploadJsonResponse,
} from "@/lib/salary-slips/parse-upload-response";
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

type UploadIssue = {
  error: string;
  detail?: string;
};

type BatchFailedRow = {
  fileName: string;
  error: string;
  detail?: string;
  code?: string;
};

type BatchOkRow = {
  fileName: string;
  recordCardNumber: string;
  employeeName: string;
  replacedExisting?: boolean;
};

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

function UploadIssueAlert({ issue }: { issue: UploadIssue }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
    >
      <p className="font-semibold">{issue.error}</p>
      {issue.detail ? (
        <p className="mt-1 text-rose-700">{issue.detail}</p>
      ) : null}
    </div>
  );
}

export default function UploadSalarySlipPage() {
  const { month: defaultMonth, year: defaultYear } = getCurrentMonthAndYear();
  const { data: rawEmployees, isPending: employeesPending } = useEmployeesQuery();
  const { invalidateSalarySlips } = useQueryInvalidation();

  const employees = useMemo(
    () =>
      (Array.isArray(rawEmployees) ? rawEmployees : [])
        .map((employee) => {
          const id = employee.$id ?? (employee as Record<string, unknown>).id;
          const recordCard = employee.recordCardNumber;
          const recordCardNumber =
            typeof recordCard === "string" ? recordCard.trim() : "";
          if (!recordCardNumber || typeof id !== "string") return null;
          return {
            id,
            name: employee.name ?? "Unknown",
            recordCardNumber,
          };
        })
        .filter(
          (
            employee,
          ): employee is { id: string; name: string; recordCardNumber: string } =>
            employee !== null,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rawEmployees],
  );

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [year, setYear] = useState<string>(defaultYear);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UploadIssue | null>(null);
  const [success, setSuccess] = useState<{
    periodLabel: string;
    recordCardNumber: string;
    replacedExisting?: boolean;
  } | null>(null);

  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [batchError, setBatchError] = useState<UploadIssue | null>(null);
  const [batchResult, setBatchResult] = useState<{
    ok: BatchOkRow[];
    failed: BatchFailedRow[];
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

  const slipMatchEmployees = useMemo<SlipMatchEmployee[]>(
    () =>
      employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        recordCardNumber: employee.recordCardNumber,
      })),
    [employees],
  );

  const batchPreview = useMemo(() => {
    if (batchFiles.length === 0) return [];

    return batchFiles.map((file) => {
      const displayName = getSlipFileBaseName(file.name) || file.name;

      if (!isPdfFile(file)) {
        return {
          fileName: file.name,
          status: "invalid" as const,
          error: `"${displayName}" is not a PDF`,
          detail: "Only .pdf files are accepted.",
        };
      }

      const match = matchEmployeeBySlipFileName(file.name, slipMatchEmployees);
      if (match.status === "ok") {
        return {
          fileName: file.name,
          status: "ok" as const,
          label: `${match.employee.name} (${match.employee.recordCardNumber})`,
        };
      }

      const failure = describeSlipMatchFailure(file.name, match);
      return {
        fileName: file.name,
        status: match.status,
        error: failure.error,
        detail: failure.detail,
      };
    });
  }, [batchFiles, slipMatchEmployees]);

  const batchReadyCount = batchPreview.filter(
    (row) => row.status === "ok",
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedRecord = recordCardNumber.trim();
    if (!trimmedRecord) {
      setError({
        error: "Employee is required",
        detail: "Select an employee from the list.",
      });
      return;
    }
    if (!periodLabel) {
      setError({
        error: "Salary period is required",
        detail: "Choose a month and year before uploading.",
      });
      return;
    }
    if (!file) {
      setError({
        error: "PDF file is required",
        detail: "Choose a salary slip PDF to upload.",
      });
      return;
    }
    if (!isPdfFile(file)) {
      setError({
        error: "Only PDF files are allowed",
        detail: `"${file.name}" is not a PDF.`,
      });
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
      const data = await parseUploadJsonResponse(res);
      if (!res.ok) {
        setError(getUploadErrorMessage(data, "Upload failed. Please try again."));
        return;
      }
      setSuccess({
        periodLabel: periodDisplayLabel || periodLabel,
        recordCardNumber: trimmedRecord,
        replacedExisting: Boolean(data.replacedExisting),
      });
      setFile(null);
      await invalidateSalarySlips(periodLabel, trimmedRecord);
    } catch (err) {
      setError({
        error:
          err instanceof Error ? err.message : "Failed to upload. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodLabel) {
      setBatchError({
        error: "Salary period is required",
        detail: "Choose a month and year before uploading.",
      });
      return;
    }
    if (batchFiles.length === 0) {
      setBatchError({
        error: "No PDF files selected",
        detail: "Choose one or more PDF files to upload.",
      });
      return;
    }

    const invalidPdf = batchFiles.filter((file) => !isPdfFile(file));
    if (invalidPdf.length > 0) {
      setBatchError({
        error: `${invalidPdf.length} selected file${invalidPdf.length === 1 ? "" : "s"} ${invalidPdf.length === 1 ? "is" : "are"} not PDFs`,
        detail: invalidPdf.map((file) => file.name).join(", "),
      });
      return;
    }

    if (batchReadyCount === 0) {
      setBatchError({
        error: "No files matched an employee",
        detail:
          "Rename each PDF to the employee full name or record card number before uploading.",
      });
      return;
    }

    setBatchError(null);
    setBatchResult(null);
    setBatchLoading(true);
    setBatchProgress({ current: 0, total: batchFiles.length });

    const ok: BatchOkRow[] = [];
    const failed: BatchFailedRow[] = [];

    try {
      for (let index = 0; index < batchFiles.length; index += 1) {
        const file = batchFiles[index]!;
        setBatchProgress({ current: index + 1, total: batchFiles.length });

        const formData = new FormData();
        formData.set("periodLabel", periodLabel);
        formData.append("files", file);

        try {
          const res = await fetch("/api/salary-slips/upload-batch", {
            method: "POST",
            body: formData,
          });
          const data = await parseUploadJsonResponse(res);

          if (!res.ok) {
            const issue = getUploadErrorMessage(
              data,
              `Upload failed for ${file.name}`,
            );
            failed.push({
              fileName: file.name,
              error: issue.error,
              detail: issue.detail,
              code: issue.code,
            });
            continue;
          }

          const fileOk = (data.ok ?? []) as BatchOkRow[];
          const fileFailed = (data.failed ?? []) as BatchFailedRow[];
          ok.push(...fileOk);
          failed.push(...fileFailed);
        } catch (err) {
          failed.push({
            fileName: file.name,
            error:
              err instanceof Error
                ? err.message
                : `Upload failed for ${file.name}`,
          });
        }
      }

      setBatchResult({
        ok,
        failed,
        summary: {
          uploaded: ok.length,
          failed: failed.length,
          total: batchFiles.length,
        },
      });

      if (ok.length === 0 && failed.length > 0) {
        setBatchError({
          error: "Batch upload completed with no successful uploads",
          detail: `${failed.length} file${failed.length === 1 ? "" : "s"} failed. See the details below.`,
        });
      }

      if (ok.length > 0) {
        setBatchFiles([]);
        await invalidateSalarySlips(periodLabel);
      }
    } catch (err) {
      setBatchError({
        error:
          err instanceof Error
            ? err.message
            : "Batch upload failed. Please try again.",
      });
    } finally {
      setBatchLoading(false);
      setBatchProgress(null);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <Link
          href="/salary-slips"
          aria-label="Back to Salary Slips"
          className={buttonVariants({
            variant: "council-outline",
            className: "mb-6 h-11 rounded-xl px-4",
          })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <PageHeader
          icon={Upload}
          title="Upload Salary Slip"
          subtitle="Upload salary slip PDFs for the selected month. Use one file per employee, or upload a whole folder at once by matching each filename to an employee name."
          className="mb-8"
        />

        {employeesPending ? (
          <SkeletonUploadSlipsPage />
        ) : (
          <>

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
                  employee or record card, e.g.{" "}
                  <span className="font-semibold text-slate-700">
                    Ahmed Azmeen.pdf
                  </span>{" "}
                  or{" "}
                  <span className="font-semibold text-slate-700">
                    A068218.pdf
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
                    {batchPreview.length > 0
                      ? ` · ${batchReadyCount} matched, ${batchPreview.length - batchReadyCount} need attention`
                      : ""}
                  </p>
                ) : null}
              </ControlField>

              {batchPreview.length > 0 ? (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  {batchPreview.map((row) => (
                    <div
                      key={row.fileName}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        row.status === "ok"
                          ? "bg-emerald-50 text-emerald-900"
                          : "bg-amber-50 text-amber-950",
                      )}
                    >
                      <p className="font-medium">{row.fileName}</p>
                      {row.status === "ok" ? (
                        <p className="text-xs text-emerald-800">
                          Matched to {row.label}
                        </p>
                      ) : (
                        <>
                          <p className="text-xs font-medium">{row.error}</p>
                          {row.detail ? (
                            <p className="text-xs opacity-90">{row.detail}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {batchProgress ? (
                <p className="text-sm font-medium text-teal-700">
                  Uploading file {batchProgress.current} of {batchProgress.total}
                  …
                </p>
              ) : null}

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
              <div className="mt-4">
                <UploadIssueAlert issue={batchError} />
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
                      Needs attention ({batchResult.failed.length})
                    </p>
                    <ul className="space-y-3">
                      {batchResult.failed.map((f) => (
                        <li
                          key={f.fileName}
                          className="rounded-lg border border-amber-100 bg-white/80 p-3 text-slate-700"
                        >
                          <p className="font-semibold text-slate-900">
                            {f.fileName}
                          </p>
                          <p className="mt-1 font-medium text-amber-900">
                            {f.error}
                          </p>
                          {f.detail ? (
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {f.detail}
                            </p>
                          ) : null}
                          {f.code ? (
                            <p className="mt-1 font-mono text-[11px] text-slate-400">
                              {f.code}
                            </p>
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
                    <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-slate-600">
                      {batchResult.ok.map((row) => (
                        <li
                          key={row.fileName}
                          className="rounded-lg bg-emerald-50/70 px-3 py-2"
                        >
                          <span className="font-medium text-slate-900">
                            {row.fileName}
                          </span>{" "}
                          → {row.employeeName} ({row.recordCardNumber})
                          {row.replacedExisting ? (
                            <span className="block text-xs text-emerald-800">
                              Replaced an existing slip for this period.
                            </span>
                          ) : null}
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
            <UploadIssueAlert issue={error} />
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
                {success.recordCardNumber}){" "}
                {success.replacedExisting ? "updated" : "uploaded"} successfully.
                The employee can view it on the{" "}
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
          </>
        )}
      </div>
    </PageShell>
  );
}
