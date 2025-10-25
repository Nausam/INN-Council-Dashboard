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
import { fetchMosqueAttendanceForMonth } from "@/lib/appwrite/appwrite";
import React, { useState } from "react";

/* ======================= Types ======================= */

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
  date: string; // ISO string
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

/* ======================= Normalizers (no any) ======================= */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v : "";
}

function getNumber(o: Record<string, unknown>, key: string): number {
  const v = o[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getEmployeeRef(o: Record<string, unknown>, key: string): EmployeeRef {
  const v = o[key];
  if (typeof v === "string") return v;

  if (isRecord(v)) {
    const $id = "$id" in v && typeof v.$id === "string" ? v.$id : "";
    const name = "name" in v && typeof v.name === "string" ? v.name : "";
    const designation =
      "designation" in v && typeof v.designation === "string"
        ? v.designation
        : undefined;
    const joinedDate =
      "joinedDate" in v && typeof v.joinedDate === "string"
        ? v.joinedDate
        : undefined;
    const section =
      "section" in v && typeof v.section === "string" ? v.section : undefined;

    if ($id || name || designation || joinedDate || section) {
      return { $id, name, designation, joinedDate, section };
    }
  }
  return ""; // fallback: unresolved ref
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

/* ======================= Component ======================= */

const MosqueMonthlyReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [reportAvailable, setReportAvailable] = useState<boolean>(false);
  const [reportData, setReportData] = useState<Array<[string, ReportEntry]>>(
    []
  );

  const generateReport = async (month: string): Promise<void> => {
    setLoading(true);
    try {
      const raw = await fetchMosqueAttendanceForMonth(month);
      const attendanceRecords = normalizeAttendance(raw);

      // Keep only records in the chosen month (YYYY-MM)
      const monthRecords = attendanceRecords.filter((record) => {
        const recordMonth = new Date(record.date).toISOString().slice(0, 7);
        return recordMonth === month;
      });

      if (monthRecords.length === 0) {
        setReportAvailable(false);
        setReportData([]);
        setLoading(false);
        return;
      }

      // Aggregate by employee (use embedded name if available; fallback to id)
      const reportMap = new Map<string, ReportEntry>();

      for (const r of monthRecords) {
        // Resolve details
        let name = "Unknown";
        let designation = "";
        let joinedDate = "";
        let section = "";

        if (typeof r.employeeId === "string") {
          name = r.employeeId; // fallback to id as name
        } else {
          name = r.employeeId.name || r.employeeId.$id || "Unknown";
          designation = r.employeeId.designation ?? "";
          joinedDate = r.employeeId.joinedDate ?? "";
          section = r.employeeId.section ?? "";
        }

        // Key by name (you can change to $id if you prefer)
        const key = name;

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

        current.totalMinutesLate =
          current.fathisMinutesLate +
          current.mendhuruMinutesLate +
          current.asuruMinutesLate +
          current.maqribMinutesLate +
          current.ishaMinutesLate;

        current.totalHoursLate = Math.floor(current.totalMinutesLate / 60);

        reportMap.set(key, current);
      }

      setReportData(Array.from(reportMap.entries()));
      setReportAvailable(true);
    } catch (err) {
      console.error("Error generating mosque report:", err);
      setReportAvailable(false);
      setReportData([]);
    } finally {
      setLoading(false);
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
      "Total Late (mins)",
      "Total Late (hrs)",
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
            onClick={() => generateReport(selectedMonth)}
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
                <TableRow key={stats.name + index}>
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
