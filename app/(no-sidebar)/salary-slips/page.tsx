"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FileText, Download, ExternalLink, Loader2, Calendar as CalendarIcon } from "lucide-react";
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
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-8 text-center">
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Salary Slips</h1>
          <p className="text-muted-foreground mt-1">
            Enter your record card number to view and download your salary slips.
          </p>
        </div>

        <Card className="mx-auto w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5" />
              View my slips
            </CardTitle>
            <CardDescription className="text-center">
              Your record card number is the unique ID on your employee record.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col items-center space-y-4">
              <div className="w-full space-y-2">
                <Label htmlFor="recordCard" className="block text-center">Record card number</Label>
                <Input
                  id="recordCard"
                  type="text"
                  placeholder="e.g. 12345"
                  value={recordCard}
                  onChange={(e) => setRecordCard(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                  className="w-full text-center"
                />
              </div>
              <div className="w-full space-y-2">
                <Label className="block text-center">Show slip for month (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-center text-center font-normal",
                        !filterDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterDate ? format(filterDate, "MMMM yyyy") : "Pick a month"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={filterDate}
                      onSelect={setFilterDate}
                      defaultMonth={filterDate ?? new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "View my slips"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

        {error && (
          <Card className="mx-auto w-full max-w-lg border-destructive/50 bg-destructive/5 text-center">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="mx-auto w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle>Slips for {result.employee.name}</CardTitle>
            <CardDescription>
              Record card: {result.employee.recordCardNumber}
              {filterDate ? (
                <span className="mt-1 block">
                  Showing: {format(filterDate, "MMMM yyyy")}{" "}
                  <button
                    type="button"
                    onClick={() => setFilterDate(undefined)}
                    className="underline hover:no-underline"
                  >
                    Show all
                  </button>
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.slips.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No salary slips found for this record card.
              </p>
            ) : filteredSlips.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No slip for {filterDate ? format(filterDate, "MMMM yyyy") : "this month"}.
              </p>
            ) : (
              <ul className="mx-auto space-y-3 text-center">
                {filteredSlips.map((slip) => (
                  <li
                    key={slip.periodLabel}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0 text-left">
                      <p className="font-medium">
                        {formatPeriodDisplay(slip.periodLabel)}
                      </p>
                      {slip.fileName && (
                        <p className="text-muted-foreground text-sm truncate">
                          {slip.fileName}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {slip.viewUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={slip.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-1 h-4 w-4" />
                            View
                          </a>
                        </Button>
                      )}
                      {slip.downloadUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={slip.downloadUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="mr-1 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      )}
                      {!slip.viewUrl && !slip.downloadUrl && (
                        <span className="text-muted-foreground text-xs">
                          Links not available
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
