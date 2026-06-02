"use client";

import { AttendancePageControls } from "@/components/attendance/attendance-page-controls";
import MosqueAttendanceTable from "@/components/MosqueAttendanceTable";
import PrayerTimesBanner from "@/components/PrayerTimesBanner";
import { EmptyState, PageHeader, PageShell } from "@/components/design-system";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  useMosqueAttendanceQuery,
  useQueryInvalidation,
} from "@/hooks/queries";
import { generateMosqueAttendanceAction } from "@/lib/attendance/attendance.actions";
import type { MosqueAttendanceRecord } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";

type AttendanceDoc = MosqueAttendanceRecord;

const employeeOrder = [
  "Mohamed Shahidh",
  "Ahmed Zahidh",
  "Mohamed Mahir",
  "Ibrahim Waseen",
  "Ibrahim Hashim",
  "Hawwa Luiza",
];

const sortAttendanceByEmployeeOrder = (attendance: AttendanceDoc[]) => {
  return [...attendance].sort((a, b) => {
    const getEmployeeName = (record: AttendanceDoc): string => {
      const emp = record.employeeId;
      if (typeof emp === "string") return emp;
      return emp?.name || emp?.$id || "";
    };

    const nameA = getEmployeeName(a);
    const nameB = getEmployeeName(b);

    const indexA = employeeOrder.indexOf(nameA);
    const indexB = employeeOrder.indexOf(nameB);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return nameA.localeCompare(nameB);
  });
};

const MosqueAttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [generating, setGenerating] = useState(false);

  const { invalidateMosqueAttendance } = useQueryInvalidation();

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
  } = useMosqueAttendanceQuery(formattedSelectedDate);

  const attendanceData = useMemo(
    () => sortAttendanceByEmployeeOrder((rawAttendance ?? []) as AttendanceDoc[]),
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
    console.error("Error fetching mosque attendance:", error);
    toast({
      title: "Error",
      description: "Failed to load attendance for the selected date.",
      variant: "destructive",
    });
  }, [error]);

  const handleGenerateAttendance = async () => {
    if (!formattedSelectedDate) return;
    setGenerating(true);
    try {
      const result = await generateMosqueAttendanceAction(formattedSelectedDate);

      if (!result.success) {
        throw new Error(result.error || "Failed to generate attendance");
      }

      if (result.alreadyExists) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        await invalidateMosqueAttendance(formattedSelectedDate, monthKey);
        return;
      }

      if (!result.prayerTimesFound) {
        toast({
          title: "Warning",
          description:
            "Prayer times not found. Attendance created without prefilled times.",
          variant: "default",
        });
      }

      toast({
        title: "Success",
        description: "Attendance sheet created for mosque assistants.",
        variant: "success",
      });

      await invalidateMosqueAttendance(formattedSelectedDate, monthKey);
    } catch (error) {
      console.error("Error generating mosque attendance:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate attendance.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const pageLoading = isPending;
  const actionLoading = isFetching || generating;

  return (
    <PageShell>
      <PageHeader
        icon={Building2}
        title="Mosque Attendance"
        subtitle="Track daily prayer attendance for mosque staff"
      />

      <AttendancePageControls
        selectedDate={formattedSelectedDate}
        onDateChange={handleDateChange}
        onSearch={() => void refetch()}
        searchLoading={actionLoading}
        searchLabel="Refresh"
        showGenerate={showGenerateButton}
        onGenerate={handleGenerateAttendance}
        generateLoading={actionLoading}
        className="mb-6"
      />

      {formattedSelectedDate ? (
        <div className="mb-6">
          <PrayerTimesBanner dateISO={formattedSelectedDate} />
        </div>
      ) : null}

      {pageLoading ? (
        <SkeletonAttendanceTable variant="mosque" />
      ) : attendanceData.length > 0 ? (
        <MosqueAttendanceTable
          date={formattedSelectedDate}
          data={attendanceData}
        />
      ) : (
        !isAttendanceGenerated && (
          <EmptyState
            icon={Building2}
            title="No attendance sheet"
            description="No mosque attendance records exist for this date. Generate a sheet to begin."
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

export default MosqueAttendancePage;
