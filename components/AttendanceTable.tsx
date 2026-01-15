/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  deductLeave,
  deleteAttendancesByDate,
  EmployeeDoc,
  fetchEmployeeById,
  updateAttendanceRecord,
} from "@/lib/appwrite/appwrite";
import { useUser } from "@/Providers/UserProvider";
import {
  Clock,
  UserCheck,
  Trash2,
  AlertCircle,
  Users,
  Save,
  ChevronDown,
  Sparkles,
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

  useEffect(() => {
    if (unresolvedIds.length === 0) return;
    (async () => {
      try {
        const results = await Promise.all(
          unresolvedIds.map(async (id) => {
            try {
              const doc = await fetchEmployeeById(id);
              const anyDoc = doc as Record<string, unknown>;
              const name =
                String(
                  (anyDoc.name as string) ??
                    (anyDoc["fullName"] as string) ??
                    (anyDoc["displayName"] as string) ??
                    ""
                ) || "Unknown";
              const section =
                String(
                  (anyDoc.section as string) ??
                    (anyDoc["Section"] as string) ??
                    (anyDoc["department"] as string) ??
                    (anyDoc["Department"] as string) ??
                    (anyDoc["role"] as string) ??
                    ""
                ) || "";
              return { id, name, section };
            } catch {
              return { id, name: "Unknown", section: "" };
            }
          })
        );
        setEmployeeCache((prev) => {
          const next = { ...prev };
          for (const r of results)
            next[r.id] = { name: r.name, section: r.section };
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
  }, [unresolvedIds]);

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
    icon,
  }: {
    title: string;
    icon: React.ReactNode;
  }) => (
    <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
      <TableCell colSpan={4} className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-slate-700 shadow-sm ring-1 ring-slate-200/60 backdrop-blur">
              {icon}
            </span>
            <span className="tracking-tight">{title}</span>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200/50">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            Section
          </span>
        </div>
      </TableCell>
    </TableRow>
  );

  const renderSection = (
    title: string,
    rows: AttendanceRecord[],
    icon: React.ReactNode
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
              className={[
                "transition-all duration-200 ease-out",
                isChanged
                  ? "bg-amber-50/60 hover:bg-amber-50"
                  : "hover:bg-slate-50/70",
              ].join(" ")}
              style={{ willChange: "transform" }}
            >
              <TableCell className="px-4 py-3 text-sm font-bold text-slate-500">
                {rowCounter}
              </TableCell>

              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-500 opacity-30 blur-xl" />
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white shadow-lg shadow-indigo-500/30 ring-2 ring-white">
                      {nameFromRecord(record).charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">
                        {nameFromRecord(record)}
                      </span>

                      {isChanged && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200/60">
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
                  <div className="relative group">
                    <Clock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-hover:text-indigo-500" />
                    <input
                      type="time"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 ease-out placeholder-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                      value={formatTimeForInput(record.signInTime)}
                      onChange={(e) =>
                        handleSignInChange(record.$id, e.target.value)
                      }
                    />
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-slate-400">
                    —
                  </span>
                )}
              </TableCell>

              <TableCell className="px-4 py-3">
                <div className="group relative">
                  <select
                    value={
                      record.leaveType
                        ? reverseLeaveTypeMapping[record.leaveType] ?? ""
                        : ""
                    }
                    onChange={(e) =>
                      handleLeaveChange(record.$id, e.target.value)
                    }
                    className="w-full appearance-none rounded-2xl border-2 border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-out hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">✓ Present</option>
                    {leaveTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-hover:text-indigo-500" />
                </div>
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
      {/* Modified banner (glass) */}
      {changedCount > 0 && (
        <div
          className="group relative overflow-hidden rounded-3xl bg-white/80 p-4 shadow-md ring-1 ring-amber-200/60 backdrop-blur-xl transition-all duration-300 ease-out hover:shadow-xl"
          style={{
            willChange: "transform",
            animation: "fadeInUp 420ms ease-out",
          }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500 opacity-0 blur-3xl transition-all duration-500 group-hover:opacity-15" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/60">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">
                {changedCount} {changedCount === 1 ? "record" : "records"}{" "}
                modified
              </p>
              <p className="text-xs font-semibold text-slate-600">
                Don&apos;t forget to submit your changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table (glass card) */}
      <div
        className="group relative overflow-hidden rounded-3xl bg-white/80 shadow-md ring-1 ring-slate-200/50 backdrop-blur-xl transition-all duration-300 ease-out hover:shadow-xl hover:ring-slate-300/50"
        style={{
          willChange: "transform",
          animation: "fadeInUp 420ms ease-out 60ms both",
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-indigo-500 opacity-0 blur-3xl transition-all duration-500 group-hover:opacity-15" />
        <div
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          style={{ width: "50%" }}
        />

        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                #
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Employee
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Sign In
              </TableHead>
              <TableHead className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {renderSection(
              "Council",
              councillor,
              <Users className="h-4 w-4 text-violet-600" />
            )}
            {renderSection(
              "Admin",
              admin,
              <UserCheck className="h-4 w-4 text-blue-600" />
            )}
            {renderSection(
              "Waste Management",
              waste,
              <Users className="h-4 w-4 text-emerald-600" />
            )}
            {renderSection(
              "Other",
              sortWithin(other),
              <Users className="h-4 w-4 text-slate-600" />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Action bar */}
      <div
        className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        style={{ animation: "fadeInUp 420ms ease-out 120ms both" }}
      >
        <button
          className={[
            "group inline-flex items-center justify-center gap-2 rounded-2xl",
            "bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3",
            "text-sm font-bold text-white shadow-lg shadow-indigo-500/30",
            "transition-all duration-200 ease-out hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40",
            submitting ? "cursor-not-allowed opacity-50" : "",
          ].join(" ")}
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
                className={[
                  "group inline-flex items-center justify-center gap-2 rounded-2xl",
                  "border-2 border-red-200 bg-white/80 px-6 py-3",
                  "text-sm font-bold text-red-600 shadow-sm backdrop-blur-sm",
                  "transition-all duration-200 ease-out hover:scale-105 hover:bg-red-50 hover:shadow-md",
                  submitting ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
                disabled={submitting}
              >
                <Trash2 className="h-5 w-5" />
                Delete Attendance
              </button>
            </AlertDialogTrigger>

            <AlertDialogContent className="rounded-3xl border-0 bg-white/90 shadow-2xl ring-1 ring-slate-200/60 backdrop-blur-2xl">
              <AlertDialogHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-100 text-red-700 ring-1 ring-red-200/60">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <AlertDialogTitle className="text-2xl font-black tracking-tight text-slate-900">
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium text-slate-600">
                  This action cannot be undone. This will permanently delete
                  today&apos;s attendance and remove your data from the
                  database.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-2xl border-2 border-slate-200 bg-white/80 font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-md">
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 px-6 font-bold text-white shadow-lg transition-all duration-200 hover:shadow-xl"
                  onClick={handleDeleteAllAttendances}
                >
                  Delete Attendance
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AttendanceTable;
