"use client";

import { AttendanceChangesBanner } from "@/components/attendance/attendance-changes-banner";
import { AttendanceLeaveSelect } from "@/components/attendance/attendance-leave-select";
import { PrayerAttendancePicker } from "@/components/attendance/prayer-attendance-picker";
import { AvatarGlow, CouncilCard } from "@/components/design-system";
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
import { Button } from "@/components/ui/button";
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
import { useAllEmployeesActionQuery, useQueryInvalidation } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import {
  deductLeave,
  deleteMosqueAttendancesByDate,
  fetchEmployeeById,
  fetchPrayerTimesByDate,
  updateMosqueAttendanceRecord,
} from "@/lib/firebase/hr";
import { fetchInnamaadhooTimes, InnamaadhooTimes } from "@/lib/salat-client";
import { cn } from "@/lib/utils";
import { useUser } from "@/Providers/UserProvider";
import {
  leaveTypeMapping,
  MosqueAttendanceRecord,
  MosqueAttendanceTableProps,
  PrayerKey,
} from "@/types";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Save, Trash2 } from "lucide-react";

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
  const { invalidateMosqueAttendance, invalidateEmployees } =
    useQueryInvalidation();
  const monthKey = date.slice(0, 7);

  const [empInfoMap, setEmpInfoMap] = useState<
    Record<string, { name: string; designation?: string }>
  >({});

  useEffect(() => {
    setAttendanceRecords(data);
  }, [data]);

  // Fallback: one batch fetch if rows still have bare employee ids.
  const unresolvedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of data) {
      const emp = r.employeeId as unknown as EmployeeRef;
      if (typeof emp === "string" && emp && !empInfoMap[emp]) ids.add(emp);
    }
    return Array.from(ids);
  }, [data, empInfoMap]);

  const { data: allEmployees } = useAllEmployeesActionQuery();

  useEffect(() => {
    if (!allEmployees?.length || unresolvedIds.length === 0) return;

    const add: Record<string, { name: string; designation?: string }> = {};
    for (const doc of allEmployees) {
      if (unresolvedIds.includes(doc.$id)) {
        add[doc.$id] = { name: doc.name, designation: doc.designation };
      }
    }

    if (Object.keys(add).length > 0) {
      setEmpInfoMap((prev) => ({ ...prev, ...add }));
    }
  }, [allEmployees, unresolvedIds]);

  const handlePrayerChange = (
    attendanceId: string,
    prayer: PrayerKey,
    hhmm: string | null,
  ) => {
    const lateKey = prayer.replace(
      "SignInTime",
      "MinutesLate",
    ) as keyof MosqueAttendanceRecord;

    setAttendanceRecords((prev) =>
      prev.map((r) => {
        if (r.$id !== attendanceId) return r;

        if (hhmm === null) {
          return {
            ...r,
            [prayer]: null,
            [lateKey]: 0,
            changed: true,
          } as MosqueAttendanceRecord;
        }

        return {
          ...r,
          [prayer]: convertTimeToDateTime(hhmm, date),
          changed: true,
        };
      }),
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
            fathisSignInTime: r.fathisSignInTime,
            mendhuruSignInTime: r.mendhuruSignInTime,
            asuruSignInTime: r.asuruSignInTime,
            maqribSignInTime: r.maqribSignInTime,
            ishaSignInTime: r.ishaSignInTime,
            fathisMinutesLate: r.fathisMinutesLate ?? 0,
            mendhuruMinutesLate: r.mendhuruMinutesLate ?? 0,
            asuruMinutesLate: r.asuruMinutesLate ?? 0,
            maqribMinutesLate: r.maqribMinutesLate ?? 0,
            ishaMinutesLate: r.ishaMinutesLate ?? 0,
            leaveType: r.leaveType,
          });
        })
      );

      const affectedEmployeeIds = new Set(
        changed
          .map((r) => resolveEmployeeId(r.employeeId as unknown as EmployeeRef))
          .filter((id): id is string => Boolean(id)),
      );

      await invalidateMosqueAttendance(date, monthKey);
      await Promise.all(
        Array.from(affectedEmployeeIds).map((id) => invalidateEmployees(id)),
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
      <AttendanceChangesBanner count={changedCount} />

      <CouncilCard interactive="none" className="overflow-hidden p-0">
        <div className="relative overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-12 px-3 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  #
                </TableHead>
                <TableHead className="w-[180px] px-3 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Employee
                </TableHead>

                {prayerColumns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="w-[132px] min-w-[132px] px-2 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    {col.label}
                  </TableHead>
                ))}

                <TableHead className="sticky right-0 z-20 w-[150px] bg-slate-50/95 px-2 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
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
                  empInfoMap,
                );

                return (
                  <TableRow
                    key={record.$id}
                    className={cn(
                      "transition-colors duration-150",
                      isChanged
                        ? "bg-amber-50/60 hover:bg-amber-50"
                        : "hover:bg-slate-50/70",
                    )}
                  >
                    <TableCell className="px-3 py-4 text-sm font-semibold text-slate-600">
                      {index + 1}
                    </TableCell>

                    <TableCell className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarGlow name={displayName} size="sm" />

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
                              empInfoMap,
                            ) || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {prayerColumns.map((col) => (
                      <TableCell key={col.key} className="w-[132px] min-w-[132px] px-2 py-4">
                        <PrayerAttendancePicker
                          value={
                            record[col.key] && !isOnLeave
                              ? formatTimeForInput(record[col.key]!)
                              : null
                          }
                          onChange={(hhmm) =>
                            handlePrayerChange(record.$id, col.key, hhmm)
                          }
                          disabled={isOnLeave}
                        />
                      </TableCell>
                    ))}

                    <TableCell className="sticky right-0 z-10 bg-white/95 px-2 py-4 backdrop-blur-sm">
                      <AttendanceLeaveSelect
                        value={
                          record.leaveType
                            ? reverseLeaveTypeMapping[
                                record.leaveType as keyof typeof reverseLeaveTypeMapping
                              ]
                            : ""
                        }
                        onValueChange={(label) =>
                          handleLeaveChange(record.$id, label)
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CouncilCard>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="council"
          className="h-11 rounded-xl px-6"
          onClick={handleSubmitAttendance}
          disabled={submitting}
        >
          <Save className="h-4 w-4" />
          {submitting ? "Submitting..." : "Submit attendance"}
        </Button>

        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-red-200 px-6 text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={submitting}
              >
                <Trash2 className="h-4 w-4" />
                Delete sheet
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="rounded-3xl border-0 bg-white shadow-xl ring-1 ring-slate-200/60">
              <AlertDialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 ring-1 ring-red-200/60">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <AlertDialogTitle className="text-xl font-black tracking-tight text-slate-900">
                  Delete mosque attendance?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium text-slate-600">
                  This permanently removes all mosque attendance records for
                  this date. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="h-10 rounded-xl">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="h-10 rounded-xl bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAllAttendances}
                >
                  Delete sheet
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
