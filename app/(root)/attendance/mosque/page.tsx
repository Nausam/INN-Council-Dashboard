"use client";

import MosqueAttendanceTable from "@/components/MosqueAttendanceTable";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { toast } from "@/hooks/use-toast";
import type { EmployeeDoc } from "@/lib/appwrite/appwrite";
import {
  createMosqueAttendanceForEmployees,
  fetchAllEmployees,
  fetchMosqueAttendanceForDate,
} from "@/lib/appwrite/appwrite";
import type { MosqueAttendanceRecord } from "@/types";
import { useEffect, useMemo, useState } from "react";

import PrayerTimesBanner from "@/components/PrayerTimesBanner";
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
  Building2,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";

type AttendanceDoc = MosqueAttendanceRecord;

const MosqueAttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [attendanceData, setAttendanceData] = useState<AttendanceDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAttendanceGenerated, setIsAttendanceGenerated] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

  const fetchAttendanceData = async (date: string) => {
    if (!date) return;
    setLoading(true);
    try {
      const attendance = (await fetchMosqueAttendanceForDate(
        date
      )) as AttendanceDoc[];

      if (attendance.length > 0) {
        setAttendanceData(attendance);
        setIsAttendanceGenerated(true);
        setShowGenerateButton(false);
      } else {
        setAttendanceData([]);
        setIsAttendanceGenerated(false);
        setShowGenerateButton(true);
      }
    } catch (error) {
      console.error("Error fetching mosque attendance:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance for the selected date.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAttendance = async () => {
    if (!formattedSelectedDate) return;
    setLoading(true);
    try {
      const existing = (await fetchMosqueAttendanceForDate(
        formattedSelectedDate
      )) as AttendanceDoc[];

      if (existing.length > 0) {
        toast({
          title: "Already exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        setAttendanceData(existing);
        setIsAttendanceGenerated(true);
        setShowGenerateButton(false);
      } else {
        const employees = (await fetchAllEmployees()) as EmployeeDoc[];
        const mosqueAssistants = employees.filter(
          (e) =>
            (e.designation === "Council Assistant" ||
              e.designation === "Imam") &&
            e.section === "Mosque"
        );
        await createMosqueAttendanceForEmployees(
          formattedSelectedDate,
          mosqueAssistants
        );
        toast({
          title: "Success",
          description: "Attendance sheet created for mosque assistants.",
          variant: "success",
        });
        await fetchAttendanceData(formattedSelectedDate);
      }
    } catch (error) {
      console.error("Error generating mosque attendance:", error);
      toast({
        title: "Error",
        description: "Failed to generate attendance.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (formattedSelectedDate) {
      fetchAttendanceData(formattedSelectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedSelectedDate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Mosque Attendance
              </h1>
              <p className="mt-1 text-slate-600">
                Track daily prayer attendance for mosque staff
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
                      "h-11 w-full justify-start rounded-xl border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-md lg:w-64",
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              onClick={() => fetchAttendanceData(formattedSelectedDate)}
              disabled={loading || !formattedSelectedDate}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading...
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

        {/* Prayer Times Banner */}
        {formattedSelectedDate && (
          <div className="mb-8">
            <PrayerTimesBanner dateISO={formattedSelectedDate} />
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <SkeletonAttendanceTable />
        ) : attendanceData.length > 0 ? (
          <MosqueAttendanceTable
            date={formattedSelectedDate}
            data={attendanceData}
          />
        ) : (
          !isAttendanceGenerated && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 px-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
                <Building2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">
                No attendance data found
              </h3>
              <p className="mb-4 text-center text-sm text-slate-600">
                No mosque attendance records exist for the selected date.
                <br />
                Generate a new attendance sheet to get started.
              </p>
              {showGenerateButton && (
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600"
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

export default MosqueAttendancePage;
