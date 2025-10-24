"use client";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  convertTimeToDateTime,
  formatTimeForInput,
  reverseLeaveTypeMapping,
} from "@/constants";
import { useToast } from "@/hooks/use-toast";
import {
  deductLeave,
  deleteMosqueAttendancesByDate,
  fetchEmployeeById,
  fetchPrayerTimesByDate, // fallback source
  updateMosqueAttendanceRecord,
} from "@/lib/appwrite/appwrite";
import { useUser } from "@/Providers/UserProvider";
import {
  leaveTypeMapping,
  leaveTypes,
  MosqueAttendanceRecord,
  MosqueAttendanceTableProps,
  PrayerKey,
} from "@/types";
import { useEffect, useMemo, useState } from "react";

// Innamaadhoo salat helper
import { fetchInnamaadhooTimes, InnamaadhooTimes } from "@/lib/salat-client";

/** Parse "HH:MM" -> minutes since midnight */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Lateness in minutes using LOCAL clock math (ignores TZ/UTC). */
function latenessMinutes(
  requiredHHMM: string,
  actualISO?: string | null
): number {
  if (!actualISO) return 0;
  // Your own helper returns "HH:MM" for inputs saved as ISO; perfect for local math
  const actualHHMM = formatTimeForInput(actualISO);
  if (!actualHHMM) return 0;
  const diff = toMinutes(actualHHMM) - toMinutes(requiredHHMM);
  return Math.max(0, Math.round(diff));
}

/** Build a *local* Date from an ISO yyyy-mm-dd and HH:mm string */
function localDateFrom(dateISO: string, hhmm: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [H, M] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, H, M, 0, 0);
}

/** Normalize employee id from either embedded object or string */
function resolveEmployeeId(emp: any): string | null {
  if (!emp) return null;
  if (typeof emp === "string") return emp;
  if (typeof emp.$id === "string") return emp.$id;
  if (typeof emp.id === "string") return emp.id;
  return null;
}

const MosqueAttendanceTable = ({ date, data }: MosqueAttendanceTableProps) => {
  const [attendanceRecords, setAttendanceRecords] =
    useState<MosqueAttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);

  // NEW: local cache of id -> employee name
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const { currentUser, isAdmin } = useUser();

  useEffect(() => {
    setAttendanceRecords(data);
  }, [data]);

  // --- NEW: fetch names for any string employeeId we don't know yet -----------
  const unresolvedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of data) {
      const emp = r.employeeId;
      if (typeof emp === "string") {
        if (!nameMap[emp]) ids.add(emp);
      }
    }
    return Array.from(ids);
  }, [data, nameMap]);

  useEffect(() => {
    if (unresolvedIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.allSettled(
          unresolvedIds.map((id) => fetchEmployeeById(id))
        );
        const additions: Record<string, string> = {};
        results.forEach((res, i) => {
          const id = unresolvedIds[i];
          if (res.status === "fulfilled" && res.value) {
            additions[id] = res.value.name || id;
          } else {
            additions[id] = id; // fallback to showing id if fetch fails
          }
        });
        if (!cancelled) {
          setNameMap((prev) => ({ ...prev, ...additions }));
        }
      } catch {
        // ignore; names for those ids will remain as id strings
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unresolvedIds]);

  // ---------------------------------------------------------------------------

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

  const handleSubmitAttendance = async () => {
    setSubmitting(true);
    toast({
      title: "Submitting",
      description: "Updating mosque attendance...",
      variant: "default",
    });

    // 1) Try salat.db Innamaadhoo times
    let salat: InnamaadhooTimes | null = null;
    try {
      salat = await fetchInnamaadhooTimes(date);
    } catch {
      salat = null; // fall back silently
    }

    // 2) Fallback to existing Appwrite method to keep behaviour unchanged
    let prayerTimes: Record<PrayerKey, string> | null = null;
    if (salat) {
      const t = salat.times;
      prayerTimes = {
        fathisSignInTime: t.fathisTime,
        mendhuruSignInTime: t.mendhuruTime,
        asuruSignInTime: t.asuruTime,
        maqribSignInTime: t.maqribTime,
        ishaSignInTime: t.ishaTime,
      };
    } else {
      const fetched = await fetchPrayerTimesByDate(date);
      if (!fetched) {
        toast({
          title: "Error",
          description: "Prayer times not found for the selected date.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
      prayerTimes = {
        fathisSignInTime: fetched.fathisTime,
        mendhuruSignInTime: fetched.mendhuruTime,
        asuruSignInTime: fetched.asuruTime,
        maqribSignInTime: fetched.maqribTime,
        ishaSignInTime: fetched.ishaTime,
      };
    }

    const MAX_LATE = 64;

    function wholeMinutesDiff(a: Date, b: Date) {
      // positive = a after b
      const diff = (a.getTime() - b.getTime()) / 60000;
      // round to nearest whole minute; then clamp
      return Math.max(0, Math.min(MAX_LATE, Math.round(diff)));
    }

    const updatedAttendanceWithLateness = attendanceRecords.map((record) => {
      const updatedRecord = { ...record };

      (Object.keys(prayerTimes!) as Array<PrayerKey>).forEach((prayerKey) => {
        const requiredHHMM = prayerTimes![prayerKey]; // e.g. "04:40"
        const actualISO = record[prayerKey] as string | undefined;

        // Pure local HH:MM math (no UTC offset mistakes) + clamp to schema range
        const minutesLate = Math.min(
          64,
          latenessMinutes(requiredHHMM, actualISO)
        );

        const latenessKey = `${prayerKey.replace(
          "SignInTime",
          "MinutesLate"
        )}` as keyof typeof updatedRecord;

        if (latenessKey in updatedRecord) {
          updatedRecord[latenessKey] = minutesLate as never;
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
      await Promise.all(
        changedRecords.map(async (record) => {
          const empId = resolveEmployeeId(record.employeeId);

          if (!empId) {
            // Still update the record (timestamps & lateness), skip leave ops
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
            return;
          }

          // fetch full employee doc to check balances
          const employeeData = await fetchEmployeeById(empId);

          const leaveType = record.leaveType || "";
          const availableLeaveCount = employeeData?.[leaveType] ?? 0;

          if (record.leaveType && availableLeaveCount <= 0) {
            toast({
              title: "Leave Balance Error",
              description: `${employeeData?.name || empId} does not have any ${
                record.leaveType
              } left.`,
              variant: "destructive",
            });
          }

          if (
            record.previousLeaveType &&
            record.previousLeaveType !== record.leaveType
          ) {
            await deductLeave(empId, record.previousLeaveType, true);
          }

          if (
            record.leaveType &&
            (!record.leaveDeducted ||
              record.previousLeaveType !== record.leaveType)
          ) {
            await deductLeave(empId, record.leaveType);
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

  /** Derive display name for a row */
  const renderEmployeeName = (emp: any) => {
    if (!emp) return "Unknown";
    if (typeof emp === "string") {
      return nameMap[emp] || emp; // show fetched name or fallback to id
    }
    return emp.name || emp.$id || emp.id || "Unknown";
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
              <TableCell>{renderEmployeeName(record.employeeId)}</TableCell>
              {(
                [
                  "fathisSignInTime",
                  "mendhuruSignInTime",
                  "asuruSignInTime",
                  "maqribSignInTime",
                  "ishaSignInTime",
                ] as PrayerKey[]
              ).map((prayer) => (
                <TableCell key={prayer}>
                  <input
                    type="time"
                    value={
                      record[prayer] ? formatTimeForInput(record[prayer]!) : ""
                    }
                    onChange={(e) =>
                      handleSignInChange(record.$id, prayer, e.target.value)
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
                      resolveEmployeeId(record.employeeId) || ""
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
        ) : null}
      </div>
    </div>
  );
};

export default MosqueAttendanceTable;
