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
import { EMPLOYEE_NAMES } from "@/constants";
import { fetchAttendanceForMonth } from "@/lib/appwrite/appwrite";
import React, { useEffect, useState } from "react";

/* ======================= Types ======================= */

interface LeaveReport {
  sickLeave: number;
  annualLeave: number;
  certificateSickLeave: number;
  familyRelatedLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  noPayLeave: number;
  officialLeave: number;
  minutesLate: number;
  totalAbsent: number;
}

interface EmployeeDetails {
  name: string;
  address: string;
  designation: string;
  recordCardNumber: string;
  joinedDate: string; // ISO date string
  section: string;
}

type ReportEntry = LeaveReport & EmployeeDetails;

type ReportTuple = [employeeKey: string, entry: ReportEntry];

/** Minimal shape of an employee reference on the attendance document */
type EmployeeRef =
  | string
  | {
      name: string;
      address?: string;
      designation?: string;
      recordCardNumber?: string;
      joinedDate?: string;
      section?: string;
    };

/** Minimal shape of an attendance document we need here */
interface AttendanceDoc {
  date: string; // ISO
  employeeId: EmployeeRef;
  minutesLate?: number | null;
  leaveType?: string | null;
}

/* ======================= Type guards ======================= */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isEmployeeRef(v: unknown): v is EmployeeRef {
  if (typeof v === "string") return true;
  return (
    isObject(v) &&
    typeof v.name === "string" &&
    (typeof v.address === "string" || typeof v.address === "undefined") &&
    (typeof v.designation === "string" ||
      typeof v.designation === "undefined") &&
    (typeof v.recordCardNumber === "string" ||
      typeof v.recordCardNumber === "undefined") &&
    (typeof v.joinedDate === "string" || typeof v.joinedDate === "undefined") &&
    (typeof v.section === "string" || typeof v.section === "undefined")
  );
}

function isAttendanceDoc(v: unknown): v is AttendanceDoc {
  return (
    isObject(v) &&
    typeof v.date === "string" &&
    "employeeId" in v &&
    isEmployeeRef((v as Record<string, unknown>).employeeId) &&
    (typeof (v as Record<string, unknown>).minutesLate === "number" ||
      typeof (v as Record<string, unknown>).minutesLate === "undefined" ||
      (v as Record<string, unknown>).minutesLate === null) &&
    (typeof (v as Record<string, unknown>).leaveType === "string" ||
      typeof (v as Record<string, unknown>).leaveType === "undefined" ||
      (v as Record<string, unknown>).leaveType === null)
  );
}

/* ======================= Utilities ======================= */

function normalizeEmployee(ref: EmployeeRef): EmployeeDetails | null {
  if (typeof ref === "string") {
    // We can’t produce a full details record from a string id; skip those rows
    return null;
  }
  // Default empty strings to keep CSV/view consistent
  return {
    name: ref.name,
    address: ref.address ?? "",
    designation: ref.designation ?? "",
    recordCardNumber: ref.recordCardNumber ?? "",
    joinedDate: ref.joinedDate ?? "",
    section: ref.section ?? "",
  };
}

/* ======================= Component ======================= */

const CouncilReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [totalDays, setTotalDays] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [reportAvailable, setReportAvailable] = useState<boolean>(false);

  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("All");

  const [fullReportData, setFullReportData] = useState<ReportTuple[]>([]);
  const [reportData, setReportData] = useState<ReportTuple[]>([]);

  const generateReport = async (month: string) => {
    setLoading(true);
    try {
      const raw = await fetchAttendanceForMonth(month);

      const docs: AttendanceDoc[] = Array.isArray(raw)
        ? raw.filter(isAttendanceDoc)
        : [];

      // Filter to chosen month + (employee/section) *when present in the row*
      const monthRecords = docs.filter((record) => {
        const recordMonth = new Date(record.date).toISOString().slice(0, 7);

        if (recordMonth !== month) return false;

        const emp = normalizeEmployee(record.employeeId);
        if (!emp) return false; // cannot use rows without full employee details

        const sectionMatches =
          selectedSection === "All" || emp.section === selectedSection;

        const employeeMatches =
          selectedEmployee === "All" || emp.name === selectedEmployee;

        return sectionMatches && employeeMatches;
      });

      if (monthRecords.length === 0) {
        setReportAvailable(false);
        setFullReportData([]);
        setReportData([]);
        setLoading(false);
        return;
      }

      // Build report keyed by employee name
      const reportMap = new Map<string, ReportEntry>();

      monthRecords.forEach((record) => {
        const emp = normalizeEmployee(record.employeeId);
        if (!emp) return;

        // Initialize entry if not present
        if (!reportMap.has(emp.name)) {
          reportMap.set(emp.name, {
            sickLeave: 0,
            annualLeave: 0,
            certificateSickLeave: 0,
            familyRelatedLeave: 0,
            maternityLeave: 0,
            paternityLeave: 0,
            noPayLeave: 0,
            officialLeave: 0,
            minutesLate: 0,
            totalAbsent: 0,
            ...emp,
          });
        }

        const entry = reportMap.get(emp.name)!;

        // Count leave
        const leave = record.leaveType ?? "";
        const leaveKey = leave as keyof LeaveReport;
        if (leave && leaveKey in entry) {
          (entry[leaveKey] as number) += 1;
          entry.totalAbsent += 1;
        }

        // Sum minutes late
        if (typeof record.minutesLate === "number") {
          entry.minutesLate += record.minutesLate;
        }
      });

      const tuples: ReportTuple[] = Array.from(reportMap.entries());
      setFullReportData(tuples);
      setReportData(tuples);
      setReportAvailable(true);
    } catch (err) {
      console.error("Error generating report:", err);
      setReportAvailable(false);
      setFullReportData([]);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply UI filters to fullReportData
  useEffect(() => {
    if (fullReportData.length === 0) return;

    const filtered = fullReportData.filter(([, stats]) => {
      const sectionMatches =
        selectedSection === "All" || stats.section === selectedSection;

      const employeeMatches =
        selectedEmployee === "All" || stats.name === selectedEmployee;

      return sectionMatches && employeeMatches;
    });

    setReportData(filtered);
  }, [selectedSection, selectedEmployee, fullReportData]);

  const downloadCSV = () => {
    if (reportData.length === 0) return;

    const headers = [
      "Name",
      "Address",
      "Designation",
      "Record Card Number",
      "Joined Date",
      "Sick Leave",
      "Certificate Leave",
      "Annual Leave",
      "Official Leave",
      "Family Related Leave",
      "Maternity & Paternity Leave",
      "Late Minutes",
      "Total Absent Days",
      "Total Days Attended",
      "Total Working Days",
    ];

    const rows = reportData.map(([, stats]) => {
      const joined = stats.joinedDate
        ? new Date(stats.joinedDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "";

      return [
        stats.name,
        stats.address,
        stats.designation,
        stats.recordCardNumber,
        `"${joined}"`,
        `'${stats.sickLeave || 0}`,
        `'${stats.certificateSickLeave || 0}`,
        `'${stats.annualLeave || 0}`,
        `'${stats.officialLeave || 0}`,
        `'${stats.familyRelatedLeave || 0}`,
        `'${stats.maternityLeave || 0}`,
        `'${stats.minutesLate || 0}`,
        `'${stats.totalAbsent || 0}`,
        `'${Math.max(0, totalDays - (stats.totalAbsent || 0))}`,
        `'${totalDays}`,
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Attendance_Report_${selectedMonth}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-5 mt-10">
        Monthly Attendance Report
      </h1>

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Select Month */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Select Month</p>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded-md w-full h-12"
          />
        </div>

        {/* Total Working Days */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">
            Enter Total Working Days
          </p>
          <input
            type="number"
            value={totalDays}
            onChange={(e) => setTotalDays(Number(e.target.value) || 0)}
            className="border p-2 rounded-md w-full h-12"
            placeholder="Total Days"
          />
        </div>

        {/* Select Employee */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">
            Select Employee
          </p>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="border p-2 rounded-md w-full h-12"
          >
            <option value="All">All Employees</option>
            {EMPLOYEE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Select Section */}
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">
            Select Section
          </p>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="border p-2 rounded-md w-full h-12"
          >
            <option value="All">All Sections</option>
            <option value="Admin">Admin</option>
            <option value="Councillor">Councillor</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex lg:col-span-2 xl:col-span-4 gap-4">
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
        <p>No attendance records found for the selected month.</p>
      ) : (
        <div id="report" className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border border-gray-400 bg-slate-100/50">
                <TableHead className="table-head">#</TableHead>
                <TableHead className="table-head">Name</TableHead>
                <TableHead className="table-head">Address</TableHead>
                <TableHead className="table-head">Designation</TableHead>
                <TableHead className="table-head">Record Card Number</TableHead>
                <TableHead className="table-head">Joined Date</TableHead>
                <TableHead className="table-head">Sick Leave</TableHead>
                <TableHead className="table-head">Certificate Leave</TableHead>
                <TableHead className="table-head">Annual Leave</TableHead>
                <TableHead className="table-head">Official Leave</TableHead>
                <TableHead className="table-head">
                  Family Related Leave
                </TableHead>
                <TableHead className="table-head">
                  Maternity & Paternity
                </TableHead>
                <TableHead className="table-head">Late Minutes</TableHead>
                <TableHead className="table-head">Total Absent Days</TableHead>
                <TableHead className="table-head">
                  Total Days Attended
                </TableHead>
                <TableHead className="table-head">Total Working Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border border-gray-400">
              {reportData.map(([_, stats], index) => (
                <TableRow key={stats.name} className="border-r border-gray-300">
                  <TableCell className="text-center border-r">
                    {index + 1}
                  </TableCell>
                  <TableCell className="table-cell-rotate">
                    {stats.name}
                  </TableCell>
                  <TableCell className="table-cell-rotate">
                    {stats.address}
                  </TableCell>
                  <TableCell className="table-cell-rotate">
                    {stats.designation}
                  </TableCell>
                  <TableCell className="table-cell-rotate">
                    {stats.recordCardNumber}
                  </TableCell>
                  <TableCell className="table-cell-rotate">
                    {stats.joinedDate
                      ? new Date(stats.joinedDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : ""}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.sickLeave}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.certificateSickLeave}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.annualLeave}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.officialLeave}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.familyRelatedLeave}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.maternityLeave}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.minutesLate}
                  </TableCell>
                  <TableCell className="table-cell">
                    {stats.totalAbsent}
                  </TableCell>
                  <TableCell className="table-cell">
                    {Math.max(0, totalDays - stats.totalAbsent)}
                  </TableCell>
                  <TableCell className="text-center border-r border-gray-400">
                    {totalDays}
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

export default CouncilReportsPage;
