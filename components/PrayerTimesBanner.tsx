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
import {
  Calendar as CalendarIcon,
  MapPin,
  Sunrise,
  Sunset,
  Sun,
  Moon,
} from "lucide-react";
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

        const json: Payload = await res.json();
        if (active) setData(json);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Error";
        if (active) setErr(message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [iso]);

  const prayerTimes = data
    ? [
        {
          label: "Fajr",
          value: data.times.fathisTime,
          icon: Moon,
          gradient: "from-indigo-500 to-purple-500",
        },
        {
          label: "Sunrise",
          value: data.times.sunrise,
          icon: Sunrise,
          gradient: "from-orange-400 to-amber-500",
        },
        {
          label: "Dhuhr",
          value: data.times.mendhuruTime,
          icon: Sun,
          gradient: "from-yellow-400 to-orange-500",
        },
        {
          label: "Asr",
          value: data.times.asuruTime,
          icon: Sun,
          gradient: "from-amber-500 to-orange-600",
        },
        {
          label: "Maghrib",
          value: data.times.maqribTime,
          icon: Sunset,
          gradient: "from-rose-500 to-pink-500",
        },
        {
          label: "Isha",
          value: data.times.ishaTime,
          icon: Moon,
          gradient: "from-blue-600 to-indigo-700",
        },
      ]
    : [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Decorative background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 opacity-50" />

      {/* Content */}
      <div className="relative p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Prayer Times
              </h3>
              <p className="text-xs text-slate-600">
                {EN_ATOLL}. {EN_ISLAND}
              </p>
            </div>
          </div>

          {/* Date picker */}
          <Popover open={isPickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 rounded-xl border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700">
                  {format(selectedDate, "PPP")}
                </span>
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
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <span className="text-sm text-slate-600">
                Loading prayer times...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{err}</p>
          </div>
        )}

        {/* Prayer times grid */}
        {!loading && !err && data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {prayerTimes.map((prayer, index) => {
              const Icon = prayer.icon;
              return (
                <PrayerTimeChip
                  key={index}
                  label={prayer.label}
                  value={prayer.value}
                  icon={<Icon className="h-4 w-4" />}
                  gradient={prayer.gradient}
                />
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !err && !data && (
          <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8">
            <p className="text-sm text-slate-500">No prayer times available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PrayerTimeChip({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      {/* Icon background */}
      <div
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} opacity-10 transition-opacity group-hover:opacity-20`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="relative">
        <div className="mb-1 flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-white shadow-sm`}
          >
            {icon}
          </div>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
        </div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
