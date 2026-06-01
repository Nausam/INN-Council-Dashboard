"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrayerTimesMonthQuery } from "@/hooks/queries";
import { format } from "date-fns";
import React, { useMemo } from "react";

type PrayerTimesDoc = {
  $id: string;
  date: string;
  fathisTime: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};

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
  selectedMonth: string;
}

const PrayerTimesTable: React.FC<Props> = ({ selectedMonth }) => {
  const { data: raw, isLoading } = usePrayerTimesMonthQuery(selectedMonth);

  const prayerTimes = useMemo(
    () => (Array.isArray(raw) ? raw.filter(isPrayerTimesDoc) : []),
    [raw],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (prayerTimes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No prayer times found for this month.
      </p>
    );
  }

  return (
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
        {prayerTimes.map((pt) => (
          <TableRow key={pt.$id}>
            <TableCell>
              {format(new Date(pt.date), "MMM dd, yyyy")}
            </TableCell>
            <TableCell>{pt.fathisTime}</TableCell>
            <TableCell>{pt.mendhuruTime}</TableCell>
            <TableCell>{pt.asuruTime}</TableCell>
            <TableCell>{pt.maqribTime}</TableCell>
            <TableCell>{pt.ishaTime}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PrayerTimesTable;
