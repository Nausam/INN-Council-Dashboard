/* eslint-disable react-hooks/exhaustive-deps */
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
  fetchPrayerTimesByDate,
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
import { useEffect, useState } from "react";
import { Clock, AlertCircle, Save, Trash2 } from "lucide-react";

/* -------------------- local helpers & types -------------------- */

type EmployeeRef =
  | string
  | {
      $id?: string;
      id?: string;
      name?: string;
      designation?: string;
    };

/** Parse "HH:MM" -> minutes since midnight */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Lateness in minutes using LOCAL clock math (ignores TZ/UTC). */
function latenessMinutes(
  requiredHHMM: string,
  actualISO?: string | null,
  graceMin = 0
): number {
  if (!actualISO) return 0;
  const actualHHMM = formatTimeForInput(actualISO);
  if (!actualHHMM) return 0;
  const actual = toMinutes(actualHHMM);
  const requiredMinusGrace = Math.max(0, toMinutes(requiredHHMM) - graceMin);
  return Math.max(0, Math.round(actual - requiredMinusGrace));
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
  cache: Record<string, { name: string }>
): string {
  if (!emp) return "Unknown";
  if (typeof emp === "string") return cache[emp]?.name ?? "Unknown";
  return emp.name || emp.$id || emp.id || "Unknown";
}

function designationFromRef(
  emp: EmployeeRef | null | undefined,
  cache: Record<string, { name: string; designation?: string }>
): string {
  if (!emp) return "";
  if (typeof emp !== "string") return emp.designation ?? "";
  return cache[emp]?.designation ?? "";
}

/* ======================= Component ======================= */

const MosqueAttendanceTable = ({ date, data }: MosqueAttendanceTableProps) => {
  const [attendanceRecords, setAttendanceRecords] =
    useState<MosqueAttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();
  const { isAdmin } = useUser();

  const [empInfoMap, setEmpInfoMap] = useState<
    Record<string, { name: string; designation?: string }>
  >({});

  useEffect(() => {
    setAttendanceRecords(data);
  }, [data]);

  // fetch names for unknown string ids
  useEffect(() => {
    const ids = new Set<string>();
    for (const r of data) {
      const emp = r.employeeId as unknown as EmployeeRef;
      if (typeof emp === "string" && !empInfoMap[emp]) ids.add(emp);
    }
    const unresolved = Array.from(ids);
    if (unresolved.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        unresolved.map((id) => fetchEmployeeById(id))
      );
      const add: Record<string, { name: string; designation?: string }> = {};
      results.forEach((res, i) => {
        const id = unresolved[i];
        if (res.status === "fulfilled" && res.value) {
          const doc = res.value as { name?: string; designation?: string };
          add[id] = { name: doc?.name ?? id, designation: doc?.designation };
        } else {
          add[id] = { name: id };
        }
      });
      if (!cancelled) setEmpInfoMap((prev) => ({ ...prev, ...add }));
    })();

    return () => {
      cancelled = true;
    };
  }, [data, empInfoMap]);

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
      prev.map((r) => {
        if (r.$id !== attendanceId) return r;

        if (leaveTypeValue) {
          return {
            ...r,
            fathisSignInTime: null,
            mendhuruSignInTime: null,
            asuruSignInTime: null,
            maqribSignInTime: null,
            ishaSignInTime: null,
            leaveType: leaveTypeValue,
            previousLeaveType: r.leaveType,
            changed: true,
          };
        }

        return {
          ...r,
          leaveType: null,
          previousLeaveType: r.leaveType,
          changed: true,
        };
      })
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

      const desig = designationFromRef(
        record.employeeId as unknown as EmployeeRef,
        empInfoMap
      )
        .toLowerCase()
        .trim();
      const grace =
        desig === "imam" ? 5 : desig === "council assistant" ? 15 : 0;

      (Object.keys(prayerTimes!) as PrayerKey[]).forEach((key) => {
        const required = prayerTimes![key];
        const actualISO = record[key] as string | undefined;
        const late = Math.min(64, latenessMinutes(required, actualISO, grace));
        const lateKey = key.replace(
          "SignInTime",
          "MinutesLate"
        ) as keyof MosqueAttendanceRecord;
        // @ts-expect-error dynamic key is a numeric field
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
          const empId = resolveEmployeeId(
            r.employeeId as unknown as EmployeeRef
          );

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
                  r.employeeId as unknown as EmployeeRef,
                  empInfoMap
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
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update attendance.",
        variant: "destructive",
      });
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

  const changedCount = attendanceRecords.filter((r) => r.changed).length;

  const prayerColumns: { key: PrayerKey; label: string }[] = [
    { key: "fathisSignInTime", label: "Fajr" },
    { key: "mendhuruSignInTime", label: "Dhuhr" },
    { key: "asuruSignInTime", label: "Asr" },
    { key: "maqribSignInTime", label: "Maghrib" },
    { key: "ishaSignInTime", label: "Isha" },
  ];

  return (
    <div className="space-y-6">
      {changedCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-amber-900">
              {changedCount} {changedCount === 1 ? "record" : "records"}{" "}
              modified
            </p>
            <p className="text-sm font-medium text-amber-700">
              Don&apos;t forget to submit your changes
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl bg-white/80 shadow-md ring-1 ring-slate-200/50 backdrop-blur-xl">
        <div className="relative overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-12 px-3 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                  #
                </TableHead>

                <TableHead className="w-[180px] px-3 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                  Employee
                </TableHead>

                {prayerColumns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="w-[110px] px-2 py-4 text-xs font-bold uppercase tracking-wider text-slate-600"
                  >
                    {col.label}
                  </TableHead>
                ))}

                <TableHead
                  className="
                    w-[140px] px-2 py-4 text-xs font-bold uppercase tracking-wider text-slate-600
                    sticky right-0 z-20 bg-white/90 backdrop-blur-xl
                  "
                >
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {attendanceRecords.map((record, index) => {
                const isChanged = record.changed;
                const isOnLeave = !!record.leaveType;

                const displayName = nameFromRef(
                  record.employeeId as unknown as EmployeeRef,
                  empInfoMap
                );

                return (
                  <TableRow
                    key={record.$id}
                    className={`transition-colors ${
                      isChanged
                        ? "bg-amber-50/60 hover:bg-amber-50"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    <TableCell className="px-3 py-4 text-sm font-semibold text-slate-600">
                      {index + 1}
                    </TableCell>

                    <TableCell className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 opacity-30 blur-xl" />
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-lg shadow-indigo-500/30">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {displayName}
                            </span>
                            {isChanged && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200/60">
                                Modified
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-500">
                            {designationFromRef(
                              record.employeeId as unknown as EmployeeRef,
                              empInfoMap
                            ) || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {prayerColumns.map((col) => (
                      <TableCell key={col.key} className="px-2 py-4">
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="time"
                            value={
                              record[col.key] && !isOnLeave
                                ? formatTimeForInput(record[col.key]!)
                                : ""
                            }
                            onChange={(e) =>
                              handleSignInChange(
                                record.$id,
                                col.key,
                                e.target.value
                              )
                            }
                            disabled={isOnLeave}
                            className="
                              w-full
                              rounded-2xl
                              border-2 border-slate-200
                              bg-white
                              py-2.5 pl-10 pr-3
                              text-sm font-semibold text-slate-900
                              shadow-sm
                              transition-all duration-200 ease-out
                              hover:border-slate-300
                              focus:border-indigo-400
                              focus:outline-none
                              focus:ring-2 focus:ring-indigo-100
                              disabled:cursor-not-allowed
                              disabled:bg-slate-50
                              disabled:text-slate-400
                            "
                          />
                        </div>
                      </TableCell>
                    ))}

                    <TableCell
                      className="
                        py-4 px-2
                        sticky right-0 z-10
                        bg-white/90 backdrop-blur-xl
                      "
                    >
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
                        className="
                          w-full
                          appearance-none
                          rounded-2xl
                          border-2 border-slate-200
                          bg-white
                          py-2.5 px-3 pr-9
                          text-sm font-bold text-slate-700
                          shadow-sm
                          transition-all duration-200 ease-out
                          hover:border-slate-300
                          focus:border-indigo-400
                          focus:outline-none
                          focus:ring-2 focus:ring-indigo-100
                        "
                      >
                        <option value="">✓ Present</option>
                        {leaveTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <button
          className={`group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 ease-out hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40 md:w-auto ${
            submitting ? "cursor-not-allowed opacity-50 hover:scale-100" : ""
          }`}
          onClick={handleSubmitAttendance}
          disabled={submitting}
        >
          <Save className="h-5 w-5" />
          {submitting ? "Submitting..." : "Submit Attendance"}
        </button>

        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-white/80 px-6 py-3 text-sm font-bold text-red-600 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:scale-105 hover:bg-red-50 hover:shadow-md md:w-auto ${
                  submitting
                    ? "cursor-not-allowed opacity-50 hover:scale-100"
                    : ""
                }`}
                disabled={submitting}
              >
                <Trash2 className="h-5 w-5" />
                Delete Attendance
              </button>
            </AlertDialogTrigger>

            <AlertDialogContent className="rounded-3xl bg-white/90 backdrop-blur-2xl">
              <AlertDialogHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <AlertDialogTitle className="text-2xl font-black text-slate-900">
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium text-slate-600">
                  This action cannot be undone. This will permanently delete
                  today&apos;s mosque attendance and remove your data from the
                  database.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-2xl">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-2xl bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAllAttendances}
                >
                  Delete Attendance
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export default MosqueAttendanceTable;
