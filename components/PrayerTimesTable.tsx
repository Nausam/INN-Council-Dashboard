"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchPrayerTimesForMonth } from "@/lib/appwrite/appwrite";
import { format } from "date-fns";

const PrayerTimesTable = ({ selectedMonth }: { selectedMonth: string }) => {
  const [prayerTimes, setPrayerTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPrayerTimes = async () => {
      setLoading(true);
      try {
        const prayerTimesData = await fetchPrayerTimesForMonth(selectedMonth);
        setPrayerTimes(prayerTimesData);
      } catch (error) {
        console.error("Error fetching prayer times:", error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedMonth) {
      fetchPrayerTimes();
    }
  }, [selectedMonth]);

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">
        Prayer Times for {format(new Date(`${selectedMonth}-01`), "MMMM yyyy")}
      </h2>

      {loading ? (
        <p>Loading prayer times...</p>
      ) : prayerTimes.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Fajr</TableHead>
              <TableHead>Dhuhr</TableHead>
              <TableHead>Asr</TableHead>
              <TableHead>Maghrib</TableHead>
              <TableHead>Isha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prayerTimes.map((prayer, index) => (
              <TableRow key={index}>
                <TableCell>
                  {format(new Date(prayer.date), "dd MMM yyyy")}
                </TableCell>
                <TableCell>{prayer.fathisTime || "N/A"}</TableCell>
                <TableCell>{prayer.mendhuruTime || "N/A"}</TableCell>
                <TableCell>{prayer.asuruTime || "N/A"}</TableCell>
                <TableCell>{prayer.maqribTime || "N/A"}</TableCell>
                <TableCell>{prayer.ishaTime || "N/A"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p>No prayer times available for the selected month.</p>
      )}
    </div>
  );
};

export default PrayerTimesTable;
