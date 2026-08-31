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
  const [
    initialAssistants,
    initialEmployees,
    initialAttendance,
    initialAllowanceAttendance,
  ] = await Promise.all([
    fetchMosqueAssistants(),
    fetchAllEmployees(),
    fetchMosqueAttendanceForPeriod(report.startDate, report.endDate),
    fetchMosqueAttendanceForPeriod(allowance.startDate, allowance.endDate),
  ]);

  return (
    <MosqueMonthlyReportsView
      initialAssistants={initialAssistants}
      initialEmployees={initialEmployees}
      initialAttendance={initialAttendance}
      initialAllowanceAttendance={initialAllowanceAttendance}
    />
  );
}
