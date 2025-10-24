"use client";
import React, { useState, useEffect } from "react";
import { fetchMosqueAttendanceForMonth } from "@/lib/appwrite/appwrite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";

interface PrayerLateReport {
  fathisMinutesLate: number;
  mendhuruMinutesLate: number;
  asuruMinutesLate: number;
  maqribMinutesLate: number;
  ishaMinutesLate: number;
  totalMinutesLate: number;
  totalHoursLate: number;
}

interface EmployeeDetails {
  name: string;
  designation: string;
  joinedDate: string;
  section: string;
}

interface MosqueReport {
  [employeeId: string]: PrayerLateReport & EmployeeDetails;
}

const MosqueMonthlyReportsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [reportAvailable, setReportAvailable] = useState<boolean>(false);
  const [reportData, setReportData] = useState<any[]>([]);

  const generateReport = async (month: string) => {
    setLoading(true);
    try {
      const attendanceRecords = await fetchMosqueAttendanceForMonth(month);

      const monthRecords = attendanceRecords.filter((record) => {
        const recordDate = new Date(record.date);
        const recordMonth = recordDate.toISOString().slice(0, 7);
        return recordMonth === month;
      });

      if (monthRecords.length === 0) {
        setReportAvailable(false);
        setReportData([]);
      } else {
        const report: MosqueReport = {};

        monthRecords.forEach((record) => {
          const employeeId = record.employeeId.name;

          if (!report[employeeId]) {
            report[employeeId] = {
              fathisMinutesLate: 0,
              mendhuruMinutesLate: 0,
              asuruMinutesLate: 0,
              maqribMinutesLate: 0,
              ishaMinutesLate: 0,
              totalMinutesLate: 0,
              totalHoursLate: 0,
              name: record.employeeId.name,
              designation: record.employeeId.designation,
              joinedDate: record.employeeId.joinedDate,
              section: record.employeeId.section,
            };
          }

          // Sum late minutes for each prayer
          const prayers = [
            "fathisMinutesLate",
            "mendhuruMinutesLate",
            "asuruMinutesLate",
            "maqribMinutesLate",
            "ishaMinutesLate",
          ] as const;

          prayers.forEach((prayerKey) => {
            if (record[prayerKey]) {
              report[employeeId][prayerKey] += record[prayerKey];
              report[employeeId].totalMinutesLate += record[prayerKey];
            }
          });

          // Calculate total hours late
          report[employeeId].totalHoursLate = Math.floor(
            report[employeeId].totalMinutesLate / 60
          );
        });

        setReportData(Object.entries(report));
        setReportAvailable(true);
      }
    } catch (error) {
      console.error("Error generating mosque report:", error);
      setReportAvailable(false);
    }
    setLoading(false);
  };

  const downloadCSV = () => {
    if (reportData.length === 0) return;

    // Prepare CSV headers
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

    // Prepare CSV rows
    const rows = reportData.map(([employeeId, stats]) => [
      stats.name,
      stats.designation,
      stats.fathisMinutesLate,
      stats.mendhuruMinutesLate,
      stats.asuruMinutesLate,
      stats.maqribMinutesLate,
      stats.ishaMinutesLate,
      stats.totalMinutesLate,
      stats.totalHoursLate,
    ]);

    // Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Trigger download
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

        {/* Generate Report Button */}
        <div className="flex items-end gap-4">
          <button
            onClick={() => generateReport(selectedMonth)}
            className="custom-button h-12 w-full lg:w-auto"
          >
            Generate Report
          </button>
          <button
            onClick={downloadCSV}
            disabled={!reportAvailable} // Disable button if no report is available
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
              {reportData.map(([employeeId, stats], index) => (
                <TableRow key={index}>
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
