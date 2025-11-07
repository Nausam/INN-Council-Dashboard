"use client";
import AttendanceTable from "@/components/AttendanceTable";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { toast } from "@/hooks/use-toast";
import type { EmployeeDoc } from "@/lib/appwrite/appwrite";
import {
  createAttendanceForEmployees,
  fetchAllEmployees,
  fetchAttendanceForDate,
  syncAttendanceForDate,
} from "@/lib/appwrite/appwrite";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

/* ---------- Types (match AttendanceTable's expectations) ---------- */
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
  changed: boolean;
};

const AdminAttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [attendanceData, setAttendanceData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAttendanceGenerated, setIsAttendanceGenerated] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "";
    return new Date(
      selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000
    )
      .toISOString()
      .split("T")[0];
  }, [selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsPopoverOpen(false);
  };

  useEffect(() => {
    setAttendanceData([]);
    setShowGenerateButton(false);
    setIsAttendanceGenerated(false);
  }, [selectedDate]);

  // Normalize raw docs into table rows with `changed: false`
  const normalize = (docs: unknown[]): Row[] =>
    docs.map((d) => {
      const r = d as Omit<Row, "changed"> & Partial<Pick<Row, "changed">>;
      return { ...r, changed: r.changed ?? false };
    });

  // Fetch attendance for the selected date
  const fetchAttendanceData = async (date: string, doAutoSync = false) => {
    if (!date) return;
    setLoading(true);
    try {
      const raw = (await fetchAttendanceForDate(date)) as unknown[];
      if (raw.length > 0) {
        setAttendanceData(normalize(raw));
        setIsAttendanceGenerated(true);

        // Auto-sync (refresh sign-ins) when requested
        if (doAutoSync) {
          await handleSync(true); // silent
        }
      } else {
        setAttendanceData([]);
        setIsAttendanceGenerated(false);
        setShowGenerateButton(true);
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance for the selected date.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (silent = false) => {
    if (!formattedSelectedDate) return;
    try {
      setSyncing(true);
      const updated = await syncAttendanceForDate(formattedSelectedDate);
      if (!silent) {
        toast({
          title: updated ? "Attendance updated" : "No new punches",
          description: updated
            ? `${updated} row${
                updated === 1 ? "" : "s"
              } synced from device punches.`
            : "Everything is already up to date.",
          variant: updated ? "success" : "default",
        });
      }
    } catch (err) {
      console.error("Sync error:", err);
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to update from punches.",
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
      // Re-fetch to reflect changes
      await fetchAttendanceData(formattedSelectedDate);
    }
  };

  // Generate attendance for date if it doesn't exist
  const handleGenerateAttendance = async () => {
    if (!formattedSelectedDate) return;
    setLoading(true);
    try {
      const existing = (await fetchAttendanceForDate(
        formattedSelectedDate
      )) as unknown[];

      if (existing.length > 0) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        setAttendanceData(normalize(existing));
      } else {
        const employees = (await fetchAllEmployees()) as EmployeeDoc[];
        const created = (await createAttendanceForEmployees(
          formattedSelectedDate,
          employees
        )) as unknown[]; // your helper returns plain objects

        setAttendanceData(normalize(created));
        setShowGenerateButton(false);
        toast({
          title: "Success",
          description: "Attendance sheet created.",
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error creating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to create attendance.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      await fetchAttendanceData(formattedSelectedDate, true);
    }
  };

  useEffect(() => {
    if (formattedSelectedDate) {
      fetchAttendanceData(formattedSelectedDate, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedSelectedDate]);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-5 mt-10">Attendance</h1>

      {/* Date Picker and Apply Button */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Select Date</p>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full lg:w-auto h-12 justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-end">
          <button
            className="custom-button w-full h-12"
            onClick={() => fetchAttendanceData(formattedSelectedDate, true)}
            disabled={loading || syncing}
            title="Search & update from punches"
          >
            {loading || syncing ? "Updating..." : "Search"}
          </button>
        </div>

        {/* Show message and generate button if no attendance is found */}
        {showGenerateButton && (
          <div className="flex items-end w-full">
            <button
              className="custom-button w-full lg:w-auto h-12"
              onClick={handleGenerateAttendance}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Attendance"}
            </button>
          </div>
        )}

        {/* {isAttendanceGenerated && (
          <div className="flex items-end">
            <button
              className="custom-button w-full lg:w-auto h-12"
              onClick={() => handleSync(false)}
              disabled={loading || syncing}
              title="Refresh sign-in times from fingerprint punches"
            >
              {syncing ? "Updating..." : "Update from punches"}
            </button>
          </div>
        )} */}
      </div>

      {/* Display Skeleton or Attendance Table based on loading state */}
      {loading ? (
        <SkeletonAttendanceTable />
      ) : attendanceData.length > 0 ? (
        <AttendanceTable date={formattedSelectedDate} data={attendanceData} />
      ) : (
        !isAttendanceGenerated && (
          <p>No attendance data for this date. Please generate one.</p>
        )
      )}
    </div>
  );
};

export default AdminAttendancePage;
