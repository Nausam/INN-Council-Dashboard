"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(y, m - 1, d);
  });
  const [isPickerOpen, setPickerOpen] = useState(false);

  const iso = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const [y, m, d] = dateISO.split("-").map(Number);
    const incoming = new Date(y, m - 1, d);
    if (
      incoming.getFullYear() !== selectedDate.getFullYear() ||
      incoming.getMonth() !== selectedDate.getMonth() ||
      incoming.getDate() !== selectedDate.getDate()
    ) {
      setSelectedDate(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

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
          gradient: "from-indigo-500 to-violet-500",
        },
        {
          label: "Sunrise",
          value: data.times.sunrise,
          icon: Sunrise,
          gradient: "from-amber-500 to-orange-500",
        },
        {
          label: "Dhuhr",
          value: data.times.mendhuruTime,
          icon: Sun,
          gradient: "from-violet-500 to-purple-500",
        },
        {
          label: "Asr",
          value: data.times.asuruTime,
          icon: Sun,
          gradient: "from-indigo-500 to-purple-500",
        },
        {
          label: "Maghrib",
          value: data.times.maqribTime,
          icon: Sunset,
          gradient: "from-red-500 to-rose-500",
        },
        {
          label: "Isha",
          value: data.times.ishaTime,
          icon: Moon,
          gradient: "from-blue-500 to-indigo-500",
        },
      ]
    : [];

  return (
    <div
      className="
        relative overflow-hidden
        rounded-3xl
        bg-white/80 backdrop-blur-xl
        shadow-sm ring-1 ring-slate-200/60
      "
      style={{ animation: "fadeInUp 320ms ease-out" }}
    >
      {/* subtle wash (no hover group) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 opacity-80" />

      <div className="relative p-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* reduced glow */}
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/15 blur-lg" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
                <MapPin className="h-6 w-6" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  Prayer Times
                </h3>
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200/70">
                  {EN_ATOLL}. {EN_ISLAND}
                </span>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">
                Pick a date to view today’s timings
              </p>
            </div>
          </div>

          {/* Date picker */}
          <Popover open={isPickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  `
                  h-11 rounded-2xl
                  border-2 border-slate-200
                  bg-white/80 backdrop-blur-sm
                  px-4
                  text-sm font-bold text-slate-700
                  shadow-none
                  transition-colors duration-200
                  hover:border-indigo-300 hover:bg-white
                `
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                <span>{format(selectedDate, "PPP")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto rounded-3xl border-0 bg-white/95 p-0 shadow-lg ring-1 ring-slate-200/60 backdrop-blur-2xl"
              align="end"
            >
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

        {/* Loading */}
        {loading && (
          <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-slate-200/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  Loading prayer times…
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  Fetching latest data for {iso}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {err && !loading && (
          <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-red-200/60 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-sm">
                <span className="text-sm font-black">!</span>
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">
                  Couldn’t load
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {err}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        {!loading && !err && data && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {prayerTimes.map((p, index) => {
              const Icon = p.icon;
              return (
                <PrayerTimeChip
                  key={index}
                  label={p.label}
                  value={p.value}
                  icon={<Icon className="h-4 w-4" />}
                  gradient={p.gradient}
                  delayMs={index * 40}
                />
              );
            })}
          </div>
        )}

        {/* Empty */}
        {!loading && !err && !data && (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white py-12">
            <div className="mx-auto flex max-w-sm flex-col items-center px-6 text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-slate-200/60 blur-lg" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 ring-4 ring-slate-200/50">
                  <MapPin className="h-8 w-8 text-slate-400" />
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                No prayer times
              </h3>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Try selecting another date.
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function PrayerTimeChip({
  label,
  value,
  icon,
  gradient,
  delayMs = 0,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  delayMs?: number;
}) {
  return (
    <div
      className="
        relative overflow-hidden
        rounded-3xl
        bg-white/90
        p-4
        shadow-sm ring-1 ring-slate-200/60
        transition-transform duration-200 ease-out
        hover:-translate-y-0.5
      "
      style={{
        animation: `fadeInUp 300ms ease-out ${delayMs}ms both`,
      }}
    >
      {/* tiny, per-card hover accent (individual) */}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-200 hover:opacity-0",
          `bg-gradient-to-br ${gradient}`
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-200",
          `bg-gradient-to-br ${gradient}`
        )}
      />
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 hover:opacity-0" />

      {/* Use Tailwind group only inside chip so it affects only this chip */}
      <div className="group">
        <div
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-15",
            `bg-gradient-to-br ${gradient}`
          )}
        />
        <div
          className="
            pointer-events-none absolute inset-0
            opacity-0
            bg-gradient-to-r from-transparent via-white/35 to-transparent
            transition-opacity duration-200
            group-hover:opacity-100
          "
        />

        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-2">
            <div className="relative">
              <div
                className={cn(
                  "absolute inset-0 rounded-2xl opacity-0 blur-lg transition-opacity duration-200 group-hover:opacity-20",
                  `bg-gradient-to-br ${gradient}`
                )}
              />
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105",
                  `bg-gradient-to-br ${gradient}`
                )}
              >
                {icon}
              </div>
            </div>

            <p className="text-xs font-bold tracking-wider text-slate-600">
              {label.toUpperCase()}
            </p>
          </div>

          <p className="text-2xl font-black tracking-tight text-slate-900">
            {value}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
