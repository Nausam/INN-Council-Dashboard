"use client";

import { CouncilCard } from "@/components/design-system/council-card";
import { EmptyState } from "@/components/design-system/empty-state";
import { PageHeader } from "@/components/design-system/page-header";
import { PageShell } from "@/components/design-system/page-shell";
import { Button } from "@/components/ui/button";
import { buildAttendanceReportWorkbook } from "@/lib/attendance/attendance-report-excel";
import {
  ABSENT_LABEL,
  DHIVEHI_WEEKDAYS,
  monthTitleDv,
  type AttendanceReport,
  type AttendanceReportGroupKey,
} from "@/lib/attendance/attendance-report-shared";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatJoined(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function AttendanceReportView({ report }: { report: AttendanceReport }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const firstGroup = report.groups.find((group) => group.employees.length > 0)?.key ?? "office";
  const [activeKey, setActiveKey] = useState<AttendanceReportGroupKey>(firstGroup);

  const active = report.groups.find((group) => group.key === activeKey) ?? report.groups[0];
  const offDays = useMemo(() => report.days.filter((day) => day.off).length, [report.days]);
  const employeeCount = report.groups.reduce((sum, group) => sum + group.employees.length, 0);

  const goToMonth = (month: string) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    startTransition(() => router.push(`/reports/attendance?month=${month}`));
  };

  const downloadExcel = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await buildAttendanceReportWorkbook(report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Muvazzafun ge Haaziree - ${monthLabel(report.month)}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      setDownloadError("Could not build the Excel file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PageShell maxWidth="full">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          icon={ClipboardList}
          title="Attendance Report"
          subtitle="First punch of each day and leave for every employee, laid out like the paper register"
          className="mb-8"
          actions={
            <Button
              onClick={downloadExcel}
              disabled={downloading || employeeCount === 0}
              className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Excel
            </Button>
          }
        />

        <CouncilCard interactive="none" className="mb-6 border border-teal-100 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => goToMonth(shiftMonth(report.month, -1))}
                disabled={isNavigating}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="month"
                value={report.month}
                onChange={(event) => goToMonth(event.target.value)}
                className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                aria-label="Report month"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => goToMonth(shiftMonth(report.month, 1))}
                disabled={isNavigating}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {isNavigating && <Loader2 className="h-4 w-4 animate-spin text-teal-600" />}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
              <span>
                <span className="font-dh2 text-base text-slate-900">{monthTitleDv(report.month)}</span>
              </span>
              <span>{report.days.length} days</span>
              <span>{report.days.length - offDays} working days</span>
              <span>{employeeCount} employees</span>
            </div>
          </div>
          {downloadError && <p className="mt-3 text-sm text-red-600">{downloadError}</p>}
        </CouncilCard>

        <div className="mb-4 flex flex-wrap gap-2">
          {report.groups.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => setActiveKey(group.key)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                group.key === active.key
                  ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50",
              )}
            >
              {group.title}
              <span className="ms-2 opacity-70">{group.employees.length}</span>
            </button>
          ))}
        </div>

        {active.employees.length === 0 ? (
          <EmptyState icon={Users} title="No employees in this group" />
        ) : (
          <CouncilCard interactive="none" className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-200" />
                Weekend / holiday
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-amber-200" />
                Leave (running count)
              </span>
            </div>
            <div className="max-h-[75vh] overflow-auto" dir="rtl">
              <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-20 bg-white">
                  <tr>
                    <th className="sticky right-0 z-30 border-b border-l border-slate-200 bg-teal-50 px-3 py-3 font-dh2 text-base font-semibold text-teal-900">
                      {monthTitleDv(report.month)}
                    </th>
                    {active.employees.map((employee) => (
                      <th
                        key={employee.id}
                        className="w-[148px] min-w-[148px] border-b border-l border-slate-200 bg-white px-3 py-3 align-top font-normal"
                      >
                        <div className="font-dh2 text-[15px] leading-6 text-slate-900">
                          {employee.nameDv}
                        </div>
                        <div className="mt-1 font-dh2 text-xs leading-5 text-slate-500">
                          {employee.designationDv}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400" dir="ltr">
                          {formatJoined(employee.joinedDate)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <tr key={day.iso} className={day.off ? "bg-slate-100" : "bg-white"}>
                      <td
                        className={cn(
                          "sticky right-0 z-10 border-b border-l border-slate-200 px-3 py-2",
                          day.off ? "bg-slate-200" : "bg-teal-50/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-dh2 text-sm text-slate-800">
                            {DHIVEHI_WEEKDAYS[day.weekday]}
                          </span>
                          <span className="w-6 text-center font-semibold tabular-nums text-slate-900">
                            {day.day}
                          </span>
                        </div>
                      </td>
                      {active.employees.map((employee) => {
                        const cell = employee.cells[day.day];
                        return (
                          <td
                            key={employee.id}
                            className="w-[148px] min-w-[148px] max-w-[148px] border-b border-l border-slate-200 px-2 py-1.5 text-center align-middle"
                          >
                            {cell?.leave && (
                              <div className="mb-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-900">
                                <span className="font-dh2 text-xs">{cell.leave.labelDv}</span>
                                {cell.leave.count !== null && (
                                  <span className="text-xs font-semibold tabular-nums">
                                    {cell.leave.count}
                                  </span>
                                )}
                              </div>
                            )}
                            {cell?.mark === "present" && (
                              <Check className="mx-auto h-5 w-5 text-teal-600" aria-label="Present" />
                            )}
                            {cell?.mark === "absent" && (
                              <span className="rounded bg-rose-50 px-1.5 font-dh2 text-xs text-rose-700 ring-1 ring-rose-200">
                                {ABSENT_LABEL}
                              </span>
                            )}
                            {cell?.time && (
                              <div className="flex justify-center" dir="ltr">
                                <span className="rounded bg-slate-50 px-1.5 text-xs tabular-nums text-slate-700 ring-1 ring-slate-200">
                                  {cell.time}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CouncilCard>
        )}
      </div>
    </PageShell>
  );
}
