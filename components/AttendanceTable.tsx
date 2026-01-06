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
import { useToast } from "@/hooks/use-toast";
import {
  deductLeave,
  deleteAttendancesByDate,
  EmployeeDoc,
  fetchEmployeeById,
  updateAttendanceRecord,
} from "@/lib/appwrite/appwrite";
import { useUser } from "@/Providers/UserProvider";
import { useEffect, useMemo, useState } from "react";

// --- HELPERS ---
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

type NumericLeaveKey = AdditiveLeave | BalanceLeave;

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

// --- Maldives timezone helpers (UTC+05:00, no DST) ---
const MV_OFFSET_MIN = 5 * 60;

/* ---------------- Time helpers ---------------- */
const formatTimeForInput = (dateTime: string | null) => {
  if (!dateTime) return "";
  const d = new Date(dateTime); // UTC moment
  // Convert to MV wall-clock minutes, then format HH:mm
  const minsUtc = d.getUTCHours() * 60 + d.getUTCMinutes();
  const minsMv = (minsUtc + MV_OFFSET_MIN + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(minsMv / 60)).padStart(2, "0");
  const mm = String(minsMv % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

const convertTimeToDateTime = (time: string, date: string) => {
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  // Start at the UTC midnight of that calendar date
  const utc = new Date(`${date}T00:00:00.000Z`);
  // Set minutes so that the *local MV* wall-clock equals hh:mm
  utc.setUTCMinutes(hh * 60 + mm - MV_OFFSET_MIN);
  return utc.toISOString();
};

const mvLocalToUtcDate = (date: string, hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map((v) => parseInt(v, 10));
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCMinutes(hh * 60 + mm - MV_OFFSET_MIN);
  return utc;
};

/* ===================================================================== */

const AttendanceTable = ({ date, data }: AttendanceTableProps) => {
  const [attendanceUpdates, setAttendanceUpdates] =
    useState<AttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);
  const { isAdmin } = useUser();
  const { toast } = useToast();

  // Cache for resolving names/sections when employeeId is a string
  const [employeeCache, setEmployeeCache] = useState<
    Record<string, { name: string; section?: string }>
  >({});

  /* -------- helpers for mixed shapes + cache -------- */
  const idFromRef = (ref: EmployeeRef) =>
    typeof ref === "object" ? ref.$id : ref;

  const normalize = (s?: string) => (s ?? "").toLowerCase().trim();
  const clean = (s?: string) => normalize(s).replace(/[^a-z]/g, "");

  // robust section extraction (looks at several possible fields/variants)
  const sectionFromRecord = (r: AttendanceRecord) => {
    if (typeof r.employeeId === "object") {
      const s = r.employeeId.section ?? "";
      return s || "";
    }
    const id = r.employeeId;
    const cache = id ? employeeCache[id] : undefined;
    // try common alternative fields if your employee doc uses different keys

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

  // Keep local state in sync with prop
  useEffect(() => {
    setAttendanceUpdates(data);
  }, [data]);

  // Which IDs do we need to resolve?
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

  // Fetch missing employee docs (parallel)
  useEffect(() => {
    if (unresolvedIds.length === 0) return;
    (async () => {
      try {
        const results = await Promise.all(
          unresolvedIds.map(async (id) => {
            try {
              const doc = await fetchEmployeeById(id);
              // read name/section defensively
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

  // Your requested fixed order (we'll compare case-insensitively)
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

  // Build a fast index map with normalized keys
  const orderIndex = useMemo(() => {
    const map = new Map<string, number>();
    employeeOrder.forEach((n, i) => map.set(normalize(n), i));
    return map;
  }, []);

  // map noisy section strings to canonical groups
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

  // split into groups by canonical section
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

  // sort within group by your fixed order (case-insensitive), then by name
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

    // compute lateness first
    const withLateness = attendanceUpdates.map((r) => {
      if (!r.signInTime) return r;
      const sec = getCanonicalSection(sectionFromRecord(r));
      const required = sec === "Councillor" ? "08:30" : "08:00";

      // required time treated as Maldives local, converted to UTC
      const requiredTime = mvLocalToUtcDate(date, required);
      const actual = new Date(r.signInTime); // already UTC ISO

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
            // if additive -> no blocking check
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

  /* ---------------- UI ---------------- */
  let rowCounter = 0;

  const SectionHeadingRow = ({ title }: { title: string }) => (
    <TableRow>
      <TableCell colSpan={4} className="bg-muted/60 text-sm font-medium">
        <div className="py-2 px-3">{title}</div>
      </TableCell>
    </TableRow>
  );

  const renderSection = (title: string, rows: AttendanceRecord[]) => {
    if (!rows.length) return null;
    const sorted = sortWithin(rows);
    return (
      <>
        <SectionHeadingRow title={title} />
        {sorted.map((record) => {
          rowCounter += 1;
          return (
            <TableRow key={record.$id}>
              <TableCell className="py-2 px-4">{rowCounter}</TableCell>
              <TableCell className="py-2 px-4">
                {nameFromRecord(record)}
              </TableCell>
              <TableCell className="py-2 px-4">
                {!record.leaveType ? (
                  <input
                    type="time"
                    className="border p-2 rounded-md"
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
                      ? reverseLeaveTypeMapping[record.leaveType] ?? ""
                      : ""
                  }
                  onChange={(e) =>
                    handleLeaveChange(record.$id, e.target.value)
                  }
                  className="border p-2 rounded-md"
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
          {renderSection("Council", councillor)}
          {renderSection("Admin", admin)}
          {renderSection("Waste Management", waste)}
          {renderSection("Other", sortWithin(other))}
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

        {isAdmin ? (
          <AlertDialog>
            <AlertDialogTrigger className="flex items-center justify-center w-full md:w-60">
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

export default AttendanceTable;
