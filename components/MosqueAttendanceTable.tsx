"use client";
import React, { useEffect, useState } from "react";
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
import {
  deductLeave,
  deleteMosqueAttendancesByDate,
  fetchEmployeeById,
  fetchPrayerTimesByDate,
  updateMosqueAttendanceRecord,
} from "@/lib/appwrite/appwrite";
import {
  leaveTypeMapping,
  leaveTypes,
  MosqueAttendanceRecord,
  MosqueAttendanceTableProps,
  PrayerKey,
} from "@/types";
import {
  convertTimeToDateTime,
  formatTimeForInput,
  reverseLeaveTypeMapping,
} from "@/constants";
import { useUser } from "@/Providers/UserProvider";

const MosqueAttendanceTable = ({ date, data }: MosqueAttendanceTableProps) => {
  const [attendanceRecords, setAttendanceRecords] =
    useState<MosqueAttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const { currentUser, isAdmin, loading: userLoading } = useUser();

  useEffect(() => {
    setAttendanceRecords(data);
  }, [data]);

  // Handle sign-in time change
  const handleSignInChange = (
    attendanceId: string,
    prayer: PrayerKey,
    newSignInTime: string
  ) => {
    const dateTime = convertTimeToDateTime(newSignInTime, date);
    const updatedRecords = attendanceRecords.map((record) =>
      record.$id === attendanceId
        ? { ...record, [prayer]: dateTime, changed: true }
        : record
    );
    setAttendanceRecords(updatedRecords);
  };

  // Handle leave type change
  const handleLeaveChange = async (
    attendanceId: string,
    leaveTypeLabel: string,
    employeeId: string
  ) => {
    const leaveTypeValue =
      leaveTypeMapping[leaveTypeLabel as keyof typeof leaveTypeMapping] || null;

    const updatedAttendance = attendanceRecords.map((record) => {
      if (record.$id === attendanceId) {
        const previousLeaveType = record.leaveType;

        // If a leave type is selected, clear all prayer times
        // Otherwise, keep the prayer times intact
        const updatedRecord = {
          ...record,
          fathisSignInTime: leaveTypeValue ? null : record.fathisSignInTime,
          mendhuruSignInTime: leaveTypeValue ? null : record.mendhuruSignInTime,
          asuruSignInTime: leaveTypeValue ? null : record.asuruSignInTime,
          maqribSignInTime: leaveTypeValue ? null : record.maqribSignInTime,
          ishaSignInTime: leaveTypeValue ? null : record.ishaSignInTime,
          leaveType: leaveTypeValue,
          previousLeaveType,
          changed: true,
        };

        return updatedRecord;
      }
      return record;
    });

    setAttendanceRecords(updatedAttendance);
  };

  // Submit updated attendance
  const handleSubmitAttendance = async () => {
    setSubmitting(true);
    toast({
      title: "Submitting",
      description: "Updating mosque attendance...",
      variant: "default",
    });

    const fetchePprayerTimes = await fetchPrayerTimesByDate(date);
    if (!fetchePprayerTimes) {
      toast({
        title: "Error",
        description: "Prayer times not found for the selected date.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    // Map prayer times document into the expected format
    const prayerTimes: Record<PrayerKey, string> = {
      fathisSignInTime: fetchePprayerTimes.fathisTime,
      mendhuruSignInTime: fetchePprayerTimes.mendhuruTime,
      asuruSignInTime: fetchePprayerTimes.asuruTime,
      maqribSignInTime: fetchePprayerTimes.maqribTime,
      ishaSignInTime: fetchePprayerTimes.ishaTime,
    };

    const updatedAttendanceWithLateness = attendanceRecords.map((record) => {
      const updatedRecord = { ...record };

      // Loop through each prayer and calculate lateness
      (Object.keys(prayerTimes) as Array<PrayerKey>).forEach((prayerKey) => {
        const requiredTime = new Date(`${date}T${prayerTimes[prayerKey]}Z`);
        const actualSignIn = record[prayerKey]
          ? new Date(record[prayerKey] as string)
          : null;

        // Calculate lateness in minutes
        const lateness = actualSignIn
          ? Math.max(
              0,
              (actualSignIn.getTime() - requiredTime.getTime()) / (1000 * 60)
            )
          : 0;

        // Update the corresponding lateness field
        const latenessKey = `${prayerKey.replace(
          "SignInTime",
          "MinutesLate"
        )}` as keyof typeof updatedRecord;

        if (latenessKey in updatedRecord) {
          updatedRecord[latenessKey] = lateness as never;
        }
      });

      return updatedRecord;
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
      // Update each changed record (replace this with your update logic)
      await Promise.all(
        changedRecords.map(async (record) => {
          // Fetch the complete employee data to get leave balances
          const employeeData = await fetchEmployeeById(record.employeeId.$id);

          // Access the leave balance using the leaveType field
          const leaveType = record.leaveType || "";
          const availableLeaveCount = employeeData[leaveType] ?? 0;

          if (record.leaveType && availableLeaveCount <= 0) {
            toast({
              title: "Leave Balance Error",
              description: `${employeeData.name} does not have any ${record.leaveType} left.`,
              variant: "destructive",
            });
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

          await updateMosqueAttendanceRecord(record.$id, {
            fathisSignInTime: record.fathisSignInTime || undefined,
            mendhuruSignInTime: record.mendhuruSignInTime || undefined,
            asuruSignInTime: record.asuruSignInTime || undefined,
            maqribSignInTime: record.maqribSignInTime || undefined,
            ishaSignInTime: record.ishaSignInTime || undefined,
            fathisMinutesLate: record.fathisMinutesLate || 0,
            mendhuruMinutesLate: record.mendhuruMinutesLate || 0,
            asuruMinutesLate: record.asuruMinutesLate || 0,
            maqribMinutesLate: record.maqribMinutesLate || 0,
            ishaMinutesLate: record.ishaMinutesLate || 0,
            leaveType: record.leaveType,
          });
        })
      );

      toast({
        title: "Success",
        description: "Mosque attendance updated successfully.",
        variant: "success",
      });

      setAttendanceRecords((prev) =>
        prev.map((record) => ({ ...record, changed: false }))
      );
    } catch (error) {
      console.error(error);
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
      await deleteMosqueAttendancesByDate(date);
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
            <TableHead>#</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Fathis Prayer</TableHead>
            <TableHead>Mendhuru Prayer</TableHead>
            <TableHead>Asuru Prayer</TableHead>
            <TableHead>Maqrib Prayer</TableHead>
            <TableHead>Isha Prayer</TableHead>
            <TableHead>Attendance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendanceRecords.map((record, index) => (
            <TableRow key={record.$id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{record.employeeId.name}</TableCell>
              {[
                "fathisSignInTime",
                "mendhuruSignInTime",
                "asuruSignInTime",
                "maqribSignInTime",
                "ishaSignInTime",
              ].map((prayer) => (
                <TableCell key={prayer}>
                  <input
                    type="time"
                    value={
                      record[prayer as PrayerKey]
                        ? formatTimeForInput(record[prayer as PrayerKey])
                        : ""
                    }
                    onChange={(e) =>
                      handleSignInChange(
                        record.$id,
                        prayer as PrayerKey,
                        e.target.value
                      )
                    }
                    className="border p-2 rounded"
                  />
                </TableCell>
              ))}
              <TableCell>
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

      <div className="flex justify-between mt-6 gap-4">
        <button
          className={`custom-button ${
            submitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onClick={handleSubmitAttendance}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit Attendance"}
        </button>

        {isAdmin ? (
          <AlertDialog>
            <AlertDialogTrigger className="flex items-center justify-center w-full md:w-48">
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
        ) : (
          <></>
        )}
      </div>
    </div>
  );
};

export default MosqueAttendanceTable;
