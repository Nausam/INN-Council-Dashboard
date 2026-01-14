/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import AttendanceTable from "@/components/AttendanceTable";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { toast } from "@/hooks/use-toast";
import type { EmployeeDoc } from "@/lib/appwrite/appwrite";
import {
  createAttendanceForEmployeesAction,
  fetchAllEmployeesAction,
  fetchAttendanceForDateAction,
  syncAttendanceForDateAction,
} from "@/lib/attendance/attendance.actions";
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
import {
  Calendar as CalendarIcon,
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";

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
      const result = await fetchAttendanceForDateAction(date);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch attendance");
      }

      const raw = result.data || [];

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
    } catch (error: any) {
      console.error("Error loading attendance:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to load attendance for the selected date.",
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
      const result = await syncAttendanceForDateAction(formattedSelectedDate);

      if (!result.success) {
        throw new Error(result.error || "Failed to sync");
      }

      const updated = result.updated || 0;

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
      // Re-fetch to reflect changes
      await fetchAttendanceData(formattedSelectedDate);
    }
  };

  // Generate attendance for date if it doesn't exist
  const handleGenerateAttendance = async () => {
    if (!formattedSelectedDate) return;
    setLoading(true);
    try {
      const existingResult = await fetchAttendanceForDateAction(
        formattedSelectedDate
      );

      if (!existingResult.success) {
        throw new Error(
          existingResult.error || "Failed to check existing attendance"
        );
      }

      const existing = existingResult.data || [];

      if (existing.length > 0) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        setAttendanceData(normalize(existing));
      } else {
        const employeesResult = await fetchAllEmployeesAction();

        if (!employeesResult.success) {
          throw new Error(employeesResult.error || "Failed to fetch employees");
        }

        const employees = employeesResult.data as EmployeeDoc[];

        const createResult = await createAttendanceForEmployeesAction(
          formattedSelectedDate,
          employees
        );

        if (!createResult.success) {
          throw new Error(createResult.error || "Failed to create attendance");
        }

        const created = createResult.data || [];
        setAttendanceData(normalize(created));
        setShowGenerateButton(false);
        toast({
          title: "Success",
          description: "Attendance sheet created.",
          variant: "success",
        });
      }
    } catch (error: any) {
      console.error("Error creating attendance:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create attendance.",
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Attendance Management
              </h1>
              <p className="mt-1 text-slate-600">
                Manage daily attendance records for all employees
              </p>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
            {/* Date Picker */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Select Date
              </label>
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 w-full justify-start rounded-xl border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md lg:w-64",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                    {selectedDate ? (
                      <span className="font-medium text-slate-700">
                        {format(selectedDate, "PPP")}
                      </span>
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Search Button */}
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              onClick={() => fetchAttendanceData(formattedSelectedDate, true)}
              disabled={loading || syncing}
              title="Search & update from punches"
            >
              {loading || syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search
                </>
              )}
            </button>

            {/* Generate Button */}
            {showGenerateButton && (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                onClick={handleGenerateAttendance}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Generate Attendance
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <SkeletonAttendanceTable />
        ) : attendanceData.length > 0 ? (
          <AttendanceTable date={formattedSelectedDate} data={attendanceData} />
        ) : (
          !isAttendanceGenerated && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 px-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <ClipboardList className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">
                No attendance data found
              </h3>
              <p className="mb-4 text-center text-sm text-slate-600">
                No attendance records exist for the selected date.
                <br />
                Generate a new attendance sheet to get started.
              </p>
              {showGenerateButton && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-600"
                  onClick={handleGenerateAttendance}
                  disabled={loading}
                >
                  <Plus className="h-4 w-4" />
                  Generate Attendance
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AdminAttendancePage;
