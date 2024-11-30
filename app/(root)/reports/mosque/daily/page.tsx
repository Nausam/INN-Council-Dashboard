"use client";

import React, { useState, useEffect } from "react";
import {
  fetchMosqueAttendanceForMonth,
  fetchPrayerTimesForMonth,
  fetchMosqueAssistants,
  fetchMosqueDailyAttendanceForMonth,
} from "@/lib/appwrite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";

const MosqueMonthlyReportsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<{ [date: string]: any }>({});

  // Fetch Employees with designation "Mosque Assistant"
  const fetchEmployees = async () => {
    try {
      const employees = await fetchMosqueAssistants();
      setEmployees(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Fetch Attendance Data
  const fetchMonthlyReport = async (month: string) => {
    if (!selectedEmployee) return; // Only generate for a selected employee
    setLoading(true);
    try {
      // Fetch attendance data for the month for the selected employee
      const attendance = await fetchMosqueDailyAttendanceForMonth(
        month,
        selectedEmployee
      );
      setAttendanceData(attendance);

      // Fetch all prayer times for the month in one query
      const prayerTimesData = await fetchPrayerTimesForMonth(month);

      // Convert prayer times into a key-value map (keyed by date)
      const prayerTimesMap: { [date: string]: any } = {};
      prayerTimesData.forEach((record: any) => {
        const date = record.date.slice(0, 10);
        prayerTimesMap[date] = {
          fathisTime: record.fathisTime,
          mendhuruTime: record.mendhuruTime,
          asuruTime: record.asuruTime,
          maqribTime: record.maqribTime,
          ishaTime: record.ishaTime,
        };
      });

      setPrayerTimes(prayerTimesMap);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if the employee is late
  const isLate = (signInTime: string | null, expectedTime: string | null) => {
    if (!signInTime || !expectedTime) return false;

    const signInDate = new Date(signInTime);
    const expectedDate = new Date(
      `${signInDate.toISOString().slice(0, 10)}T${expectedTime}Z`
    );

    return signInDate > expectedDate;
  };

  // Download CSV
  const downloadCSV = () => {
    if (attendanceData.length === 0) return;

    // Find the selected employee's name
    const employee = employees.find((emp) => emp.$id === selectedEmployee);
    const employeeName = employee
      ? employee.name.replace(/\s+/g, "_")
      : "Employee";

    // Prepare CSV data
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
    const rows = attendanceData.map((record) => {
      const date = record.date.slice(0, 10); // YYYY-MM-DD
      const times = prayerTimes[date] || {};

      return [
        date,
        record.employeeId.name,
        record.employeeId.designation,
        record.fathisSignInTime
          ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "UTC",
            }).format(new Date(record.fathisSignInTime))
          : "Not Signed In",
        record.mendhuruSignInTime
          ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "UTC",
            }).format(new Date(record.mendhuruSignInTime))
          : "Not Signed In",
        record.asuruSignInTime
          ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "UTC",
            }).format(new Date(record.asuruSignInTime))
          : "Not Signed In",
        record.maqribSignInTime
          ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "UTC",
            }).format(new Date(record.maqribSignInTime))
          : "Not Signed In",
        record.ishaSignInTime
          ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "UTC",
            }).format(new Date(record.ishaSignInTime))
          : "Not Signed In",
      ];
    });

    // Convert to CSV
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Report_${selectedMonth}_${employeeName}.csv`;
    link.click();
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">
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

        {/* Employee Filter Dropdown */}
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

        {/* Download CSV Button */}
        <div className="flex items-end">
          <button
            onClick={downloadCSV}
            disabled={attendanceData.length === 0} // Disable if no data
            className={`custom-button h-12 w-full lg:w-auto ${
              attendanceData.length === 0
                ? "bg-gray-300 cursor-not-allowed"
                : ""
            }`}
          >
            Download CSV
          </button>
        </div>

        {/* Generate Report Button */}
        <div className="flex items-end">
          <button
            onClick={() => fetchMonthlyReport(selectedMonth)}
            disabled={!selectedEmployee}
            className={`custom-button h-12 w-full lg:w-auto ${
              !selectedEmployee ? "bg-gray-300 cursor-not-allowed" : ""
            }`}
          >
            Generate Report
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
              {attendanceData.map((record, index) => {
                const date = record.date.slice(0, 10); // Format YYYY-MM-DD
                const times = prayerTimes[date] || {};

                return (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{record.employeeId.name}</TableCell>
                    <TableCell>{record.employeeId.designation}</TableCell>
                    <TableCell>{date}</TableCell>
                    <TableCell
                      className={`${
                        isLate(record.fathisSignInTime, times.fathisTime)
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {record.fathisSignInTime
                        ? new Intl.DateTimeFormat("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "UTC",
                          }).format(new Date(record.fathisSignInTime))
                        : "Not Signed In"}
                    </TableCell>
                    <TableCell
                      className={`${
                        isLate(record.mendhuruSignInTime, times.mendhuruTime)
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {record.mendhuruSignInTime
                        ? new Intl.DateTimeFormat("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "UTC",
                          }).format(new Date(record.mendhuruSignInTime))
                        : "Not Signed In"}
                    </TableCell>
                    <TableCell
                      className={`${
                        isLate(record.asuruSignInTime, times.asuruTime)
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {record.asuruSignInTime
                        ? new Intl.DateTimeFormat("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "UTC",
                          }).format(new Date(record.asuruSignInTime))
                        : "Not Signed In"}
                    </TableCell>
                    <TableCell
                      className={`${
                        isLate(record.maqribSignInTime, times.maqribTime)
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {record.maqribSignInTime
                        ? new Intl.DateTimeFormat("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "UTC",
                          }).format(new Date(record.maqribSignInTime))
                        : "Not Signed In"}
                    </TableCell>
                    <TableCell
                      className={`${
                        isLate(record.ishaSignInTime, times.ishaTime)
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {record.ishaSignInTime
                        ? new Intl.DateTimeFormat("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            timeZone: "UTC",
                          }).format(new Date(record.ishaSignInTime))
                        : "Not Signed In"}
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
