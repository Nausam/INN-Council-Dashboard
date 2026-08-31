"use client";

import { AttendancePageControls } from "@/components/attendance/attendance-page-controls";
import MosqueAttendanceTable from "@/components/MosqueAttendanceTable";
import PrayerTimesBanner from "@/components/PrayerTimesBanner";
import { EmptyState, PageHeader, PageShell } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { generateMosqueAttendanceAction } from "@/lib/attendance/attendance.actions";
import type { MosqueAttendanceRecord } from "@/types";
import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const employeeOrder = [
  "Mohamed Shahidh",
  "Ahmed Zahidh",
  "Mohamed Mahir",
  "Ibrahim Waseen",
  "Ibrahim Hashim",
  "Hawwa Luiza",
];

function sortAttendance(attendance: MosqueAttendanceRecord[]) {
  return [...attendance].sort((a, b) => {
    const nameOf = (record: MosqueAttendanceRecord) => {
      const emp = record.employeeId;
      if (typeof emp === "string") return emp;
      return emp?.name || emp?.$id || "";
    };
    const nameA = nameOf(a);
    const nameB = nameOf(b);
    const indexA = employeeOrder.indexOf(nameA);
    const indexB = employeeOrder.indexOf(nameB);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return nameA.localeCompare(nameB);
  });
}

export function MosqueAttendancePageView({
  date,
  rows,
}: {
  date: string;
  rows: MosqueAttendanceRecord[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const attendanceData = useMemo(() => sortAttendance(rows), [rows]);
  const showGenerateButton = attendanceData.length === 0;

  const handleDateChange = (iso: string) => {
    if (!iso || iso === date) return;
    router.push(`/attendance/mosque?date=${iso}`);
  };

  const handleGenerateAttendance = async () => {
    setGenerating(true);
    try {
      const result = await generateMosqueAttendanceAction(date);
      if (!result.success) {
        throw new Error(result.error || "Failed to generate attendance");
      }
      if (result.alreadyExists) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        router.refresh();
        return;
      }
      toast({
        title: "Success",
        description: `Created ${result.created ?? 0} blank attendance row(s).`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
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

  return (
    <PageShell>
      <PageHeader
        icon={Building2}
        title="Mosque Attendance"
        subtitle="Track daily prayer attendance for mosque staff"
      />

      <AttendancePageControls
        selectedDate={date}
        onDateChange={handleDateChange}
        onSearch={() => router.refresh()}
        searchLoading={generating}
        searchLabel="Refresh"
        showGenerate={showGenerateButton}
        onGenerate={handleGenerateAttendance}
        generateLoading={generating}
        className="mb-6"
      />

      <div className="mb-6">
        <PrayerTimesBanner dateISO={date} />
      </div>

      {attendanceData.length > 0 ? (
        <MosqueAttendanceTable date={date} data={attendanceData} />
      ) : (
        <EmptyState
          icon={Building2}
          title="No attendance sheet"
          description="No mosque attendance records exist for this date. Generate a sheet to begin."
          action={
            <Button
              variant="council"
              className="mt-2 h-11 rounded-xl px-6"
              onClick={handleGenerateAttendance}
              disabled={generating}
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
