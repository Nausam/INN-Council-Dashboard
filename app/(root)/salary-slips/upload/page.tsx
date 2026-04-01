"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAllEmployees } from "@/lib/appwrite/appwrite";
import type { EmployeeDoc } from "@/lib/appwrite/appwrite";
import {
  Upload,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Check,
  Files,
  AlertTriangle,
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

type EmployeeOption = { id: string; name: string; recordCardNumber: string };

export default function UploadSalarySlipPage() {
  const { month: defaultMonth, year: defaultYear } = getCurrentMonthAndYear();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
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
  const [uploadedRecordCardNumbers, setUploadedRecordCardNumbers] = useState<
    Set<string>
  >(new Set());
  const [uploadedListVersion, setUploadedListVersion] = useState(0);

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
    (async () => {
      try {
        const list = await fetchAllEmployees();
        const opts: EmployeeOption[] = (list as EmployeeDoc[])
          .map((e) => {
            const id = e.$id ?? (e as Record<string, unknown>).$id;
            const rc =
              e.recordCardNumber ??
              (e as Record<string, unknown>).recordCardNumber;
            const str = typeof rc === "string" ? rc.trim() : "";
            if (!str || typeof id !== "string") return null;
            return { id, name: e.name ?? "Unknown", recordCardNumber: str };
          })
          .filter((o): o is EmployeeOption => o !== null);
        opts.sort((a, b) => a.name.localeCompare(b.name));
        setEmployees(opts);
        if (opts.length > 0 && !selectedEmployeeId)
          setSelectedEmployeeId(opts[0].id);
      } catch (e) {
        console.error("Failed to load employees:", e);
      } finally {
        setEmployeesLoading(false);
      }
    })();
  }, []);

  const periodLabel = useMemo(() => {
    if (!month || !year) return "";
    const monthNum = MONTHS.indexOf(month) + 1;
    if (monthNum < 1) return "";
    return `${year}-${String(monthNum).padStart(2, "0")}`;
  }, [month, year]);

  useEffect(() => {
    if (!periodLabel) {
      setUploadedRecordCardNumbers(new Set());
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/salary-slips/uploaded?period=${encodeURIComponent(periodLabel)}`,
        );
        const data = await res.json();
        if (res.ok && Array.isArray(data.recordCardNumbers)) {
          setUploadedRecordCardNumbers(
            new Set(data.recordCardNumbers as string[]),
          );
        } else {
          setUploadedRecordCardNumbers(new Set());
        }
      } catch {
        setUploadedRecordCardNumbers(new Set());
      }
    })();
  }, [periodLabel, uploadedListVersion]);

  const periodDisplayLabel = useMemo(() => {
    if (!month || !year) return "";
    return `${month} ${year}`;
  }, [month, year]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );
  const recordCardNumber = selectedEmployee?.recordCardNumber ?? "";

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
      setUploadedListVersion((v) => v + 1);
      setTimeout(() => window.location.reload(), 1200);
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
      setUploadedListVersion((v) => v + 1);
    } catch {
      setBatchError("Batch upload failed. Please try again.");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/salary-slips" aria-label="Back to Salary Slips">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload Salary Slip
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload salary slip PDFs for the selected month. Use one file per
            employee, or upload a whole folder at once by matching each filename
            to an employee name.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salary period</CardTitle>
          <CardDescription>
            Applies to both single and batch uploads below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Select
              value={month || undefined}
              onValueChange={setMonth}
              disabled={loading || batchLoading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={year || undefined}
              onValueChange={setYear}
              disabled={loading || batchLoading}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {periodDisplayLabel && (
            <p className="text-muted-foreground mt-2 text-sm">
              Period label stored as{" "}
              <span className="font-mono text-foreground">{periodLabel}</span>{" "}
              ({periodDisplayLabel})
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Single upload
          </CardTitle>
          <CardDescription>
            Pick the employee, then one PDF (max 10MB).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={selectedEmployeeId || undefined}
                onValueChange={setSelectedEmployeeId}
                disabled={loading || employeesLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      employeesLoading
                        ? "Loading employees..."
                        : "Select employee"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => {
                    const hasSlip = uploadedRecordCardNumbers.has(
                      emp.recordCardNumber,
                    );
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        <span className="flex items-center gap-2">
                          {hasSlip && (
                            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                          )}
                          {emp.name} ({emp.recordCardNumber})
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">PDF file</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,application/pdf"
                disabled={loading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-muted-foreground text-sm">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <Button type="submit" disabled={loading || employeesLoading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload slip
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            Batch upload
          </CardTitle>
          <CardDescription>
            Select many PDFs at once (e.g. from a folder). Each file must be
            named like the employee in the system, without the record card
            number — for example{" "}
            <span className="font-medium text-foreground">Ahmed Azmeen.pdf</span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-files">PDF files</Label>
              <Input
                id="batch-files"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                disabled={batchLoading || !periodLabel}
                onChange={(e) =>
                  setBatchFiles(Array.from(e.target.files ?? []))
                }
              />
              {batchFiles.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {batchFiles.length} file{batchFiles.length !== 1 ? "s" : ""}{" "}
                  selected
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={
                batchLoading || employeesLoading || !periodLabel || batchFiles.length === 0
              }
            >
              {batchLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Files className="mr-2 h-4 w-4" />
                  Upload all matched
                </>
              )}
            </Button>
          </form>

          {batchError && (
            <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {batchError}
            </div>
          )}

          {batchResult && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="font-medium">
                Done: {batchResult.summary.uploaded} uploaded,{" "}
                {batchResult.summary.failed} failed (of{" "}
                {batchResult.summary.total}).
              </p>
              {batchResult.failed.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <p className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Needs attention
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                    {batchResult.failed.map((f) => (
                      <li key={f.fileName}>
                        <span className="text-foreground">{f.fileName}</span>:{" "}
                        {f.error}
                        {f.detail ? (
                          <span className="block pl-4 text-xs">{f.detail}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {batchResult.ok.length > 0 && (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer font-medium text-emerald-800 dark:text-emerald-200">
                    {batchResult.ok.length} matched and uploaded
                  </summary>
                  <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-muted-foreground">
                    {batchResult.ok.map((row) => (
                      <li key={row.fileName}>
                        <span className="text-foreground">{row.fileName}</span>{" "}
                        → {row.employeeName} ({row.recordCardNumber})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="pt-6">
            <p className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Slip for period &quot;{success.periodLabel}&quot; (record card{" "}
              {success.recordCardNumber}) uploaded successfully. The employee
              can view it on the{" "}
              <Link href="/salary-slips" className="underline">
                Salary Slips
              </Link>{" "}
              page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
