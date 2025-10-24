"use client";

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
import { useEffect, useMemo, useState } from "react";

type Times = {
  fathisTime: string;
  sunrise: string;
  mendhuruTime: string;
  asuruTime: string;
  maqribTime: string;
  ishaTime: string;
};
type Payload = {
  island: { atoll: string; island: string; tz: string; offsetMinutes: number };
  date: string;
  times: Times;
};

const EN_ATOLL = "R";
const EN_ISLAND = "Innamaadhoo";

export default function PrayerTimesBanner({ dateISO }: { dateISO: string }) {
  // Local date selection (seeded from prop)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  });
  const [isPickerOpen, setPickerOpen] = useState(false);

  // Always compute current ISO from selectedDate
  const iso = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If parent changes dateISO, reflect it here too
  useEffect(() => {
    const [y, m, d] = dateISO.split("-").map(Number);
    const incoming = new Date(y, m - 1, d);
    // only update if different day
    if (
      incoming.getFullYear() !== selectedDate.getFullYear() ||
      incoming.getMonth() !== selectedDate.getMonth() ||
      incoming.getDate() !== selectedDate.getDate()
    ) {
      setSelectedDate(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  // Fetch when iso changes
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setData(null);
        const res = await fetch(`/api/innamaadhoo?date=${iso}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load: ${await res.text()}`);
        const json = (await res.json()) as Payload;
        if (active) setData(json);
      } catch (e: any) {
        if (active) setErr(String(e?.message || e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [iso]);

  return (
    <div className="border rounded-md p-4 text-sm text-gray-700">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-2">
        {/* Force English label regardless of what DB returns */}
        <span>
          <span className="text-gray-600">Island:</span>{" "}
          {`${EN_ATOLL}. ${EN_ISLAND}`}
        </span>

        <div className="flex items-center gap-3">
          {/* Date picker */}
          <Popover open={isPickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("h-9 w-auto justify-start text-left font-normal")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (d) {
                    setSelectedDate(d);
                    setPickerOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* <span className="text-gray-500">Date: {iso}</span> */}
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {!loading && !err && data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Chip label="Fajr" value={data.times.fathisTime} />
          <Chip label="Sunrise" value={data.times.sunrise} />
          <Chip label="Dhuhr" value={data.times.mendhuruTime} />
          <Chip label="Asr" value={data.times.asuruTime} />
          <Chip label="Maghrib" value={data.times.maqribTime} />
          <Chip label="Isha" value={data.times.ishaTime} />
        </div>
      )}

      {!loading && !err && !data && <div>—</div>}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-50 border px-3 py-2 flex items-center justify-between">
      <span className="font-medium">{label}</span>
      <span>{value}</span>
    </div>
  );
}
