/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AttendanceChangesBanner } from "@/components/attendance/attendance-changes-banner";
import { AttendanceLeaveSelect } from "@/components/attendance/attendance-leave-select";
import { AttendanceTimeInput } from "@/components/attendance/attendance-time-input";
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
import { useEmployeesQuery, useQueryInvalidation } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import {
  deductLeave,
  deleteAttendancesByDate,
  EmployeeDoc,
  fetchEmployeeById,
  updateAttendanceRecord,
} from "@/lib/firebase/hr";
import { cn } from "@/lib/utils";
import { useUser } from "@/Providers/UserProvider";
import {
  AlertCircle,
  Briefcase,
  Recycle,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
/* ---------------- Helpers ---------------- */
const ADDITIVE_LEAVES = [
  "maternityLeave",
  "preMaternityLeave",
  "paternityLeave",
  "noPayLeave",
  "officialLeave",
] as const;
type AdditiveLeave = (typeof ADDITIVE_LEAVES)[number];

const BALANCE_LEAVES = [
  "sickLeave",
  "certificateSickLeave",
  "annualLeave",
  "familyRelatedLeave",
] as const;
type BalanceLeave = (typeof BALANCE_LEAVES)[number];

const isAdditiveLeave = (k: string): k is AdditiveLeave =>
  (ADDITIVE_LEAVES as readonly string[]).includes(k);

const isBalanceLeave = (k: string): k is BalanceLeave =>
  (BALANCE_LEAVES as readonly string[]).includes(k);

function getNumericLeave(emp: EmployeeDoc, key: string): number {
  if (isAdditiveLeave(key) || isBalanceLeave(key)) {
    const v = emp[key as keyof EmployeeDoc];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  return 0;
}

/* ---------------- Types ---------------- */
type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      section?: string;
    };

interface AttendanceRecord {
  $id: string;
  employeeId: EmployeeRef;
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

/* ---------------- Leave mappings ---------------- */
const leaveTypes = [
  "Sick Leave",
  "Certificate Leave",
  "Annual Leave",
  "Family Related Leave",
  "Maternity Leave",
  "Pre Maternity Leave",
  "Paternity Leave",
  "No Pay Leave",
  "Official Leave",
] as const;

type LeaveLabel = (typeof leaveTypes)[number];

const leaveTypeMapping: Record<LeaveLabel, string> = {
  "Sick Leave": "sickLeave",
  "Certificate Leave": "certificateSickLeave",
  "Annual Leave": "annualLeave",
  "Family Related Leave": "familyRelatedLeave",
  "Maternity Leave": "maternityLeave",
  "Pre Maternity Leave": "preMaternityLeave",
  "Paternity Leave": "paternityLeave",
  "No Pay Leave": "noPayLeave",
  "Official Leave": "officialLeave",
};

const reverseLeaveTypeMapping: Record<string, LeaveLabel> = Object.fromEntries(
  (Object.entries(leaveTypeMapping) as Array<[LeaveLabel, string]>).map(
    ([label, value]) => [value, label]
  )
) as Record<string, LeaveLabel>;

/* --- Maldives timezone helpers (UTC+05:00, no DST) --- */
const MV_OFFSET_MIN = 5 * 60;

/* ---------------- Time helpers ---------------- */
const formatTimeForInput = (dateTime: string | null) => {
  if (!dateTime) return "";
  const d = new Date(dateTime);
  const localMs = d.getTime() + MV_OFFSET_MIN * 60 * 1000;
  const localDate = new Date(localMs);
  const hh = String(localDate.getUTCHours()).padStart(2, "0");
  const mm = String(localDate.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const convertTimeToDateTime = (time: string, date: string) => {
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  const utc = new Date(`${date}T00:00:00.000Z`);
  const mvMinutes = hh * 60 + mm;
  const utcMinutes = mvMinutes - MV_OFFSET_MIN;
  utc.setUTCMinutes(utcMinutes);
  return utc.toISOString();
};

const mvLocalToUtcDate = (date: string, hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map((v) => parseInt(v, 10));
  const utc = new Date(`${date}T00:00:00.000Z`);
  const mvMinutes = hh * 60 + mm;
  const utcMinutes = mvMinutes - MV_OFFSET_MIN;
  utc.setUTCMinutes(utcMinutes);
  return utc;
};

const AttendanceTable = ({ date, data }: AttendanceTableProps) => {
  const [attendanceUpdates, setAttendanceUpdates] =
    useState<AttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);
  const { isAdmin } = useUser();
  const { toast } = useToast();
  const { invalidateCouncilAttendance, invalidateEmployees } =
    useQueryInvalidation();
  const monthKey = date.slice(0, 7);

  const [employeeCache, setEmployeeCache] = useState<
    Record<string, { name: string; section?: string }>
  >({});

  const idFromRef = (ref: EmployeeRef) =>
    typeof ref === "object" ? ref.$id : ref;

  const normalize = (s?: string) => (s ?? "").toLowerCase().trim();
  const clean = (s?: string) => normalize(s).replace(/[^a-z]/g, "");

  const sectionFromRecord = (r: AttendanceRecord) => {
    if (typeof r.employeeId === "object") return r.employeeId.section ?? "";
    const id = r.employeeId;
    const cache = id ? employeeCache[id] : undefined;
    const raw =
      cache?.section ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any)?.Section ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any)?.department ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any)?.Department ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any)?.role ||
      "";
    return raw || "";
  };

  const nameFromRecord = (r: AttendanceRecord) => {
    if (typeof r.employeeId === "object") return r.employeeId.name ?? "Unknown";
    const id = r.employeeId;
    return (id && employeeCache[id]?.name) || "Unknown";
  };

  useEffect(() => {
    setAttendanceUpdates(data);
  }, [data]);

  const unresolvedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of attendanceUpdates) {
      if (typeof r.employeeId === "string") {
        const id = r.employeeId;
        if (id && !employeeCache[id]) ids.add(id);
      }
    }
    return Array.from(ids);
  }, [attendanceUpdates, employeeCache]);

  const { data: allEmployees } = useEmployeesQuery();

  useEffect(() => {
    if (!allEmployees?.length || unresolvedIds.length === 0) return;

    const lookup: Record<string, { name: string; section?: string }> = {};
    for (const emp of allEmployees) {
      if (unresolvedIds.includes(emp.$id)) {
        lookup[emp.$id] = { name: emp.name, section: emp.section };
      }
    }

    if (Object.keys(lookup).length > 0) {
      setEmployeeCache((prev) => ({ ...prev, ...lookup }));
    }
  }, [allEmployees, unresolvedIds]);

  /* ---------------- Custom order + section-first sort ---------------- */
  const employeeOrder = [
    "Ahmed Azmeen",
    "Ahmed Ruzaan",
    "Ibrahim Nuhan",
    "Aminath Samaha",
    "Aishath Samaha",
    "Imran Shareef",
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
    "Aishath Naahidha",
    "Aishath Simaana",
    "Fazeela Naseer",
    "Buruhan",
    "Ubaidh",
  ];

  const orderIndex = useMemo(() => {
    const map = new Map<string, number>();
    employeeOrder.forEach((n, i) => map.set(normalize(n), i));
    return map;
  }, []);

  type CanonicalSection = "Councillor" | "Admin" | "Waste Management" | "Other";
  const getCanonicalSection = (raw?: string): CanonicalSection => {
    const n = clean(raw);
    if (["councillor", "councilor", "council", "counciler"].includes(n))
      return "Councillor";
    if (
      [
        "admin",
        "administrator",
        "administration",
        "office",
        "officeadmin",
      ].includes(n)
    )
      return "Admin";
    if (
      [
        "wastemanagement",
        "waste",
        "wastemgmt",
        "wm",
        "wastecollection",
        "waste-collection",
      ].includes(n)
    )
      return "Waste Management";
    return "Other";
  };

  const grouped = useMemo(() => {
    const g: Record<CanonicalSection, AttendanceRecord[]> = {
      Councillor: [],
      Admin: [],
      "Waste Management": [],
      Other: [],
    };
    for (const r of attendanceUpdates) {
      const sec = getCanonicalSection(sectionFromRecord(r));
      g[sec].push(r);
    }
    return g;
  }, [attendanceUpdates, employeeCache]);

  const sortWithin = (arr: AttendanceRecord[]) => {
    return [...arr].sort((a, b) => {
      const an = nameFromRecord(a);
      const bn = nameFromRecord(b);
      const ai = orderIndex.get(normalize(an)) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(normalize(bn)) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return an.localeCompare(bn);
    });
  };

  /* ---------------- Handlers ---------------- */
  const handleSignInChange = (attendanceId: string, newSignInTime: string) => {
    const dateTime = convertTimeToDateTime(newSignInTime, date);
    setAttendanceUpdates((prev) =>
      prev.map((r) =>
        r.$id === attendanceId
          ? { ...r, signInTime: dateTime, leaveType: "", changed: true }
          : r
      )
    );
  };

  const handleLeaveChange = (attendanceId: string, leaveTypeLabel: string) => {
    const leaveTypeValue =
      leaveTypeMapping[leaveTypeLabel as LeaveLabel] ?? null;
    setAttendanceUpdates((prev) =>
      prev.map((r) => {
        if (r.$id !== attendanceId) return r;
        const previousLeaveType = r.leaveType;
        return {
          ...r,
          signInTime: leaveTypeValue ? null : r.signInTime,
          leaveType: leaveTypeValue,
          previousLeaveType,
          changed: true,
        };
      })
    );
  };

  const handleSubmitAttendance = async () => {
    setSubmitting(true);
    toast({ title: "Submitting", description: "Updating attendance..." });

    const withLateness = attendanceUpdates.map((r) => {
      if (!r.signInTime) return r;
      const sec = getCanonicalSection(sectionFromRecord(r));
      const required = sec === "Councillor" ? "08:30" : "08:00";
      const requiredTime = mvLocalToUtcDate(date, required);
      const actual = new Date(r.signInTime);

      const minutesLate = Math.max(
        0,
        Math.round((actual.getTime() - requiredTime.getTime()) / 60000)
      );
      return { ...r, minutesLate };
    });

    const changed = withLateness.filter((r) => r.changed);
    if (changed.length === 0) {
      toast({
        title: "No Changes",
        description: "No changes detected.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    try {
      await Promise.all(
        changed.map(async (r) => {
          const empId = idFromRef(r.employeeId);
          const employee = await fetchEmployeeById(empId);

          const leaveType = r.leaveType ?? "";
          if (leaveType) {
            if (isBalanceLeave(leaveType)) {
              const available = getNumericLeave(employee, leaveType);
              if (available <= 0) {
                throw new Error(
                  `${nameFromRecord(r)} does not have any ${leaveType} left.`
                );
              }
            }
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

          await updateAttendanceRecord(r.$id, {
            signInTime: r.signInTime,
            leaveType: r.leaveType ?? null,
            minutesLate: r.minutesLate ?? 0,
            previousLeaveType: r.leaveType ?? null,
            leaveDeducted: Boolean(r.leaveType),
          });
        })
      );

      const affectedEmployeeIds = new Set(
        changed.map((r) => idFromRef(r.employeeId)),
      );

      await invalidateCouncilAttendance(date, monthKey);
      await Promise.all(
        Array.from(affectedEmployeeIds).map((id) => invalidateEmployees(id)),
      );

      toast({
        title: "Success",
        description: "All attendance records updated.",
      });
      setAttendanceUpdates((prev) =>
        prev.map((r) => ({ ...r, changed: false }))
      );
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Error updating attendance.",
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
      await deleteAttendancesByDate(date);
      toast({ title: "Success", description: "All attendances deleted." });
      window.location.reload();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const changedCount = attendanceUpdates.filter((r) => r.changed).length;

  /* ---------------- UI helpers ---------------- */
  let rowCounter = 0;

  const SectionHeadingRow = ({
    title,
    icon: Icon,
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <TableRow className="bg-teal-50/40 hover:bg-teal-50/40">
      <TableCell colSpan={4} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-black tracking-tight text-slate-900">
            {title}
          </span>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 ring-1 ring-teal-100">
            Section
          </span>
        </div>
      </TableCell>
    </TableRow>
  );

  const renderSection = (
    title: string,
    rows: AttendanceRecord[],
    icon: React.ComponentType<{ className?: string }>,
  ) => {
    if (!rows.length) return null;
    const sorted = sortWithin(rows);

    return (
      <>
        <SectionHeadingRow title={title} icon={icon} />
        {sorted.map((record) => {
          rowCounter += 1;
          const isChanged = record.changed;

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
              <TableCell className="px-4 py-3 text-sm font-bold text-slate-500">
                {rowCounter}
              </TableCell>

              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <AvatarGlow
                    name={nameFromRecord(record)}
                    size="sm"
                    className="group-hover:scale-100"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">
                        {nameFromRecord(record)}
                      </span>

                      {isChanged && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200/60">
                          Modified
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-medium text-slate-500">
                      {sectionFromRecord(record) || "—"}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="px-4 py-3">
                {!record.leaveType ? (
                  <AttendanceTimeInput
                    value={formatTimeForInput(record.signInTime)}
                    onChange={(value) =>
                      handleSignInChange(record.$id, value)
                    }
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    —
                  </span>
                )}
              </TableCell>

              <TableCell className="px-4 py-3">
                <AttendanceLeaveSelect
                  value={
                    record.leaveType
                      ? reverseLeaveTypeMapping[record.leaveType] ?? ""
                      : ""
                  }
                  onValueChange={(label) =>
                    handleLeaveChange(record.$id, label)
                  }
                  leaveOptions={leaveTypes}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </>
    );
  };

  const councillor = grouped["Councillor"];
  const admin = grouped["Admin"];
  const waste = grouped["Waste Management"];
  const other = grouped["Other"];

  return (
    <div className="space-y-6">
      <AttendanceChangesBanner count={changedCount} />

      <CouncilCard interactive="none" className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                #
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Employee
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Sign in
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {renderSection("Council", councillor, Users)}
            {renderSection("Admin", admin, Briefcase)}
            {renderSection("Waste Management", waste, Recycle)}
            {renderSection("Other", sortWithin(other), UserCheck)}
          </TableBody>
        </Table>
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
                  Delete attendance sheet?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium text-slate-600">
                  This permanently removes all attendance records for this date.
                  This action cannot be undone.
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

export default AttendanceTable;
