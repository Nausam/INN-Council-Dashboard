"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  Download,
  ExternalLink,
  Loader2,
  Wallet,
  Search,
  CalendarDays,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";

type SlipItem = {
  periodLabel: string;
  fileName?: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

function formatPeriodDisplay(periodLabel: string): string {
  const m = periodLabel.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthIndex = parseInt(m[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex < months.length)
      return `${months[monthIndex]} ${m[1]}`;
  }
  return periodLabel;
}

type Result = {
  employee: { name: string; recordCardNumber: string };
  slips: SlipItem[];
};

export default function SalarySlipsPage() {
  const [recordCard, setRecordCard] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const filteredSlips = useMemo(() => {
    if (!result) return [];
    if (!filterDate) return result.slips;
    const period = `${filterDate.getFullYear()}-${String(filterDate.getMonth() + 1).padStart(2, "0")}`;
    return result.slips.filter((s) => s.periodLabel === period);
  }, [result, filterDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = recordCard.trim();
    if (!trimmed) {
      setError("Please enter your record card number.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/salary-slips?recordCard=${encodeURIComponent(trimmed)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setResult(null);
        return;
      }
      setResult(data as Result);
    } catch {
      setError("Failed to load salary slips. Please try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Gradient glow behind content */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-1/2 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <Wallet className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Salary Slips
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            Enter your record card number to view and download your payslips
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 backdrop-blur-sm sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="recordCard" className="text-sm text-zinc-400">
                  Record card number
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="recordCard"
                    type="text"
                    placeholder="e.g. 12345"
                    value={recordCard}
                    onChange={(e) => setRecordCard(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                    className="h-10 rounded-lg border-zinc-700 bg-zinc-800 pl-10 text-white placeholder:text-zinc-600 focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterMonth" className="text-sm text-zinc-400 sm:sr-only">
                  Month
                </Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="filterMonth"
                    type="month"
                    value={filterDate ? format(filterDate, "yyyy-MM") : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilterDate(v ? new Date(v + "-01") : undefined);
                    }}
                    disabled={loading}
                    className="h-10 rounded-lg border-zinc-700 bg-zinc-800 pl-10 text-base text-white focus-visible:border-emerald-500 focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-0 [color-scheme:dark]"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-10 rounded-lg bg-emerald-600 px-5 font-medium text-white transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0 focus-visible:ring-offset-zinc-900"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
            >
              {error}
            </div>
          )}
        </form>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 bg-zinc-800" />
                <Skeleton className="h-3 w-20 bg-zinc-800" />
              </div>
            </div>
            <Skeleton className="h-3 w-24 bg-zinc-800" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-24 bg-zinc-800" />
                      <Skeleton className="h-3 w-32 bg-zinc-800" />
                    </div>
                    <Skeleton className="h-5 w-10 rounded-md bg-zinc-800" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1 rounded-lg bg-zinc-800" />
                    <Skeleton className="h-9 flex-1 rounded-lg bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && result && (
          <div className="space-y-5">
            {/* Employee badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-400">
                {result.employee.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {result.employee.name}
                </p>
                <p className="text-sm text-zinc-500">
                  #{result.employee.recordCardNumber}
                </p>
              </div>
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate(undefined)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
                >
                  {format(filterDate, "MMM yyyy")}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Slip count */}
            <p className="text-sm text-zinc-500">
              {result.slips.length === 0
                ? "No slips found"
                : filteredSlips.length === 0
                  ? `No slip for ${filterDate ? format(filterDate, "MMMM yyyy") : "this period"}`
                  : `${filteredSlips.length} slip${filteredSlips.length !== 1 ? "s" : ""} available`}
            </p>

            {/* Slips grid */}
            {filteredSlips.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredSlips.map((slip) => (
                  <div
                    key={slip.periodLabel}
                    className="group rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 transition-colors hover:border-zinc-700"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-white">
                          {formatPeriodDisplay(slip.periodLabel)}
                        </p>
                        {slip.fileName && (
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {slip.fileName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        PDF
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {slip.viewUrl && (
                        <a
                          href={slip.viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </a>
                      )}
                      {slip.downloadUrl && (
                        <a
                          href={slip.downloadUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      )}
                      {!slip.viewUrl && !slip.downloadUrl && (
                        <span className="text-xs text-zinc-600">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
