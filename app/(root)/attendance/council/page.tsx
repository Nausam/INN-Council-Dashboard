/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { AttendancePageControls } from "@/components/attendance/attendance-page-controls";
import AttendanceTable from "@/components/AttendanceTable";
import { EmptyState, PageHeader, PageShell } from "@/components/design-system";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  useAllEmployeesActionQuery,
  useCouncilAttendanceQuery,
  useQueryInvalidation,
} from "@/hooks/queries";
import type { EmployeeDoc } from "@/lib/firebase/hr";
import {
  createAttendanceForEmployeesAction,
  syncAttendanceForDateAction,
} from "@/lib/attendance/attendance.actions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

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

const normalize = (docs: unknown[]): Row[] =>
  docs.map((d) => {
    const r = d as Omit<Row, "changed"> & Partial<Pick<Row, "changed">>;
    return { ...r, changed: r.changed ?? false };
  });

const AdminAttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoSyncedDate, setAutoSyncedDate] = useState<string | null>(null);

  const { invalidateCouncilAttendance } = useQueryInvalidation();

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "";
    return new Date(
      selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .split("T")[0];
  }, [selectedDate]);

  const monthKey = useMemo(
    () => (formattedSelectedDate ? formattedSelectedDate.slice(0, 7) : ""),
    [formattedSelectedDate],
  );

  const {
    data: rawAttendance,
    isPending,
    isFetching,
    error,
    refetch,
  } = useCouncilAttendanceQuery(formattedSelectedDate);

  const { data: employees } = useAllEmployeesActionQuery();

  const attendanceData = useMemo(
    () => normalize(rawAttendance ?? []),
    [rawAttendance],
  );

  const showGenerateButton = !isPending && attendanceData.length === 0;
  const isAttendanceGenerated = attendanceData.length > 0;

  const handleDateChange = (iso: string) => {
    if (!iso) return;
    const [y, m, d] = iso.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
  };

  useEffect(() => {
    if (!error) return;
    console.error("Error loading attendance:", error);
    toast({
      title: "Error",
      description:
        error instanceof Error
          ? error.message
          : "Failed to load attendance for the selected date.",
      variant: "destructive",
    });
  }, [error]);

  const handleSync = useCallback(async (silent = false) => {
    if (!formattedSelectedDate) return;
    try {
      setSyncing(true);
      const result = await syncAttendanceForDateAction(formattedSelectedDate);

      if (!result.success) {
        throw new Error(result.error || "Failed to sync");
      }

      const synced = result.synced ?? 0;
      const added = result.added ?? 0;
      const total = synced + added;

      if (!silent) {
        const descriptionParts: string[] = [];
        if (synced > 0) {
          descriptionParts.push(
            `${synced} row${synced === 1 ? "" : "s"} synced from device punches`,
          );
        }
        if (added > 0) {
          descriptionParts.push(
            `${added} employee${added === 1 ? "" : "s"} added to the sheet`,
          );
        }

        toast({
          title: total ? "Attendance updated" : "No changes",
          description:
            total > 0
              ? descriptionParts.join(". ") + "."
              : "Everything is already up to date.",
          variant: total ? "success" : "default",
        });
      }

      await invalidateCouncilAttendance(formattedSelectedDate, monthKey);
    } catch (err: any) {
      console.error("Sync error:", err);
      if (!silent) {
        toast({
          title: "Error",
          description: err.message || "Failed to update from punches.",
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [formattedSelectedDate, invalidateCouncilAttendance, monthKey]);

  useEffect(() => {
    if (
      !formattedSelectedDate ||
      autoSyncedDate === formattedSelectedDate ||
      isPending ||
      isFetching ||
      syncing ||
      generating ||
      attendanceData.length === 0
    ) {
      return;
    }

    setAutoSyncedDate(formattedSelectedDate);
    void handleSync(true);
  }, [
    attendanceData.length,
    autoSyncedDate,
    formattedSelectedDate,
    generating,
    isFetching,
    isPending,
    syncing,
    handleSync,
  ]);

  const handleSearchAndSync = async () => {
    const { data } = await refetch();
    if (data && data.length > 0) {
      await handleSync(true);
    }
  };

  const handleGenerateAttendance = async () => {
    if (!formattedSelectedDate) return;
    setGenerating(true);
    try {
      const { data: latest } = await refetch();
      const existing = latest ?? [];

      if (existing.length > 0) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        return;
      }

      if ((employees ?? []).length === 0) {
        throw new Error("Failed to fetch employees");
      }

      const createResult = await createAttendanceForEmployeesAction(
        formattedSelectedDate,
        (employees ?? []) as EmployeeDoc[],
      );

      if (!createResult.success) {
        throw new Error(createResult.error || "Failed to create attendance");
      }

      toast({
        title: "Success",
        description: "Attendance sheet created.",
        variant: "success",
      });

      await invalidateCouncilAttendance(formattedSelectedDate, monthKey);
    } catch (error: any) {
      console.error("Error creating attendance:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create attendance.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const pageLoading = isPending;
  const actionLoading = isFetching || syncing || generating;

  return (
    <PageShell>
      <PageHeader
        icon={ClipboardList}
        title="Council Attendance"
        subtitle="Manage daily sign-in and leave records for council staff"
      />

      <AttendancePageControls
        selectedDate={formattedSelectedDate}
        onDateChange={handleDateChange}
        onSearch={handleSearchAndSync}
        searchLoading={actionLoading}
        searchLabel="Search & sync"
        showGenerate={showGenerateButton}
        onGenerate={handleGenerateAttendance}
        generateLoading={actionLoading}
        className="mb-6"
      />

      {pageLoading ? (
        <SkeletonAttendanceTable />
      ) : attendanceData.length > 0 ? (
        <AttendanceTable date={formattedSelectedDate} data={attendanceData} />
      ) : (
        !isAttendanceGenerated && (
          <EmptyState
            icon={ClipboardList}
            title="No attendance sheet"
            description="No records exist for this date. Generate a sheet to start marking attendance."
            action={
              showGenerateButton ? (
                <Button
                  variant="council"
                  className="mt-2 h-11 rounded-xl px-6"
                  onClick={handleGenerateAttendance}
                  disabled={actionLoading}
                >
                  <Plus className="h-4 w-4" />
                  Generate sheet
                </Button>
              ) : undefined
            }
          />
        )
      )}
    </PageShell>
  );
};

export default AdminAttendancePage;
