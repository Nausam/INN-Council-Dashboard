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
  fetchEmployeeById,
  updateAttendanceRecord,
} from "@/lib/appwrite/appwrite";
import { useUser } from "@/Providers/UserProvider";
import { useEffect, useMemo, useState } from "react";

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

/* ---------------- Leave mappings (aligned with your Employees schema) ---------------- */
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
];

const leaveTypeMapping: Record<string, string> = {
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

const reverseLeaveTypeMapping = Object.fromEntries(
  Object.entries(leaveTypeMapping).map(([label, value]) => [value, label])
);

/* ---------------- Time helpers ---------------- */
const formatTimeForInput = (dateTime: string | null) => {
  if (!dateTime) return "";
  const d = new Date(dateTime);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
const convertTimeToDateTime = (time: string, date: string) => {
  const [hh, mm] = time.split(":");
  const d = new Date(date);
  d.setUTCHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
  return d.toISOString();
};

/* ===================================================================== */

const AttendanceTable = ({ date, data }: AttendanceTableProps) => {
  const [attendanceUpdates, setAttendanceUpdates] =
    useState<AttendanceRecord[]>(data);
  const [submitting, setSubmitting] = useState(false);
  const { isAdmin } = useUser();
  const { toast } = useToast();

  // Cache of employee docs to resolve names/sections when employeeId is only a string
  const [employeeCache, setEmployeeCache] = useState<
    Record<string, { name: string; section?: string }>
  >({});

  /* -------- helpers for mixed shapes + cache -------- */
  const idFromRef = (ref: EmployeeRef) =>
    typeof ref === "object" ? ref.$id : ref;

  const nameFromRecord = (r: AttendanceRecord) => {
    if (typeof r.employeeId === "object") return r.employeeId.name;
    const id = r.employeeId;
    return (id && employeeCache[id]?.name) || "Unknown";
  };

  const sectionFromRecord = (r: AttendanceRecord) => {
    if (typeof r.employeeId === "object") return r.employeeId.section ?? "";
    const id = r.employeeId;
    return (id && employeeCache[id]?.section) || "";
  };

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
              return {
                id,
                name: doc.name as string,
                section: (doc.section as string) || "",
              };
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
        // ignore; rows will continue to show 'Unknown' if any fetch fails
      }
    })();
  }, [unresolvedIds]);

  // Your preferred display order
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

  const sortedAttendance = [...attendanceUpdates].sort((a, b) => {
    const aName = nameFromRecord(a);
    const bName = nameFromRecord(b);
    const ai = employeeOrder.indexOf(aName);
    const bi = employeeOrder.indexOf(bName);
    const aa = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bb = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aa !== bb) return aa - bb;
    return aName.localeCompare(bName);
  });

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
    const leaveTypeValue = leaveTypeMapping[leaveTypeLabel] || null;
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
      const required =
        sectionFromRecord(r) === "Councillor" ? "08:30" : "08:00";
      const requiredTime = new Date(`${date}T${required}Z`);
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

          const leaveType = r.leaveType || "";
          if (leaveType) {
            const available = (employee as any)?.[leaveType] ?? 0;
            if (available <= 0) {
              throw new Error(
                `${nameFromRecord(r)} does not have any ${leaveType} left.`
              );
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
            leaveType: r.leaveType || null,
            minutesLate: r.minutesLate || 0,
            previousLeaveType: r.leaveType || null,
            leaveDeducted: !!r.leaveType,
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
                {nameFromRecord(record)}
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
                      ? (reverseLeaveTypeMapping as any)[record.leaveType] || ""
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
