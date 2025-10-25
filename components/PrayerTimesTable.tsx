"use client";

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
import React, { useEffect, useState } from "react";

/** Shape of a prayer-times document in your Appwrite collection */
type PrayerTimesDoc = {
  $id: string;
  date: string; // ISO string like "2025-01-14T00:00:00.000Z" or "2025-01-14"
  fathisTime: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};

/** Narrow unknown values returned from API into PrayerTimesDoc */
function isPrayerTimesDoc(v: unknown): v is PrayerTimesDoc {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.$id === "string" &&
    typeof o.date === "string" &&
    typeof o.fathisTime === "string" &&
    typeof o.mendhuruTime === "string" &&
    typeof o.asuruTime === "string" &&
    typeof o.maqribTime === "string" &&
    typeof o.ishaTime === "string"
  );
}

interface Props {
  selectedMonth: string; // "YYYY-MM"
}

const PrayerTimesTable: React.FC<Props> = ({ selectedMonth }) => {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimesDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const raw = await fetchPrayerTimesForMonth(selectedMonth);
        // Defensive narrowing to our doc type
        const docs = Array.isArray(raw) ? raw.filter(isPrayerTimesDoc) : [];
        if (!cancelled) setPrayerTimes(docs);
      } catch (err) {
        console.error("Error fetching prayer times:", err);
        if (!cancelled) setPrayerTimes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (selectedMonth) run();

    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  // Format header month (fallback to raw string if Date fails)
  const headerLabel = (() => {
    const d = new Date(`${selectedMonth}-01T00:00:00Z`);
    return isNaN(d.getTime()) ? selectedMonth : format(d, "MMMM yyyy");
  })();

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">
        Prayer Times for {headerLabel}
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
            {prayerTimes.map((p) => {
              // Accept either full ISO or YYYY-MM-DD
              const dateObj = new Date(
                p.date.length > 10 ? p.date : `${p.date}T00:00:00Z`
              );
              const dateLabel = isNaN(dateObj.getTime())
                ? p.date
                : format(dateObj, "dd MMM yyyy");

              return (
                <TableRow key={p.$id}>
                  <TableCell>{dateLabel}</TableCell>
                  <TableCell>{p.fathisTime || "N/A"}</TableCell>
                  <TableCell>{p.mendhuruTime || "N/A"}</TableCell>
                  <TableCell>{p.asuruTime || "N/A"}</TableCell>
                  <TableCell>{p.maqribTime || "N/A"}</TableCell>
                  <TableCell>{p.ishaTime || "N/A"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p>No prayer times available for the selected month.</p>
      )}
    </div>
  );
};

export default PrayerTimesTable;
