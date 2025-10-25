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
import { fetchInnamaadhooTimes, InnamaadhooTimes } from "@/lib/salat-client";
import { useUser } from "@/Providers/UserProvider";
import {
  leaveTypeMapping,
  leaveTypes,
  MosqueAttendanceRecord,
  MosqueAttendanceTableProps,
  PrayerKey,
} from "@/types";
import { useEffect, useMemo, useState } from "react";

/* -------------------- local helpers & types -------------------- */

type EmployeeRef =
  | string
  | {
      $id?: string;
      id?: string;
      name?: string;
    };

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
  const actualHHMM = formatTimeForInput(actualISO); // returns "HH:MM" locally
  if (!actualHHMM) return 0;
  const diff = toMinutes(actualHHMM) - toMinutes(requiredHHMM);
  return Math.max(0, Math.round(diff));
}

/** Normalize employee id from either embedded object or string */
function resolveEmployeeId(emp: EmployeeRef | null | undefined): string | null {
  if (!emp) return null;
  if (typeof emp === "string") return emp;
  if (typeof emp.$id === "string") return emp.$id;
  if (typeof emp.id === "string") return emp.id;
  return null;
}

/** Get display name from EmployeeRef */
function nameFromRef(
  emp: EmployeeRef | null | undefined,
  cache: Record<string, string>
): string {
  if (!emp) return "Unknown";
  if (typeof emp === "string") return cache[emp] ?? emp;
  return emp.name || emp.$id || emp.id || "Unknown";
}

/* ======================= Component ======================= */

const MosqueAttendanceTable = ({ date, data }: MosqueAttendanceTableProps) => {
  const [attendanceRecords, setAttendanceRecords] =
    useState<MosqueAttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);

  // id -> employee name (for rows where employeeId is a string id)
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const { isAdmin } = useUser();

  useEffect(() => {
    setAttendanceRecords(data);
  }, [data]);

  // fetch names for unknown string ids
  const unresolvedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of data) {
      const emp = r.employeeId;
      if (typeof emp === "string" && !nameMap[emp]) ids.add(emp);
    }
    return Array.from(ids);
  }, [data, nameMap]);

  useEffect(() => {
    if (unresolvedIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        unresolvedIds.map((id) => fetchEmployeeById(id))
      );
      const additions: Record<string, string> = {};
      results.forEach((res, i) => {
        const id = unresolvedIds[i];
        if (res.status === "fulfilled" && res.value) {
          const doc = res.value as { name?: string };
          additions[id] = doc?.name ?? id;
        } else {
          additions[id] = id;
        }
      });
      if (!cancelled) setNameMap((prev) => ({ ...prev, ...additions }));
    })();

    return () => {
      cancelled = true;
    };
  }, [unresolvedIds]);

  const handleSignInChange = (
    attendanceId: string,
    prayer: PrayerKey,
    newSignInTime: string
  ) => {
    const dateTime = convertTimeToDateTime(newSignInTime, date);
    setAttendanceRecords((prev) =>
      prev.map((r) =>
        r.$id === attendanceId ? { ...r, [prayer]: dateTime, changed: true } : r
      )
    );
  };

  const handleLeaveChange = (attendanceId: string, leaveTypeLabel: string) => {
    const leaveTypeValue =
      leaveTypeMapping[leaveTypeLabel as keyof typeof leaveTypeMapping] ?? null;
    setAttendanceRecords((prev) =>
      prev.map((r) =>
        r.$id === attendanceId
          ? {
              ...r,
              fathisSignInTime: leaveTypeValue ? null : r.fathisSignInTime,
              mendhuruSignInTime: leaveTypeValue ? null : r.mendhuruSignInTime,
              asuruSignInTime: leaveTypeValue ? null : r.asuruSignInTime,
              maqribSignInTime: leaveTypeValue ? null : r.maqribSignInTime,
              ishaSignInTime: leaveTypeValue ? null : r.ishaSignInTime,
              leaveType: leaveTypeValue,
              previousLeaveType: r.leaveType,
              changed: true,
            }
          : r
      )
    );
  };

  const handleSubmitAttendance = async () => {
    setSubmitting(true);
    toast({
      title: "Submitting",
      description: "Updating mosque attendance...",
      variant: "default",
    });

    // 1) Try salat.db (Innamaadhoo)
    let salat: InnamaadhooTimes | null = null;
    try {
      salat = await fetchInnamaadhooTimes(date);
    } catch {
      salat = null;
    }

    // 2) Fallback to Appwrite prayerTimes collection
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

    // apply lateness per prayer (clamped to schema range 0..64)
    const updatedAttendance = attendanceRecords.map((record) => {
      const copy: MosqueAttendanceRecord = { ...record };
      (Object.keys(prayerTimes!) as PrayerKey[]).forEach((key) => {
        const required = prayerTimes![key];
        const actualISO = record[key] as string | undefined;
        const late = Math.min(64, latenessMinutes(required, actualISO));
        const lateKey = key.replace(
          "SignInTime",
          "MinutesLate"
        ) as unknown as keyof MosqueAttendanceRecord;
        // @ts-expect-error – the dynamic key maps to the numeric late field in our record type
        copy[lateKey] = late;
      });
      return copy;
    });

    const changed = updatedAttendance.filter((r) => r.changed);
    if (changed.length === 0) {
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
        changed.map(async (r) => {
          const empId = resolveEmployeeId(r.employeeId);

          if (empId) {
            const employee = (await fetchEmployeeById(empId)) as Record<
              string,
              unknown
            >;
            const leaveType = r.leaveType ?? "";
            const available =
              typeof employee[leaveType] === "number"
                ? (employee[leaveType] as number)
                : 0;

            if (r.leaveType && available <= 0) {
              toast({
                title: "Leave Balance Error",
                description: `${nameFromRef(
                  r.employeeId,
                  nameMap
                )} does not have any ${r.leaveType} left.`,
                variant: "destructive",
              });
            }

            if (r.previousLeaveType && r.previousLeaveType !== r.leaveType) {
              await deductLeave(empId, r.previousLeaveType, true);
            }
            if (
              r.leaveType &&
              (!r.leaveDeducted || r.previousLeaveType !== r.leaveType)
            ) {
              await deductLeave(empId, r.leaveType);
            }
          }

          await updateMosqueAttendanceRecord(r.$id, {
            fathisSignInTime: r.fathisSignInTime || undefined,
            mendhuruSignInTime: r.mendhuruSignInTime || undefined,
            asuruSignInTime: r.asuruSignInTime || undefined,
            maqribSignInTime: r.maqribSignInTime || undefined,
            ishaSignInTime: r.ishaSignInTime || undefined,
            fathisMinutesLate: r.fathisMinutesLate || 0,
            mendhuruMinutesLate: r.mendhuruMinutesLate || 0,
            asuruMinutesLate: r.asuruMinutesLate || 0,
            maqribMinutesLate: r.maqribMinutesLate || 0,
            ishaMinutesLate: r.ishaMinutesLate || 0,
            leaveType: r.leaveType,
          });
        })
      );

      toast({
        title: "Success",
        description: "Mosque attendance updated successfully.",
        variant: "success",
      });

      setAttendanceRecords((prev) =>
        prev.map((r) => ({ ...r, changed: false }))
      );
    } catch (error) {
      // eslint-disable-next-line no-console
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
      window.location.reload();
    } catch {
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
              <TableCell>
                {nameFromRef(record.employeeId as EmployeeRef, nameMap)}
              </TableCell>

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
                    handleLeaveChange(record.$id, e.target.value)
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
                className={`flex justify-center red-button w-full h-12 items-center ${
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
                  today&apos;s attendance and remove your data from the
                  database.
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
