"use client";
import MosqueAttendanceTable from "@/components/MosqueAttendanceTable";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";
import { toast } from "@/hooks/use-toast";
import {
  createMosqueAttendanceForEmployees,
  fetchAllEmployees,
  fetchMosqueAttendanceForDate,
} from "@/lib/appwrite/appwrite";
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
import { useUser } from "@/Providers/UserProvider";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

/** API payload shape from /api/innamaadhoo */
type InnamaadhooApi = {
  island: {
    atoll: string;
    island: string;
    tz: string;
    offsetMinutes: number;
  };
  date: string; // YYYY-MM-DD
  times: {
    fathisTime: string; // Fajr
    sunrise: string; // Sunrise
    mendhuruTime: string; // Dhuhr
    asuruTime: string; // Asr
    maqribTime: string; // Maghrib
    ishaTime: string; // Isha
  };
};

const MosqueAttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAttendanceGenerated, setIsAttendanceGenerated] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Prayer times state (new)
  const [ptLoading, setPtLoading] = useState(false);
  const [ptError, setPtError] = useState<string | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<InnamaadhooApi | null>(null);

  const { currentUser, isAdmin, loading: userLoading } = useUser();

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
  }, [selectedDate]);

  // === Fetch prayer times whenever date changes (no change to attendance flow) ===
  useEffect(() => {
    if (!formattedSelectedDate) return;
    let cancelled = false;

    const run = async () => {
      setPtLoading(true);
      setPtError(null);
      try {
        const res = await fetch(
          `/api/innamaadhoo?date=${formattedSelectedDate}`,
          {
            cache: "no-store",
          }
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            j?.error || `Failed to load prayer times (${res.status})`
          );
        }
        const data: InnamaadhooApi = await res.json();
        if (!cancelled) setPrayerTimes(data);
      } catch (err: any) {
        if (!cancelled) {
          setPrayerTimes(null);
          setPtError(err?.message || "Failed to load prayer times.");
        }
      } finally {
        if (!cancelled) setPtLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [formattedSelectedDate]);

  // Fetch attendance for the selected date (unchanged)
  const fetchAttendanceData = async (date: string) => {
    setLoading(true);
    try {
      const attendance = await fetchMosqueAttendanceForDate(date);
      if (attendance.length > 0) {
        setAttendanceData(attendance);
        setIsAttendanceGenerated(true);
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

  // Generate attendance (unchanged)
  const handleGenerateAttendance = async () => {
    setLoading(true);
    try {
      const attendance = await fetchMosqueAttendanceForDate(
        formattedSelectedDate
      );

      if (attendance.length > 0) {
        toast({
          title: "Success",
          description: "Attendance already created for this date",
          variant: "destructive",
        });

        setAttendanceData(attendance);
      } else {
        const employees = await fetchAllEmployees();
        const mosqueAssistants = employees.filter(
          (employee) => employee.designation === "Mosque Assistant"
        );
        const newAttendance = await createMosqueAttendanceForEmployees(
          formattedSelectedDate,
          mosqueAssistants
        );
        setAttendanceData(newAttendance);
        setShowGenerateButton(false);
        toast({
          title: "Success",
          description: "Attendance sheet created for mosque assistants",
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
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-5 mt-10">Mosque Attendance</h1>

      {/* Date Picker and Apply Button */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
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
            className="custom-button w-full h-12"
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

      {/* --- Prayer Times Card (Innamaadhoo) --- */}
      <div className="mt-10 mb-10">
        {formattedSelectedDate && (
          <PrayerTimesBanner dateISO={formattedSelectedDate} />
        )}
      </div>

      {/* Display Skeleton or Attendance Table based on loading state (unchanged) */}
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
