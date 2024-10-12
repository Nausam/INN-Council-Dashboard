"use client";
import { useEffect, useState } from "react";
import AttendanceTable from "@/components/AttendanceTable";
import {
  createAttendanceForEmployees,
  fetchAllEmployees,
  fetchAttendanceForDate,
} from "@/lib/appwrite";
import SkeletonAttendanceTable from "@/components/skeletons/SkeletonAttendanceTable";

const AttendancePage = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAttendanceGenerated, setIsAttendanceGenerated] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);

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
      const attendance = await fetchAttendanceForDate(selectedDate);

      if (attendance.length > 0) {
        alert("Attendance already created for this date.");
        setAttendanceData(attendance);
      } else {
        const employees = await fetchAllEmployees();
        const newAttendance = await createAttendanceForEmployees(
          selectedDate,
          employees
        );
        setAttendanceData(newAttendance);
        setShowGenerateButton(false);
        alert("Attendance created for today!");
      }
    } catch (error) {
      console.error("Error:", error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Attendance</h1>

      {/* Date Picker and Apply Button */}
      <div className="flex mb-10 gap-4 items-center">
        <div>
          <p>Select Date</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border p-2"
          />
        </div>

        <div>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
            onClick={() => fetchAttendanceData(selectedDate)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply Date"}
          </button>
        </div>

        {/* Show message and generate button if no attendance is found */}
        {showGenerateButton && (
          <div className="mt-4">
            <button
              className="bg-green-500 text-white px-4 py-2 rounded shadow-md"
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
        <AttendanceTable date={selectedDate} data={attendanceData} />
      ) : (
        !isAttendanceGenerated && (
          <p>No attendance data for this date. Please generate one.</p>
        )
      )}
    </div>
  );
};

export default AttendancePage;
