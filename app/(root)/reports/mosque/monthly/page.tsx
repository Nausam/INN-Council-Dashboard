export const dynamic = "force-dynamic";

import {
  fetchAllEmployees,
  fetchMosqueAssistants,
  fetchMosqueAttendanceForPeriod,
} from "@/lib/actions/hr.actions";
import { todayMaldivesIso } from "@/lib/attendance-sync/time";
import { MosqueMonthlyReportsView } from "./MosqueMonthlyReportsView";

function maldivesMonth() {
  return todayMaldivesIso().slice(0, 7);
}

function defaultReportPeriod() {
  const month = maldivesMonth();
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1));
  return {
    startDate: `${previousMonth.getUTCFullYear()}-${String(
      previousMonth.getUTCMonth() + 1,
    ).padStart(2, "0")}-11`,
    endDate: `${year}-${String(monthNumber).padStart(2, "0")}-10`,
  };
}

function allowancePeriod() {
  const month = maldivesMonth();
  const [year, monthNumber] = month.split("-").map(Number);
  const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1));
  return {
    startDate: `${previousMonth.getUTCFullYear()}-${String(
      previousMonth.getUTCMonth() + 1,
    ).padStart(2, "0")}-16`,
    endDate: `${year}-${String(monthNumber).padStart(2, "0")}-15`,
  };
}

export default async function MosqueMonthlyReportsPage() {
  const report = defaultReportPeriod();
  const allowance = allowancePeriod();
  // The two periods overlap by most of a month, so read the combined range once.
  const [initialAssistants, initialEmployees, combined] = await Promise.all([
    fetchMosqueAssistants(),
    fetchAllEmployees(),
    fetchMosqueAttendanceForPeriod(
      report.startDate < allowance.startDate ? report.startDate : allowance.startDate,
      report.endDate > allowance.endDate ? report.endDate : allowance.endDate,
    ),
  ]);
  const within = (period: { startDate: string; endDate: string }) =>
    combined.filter((row) => row.date.slice(0, 10) >= period.startDate && row.date.slice(0, 10) <= period.endDate);
  const initialAttendance = within(report);
  const initialAllowanceAttendance = within(allowance);

  return (
    <MosqueMonthlyReportsView
      initialAssistants={initialAssistants}
      initialEmployees={initialEmployees}
      initialAttendance={initialAttendance}
      initialAllowanceAttendance={initialAllowanceAttendance}
    />
  );
}
