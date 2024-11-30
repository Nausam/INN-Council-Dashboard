"use client";
import React, { useEffect, useState } from "react";
import {
  deductLeave,
  deleteAttendancesByDate,
  fetchEmployeeById,
  updateAttendanceRecord,
} from "@/lib/appwrite/appwrite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface AttendanceRecord {
  $id: string;
  employeeId: { name: string; $id: string; section: string };
  signInTime: string | null;
  leaveType: string | null;
  minutesLate: number | null;
  previousLeaveType: string | null;
  leaveDeducted: boolean;
  changed: boolean;
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

const AttendanceTable = ({ date, data }: AttendanceTableProps) => {
  const [attendanceUpdates, setAttendanceUpdates] =
    useState<AttendanceRecord[]>(data);
  const [initialAttendanceData, setInitialAttendanceData] =
    useState<AttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();

  // Track initial attendance state
  useEffect(() => {
    setInitialAttendanceData(data);
  }, [data]);

  // List of employee names in the required order
  const employeeOrder = [
    "Ahmed Azmeen",
    "Ahmed Ruzaan",
    "Ibrahim Nuhan",
    "Aminath Samaha",
    "Aishath Samaha",
    "Imraan Shareef",
    "Aminath Shazuly",
    "Fazeel Ahmed",
    "Hussain Sazeen",
    "Mohamed Suhail",
    "Aminath Shaliya",
    "Fathimath Jazlee",
    "Aminath Nuha",
    "Hussain Nausam",
    "Fathimath Zeyba",
    "Fathimath Usaira",
    "Mohamed Waheedh",
    "Aishath Shaila",
    "Azlifa Saleem",
    "Aishath Shabaana",
  ];

  // Sort attendanceUpdates based on the required employee order
  const sortedAttendance = attendanceUpdates.sort(
    (a, b) =>
      employeeOrder.indexOf(a.employeeId.name) -
      employeeOrder.indexOf(b.employeeId.name)
  );

  // Handle sign-in time change
  const handleSignInChange = (attendanceId: string, newSignInTime: string) => {
    const dateTime = convertTimeToDateTime(newSignInTime, date);
    const updatedAttendance = attendanceUpdates.map((record) =>
      record.$id === attendanceId
        ? { ...record, signInTime: dateTime, leaveType: "", changed: true }
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
        const previousLeaveType = record.leaveType;

        return {
          ...record,
          signInTime: leaveTypeValue ? null : record.signInTime,
          leaveType: leaveTypeValue,
          previousLeaveType,
          changed: true,
        };
      }
      return record;
    });

    setAttendanceUpdates(updatedAttendance);
  };

  // Submit the updated attendance
  const handleSubmitAttendance = async () => {
    setSubmitting(true);
    toast({
      title: "Submitting",
      description: "Updating attendance...",
      variant: "default",
    });

    const updatedAttendanceWithLateness = attendanceUpdates.map((record) => {
      if (record.signInTime) {
        // Default sign in time
        let requiredSignInTime = "08:00";

        // Check if the employee's section is "Councillor", then set required sign-in time to 08:30
        if (record.employeeId.section === "Councillor") {
          requiredSignInTime = "08:30";
        }

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

    const changedRecords = updatedAttendanceWithLateness.filter(
      (record) => record.changed
    );

    if (changedRecords.length === 0) {
      toast({
        title: "No Changes",
        description: "No changes detected to submit.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    try {
      // Process all updates concurrently using Promise.all()
      await Promise.all(
        changedRecords.map(async (record) => {
          // Fetch the complete employee data to get leave balances
          const employeeData = await fetchEmployeeById(record.employeeId.$id);

          // Access the leave balance using the leaveType field
          const leaveType = record.leaveType || "";
          const availableLeaveCount = employeeData[leaveType] ?? 0;

          if (record.leaveType && availableLeaveCount <= 0) {
            throw new Error(
              `${employeeData.name} does not have any ${record.leaveType} left.`
            );
          }

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

          if (
            record.leaveType &&
            (!record.leaveDeducted ||
              record.previousLeaveType !== record.leaveType)
          ) {
            await deductLeave(record.employeeId.$id, record.leaveType);
          }

          await updateAttendanceRecord(record.$id, {
            signInTime: record.signInTime,
            leaveType: record.leaveType || null,
            minutesLate: record.minutesLate || 0,
            previousLeaveType: record.leaveType || null,
            leaveDeducted: !!record.leaveType,
          });
        })
      );

      toast({
        title: "Success",
        description: "All attendance records updated successfully.",
        variant: "success",
      });

      setAttendanceUpdates((prev) =>
        prev.map((record) => ({ ...record, changed: false }))
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Error updating attendance records.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete attendances for selected date
  const handleDeleteAllAttendances = async () => {
    setSubmitting(true);
    toast({
      title: "Deleting",
      description: "Deleting all attendances for the selected date...",
      variant: "destructive",
    });

    try {
      await deleteAttendancesByDate(date);
      toast({
        title: "Success",
        description: "All attendances deleted successfully.",
        variant: "success",
      });
      window!.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete attendances. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="py-2 px-4">#</TableHead>
            <TableHead className="py-2 px-4">Employee Name</TableHead>
            <TableHead className="py-2 px-4">Sign in Time</TableHead>
            <TableHead className="py-2 px-4">Attendance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAttendance.map((record, index) => (
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

      <div className="flex md:flex-row gap-4 flex-col w-full justify-between mt-10">
        <button
          className={`custom-button md:w-60 w-full h-12 ${
            submitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleSubmitAttendance}
          disabled={submitting}
        >
          Submit Attendance
        </button>

        <AlertDialog>
          <AlertDialogTrigger className="flex items-center justify-center w-full md:w-60">
            <div
              className={`flex justify-center red-button w-full h-12  items-center ${
                submitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <p>Delete Attendance</p>
            </div>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete
                today's attendance and remove your data from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteAllAttendances}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AttendanceTable;
