"use client";

import MosqueAttendanceTable from "@/components/MosqueAttendanceTable";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { toast } from "@/hooks/use-toast";
import type {
  EmployeeDoc, // ✅ use the exported type so it matches the function signature
} from "@/lib/appwrite/appwrite";
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
import { Calendar as CalendarIcon } from "lucide-react";

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
          title: "Exists",
          description: "Attendance already created for this date.",
          variant: "destructive",
        });
        setAttendanceData(existing);
        setIsAttendanceGenerated(true);
        setShowGenerateButton(false);
      } else {
        // ✅ fetch as the exported EmployeeDoc[]
        const employees = (await fetchAllEmployees()) as EmployeeDoc[];
        const mosqueAssistants = employees.filter(
          (e) =>
            (e.designation === "Council Assistant" ||
              e.designation === "Imam") &&
            e.section === "Mosque"
        );
        await createMosqueAttendanceForEmployees(
          formattedSelectedDate,
          mosqueAssistants // ✅ matches the function’s expected type
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

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-5 mt-10">Mosque Attendance</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
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
            onClick={() => fetchAttendanceData(formattedSelectedDate)}
            disabled={loading || !formattedSelectedDate}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

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
      </div>

      <div className="mt-10 mb-10">
        {formattedSelectedDate && (
          <PrayerTimesBanner dateISO={formattedSelectedDate} />
        )}
      </div>

      {loading ? (
        <SkeletonAttendanceTable />
      ) : attendanceData.length > 0 ? (
        <MosqueAttendanceTable
          date={formattedSelectedDate}
          data={attendanceData}
        />
      ) : (
        !isAttendanceGenerated && (
          <p>No attendance data for this date. Please generate one.</p>
        )
      )}
    </div>
  );
};

export default MosqueAttendancePage;
