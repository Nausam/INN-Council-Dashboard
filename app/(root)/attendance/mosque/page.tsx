"use client";
import { useEffect, useState } from "react";
import AttendanceTable from "@/components/AttendanceTable";
import {
  createAttendanceForEmployees,
  fetchAllEmployees,
  fetchAttendanceForDate,
} from "@/lib/appwrite";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const MosqueAttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAttendanceGenerated, setIsAttendanceGenerated] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const formattedSelectedDate = selectedDate
    ? new Date(
        selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0]
    : "";

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setIsPopoverOpen(false);
  };

  useEffect(() => {
    setAttendanceData([]);
    setShowGenerateButton(false);
  }, [selectedDate]);

  // Fetch attendance for the selected date
  const fetchAttendanceData = async (date: string) => {
    setLoading(true);
    try {
      const attendance = await fetchAttendanceForDate(date);
      if (attendance.length > 0) {
        setAttendanceData(attendance);
        setIsAttendanceGenerated(true);
        date;
      } else {
        setAttendanceData([]);
        setIsAttendanceGenerated(false);
        setShowGenerateButton(true);
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  // Handle generating attendance for a date if it doesn't exist
  const handleGenerateAttendance = async () => {
    setLoading(true);
    try {
      const attendance = await fetchAttendanceForDate(formattedSelectedDate);

      if (attendance.length > 0) {
        toast({
          title: "Success",
          description: "Attendance already created for this date",
          variant: "destructive",
        });

        setAttendanceData(attendance);
      } else {
        const employees = await fetchAllEmployees();
        const newAttendance = await createAttendanceForEmployees(
          formattedSelectedDate,
          employees
        );
        setAttendanceData(newAttendance);
        setShowGenerateButton(false);
        toast({
          title: "Success",
          description: "Attendance sheet created for today",
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
    fetchAttendanceData(formattedSelectedDate);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Attendance</h1>

      {/* Date Picker and Apply Button */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Select Date</p>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
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
            className="custom-button w-full  h-12"
            onClick={() => fetchAttendanceData(formattedSelectedDate)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Search"}
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

export default MosqueAttendancePage;
