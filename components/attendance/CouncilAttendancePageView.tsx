"use client";

import { AttendancePageControls } from "@/components/attendance/attendance-page-controls";
import AttendanceTable from "@/components/AttendanceTable";
import { EmptyState, PageHeader, PageShell } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { fetchAllEmployees } from "@/lib/actions/hr.actions";
import {
  createAttendanceForEmployeesAction,
  syncAttendanceForDateAction,
} from "@/lib/attendance/attendance.actions";
import type { EnrichedAttendanceRow } from "@/lib/attendance/enrich-attendance";
import { ClipboardList, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type EmployeeRef =
  | string
  | {
      $id: string;
      name: string;
      section?: string;
    };

type Row = {
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
};

const normalize = (docs: EnrichedAttendanceRow[]): Row[] =>
  docs.map((d) => ({
    $id: d.$id,
    employeeId: d.employeeId,
    signInTime: d.signInTime ?? null,
    leaveType: d.leaveType ?? null,
    minutesLate: d.minutesLate ?? 0,
    previousLeaveType: d.previousLeaveType ?? null,
    leaveDeducted: d.leaveDeducted ?? false,
    leaveUsedAfter: d.leaveUsedAfter ?? null,
    leaveRemainingAfter: d.leaveRemainingAfter ?? null,
    changed: false,
  }));

export function CouncilAttendancePageView({
  date,
  rows,
}: {
  date: string;
  rows: EnrichedAttendanceRow[];
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const attendanceData = useMemo(() => normalize(rows), [rows]);
  const showGenerateButton = attendanceData.length === 0;
  const actionLoading = syncing || generating;

  const handleDateChange = (iso: string) => {
    if (!iso || iso === date) return;
    router.push(`/attendance/council?date=${iso}`);
  };

  const handleSync = async (syncDevice = false) => {
    try {
      setSyncing(true);
      const result = await syncAttendanceForDateAction(date, { syncDevice });
      if (!result.success) throw new Error(result.error || "Failed to sync");
      const synced = result.synced ?? 0;
      const added = result.added ?? 0;
      toast({
        title: synced + added ? "Attendance updated" : "No changes",
        description:
          synced + added > 0
            ? `${synced} synced, ${added} added.`
            : "Everything is already up to date.",
        variant: synced + added ? "success" : "default",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update from punches.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateAttendance = async () => {
    setGenerating(true);
    try {
      if (rows.length > 0) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        return;
      }
      const employees = await fetchAllEmployees();
      const createResult = await createAttendanceForEmployeesAction(date, employees);
      if (!createResult.success) {
        throw new Error(createResult.error || "Failed to create attendance");
      }
      toast({
        title: "Success",
        description: "Attendance sheet created.",
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create attendance.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={ClipboardList}
        title="Council Attendance"
        subtitle="Manage daily sign-in and leave records for council staff"
      />

      <AttendancePageControls
        selectedDate={date}
        onDateChange={handleDateChange}
        onSearch={() => void handleSync(true)}
        searchLoading={actionLoading}
        searchLabel="Search & sync"
        showGenerate={showGenerateButton}
        onGenerate={handleGenerateAttendance}
        generateLoading={actionLoading}
        className="mb-6"
      />

      {attendanceData.length > 0 ? (
        <AttendanceTable date={date} data={attendanceData} />
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No attendance sheet"
          description="No records exist for this date. Generate a sheet to start marking attendance."
          action={
            <Button
              variant="council"
              className="mt-2 h-11 rounded-xl px-6"
              onClick={handleGenerateAttendance}
              disabled={actionLoading}
            >
              <Plus className="h-4 w-4" />
              Generate sheet
            </Button>
          }
        />
      )}
    </PageShell>
  );
}
