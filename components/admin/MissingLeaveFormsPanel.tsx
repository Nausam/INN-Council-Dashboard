"use client";

import { AvatarPhoto } from "@/components/design-system/avatar-photo";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { useToast } from "@/hooks/use-toast";
import {
  listMissingLeaveForms,
  remindMissingLeaveForms,
  type MissingLeaveFormRow,
  type MissingLeaveFormsList,
} from "@/lib/actions/employee-push.actions";
import { maldivesTodayIso } from "@/lib/employees/details-dashboard";
import { employeePhotoUrl } from "@/lib/employees/photo";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Bell, BellOff, BellRing, Check, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Preset = "7" | "14" | "30" | "custom";

const PRESETS: Array<{ id: Exclude<Preset, "custom">; label: string; days: number }> = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "14", label: "Last 14 days", days: 14 },
  { id: "30", label: "Last 30 days", days: 30 },
];

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Up to yesterday: today isn't over, so nobody is missing a form for it yet. */
function presetRange(days: number): { start: string; end: string } {
  const end = addDaysIso(maldivesTodayIso(), -1);
  return { start: addDaysIso(end, -(days - 1)), end };
}

function dayParts(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: date.getUTCDate(),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

export function MissingLeaveFormsPanel() {
  const { toast } = useToast();
  const [preset, setPreset] = useState<Preset>("7");
  const [range, setRange] = useState(() => presetRange(7));
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<MissingLeaveFormsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<"all" | string | null>(null);
  const [reminded, setReminded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!range.start || !range.end) return;
    let active = true;
    setLoading(true);
    void listMissingLeaveForms(range.start, range.end)
      .then((next) => {
        if (!active) return;
        setList(next);
      })
      .catch(() => {
        if (active) setList({ configured: true, employees: [], error: "Couldn't load the list." });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, revision]);

  // "Reminded" marks last until a different range is picked.
  useEffect(() => setReminded(new Set()), [range]);

  const employees = useMemo(() => list?.employees ?? [], [list]);
  const reachable = employees.filter((row) => row.alertsOn && !reminded.has(row.employeeId));
  const unreachable = employees.filter((row) => !row.alertsOn);
  const totalDays = employees.reduce((total, row) => total + row.dates.length, 0);
  const canSend = Boolean(list?.configured) && !sending && !loading;

  const choosePreset = (next: (typeof PRESETS)[number]) => {
    setPreset(next.id);
    setRange(presetRange(next.days));
  };

  const setCustom = (key: "start" | "end", value: string) => {
    setPreset("custom");
    setRange((current) => ({ ...current, [key]: value }));
  };

  async function remind(employeeIds: string[] | null) {
    const count = employeeIds ? employeeIds.length : reachable.length;
    if (!employeeIds && !window.confirm(`Send leave form reminders to ${count} ${count === 1 ? "employee" : "employees"}?`)) return;
    setSending(employeeIds ? employeeIds[0] : "all");
    try {
      const result = await remindMissingLeaveForms(range.start, range.end, employeeIds ?? reachable.map((row) => row.employeeId));
      if (result.error) {
        toast({ variant: "destructive", title: "Reminders not sent", description: result.error });
        return;
      }
      setReminded((current) => new Set([...current, ...result.reminded]));
      const missed = result.unreachable.length;
      toast({
        title: result.reminded.length
          ? `Reminded ${result.reminded.length} ${result.reminded.length === 1 ? "employee" : "employees"}`
          : "No reminders sent",
        description: missed
          ? `${missed} couldn't be reached. Their phones may have turned alerts off; ask them in person.`
          : "They'll get a notification on their phone.",
      });
      // Phones that turned alerts off were forgotten; show them as unreachable.
      if (missed) setRevision((value) => value + 1);
    } catch {
      toast({ variant: "destructive", title: "Reminders not sent", description: "Check your connection and try again." });
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="text-[#243635]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-6 border-b border-[#e4e9e6] pb-8">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#408d75]">Requests / Missing forms</p>
          <h1 className="text-4xl font-black tracking-[-0.045em] text-[#1b302e] sm:text-5xl">Missing leave forms<span className="text-[#8cc9b1]">.</span></h1>
          <p className="mt-2 text-sm text-[#84918e]">Absent working days with no leave recorded or requested</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading}
            aria-label="Refresh list"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dbe6df] bg-white text-[#527668] hover:bg-[#f2f8f3] disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : undefined} />
          </button>
          <button
            type="button"
            onClick={() => void remind(null)}
            disabled={!canSend || reachable.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#17191d] px-5 text-sm font-extrabold text-white shadow-[0_5px_14px_rgba(23,25,29,0.16)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
          >
            {sending === "all" ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
            Remind all{reachable.length ? ` (${reachable.length})` : ""}
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-white bg-[#f2f5f3] p-1" role="group" aria-label="Date range">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => choosePreset(item)}
              aria-pressed={preset === item.id}
              className={cn(
                "min-h-[34px] rounded-full px-4 text-xs font-extrabold transition",
                preset === item.id ? "bg-[#17191d] text-white shadow-[0_5px_14px_rgba(23,25,29,0.16)]" : "text-[#5f706c] hover:text-[#17191d]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-[#6f7f7b]">
          From
          <input type="date" value={range.start} max={range.end} onChange={(event) => setCustom("start", event.target.value)} className="h-10 rounded-xl border border-[#dbe6df] bg-white px-3 text-sm font-semibold text-[#243635]" />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-[#6f7f7b]">
          To
          <input type="date" value={range.end} min={range.start} onChange={(event) => setCustom("end", event.target.value)} className="h-10 rounded-xl border border-[#dbe6df] bg-white px-3 text-sm font-semibold text-[#243635]" />
        </label>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat value={loading ? "—" : employees.length} label="employees" tone="bg-[#eef4ff] text-[#3d6ea8]" />
        <Stat value={loading ? "—" : totalDays} label="days missing" tone="bg-[#fff4ee] text-[#b4643c]" />
        <Stat value={loading ? "—" : unreachable.length} label="no alerts" tone="bg-[#f6f4f8] text-[#6a55b8]" />
      </div>

      {list && !list.configured ? (
        <p role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Notifications aren&rsquo;t set up on the server yet, so reminders can&rsquo;t be sent.</p>
      ) : null}
      {list?.error ? <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{list.error}</p> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading missing leave forms">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[200px] animate-pulse rounded-[24px] bg-[#f1f5f2]" />)}
        </div>
      ) : employees.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((row) => (
            <EmployeeCard
              key={row.employeeId}
              row={row}
              reminded={reminded.has(row.employeeId)}
              sending={sending === row.employeeId}
              canSend={canSend}
              onRemind={() => void remind([row.employeeId])}
            />
          ))}
        </div>
      ) : list && !list.error ? (
        <div className="rounded-[24px] border border-[#d9ebe5] bg-[#f1faf6] px-6 py-12 text-center">
          <Check className="mx-auto mb-3 text-[#2f9c80]" />
          <p className="font-black text-[#1c2d2e]">No missing leave forms</p>
          <p className="mt-1 text-sm text-[#7b8a8b]">Everyone absent in this range has leave recorded or requested.</p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className={cn("rounded-2xl px-4 py-3", tone)}>
      <strong className="block text-2xl font-black leading-none">{value}</strong>
      <span className="text-[11px] font-bold opacity-80">{label}</span>
    </div>
  );
}

function EmployeeCard({
  row,
  reminded,
  sending,
  canSend,
  onRemind,
}: {
  row: MissingLeaveFormRow;
  reminded: boolean;
  sending: boolean;
  canSend: boolean;
  onRemind: () => void;
}) {
  const photoUrl = employeePhotoUrl(row.employeeId, row.photoKey);
  return (
    <article className="flex min-w-0 flex-col rounded-[24px] border border-[#e8ece9] bg-white p-5 shadow-[0_9px_25px_rgba(61,50,73,0.06)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#c8ebdd] text-lg font-black text-[#126a5b]">
          {row.name.trim().charAt(0).toUpperCase() || "?"}
          {photoUrl ? <AvatarPhoto src={photoUrl} alt={row.name} className="absolute inset-0 h-full w-full object-cover" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-lg font-black tracking-tight text-[#1c2d2e]">{row.name}</strong>
          <span className="block truncate text-xs font-medium text-[#7b8a8b]">{row.designation || "No designation"}</span>
        </span>
        <Link href={`/employees/details/${row.employeeId}`} aria-label={`Open ${row.name}'s profile`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e3ebe6] text-[#527668] hover:bg-[#f2f8f3]">
          <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label={`${row.dates.length} days missing a leave form`}>
        {row.dates.map((date) => {
          const parts = dayParts(date);
          return (
            <span key={date} className={cn(motifs.calendarPage, "w-[46px]")} data-tone="late" title={date}>
              <span className={motifs.calendarPageTop}>{parts.weekday}</span>
              <strong className="!mt-1 !text-lg">{parts.day}</strong>
              <small className="!mt-0.5">{parts.month}</small>
            </span>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#243b3b]/10 pt-4">
        {row.alertsOn ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eefbf5] px-3 py-1 text-[11px] font-extrabold text-[#23795a]"><Bell size={13} />Alerts on</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4ee] px-3 py-1 text-[11px] font-extrabold text-[#a35a33]"><BellOff size={13} />No alerts · ask in person</span>
        )}
        {reminded ? (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#23795a]"><Check size={15} />Reminded</span>
        ) : row.alertsOn ? (
          <button
            type="button"
            onClick={onRemind}
            disabled={!canSend}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#17191d] px-4 text-xs font-extrabold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
            Remind
          </button>
        ) : null}
      </div>
    </article>
  );
}
