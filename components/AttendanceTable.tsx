"use client";
import React, { useState } from "react";
import { deductLeave, updateAttendanceRecord } from "@/lib/appwrite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AttendanceRecord {
  $id: string;
  employeeId: { name: string; $id: string };
  signInTime: string | null;
  leaveType: string | null;
  minutesLate: number | null;
  previousLeaveType: string | null;
  leaveDeducted: boolean;
}

interface AttendanceTableProps {
  date: string;
  data: AttendanceRecord[];
}

// Map for human-readable leave types to backend values
const leaveTypes = [
  "Sick Leave",
  "Certificate Leave",
  "Annual Leave",
  "Family Related Leave",
  "Maternity Leave",
  "Paternity Leave",
  "No Pay Leave",
  "Official Leave",
];
const leaveTypeMapping = {
  "Sick Leave": "sickLeave",
  "Certificate Leave": "certificateSickLeave",
  "Annual Leave": "annualLeave",
  "Family Related Leave": "familyRelatedLeave",
  "Maternity Leave": "maternityLeave",
  "Paternity Leave": "paternityLeave",
  "No Pay Leave": "noPayLeave",
  "Official Leave": "officialLeave",
};

// Reverse mapping to display the correct label for the backend value
const reverseLeaveTypeMapping = Object.fromEntries(
  Object.entries(leaveTypeMapping).map(([label, value]) => [value, label])
);

// Format the time to display in the input field
const formatTimeForInput = (dateTime: string | null) => {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

// Convert the input time back to ISO for saving
const convertTimeToDateTime = (time: string, date: string) => {
  const [hours, minutes] = time.split(":");
  const dateTime = new Date(date);
  dateTime.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  return dateTime.toISOString();
};

const AttendanceTable: React.FC<AttendanceTableProps> = ({ date, data }) => {
  const [attendanceUpdates, setAttendanceUpdates] =
    useState<AttendanceRecord[]>(data);

  // Handle sign-in time change
  const handleSignInChange = (attendanceId: string, newSignInTime: string) => {
    const dateTime = convertTimeToDateTime(newSignInTime, date);
    const updatedAttendance = attendanceUpdates.map((record) =>
      record.$id === attendanceId
        ? { ...record, signInTime: dateTime, leaveType: "" }
        : record
    );
    setAttendanceUpdates(updatedAttendance);
  };

  // Handle leave type change
  const handleLeaveChange = async (
    attendanceId: string,
    leaveTypeLabel: string,
    employeeId: string
  ) => {
    const leaveTypeValue =
      leaveTypeMapping[leaveTypeLabel as keyof typeof leaveTypeMapping] || null;

    const updatedAttendance = attendanceUpdates.map((record) => {
      if (record.$id === attendanceId) {
        const previousLeaveType = record.leaveType; // Save the previous leave type

        return {
          ...record,
          signInTime: leaveTypeValue ? null : record.signInTime, // Remove sign-in if on leave
          leaveType: leaveTypeValue, // Set the new leave type
          previousLeaveType, // Store previous leave type for restoration if needed
        };
      }
      return record;
    });

    setAttendanceUpdates(updatedAttendance);
  };

  // Submit the updated attendance
  const handleSubmitAttendance = async () => {
    const updatedAttendanceWithLateness = attendanceUpdates.map((record) => {
      if (record.signInTime) {
        const requiredSignInTime = "08:00"; // Assuming default 08:00
        const requiredTime = new Date(date + "T" + requiredSignInTime + "Z");
        const actualSignIn = new Date(record.signInTime);

        // Calculate lateness
        const lateness = Math.max(
          0,
          (actualSignIn.getTime() - requiredTime.getTime()) / (1000 * 60)
        );

        return { ...record, minutesLate: lateness };
      }
      return record;
    });

    for (const record of updatedAttendanceWithLateness) {
      try {
        // Restore previous leave type if it differs from the new leaveType
        if (
          record.previousLeaveType &&
          record.previousLeaveType !== record.leaveType
        ) {
          await deductLeave(
            record.employeeId.$id,
            record.previousLeaveType,
            true
          );
        }

        // Deduct the new leave type
        if (
          record.leaveType &&
          (!record.leaveDeducted ||
            record.previousLeaveType !== record.leaveType)
        ) {
          await deductLeave(record.employeeId.$id, record.leaveType);
        }

        // Update attendance record with new leave and lateness
        await updateAttendanceRecord(record.$id, {
          signInTime: record.signInTime,
          leaveType: record.leaveType || null,
          minutesLate: record.minutesLate || 0,
          previousLeaveType: record.leaveType || null,
          leaveDeducted: !!record.leaveType,
        });
      } catch (error) {
        console.error(
          `Error updating attendance for employee ${record.employeeId.$id}:`,
          error
        );
      }
    }

    alert("Attendance updated successfully");
    console.log("UPDATED ATTENDANCE:", updatedAttendanceWithLateness);
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="py-2 px-4">#</TableHead>
            <TableHead className="py-2 px-4">Employee Name</TableHead>
            <TableHead className="py-2 px-4">Attendance</TableHead>
            <TableHead className="py-2 px-4">On Leave?</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendanceUpdates.map((record, index) => (
            <TableRow key={record.$id || index}>
              <TableCell className="py-2 px-4">{index + 1}</TableCell>
              <TableCell className="py-2 px-4">
                {record.employeeId && typeof record.employeeId === "object"
                  ? record.employeeId.name
                  : "Name not available"}
              </TableCell>
              <TableCell className="py-2 px-4">
                {!record.leaveType ? (
                  <input
                    type="time"
                    className="border p-2"
                    value={formatTimeForInput(record.signInTime)}
                    onChange={(e) =>
                      handleSignInChange(record.$id, e.target.value)
                    }
                  />
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="py-2 px-4">
                <select
                  value={
                    record.leaveType
                      ? reverseLeaveTypeMapping[
                          record.leaveType as keyof typeof reverseLeaveTypeMapping
                        ]
                      : ""
                  }
                  onChange={(e) =>
                    handleLeaveChange(
                      record.$id,
                      e.target.value,
                      record.employeeId.$id
                    )
                  }
                  className="border p-2"
                >
                  <option value="">Present</option>
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <button
        className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleSubmitAttendance}
      >
        Submit Attendance
      </button>
    </div>
  );
};

export default AttendanceTable;
