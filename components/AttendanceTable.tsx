/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AttendanceLeaveSelect } from "@/components/attendance/attendance-leave-select";
import { AttendanceLeaveUsage } from "@/components/attendance/attendance-leave-usage";
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
import { computeCouncilMinutesLate } from "@/lib/attendance/council-lateness";
import { submitCouncilAttendanceAction } from "@/lib/attendance/attendance.actions";
import {
  ADDITIVE_LEAVE_KEYS,
  LEAVE_TOTAL_ALLOWANCE,
  getLeaveUsageSummary,
} from "@/lib/employees/leave-usage";
import {
  deleteAttendancesByDate,
  fetchEmployeeLeaveCalendar,
  type EmployeeDoc,
  type EmployeeLeaveCalendarEntry,
} from "@/lib/firebase/hr";
import { QUERY_STALE_TIME_ATTENDANCE } from "@/lib/query/config";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { useUser } from "@/Providers/UserProvider";
import { useQueries } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  Building2,
  Recycle,
  Save,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
/* ---------------- Helpers ---------------- */
/* ---------------- Types ---------------- */
type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      section?: string;
      designation?: string;
    };

interface AttendanceRecord {
  $id: string;
  employeeId: EmployeeRef;
  signInTime: string | null;
  leaveType: string | null;
  minutesLate: number | null;
  previousLeaveType: string | null;
  leaveDeducted: boolean;
  leaveUsedAfter?: number | null;
  leaveRemainingAfter?: number | null;
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
  const parts = time.split(":");
  if (parts.length < 2) return null;

  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return null;
  }

  const utc = new Date(`${date}T00:00:00.000Z`);
  const mvMinutes = hh * 60 + mm;
  const utcMinutes = mvMinutes - MV_OFFSET_MIN;
  utc.setUTCMinutes(utcMinutes);
  return utc.toISOString();
};

const shouldPreviewLeaveDeduction = (record: AttendanceRecord) =>
  Boolean(record.leaveType) &&
  record.changed &&
  (record.leaveDeducted !== true ||
    record.previousLeaveType !== record.leaveType);

const CONTINUOUS_CALENDAR_LEAVES = new Set([
  "maternityLeave",
  "preMaternityLeave",
  "paternityLeave",
]);

const calendarDayDifference = (from: string, to: string) => {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return 1;
  }
  const diff = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.max(1, diff);
};

const leaveSnapshotBalance = (
  entry: EmployeeLeaveCalendarEntry,
): number | null => {
  if (ADDITIVE_LEAVE_KEYS.has(entry.leaveType)) {
    return typeof entry.leaveUsedAfter === "number"
      ? entry.leaveUsedAfter
      : null;
  }

  return typeof entry.leaveRemainingAfter === "number"
    ? entry.leaveRemainingAfter
    : null;
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
    Record<string, { name: string; section?: string; designation?: string }>
  >({});

  const idFromRef = (ref: EmployeeRef) =>
    typeof ref === "object" ? ref.$id : ref;

  const normalize = (s?: string) => (s ?? "").toLowerCase().trim();
  const clean = (s?: string) => normalize(s).replace(/[^a-z]/g, "");
  const nameOrderKey = (s?: string) =>
    clean(s).replace(/(.)\1+/g, "$1");

  const buildSectionOrderIndex = (names: string[]) => {
    const map = new Map<string, number>();
    names.forEach((name, index) => {
      map.set(normalize(name), index);
      map.set(clean(name), index);
      map.set(nameOrderKey(name), index);
    });
    return map;
  };

  const registerOrderAlias = (
    map: Map<string, number>,
    canonicalName: string,
    aliasName: string,
  ) => {
    const rank =
      map.get(nameOrderKey(canonicalName)) ??
      map.get(normalize(canonicalName));
    if (rank === undefined) return;

    map.set(normalize(aliasName), rank);
    map.set(clean(aliasName), rank);
    map.set(nameOrderKey(aliasName), rank);
  };

  const getSectionOrderRank = (
    name: string,
    sectionOrder: Map<string, number>,
  ) => {
    for (const key of [normalize(name), clean(name), nameOrderKey(name)]) {
      const rank = sectionOrder.get(key);
      if (rank !== undefined) return rank;
    }
    return Number.MAX_SAFE_INTEGER;
  };

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

  const designationFromRecord = (r: AttendanceRecord) => {
    if (typeof r.employeeId === "object" && r.employeeId.designation?.trim()) {
      return r.employeeId.designation.trim();
    }

    const id = idFromRef(r.employeeId);
    const cached = id ? employeeCache[id] : undefined;
    if (cached?.designation?.trim()) return cached.designation.trim();

    return "";
  };

  useEffect(() => {
    setAttendanceUpdates(data);
  }, [data]);

  const { data: allEmployees } = useEmployeesQuery();

  const employeeById = useMemo(
    () => new Map(allEmployees?.map((emp) => [emp.$id, emp]) ?? []),
    [allEmployees],
  );

  const previewEmployeeIds = useMemo(
    () =>
      Array.from(
        new Set(
          attendanceUpdates
            .filter((record) => shouldPreviewLeaveDeduction(record))
            .map((record) => idFromRef(record.employeeId))
            .filter(Boolean),
        ),
      ),
    [attendanceUpdates],
  );

  const previewLeaveQueries = useQueries({
    queries: previewEmployeeIds.map((employeeId) => ({
      queryKey: queryKeys.employees.leaveCalendar(employeeId),
      queryFn: () => fetchEmployeeLeaveCalendar(employeeId),
      enabled: Boolean(employeeId),
      staleTime: QUERY_STALE_TIME_ATTENDANCE,
    })),
  });

  const leaveHistoryByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeLeaveCalendarEntry[]>();
    previewEmployeeIds.forEach((employeeId, index) => {
      map.set(employeeId, previewLeaveQueries[index]?.data ?? []);
    });
    return map;
  }, [previewEmployeeIds, previewLeaveQueries]);

  const leaveUsageFromRecord = (r: AttendanceRecord) => {
    if (!r.leaveType) return null;

    if (!shouldPreviewLeaveDeduction(r)) {
      if (
        ADDITIVE_LEAVE_KEYS.has(r.leaveType) &&
        typeof r.leaveUsedAfter === "number"
      ) {
        return { used: r.leaveUsedAfter, remaining: null };
      }

      if (typeof r.leaveRemainingAfter === "number") {
        return getLeaveUsageSummary(r.leaveType, r.leaveRemainingAfter);
      }
    }

    const employeeId = idFromRef(r.employeeId);
    const employee = employeeById.get(employeeId);
    if (!employee) return null;

    const value = employee[r.leaveType as keyof EmployeeDoc];
    let balance =
      typeof value === "number" && Number.isFinite(value) ? value : 0;

    if (shouldPreviewLeaveDeduction(r)) {
      const priorEntries = leaveHistoryByEmployee
        .get(employeeId)
        ?.filter(
          (entry) => entry.leaveType === r.leaveType && entry.date < date,
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.$id.localeCompare(b.$id))
        ?? [];

      const previousSnapshot = [...priorEntries]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.$id.localeCompare(a.$id),
        )
        .map((entry) => ({
          date: entry.date,
          balance: leaveSnapshotBalance(entry),
        }))
        .find(
          (entry): entry is { date: string; balance: number } =>
            typeof entry.balance === "number",
        );

      const totalAllowance = LEAVE_TOTAL_ALLOWANCE[r.leaveType];
      const inferredBase =
        typeof totalAllowance === "number"
          ? Math.max(0, totalAllowance - priorEntries.length)
          : ADDITIVE_LEAVE_KEYS.has(r.leaveType)
            ? priorEntries.length
            : balance;
      const base = previousSnapshot?.balance ?? inferredBase;
      balance = ADDITIVE_LEAVE_KEYS.has(r.leaveType)
        ? base +
          (previousSnapshot && CONTINUOUS_CALENDAR_LEAVES.has(r.leaveType)
            ? calendarDayDifference(previousSnapshot.date, date)
            : 1)
        : Math.max(0, base - 1);
    }

    return getLeaveUsageSummary(r.leaveType, balance);
  };

  useEffect(() => {
    if (!allEmployees?.length) return;

    const byId = new Map(allEmployees.map((emp) => [emp.$id, emp]));
    const lookup: Record<
      string,
      { name: string; section?: string; designation?: string }
    > = {};

    for (const record of attendanceUpdates) {
      const id = idFromRef(record.employeeId);
      const emp = byId.get(id);
      if (emp) {
        lookup[id] = {
          name: emp.name,
          section: emp.section,
          designation: emp.designation,
        };
      }
    }

    if (Object.keys(lookup).length > 0) {
      setEmployeeCache((prev) => ({ ...prev, ...lookup }));
    }
  }, [allEmployees, attendanceUpdates]);

  /* ---------------- Custom order + section-first sort ---------------- */
  const councillorOrder = [
    "Ibrahim Haleem",
    "Hussain Areef",
    "Hawwa Nazleena",
  ];

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

  const adminSectionOrder = [
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
    "Aishath Naahidha",
    "Aishath Simaana",
    "Fazeela Naseer",
    "Azlifa Mohamed Saleem",
    "Aishath Shabaana",
  ];

  const councillorOrderIndex = useMemo(
    () => buildSectionOrderIndex(councillorOrder),
    [],
  );

  const adminOrderIndex = useMemo(() => {
    const map = buildSectionOrderIndex(adminSectionOrder);
    registerOrderAlias(map, "Azlifa Mohamed Saleem", "Azlifa Saleem");
    registerOrderAlias(map, "Aishath Shabaana", "Aishath Shabana");
    return map;
  }, []);

  const orderIndex = useMemo(() => buildSectionOrderIndex(employeeOrder), []);

  type CanonicalSection =
    | "Councillor"
    | "Admin"
    | "WDC"
    | "Waste Management"
    | "Other";
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
    if (n === "wdc") return "WDC";
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
      WDC: [],
      "Waste Management": [],
      Other: [],
    };
    for (const r of attendanceUpdates) {
      const sec = getCanonicalSection(sectionFromRecord(r));
      g[sec].push(r);
    }
    return g;
  }, [attendanceUpdates, employeeCache]);

  const sortWithin = (
    arr: AttendanceRecord[],
    sectionOrder: Map<string, number> = orderIndex,
  ) => {
    return [...arr].sort((a, b) => {
      const an = nameFromRecord(a);
      const bn = nameFromRecord(b);
      const ai = getSectionOrderRank(an, sectionOrder);
      const bi = getSectionOrderRank(bn, sectionOrder);
      if (ai !== bi) return ai - bi;
      return an.localeCompare(bn);
    });
  };

  /* ---------------- Handlers ---------------- */
  const handleSignInChange = (attendanceId: string, newSignInTime: string) => {
    const dateTime = newSignInTime.trim()
      ? convertTimeToDateTime(newSignInTime, date)
      : null;
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
      const minutesLate = computeCouncilMinutesLate(
        r.signInTime,
        date,
        sectionFromRecord(r),
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
      const result = await submitCouncilAttendanceAction(
        changed.map((r) => ({
          attendanceId: r.$id,
          employeeId: idFromRef(r.employeeId),
          employeeName: nameFromRecord(r),
          signInTime: r.signInTime,
          leaveType: r.leaveType ?? null,
          minutesLate: r.minutesLate ?? 0,
          previousLeaveType: r.previousLeaveType ?? null,
          leaveDeducted: r.leaveDeducted,
        })),
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to update attendance");
      }

      await invalidateCouncilAttendance(date, monthKey);
      invalidateEmployees();

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
        description:
          e instanceof Error ? e.message : "Error updating attendance.",
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
    const sorted =
      title === "Council"
        ? sortWithin(rows, councillorOrderIndex)
        : title === "Admin"
          ? sortWithin(rows, adminOrderIndex)
          : sortWithin(rows);

    return (
      <>
        <SectionHeadingRow title={title} icon={icon} />
        {sorted.map((record) => {
          rowCounter += 1;
          const isChanged = record.changed;
          const leaveUsage = leaveUsageFromRecord(record);

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
                      {designationFromRecord(record) || "—"}
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
                ) : leaveUsage ? (
                  <AttendanceLeaveUsage usage={leaveUsage} />
                ) : (
                  <span className="text-sm font-semibold text-slate-400">—</span>
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
  const wdc = grouped["WDC"];
  const waste = grouped["Waste Management"];
  const other = grouped["Other"];

  return (
    <div className="space-y-6">
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
            {renderSection("WDC", wdc, Building2)}
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
