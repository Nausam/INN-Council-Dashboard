"use client";

import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEmployeesQuery,
  useMosqueAssistantsQuery,
  useMosqueAttendanceMonthQuery,
} from "@/hooks/queries";
import type { EmployeeDoc } from "@/lib/firebase/hr";
import React, { useMemo, useState } from "react";

function toHoursMinutes(total: number) {
  const safe = Math.max(0, Math.floor(total));
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  };
}

type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      designation?: string;
      joinedDate?: string;
      section?: string;
    };

type MosqueAttendanceDoc = {
  date: string;
  employeeId: EmployeeRef;
  fathisMinutesLate: number;
  mendhuruMinutesLate: number;
  asuruMinutesLate: number;
  maqribMinutesLate: number;
  ishaMinutesLate: number;
};

type PrayerLateReport = {
  fathisMinutesLate: number;
  mendhuruMinutesLate: number;
  asuruMinutesLate: number;
  maqribMinutesLate: number;
  ishaMinutesLate: number;
  totalMinutesLate: number;
  totalHoursLate: number;
};

type EmployeeDetails = {
  name: string;
  designation: string;
  joinedDate: string;
  section: string;
};

type ReportEntry = PrayerLateReport & EmployeeDetails;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getString(o: Record<string, unknown>, key: string): string {
  const val = o[key];
  return typeof val === "string" ? val : "";
}

function getNumber(o: Record<string, unknown>, key: string): number {
  const val = o[key];
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getEmployeeRef(o: Record<string, unknown>, key: string): EmployeeRef {
  const val = o[key];
  if (typeof val === "string") return val;

  if (isRecord(val)) {
    const $id = "$id" in val && typeof val.$id === "string" ? val.$id : "";
    const name = "name" in val && typeof val.name === "string" ? val.name : "";
    const designation =
      "designation" in val && typeof val.designation === "string"
        ? val.designation
        : undefined;
    const joinedDate =
      "joinedDate" in val && typeof val.joinedDate === "string"
        ? val.joinedDate
        : undefined;
    const section =
      "section" in val && typeof val.section === "string" ? val.section : undefined;

    if ($id || name || designation || joinedDate || section) {
      return { $id, name, designation, joinedDate, section };
    }
  }
  return "";
}

function normalizeAttendance(raw: unknown): MosqueAttendanceDoc[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item): MosqueAttendanceDoc => {
    const o = isRecord(item) ? item : {};
    return {
      date: getString(o, "date"),
      employeeId: getEmployeeRef(o, "employeeId"),
      fathisMinutesLate: getNumber(o, "fathisMinutesLate"),
      mendhuruMinutesLate: getNumber(o, "mendhuruMinutesLate"),
      asuruMinutesLate: getNumber(o, "asuruMinutesLate"),
      maqribMinutesLate: getNumber(o, "maqribMinutesLate"),
      ishaMinutesLate: getNumber(o, "ishaMinutesLate"),
    };
  });
}

function buildEmployeeInfoMap(
  assistants: EmployeeDoc[],
  allEmployees: EmployeeDoc[],
): Map<string, { name: string; designation: string }> {
  const idToInfo = new Map<string, { name: string; designation: string }>();

  for (const e of assistants) {
    idToInfo.set(e.$id, {
      name: e.name,
      designation: typeof e.designation === "string" ? e.designation : "",
    });
  }

  for (const e of allEmployees) {
    if (!idToInfo.has(e.$id)) {
      idToInfo.set(e.$id, {
        name: e.name,
        designation: typeof e.designation === "string" ? e.designation : "",
      });
    }
  }

  return idToInfo;
}

function buildMosqueReport(
  month: string,
  raw: unknown,
  idToInfo: Map<string, { name: string; designation: string }>,
): Array<[string, ReportEntry]> {
  const attendanceRecords = normalizeAttendance(raw);

  const monthRecords = attendanceRecords.filter((record) => {
    const recordMonth = new Date(record.date).toISOString().slice(0, 7);
    return recordMonth === month;
  });

  if (monthRecords.length === 0) return [];

  const reportMap = new Map<string, ReportEntry>();

  for (const r of monthRecords) {
    let key = "";
    let name = "Unknown";
    let designation = "";
    let joinedDate = "";
    let section = "";

    if (typeof r.employeeId === "string") {
      key = r.employeeId;
      const info = idToInfo.get(r.employeeId);
      if (info) {
        name = info.name;
        designation = info.designation;
      } else {
        name = "(Unknown)";
      }
    } else {
      key = r.employeeId.$id || r.employeeId.name;
      name = r.employeeId.name || r.employeeId.$id || "Unknown";
      designation = r.employeeId.designation ?? "";
      joinedDate = r.employeeId.joinedDate ?? "";
      section = r.employeeId.section ?? "";
    }

    const current: ReportEntry = reportMap.get(key) ?? {
      name,
      designation,
      joinedDate,
      section,
      fathisMinutesLate: 0,
      mendhuruMinutesLate: 0,
      asuruMinutesLate: 0,
      maqribMinutesLate: 0,
      ishaMinutesLate: 0,
      totalMinutesLate: 0,
      totalHoursLate: 0,
    };

    current.fathisMinutesLate += r.fathisMinutesLate;
    current.mendhuruMinutesLate += r.mendhuruMinutesLate;
    current.asuruMinutesLate += r.asuruMinutesLate;
    current.maqribMinutesLate += r.maqribMinutesLate;
    current.ishaMinutesLate += r.ishaMinutesLate;

    const total =
      current.fathisMinutesLate +
      current.mendhuruMinutesLate +
      current.asuruMinutesLate +
      current.maqribMinutesLate +
      current.ishaMinutesLate;

    const { hours, minutes } = toHoursMinutes(total);
    current.totalMinutesLate = minutes;
    current.totalHoursLate = hours;

    reportMap.set(key, current);
  }

  return Array.from(reportMap.entries());
}

const MosqueMonthlyReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [queryMonth, setQueryMonth] = useState<string>("");

  const { data: assistants = [] } = useMosqueAssistantsQuery();
  const { data: allEmployees = [] } = useEmployeesQuery();
  const {
    data: rawAttendance,
    isLoading,
    isFetching,
    isError,
    isSuccess,
    refetch,
  } = useMosqueAttendanceMonthQuery(queryMonth);

  const idToInfo = useMemo(
    () => buildEmployeeInfoMap(assistants, allEmployees),
    [assistants, allEmployees],
  );

  const reportData = useMemo(() => {
    if (!queryMonth || rawAttendance === undefined) return [];
    return buildMosqueReport(queryMonth, rawAttendance, idToInfo);
  }, [queryMonth, rawAttendance, idToInfo]);

  const reportAvailable =
    Boolean(queryMonth) && isSuccess && !isError && reportData.length > 0;
  const loading = Boolean(queryMonth) && (isLoading || isFetching);

  const handleGenerateReport = () => {
    if (queryMonth === selectedMonth) {
      void refetch();
    } else {
      setQueryMonth(selectedMonth);
    }
  };

  const downloadCSV = (): void => {
    if (reportData.length === 0) return;

    const headers = [
      "Employee Name",
      "Designation",
      "Fajr Late (mins)",
      "Dhuhr Late (mins)",
      "Asr Late (mins)",
      "Maghrib Late (mins)",
      "Isha Late (mins)",
      "Total Late (hrs)",
      "Total Late (mins)",
    ];

    const rows = reportData.map(([, stats]) => [
      stats.name,
      stats.designation,
      String(stats.fathisMinutesLate),
      String(stats.mendhuruMinutesLate),
      String(stats.asuruMinutesLate),
      String(stats.maqribMinutesLate),
      String(stats.ishaMinutesLate),
      String(stats.totalMinutesLate),
      String(stats.totalHoursLate),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Mosque_Monthly_Report_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-5 mt-10">
        Mosque Monthly Attendance Report
      </h1>

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Select Month</p>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded-md w-full h-12"
          />
        </div>

        <div className="flex items-end gap-4">
          <button
            onClick={handleGenerateReport}
            className="custom-button h-12 w-full lg:w-auto"
          >
            Generate Report
          </button>
          <button
            onClick={downloadCSV}
            disabled={!reportAvailable}
            className={`custom-button h-12 w-full lg:w-auto ${
              !reportAvailable ? "bg-gray-300 cursor-not-allowed" : ""
            }`}
          >
            Download CSV
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonReportsTable />
      ) : !reportAvailable ? (
        <p>No mosque attendance records found for the selected month.</p>
      ) : (
        <div id="mosque-report" className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border border-gray-400 bg-slate-100/50">
                <TableHead className="m-table-head">#</TableHead>
                <TableHead className="m-table-head">Employee Name</TableHead>
                <TableHead className="m-table-head">Designation</TableHead>
                <TableHead className="m-table-head">Fajr Late (mins)</TableHead>
                <TableHead className="m-table-head">
                  Dhuhr Late (mins)
                </TableHead>
                <TableHead className="m-table-head">Asr Late (mins)</TableHead>
                <TableHead className="m-table-head">
                  Maghrib Late (mins)
                </TableHead>
                <TableHead className="m-table-head">Isha Late (mins)</TableHead>
                <TableHead className="m-table-head font-bold">
                  Total Late (mins)
                </TableHead>
                <TableHead className="m-table-head font-bold">
                  Total Late (hrs)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border border-gray-400">
              {reportData.map(([, stats], index) => (
                <TableRow key={String(index) + stats.name}>
                  <TableCell className="table-cell">{index + 1}</TableCell>
                  <TableCell className="table-cell">{stats.name}</TableCell>
                  <TableCell className="table-cell">
                    {stats.designation}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.fathisMinutesLate}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.mendhuruMinutesLate}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.asuruMinutesLate}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.maqribMinutesLate}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.ishaMinutesLate}
                  </TableCell>
                  <TableCell className="table-cell font-bold">
                    {stats.totalMinutesLate}
                  </TableCell>
                  <TableCell className="table-cell font-bold">
                    {stats.totalHoursLate}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MosqueMonthlyReportsPage;
