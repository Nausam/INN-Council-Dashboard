"use client";

import { CouncilCard, CouncilDatePicker } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Moon,
  Sunrise,
  Sun,
  Sunset,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

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

  const handleDateChange = (value: string) => {
    if (!value) return;
    const [y, m, d] = value.split("-").map(Number);
    setSelectedDate(new Date(y, m - 1, d));
  };

  const prayerTimes = data
    ? [
        { label: "Fajr", value: data.times.fathisTime, icon: Moon, tone: "teal" },
        {
          label: "Sunrise",
          value: data.times.sunrise,
          icon: Sunrise,
          tone: "amber",
        },
        { label: "Dhuhr", value: data.times.mendhuruTime, icon: Sun, tone: "cyan" },
        { label: "Asr", value: data.times.asuruTime, icon: Sun, tone: "sky" },
        {
          label: "Maghrib",
          value: data.times.maqribTime,
          icon: Sunset,
          tone: "orange",
        },
        { label: "Isha", value: data.times.ishaTime, icon: Moon, tone: "indigo" },
      ]
    : [];

  return (
    <CouncilCard interactive="none" className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Prayer times
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200/80">
                {EN_ATOLL}. {EN_ISLAND}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              Reference timings for mosque attendance
            </p>
          </div>
        </div>

        <div className="w-full sm:max-w-[240px]">
          <CouncilDatePicker
            value={iso}
            onChange={handleDateChange}
            icon={CalendarDays}
            placeholder="Pick date"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/60">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <div>
              <p className="text-sm font-bold text-slate-900">
                Loading prayer times…
              </p>
              <p className="text-xs font-medium text-slate-500">
                Fetching data for {format(selectedDate, "PPP")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {err && !loading ? (
        <div className="rounded-2xl border border-red-200/80 bg-red-50/80 p-4 ring-1 ring-red-100">
          <p className="text-sm font-bold text-red-900">Could not load times</p>
          <p className="mt-1 text-sm font-medium text-red-700/90">{err}</p>
        </div>
      ) : null}

      {!loading && !err && data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {prayerTimes.map((p) => (
            <PrayerTimeChip
              key={p.label}
              label={p.label}
              value={p.value}
              icon={p.icon}
              tone={p.tone}
            />
          ))}
        </div>
      ) : null}

      {!loading && !err && !data ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 py-10 text-center">
          <p className="text-sm font-semibold text-slate-600">
            No prayer times for this date.
          </p>
        </div>
      ) : null}
    </CouncilCard>
  );
}

const toneStyles: Record<string, { chip: string; icon: string }> = {
  teal: { chip: "ring-teal-100", icon: "bg-teal-50 text-teal-600" },
  amber: { chip: "ring-amber-100", icon: "bg-amber-50 text-amber-600" },
  cyan: { chip: "ring-cyan-100", icon: "bg-cyan-50 text-cyan-600" },
  sky: { chip: "ring-sky-100", icon: "bg-sky-50 text-sky-600" },
  orange: { chip: "ring-orange-100", icon: "bg-orange-50 text-orange-600" },
  indigo: { chip: "ring-indigo-100", icon: "bg-indigo-50 text-indigo-600" },
};

function PrayerTimeChip({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  const styles = toneStyles[tone] ?? toneStyles.teal;

  return (
    <div
      className={cn(
        "rounded-2xl bg-white p-3 ring-1 transition-transform duration-200 hover:-translate-y-0.5",
        styles.chip,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            styles.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
      </div>
      <p className="text-xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
