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
  fetchMosqueAssistants,
  fetchMosqueDailyAttendanceForMonth,
  fetchPrayerTimesForMonth,
} from "@/lib/appwrite/appwrite";
import React, { useEffect, useState } from "react";

/* ========================= Types ========================= */

type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      designation?: string;
    };

type AttRow = {
  $id: string;
  date: string; // ISO date-time
  employeeId: EmployeeRef;
  fathisSignInTime: string | null;
  mendhuruSignInTime: string | null;
  asuruSignInTime: string | null;
  maqribSignInTime: string | null;
  ishaSignInTime: string | null;
};

type MosqueAssistant = {
  $id: string;
  name: string;
};

type PrayerTimesDoc = {
  date: string; // ISO date-time
  fathisTime: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};

type PrayerTimesMap = Record<
  string, // YYYY-MM-DD
  {
    fathisTime: string;
    mendhuruTime: string;
    asuruTime: string;
    maqribTime: string;
    ishaTime: string;
  }
>;

/* ========================= Type Guards ========================= */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isMosqueAssistant(v: unknown): v is MosqueAssistant {
  return isObject(v) && typeof v.$id === "string" && typeof v.name === "string";
}

function isEmployeeRef(v: unknown): v is EmployeeRef {
  if (typeof v === "string") return true;
  return (
    isObject(v) &&
    typeof v.$id === "string" &&
    typeof v.name === "string" &&
    (typeof v.designation === "string" || typeof v.designation === "undefined")
  );
}

function isNullableString(v: unknown): v is string | null {
  return typeof v === "string" || v === null;
}

/** Looser “attendance-like” check against unknown API rows */
function isAttendanceLike(v: unknown): v is {
  $id: unknown;
  date: unknown;
  employeeId: unknown;
  fathisSignInTime: unknown;
  mendhuruSignInTime: unknown;
  asuruSignInTime: unknown;
  maqribSignInTime: unknown;
  ishaSignInTime: unknown;
} {
  return (
    isObject(v) &&
    typeof v.$id === "string" &&
    typeof v.date === "string" &&
    "employeeId" in v &&
    "fathisSignInTime" in v &&
    "mendhuruSignInTime" in v &&
    "asuruSignInTime" in v &&
    "maqribSignInTime" in v &&
    "ishaSignInTime" in v
  );
}

function isPrayerTimesDoc(v: unknown): v is PrayerTimesDoc {
  return (
    isObject(v) &&
    typeof v.date === "string" &&
    typeof v.fathisTime === "string" &&
    typeof v.mendhuruTime === "string" &&
    typeof v.asuruTime === "string" &&
    typeof v.maqribTime === "string" &&
    typeof v.ishaTime === "string"
  );
}

/* ========================= Helpers ========================= */

function empName(emp: EmployeeRef): string {
  return typeof emp === "string" ? emp : emp.name || emp.$id || "Unknown";
}

function empDesignation(emp: EmployeeRef): string {
  return typeof emp === "string" ? "" : emp.designation ?? "";
}

/** signInTime (ISO) is late if strictly after expected "HH:MM" (as UTC). */
function isLate(signInTime: string | null, expectedTime?: string) {
  if (!signInTime || !expectedTime) return false;
  const signInDate = new Date(signInTime);
  const datePart = signInDate.toISOString().slice(0, 10);
  const expected = new Date(`${datePart}T${expectedTime}Z`);
  return signInDate.getTime() > expected.getTime();
}

function fmtTimeOrDash(iso: string | null): string {
  if (!iso) return "Not Signed In";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(iso));
}

/* ========================= Component ========================= */

const MosqueMonthlyReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [employees, setEmployees] = useState<MosqueAssistant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [attendanceData, setAttendanceData] = useState<AttRow[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesMap>({});

  // Fetch employees with designation "Mosque Assistant"
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchMosqueAssistants();
        const list: MosqueAssistant[] = Array.isArray(res)
          ? res.filter(isMosqueAssistant)
          : [];
        setEmployees(list);
      } catch (err) {
        console.error("Error fetching employees:", err);
      }
    })();
  }, []);

  // Fetch attendance & prayer-times for the selected assistant/month
  const fetchMonthlyReport = async (month: string) => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      // Attendance for the chosen employee
      const attRaw = await fetchMosqueDailyAttendanceForMonth(
        month,
        selectedEmployee
      );

      // Build strongly-typed AttRow[] from unknown input without casts
      const att: AttRow[] = Array.isArray(attRaw)
        ? attRaw.reduce<AttRow[]>((acc, row) => {
            if (!isAttendanceLike(row)) return acc;
            if (!isEmployeeRef(row.employeeId)) return acc;

            // Narrow each sign-in field to string | null
            const f = row.fathisSignInTime;
            const m1 = row.mendhuruSignInTime;
            const a = row.asuruSignInTime;
            const m2 = row.maqribSignInTime;
            const i = row.ishaSignInTime;

            if (
              !isNullableString(f) ||
              !isNullableString(m1) ||
              !isNullableString(a) ||
              !isNullableString(m2) ||
              !isNullableString(i)
            ) {
              return acc;
            }

            acc.push({
              $id: row.$id,
              date: row.date as string,
              employeeId: row.employeeId,
              fathisSignInTime: f,
              mendhuruSignInTime: m1,
              asuruSignInTime: a,
              maqribSignInTime: m2,
              ishaSignInTime: i,
            });
            return acc;
          }, [])
        : [];

      setAttendanceData(att);

      // All prayer times for the month, mapped by date
      const ptRaw = await fetchPrayerTimesForMonth(month);
      const ptDocs: PrayerTimesDoc[] = Array.isArray(ptRaw)
        ? ptRaw.filter(isPrayerTimesDoc)
        : [];

      const ptMap: PrayerTimesMap = {};
      ptDocs.forEach((doc) => {
        const key = doc.date.slice(0, 10);
        ptMap[key] = {
          fathisTime: doc.fathisTime,
          mendhuruTime: doc.mendhuruTime,
          asuruTime: doc.asuruTime,
          maqribTime: doc.maqribTime,
          ishaTime: doc.ishaTime,
        };
      });
      setPrayerTimes(ptMap);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // CSV export
  const downloadCSV = () => {
    if (attendanceData.length === 0) return;

    const emp = employees.find((e) => e.$id === selectedEmployee);
    const employeeName = (emp?.name || "Employee").replace(/\s+/g, "_");

    const headers = [
      "Date",
      "Employee Name",
      "Designation",
      "Fajr Sign-In",
      "Dhuhr Sign-In",
      "Asr Sign-In",
      "Maghrib Sign-In",
      "Isha Sign-In",
    ];

    const rows = attendanceData.map((rec) => {
      const date = rec.date.slice(0, 10);
      return [
        date,
        empName(rec.employeeId),
        empDesignation(rec.employeeId),
        fmtTimeOrDash(rec.fathisSignInTime),
        fmtTimeOrDash(rec.mendhuruSignInTime),
        fmtTimeOrDash(rec.asuruSignInTime),
        fmtTimeOrDash(rec.maqribSignInTime),
        fmtTimeOrDash(rec.ishaSignInTime),
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Attendance_Report_${selectedMonth}_${employeeName}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-5 mt-10">
        Mosque Daily Attendance Report
      </h1>

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Month Selector */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-2">
            Select Month
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded-md w-full h-12"
          />
        </div>

        {/* Employee Filter */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-2">
            Select Employee
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="border p-2 rounded-md w-full h-12"
          >
            <option value="">Select Employee</option>
            {employees.map((employee) => (
              <option key={employee.$id} value={employee.$id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-end gap-3">
          <button
            onClick={() => fetchMonthlyReport(selectedMonth)}
            disabled={!selectedEmployee}
            className={`custom-button h-12 w-full lg:w-auto ${
              !selectedEmployee ? "bg-gray-300 cursor-not-allowed" : ""
            }`}
          >
            Generate Report
          </button>
          <button
            onClick={downloadCSV}
            disabled={attendanceData.length === 0}
            className={`custom-button h-12 w-full lg:w-auto ${
              attendanceData.length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : ""
            }`}
          >
            Download CSV
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonReportsTable />
      ) : attendanceData.length === 0 ? (
        <p>No attendance records found for the selected month and employee.</p>
      ) : (
        <div id="monthly-report" className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border border-gray-400 bg-slate-100/50">
                <TableHead>#</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Fajr</TableHead>
                <TableHead>Dhuhr</TableHead>
                <TableHead>Asr</TableHead>
                <TableHead>Maghrib</TableHead>
                <TableHead>Isha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border border-gray-400">
              {attendanceData.map((rec, idx) => {
                const date = rec.date.slice(0, 10);
                const times = prayerTimes[date];

                return (
                  <TableRow key={rec.$id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{empName(rec.employeeId)}</TableCell>
                    <TableCell>{empDesignation(rec.employeeId)}</TableCell>
                    <TableCell>{date}</TableCell>

                    <TableCell
                      className={
                        times && isLate(rec.fathisSignInTime, times.fathisTime)
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {fmtTimeOrDash(rec.fathisSignInTime)}
                    </TableCell>

                    <TableCell
                      className={
                        times &&
                        isLate(rec.mendhuruSignInTime, times.mendhuruTime)
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {fmtTimeOrDash(rec.mendhuruSignInTime)}
                    </TableCell>

                    <TableCell
                      className={
                        times && isLate(rec.asuruSignInTime, times.asuruTime)
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {fmtTimeOrDash(rec.asuruSignInTime)}
                    </TableCell>

                    <TableCell
                      className={
                        times && isLate(rec.maqribSignInTime, times.maqribTime)
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {fmtTimeOrDash(rec.maqribSignInTime)}
                    </TableCell>

                    <TableCell
                      className={
                        times && isLate(rec.ishaSignInTime, times.ishaTime)
                          ? "text-red-500"
                          : ""
                      }
                    >
                      {fmtTimeOrDash(rec.ishaSignInTime)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MosqueMonthlyReportsPage;
