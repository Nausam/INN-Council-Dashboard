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

  // Define the custom order for employees
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
      // Helper to get employee name from the record
      const getEmployeeName = (record: AttendanceDoc): string => {
        const emp = record.employeeId;
        if (typeof emp === "string") return emp;
        return emp?.name || emp?.$id || "";
      };

      const nameA = getEmployeeName(a);
      const nameB = getEmployeeName(b);

      const indexA = employeeOrder.indexOf(nameA);
      const indexB = employeeOrder.indexOf(nameB);

      // If both are in the order list, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in the list, it comes first
      if (indexA !== -1) return -1;
      // If only B is in the list, it comes first
      if (indexB !== -1) return 1;
      // If neither is in the list, sort alphabetically
      return nameA.localeCompare(nameB);
    });
  };

  const fetchAttendanceData = async (date: string) => {
    if (!date) return;
    setLoading(true);
    try {
      const attendance = (await fetchMosqueAttendanceForDate(
        date
      )) as AttendanceDoc[];

      if (attendance.length > 0) {
        // Sort the attendance data by the custom employee order
        const sortedAttendance = sortAttendanceByEmployeeOrder(attendance);
        setAttendanceData(sortedAttendance);
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
        // Fetch prayer times for the selected date
        let prayerTimes: {
          fathisTime: string;
          mendhuruTime: string;
          asuruTime: string;
          maqribTime: string;
          ishaTime: string;
        } | null = null;

        try {
          // Try fetching from salat.db first
          const { fetchInnamaadhooTimes } = await import("@/lib/salat-client");
          const salat = await fetchInnamaadhooTimes(formattedSelectedDate);
          if (salat && salat.times) {
            prayerTimes = salat.times;
            console.log("Prayer times from salat.db:", prayerTimes);
          }
        } catch (error) {
          console.log("Failed to fetch from salat.db, trying Appwrite:", error);
          // Fallback to Appwrite prayerTimes collection
          try {
            const { fetchPrayerTimesByDate } = await import(
              "@/lib/appwrite/appwrite"
            );
            const fetched = await fetchPrayerTimesByDate(formattedSelectedDate);
            if (fetched) {
              prayerTimes = {
                fathisTime: fetched.fathisTime,
                mendhuruTime: fetched.mendhuruTime,
                asuruTime: fetched.asuruTime,
                maqribTime: fetched.maqribTime,
                ishaTime: fetched.ishaTime,
              };
              console.log("Prayer times from Appwrite:", prayerTimes);
            }
          } catch (appwriteError) {
            console.error(
              "Failed to fetch prayer times from Appwrite:",
              appwriteError
            );
          }
        }

        if (!prayerTimes) {
          console.warn("No prayer times available for prefilling");
          toast({
            title: "Warning",
            description:
              "Prayer times not found. Attendance created without prefilled times.",
            variant: "default",
          });
        }

        const employees = (await fetchAllEmployees()) as EmployeeDoc[];
        const mosqueAssistants = employees.filter(
          (e) =>
            (e.designation === "Council Assistant" ||
              e.designation === "Imam") &&
            e.section === "Mosque"
        );

        // Helper to subtract minutes from HH:MM time string
        const subtractMinutes = (timeStr: string, minutes: number): string => {
          const [hours, mins] = timeStr.split(":").map(Number);
          const totalMinutes = hours * 60 + mins - minutes;
          const newHours = Math.floor(totalMinutes / 60);
          const newMins = totalMinutes % 60;
          return `${String(newHours).padStart(2, "0")}:${String(
            newMins
          ).padStart(2, "0")}`;
        };

        // Helper to convert HH:MM to ISO datetime string for the selected date
        const timeToDateTime = (timeStr: string, dateStr: string): string => {
          return `${dateStr}T${timeStr}:00.000+00:00`;
        };

        // Create attendance records with prefilled prayer times
        const prefilledConfig = prayerTimes
          ? {
              getPrefilledTimes: (designation: string) => {
                const graceMinutes = designation === "Imam" ? 5 : 15;
                console.log(
                  `Creating prefilled times for ${designation} with ${graceMinutes} min grace`
                );

                const times = {
                  fathisSignInTime: timeToDateTime(
                    subtractMinutes(prayerTimes!.fathisTime, graceMinutes),
                    formattedSelectedDate
                  ),
                  mendhuruSignInTime: timeToDateTime(
                    subtractMinutes(prayerTimes!.mendhuruTime, graceMinutes),
                    formattedSelectedDate
                  ),
                  asuruSignInTime: timeToDateTime(
                    subtractMinutes(prayerTimes!.asuruTime, graceMinutes),
                    formattedSelectedDate
                  ),
                  maqribSignInTime: timeToDateTime(
                    subtractMinutes(prayerTimes!.maqribTime, graceMinutes),
                    formattedSelectedDate
                  ),
                  ishaSignInTime: timeToDateTime(
                    subtractMinutes(prayerTimes!.ishaTime, graceMinutes),
                    formattedSelectedDate
                  ),
                };

                console.log("Prefilled times:", times);
                return times;
              },
            }
          : undefined;

        console.log("Mosque assistants count:", mosqueAssistants.length);
        console.log("Has prefilled config:", !!prefilledConfig);

        await createMosqueAttendanceForEmployees(
          formattedSelectedDate,
          mosqueAssistants,
          prefilledConfig
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
