"use client";
import React, { useState, useEffect } from "react";
import { fetchAttendanceForMonth } from "@/lib/appwrite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import html2pdf from "html2pdf.js";
import SkeletonReportsTable from "@/components/skeletons/SkeletonReportsTable";

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
  joinedDate: string;
}

interface Report {
  [employeeId: string]: LeaveReport & EmployeeDetails;
}

const ReportsPage = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [totalDays, setTotalDays] = useState<number>(0);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [reportAvailable, setReportAvailable] = useState<boolean>(false);

  console.log(reportData);

  const generateReport = async (month: string) => {
    setLoading(true);
    try {
      const attendanceRecords = await fetchAttendanceForMonth(month);

      const monthRecords = attendanceRecords.filter((record) => {
        const recordDate = new Date(record.date);
        const recordMonth = recordDate.toISOString().slice(0, 7);
        return recordMonth === month;
      });

      if (monthRecords.length === 0) {
        setReportAvailable(false);
        setReportData([]);
      } else {
        const report: Report = {};

        monthRecords.forEach((record) => {
          const employeeId = record.employeeId.name;

          if (!report[employeeId]) {
            report[employeeId] = {
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
              name: record.employeeId.name,
              address: record.employeeId.address,
              designation: record.employeeId.designation,
              recordCardNumber: record.employeeId.recordCardNumber,
              joinedDate: record.employeeId.joinedDate,
            };
          }

          if (record.leaveType) {
            report[employeeId][record.leaveType as keyof LeaveReport] += 1;
            report[employeeId].totalAbsent += 1;
          }

          if (record.minutesLate) {
            report[employeeId].minutesLate += record.minutesLate;
          }
        });

        setReportData(Object.entries(report));
        setReportAvailable(true);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setReportAvailable(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    generateReport(selectedMonth);
  }, [selectedMonth]);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Monthly Attendance Report</h1>

      <div className="mb-6 flex items-center space-x-4">
        <div>
          <p>Select Month</p>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2"
          />
        </div>

        <div>
          <p>Enter Total Working Days</p>
          <input
            type="number"
            value={totalDays}
            onChange={(e) => setTotalDays(Number(e.target.value))}
            className="border p-2"
            placeholder="Total Days"
          />
        </div>

        {/* <button
          onClick={downloadPDF}
          className="bg-blue-500 text-white p-2 rounded"
        >
          Download PDF
        </button> */}
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
              {reportData.map(([employeeId, stats], index) => (
                <TableRow key={index} className="border-r border-gray-300">
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
                    {new Date(stats.joinedDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
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
                    {totalDays! - stats.totalAbsent}
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

export default ReportsPage;
