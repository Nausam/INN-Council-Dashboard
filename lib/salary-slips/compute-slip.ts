import { parseCreditSchemesFromDoc } from "@/lib/employees/credit-schemes";
import { recordCardLabelForEmployee } from "@/lib/employees/record-card-label";
import {
  computeRetirementPension,
  retirementPensionAppliesFromDoc,
} from "@/lib/employees/retirement-pension";
import {
  ALLOWANCE_SLIP_LINES,
  DEDUCTION_SLIP_LINES,
} from "@/lib/salary-slips/slip-labels";
import { formatJoinedDate, formatPeriodTitle } from "@/lib/salary-slips/format";
import {
  countAttendanceBenefitEligibleDaysInPeriod,
  getPayPeriodBounds,
  isOnAttendanceLeave,
  parsePayPeriodBoundsAsDates,
  qualifiesForAttendanceBenefit,
  resolveAttendanceRowDate,
} from "@/lib/salary-slips/pay-period";
import type { AttendanceDoc, EmployeeDoc } from "@/lib/firebase/types";

export type SalarySlipLine = {
  key: string;
  labelEn: string;
  labelDv: string;
  amount: number;
};

export type SalarySlipComputed = {
  employeeId: string;
  periodLabel: string;
  periodTitle: string;
  staff: {
    recordCardNumber: string;
    recordCardLabel: string;
    name: string;
    address: string;
    designation: string;
    office: string;
    joinedDate: string;
  };
  basicSalary: number;
  deductions: SalarySlipLine[];
  totalDeductions: number;
  basicAfterDeduction: number;
  allowances: SalarySlipLine[];
  totalAllowances: number;
  overtime: number;
  netIncome: number;
  attendanceSummary: {
    presentDays: number;
    benefitPresentDays: number;
    eligibleBenefitDaysInPeriod: number;
    totalMinutesLate: number;
    absentDays: number;
  };
};

const COUNCIL_OFFICE = "INNAMADHOO COUNCIL";
const COUNCIL_EXECUTIVE_DESIGNATION = "council executive";
const ASSISTANT_COUNCIL_EXECUTIVE_DESIGNATION = "a. council executive";
const ANNUAL_LEAVE = "annualLeave";
/** Working days used for absent-day deduction from basic salary. */
const WORKING_DAYS_PER_MONTH = 26;
/** Calendar days used to derive per-minute late deduction from basic salary. */
const SALARY_CALENDAR_DAYS = 30;
const WORKING_HOURS_PER_DAY = 8;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function parsePeriodBounds(periodLabel: string): { start: Date; end: Date } | null {
  return parsePayPeriodBoundsAsDates(periodLabel);
}

function parseDateOnly(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateFallsWithinBounds(date: Date, bounds: { start: Date; end: Date }): boolean {
  return date >= bounds.start && date <= bounds.end;
}

function normalizeDesignation(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isPresentAttendanceRow(row: AttendanceDoc | undefined): boolean {
  return Boolean(row?.signInTime) && !isOnAttendanceLeave(row?.leaveType);
}

function isAnnualLeaveRow(row: AttendanceDoc | undefined): boolean {
  return (row?.leaveType ?? "").trim() === ANNUAL_LEAVE;
}

function attendanceRowsByDate(
  employeeId: string,
  rows: AttendanceDoc[],
): Map<string, AttendanceDoc> {
  const byDate = new Map<string, AttendanceDoc>();
  for (const row of rows) {
    if (row.employeeId !== employeeId) continue;
    const rowDate = resolveAttendanceRowDate(row);
    if (!rowDate) continue;
    byDate.set(rowDate, pickAttendanceRowForDate(byDate.get(rowDate), row));
  }
  return byDate;
}

function computeTemporaryZvAllowances(
  employees: EmployeeDoc[],
  attendanceRows: AttendanceDoc[],
): Map<string, number> {
  const executive = employees.find(
    (employee) =>
      normalizeDesignation(employee.designation) ===
      COUNCIL_EXECUTIVE_DESIGNATION,
  );
  const assistant = employees.find(
    (employee) =>
      normalizeDesignation(employee.designation) ===
      ASSISTANT_COUNCIL_EXECUTIVE_DESIGNATION,
  );

  const amounts = new Map<string, number>();
  if (!executive) return amounts;

  const executiveRate = round2(num(executive.temporaryZvAllowance));
  const assistantRate = assistant
    ? round2(num(assistant.temporaryZvAllowance, executiveRate))
    : 0;
  const executiveRows = attendanceRowsByDate(executive.$id, attendanceRows);
  const assistantRows = assistant
    ? attendanceRowsByDate(assistant.$id, attendanceRows)
    : new Map<string, AttendanceDoc>();

  let executiveDays = 0;
  let assistantDays = 0;

  for (const [date, executiveRow] of Array.from(executiveRows.entries())) {
    if (isAnnualLeaveRow(executiveRow)) {
      if (assistant && isPresentAttendanceRow(assistantRows.get(date))) {
        assistantDays += 1;
      }
      continue;
    }

    if (isPresentAttendanceRow(executiveRow)) {
      executiveDays += 1;
    }
  }

  amounts.set(executive.$id, round2(executiveRate * executiveDays));
  if (assistant) {
    amounts.set(assistant.$id, round2(assistantRate * assistantDays));
  }

  return amounts;
}

function creditSchemeDeductionForPeriod(
  schemes: ReturnType<typeof parseCreditSchemesFromDoc>,
  periodLabel: string,
): number {
  const bounds = parsePeriodBounds(periodLabel);
  if (!bounds) return 0;

  let total = 0;
  for (const scheme of schemes) {
    const start = parseDateOnly(scheme.startDate);
    const end = parseDateOnly(scheme.endDate);
    if (start && bounds.end < start) continue;
    if (end && bounds.start > end) continue;

    if (!start || !end) {
      total += num(scheme.startMonthAmount);
      continue;
    }

    total += round2(
      dateFallsWithinBounds(end, bounds)
        ? scheme.endMonthAmount
        : scheme.startMonthAmount,
    );
  }
  return round2(total);
}

function pickAttendanceRowForDate(
  existing: AttendanceDoc | undefined,
  row: AttendanceDoc,
): AttendanceDoc {
  if (!existing) return row;
  if (isOnAttendanceLeave(row.leaveType)) return row;
  if (isOnAttendanceLeave(existing.leaveType)) return existing;
  if (row.signInTime && !existing.signInTime) return row;
  if (
    row.signInTime &&
    existing.signInTime &&
    num(row.minutesLate) > num(existing.minutesLate)
  ) {
    return row;
  }
  return existing;
}

function summarizeAttendance(
  employeeId: string,
  rows: AttendanceDoc[],
  periodLabel: string,
  holidayDates: ReadonlySet<string>,
): {
  presentDays: number;
  benefitPresentDays: number;
  eligibleBenefitDaysInPeriod: number;
  totalMinutesLate: number;
  absentDays: number;
} {
  const bounds = getPayPeriodBounds(periodLabel);
  const eligibleBenefitDaysInPeriod = countAttendanceBenefitEligibleDaysInPeriod(
    periodLabel,
    holidayDates,
  );

  const rowsByDate = new Map<string, AttendanceDoc>();

  for (const row of rows) {
    if (row.employeeId !== employeeId) continue;

    const rowDate = resolveAttendanceRowDate(row);
    if (!rowDate) continue;
    if (
      bounds &&
      (rowDate < bounds.startIso || rowDate > bounds.endIso)
    ) {
      continue;
    }

    rowsByDate.set(
      rowDate,
      pickAttendanceRowForDate(rowsByDate.get(rowDate), row),
    );
  }

  let presentDays = 0;
  let benefitPresentDays = 0;
  let totalMinutesLate = 0;
  let absentDays = 0;

  for (const [rowDate, row] of Array.from(rowsByDate.entries())) {
    totalMinutesLate += num(row.minutesLate);

    const leave = row.leaveType?.trim() ?? "";
    const onLeave = isOnAttendanceLeave(row.leaveType);

    if (onLeave) {
      if (leave === "noPayLeave") absentDays += 1;
      continue;
    }

    if (row.signInTime) {
      presentDays += 1;
      if (
        qualifiesForAttendanceBenefit(
          row.signInTime,
          row.leaveType,
          rowDate,
          holidayDates,
        )
      ) {
        benefitPresentDays += 1;
      }
    } else {
      absentDays += 1;
    }
  }

  return {
    presentDays,
    benefitPresentDays,
    eligibleBenefitDaysInPeriod,
    totalMinutesLate,
    absentDays,
  };
}

function dailyRate(basicSalary: number): number {
  return basicSalary / WORKING_DAYS_PER_MONTH;
}

/** Basic salary ÷ 30 days ÷ working hours per day ÷ 60 minutes. */
function lateMinuteRate(basicSalary: number): number {
  return (
    basicSalary / SALARY_CALENDAR_DAYS / WORKING_HOURS_PER_DAY / 60
  );
}

export function computeSalarySlip(
  employee: EmployeeDoc,
  periodLabel: string,
  attendanceRows: AttendanceDoc[],
  holidayDates: ReadonlySet<string> = new Set(),
  temporaryZvAllowanceOverride?: number,
): SalarySlipComputed {
  const basicSalary = round2(num(employee.basicSalary));
  const livingAllowance = round2(num(employee.livingAllowance));
  const foodAllowance = round2(num(employee.foodAllowance));
  const ramazanAllowance = round2(num(employee.ramazanAllowance));
  const phoneAllowance = round2(num(employee.phoneAllowance));
  const jobAllowance = round2(num(employee.jobAllowance));
  const attendanceBenefitRate = round2(num(employee.attendanceBenefit));
  const zvAllowanceRate = round2(num(employee.temporaryZvAllowance));

  const creditSchemes = parseCreditSchemesFromDoc(employee.creditSchemes);
  const legacyCredit = num(employee.creditScheme);
  const creditSchemeDeduction =
    creditSchemes.length > 0
      ? creditSchemeDeductionForPeriod(creditSchemes, periodLabel)
      : round2(legacyCredit);

  const summary = summarizeAttendance(
    employee.$id,
    attendanceRows,
    periodLabel,
    holidayDates,
  );
  const basicLateFine = round2(
    summary.totalMinutesLate * lateMinuteRate(basicSalary),
  );
  const jobAllowanceLateFine = round2(
    summary.totalMinutesLate * lateMinuteRate(jobAllowance),
  );
  const lateFine = basicLateFine;
  const basicAbsentDaysFine = round2(summary.absentDays * dailyRate(basicSalary));
  const jobAllowanceAbsentDaysFine = round2(
    summary.absentDays * dailyRate(jobAllowance),
  );
  const absentDaysFine = round2(
    basicAbsentDaysFine + jobAllowanceAbsentDaysFine,
  );
  const absentHoursFine = 0;
  const pensionableBasicSalary = round2(
    Math.max(0, basicSalary - basicLateFine - basicAbsentDaysFine - absentHoursFine),
  );
  const pension = computeRetirementPension(
    pensionableBasicSalary,
    retirementPensionAppliesFromDoc(employee.retirementPensionApplies),
  );

  const attendanceBenefit = round2(
    attendanceBenefitRate * summary.benefitPresentDays,
  );
  const zvAllowance =
    typeof temporaryZvAllowanceOverride === "number"
      ? round2(temporaryZvAllowanceOverride)
      : round2(zvAllowanceRate * summary.presentDays);

  const deductionAmounts = {
    lateMinutes: lateFine,
    absentHours: absentHoursFine,
    creditScheme: creditSchemeDeduction,
    pension,
    absentDays: absentDaysFine,
  };

  const deductions: SalarySlipLine[] = DEDUCTION_SLIP_LINES.map((line) => ({
    key: line.key,
    labelEn: line.en,
    labelDv: line.dv,
    amount: round2(deductionAmounts[line.key]),
  }));

  const totalDeductions = round2(
    deductions.reduce((sum, line) => sum + line.amount, 0),
  );
  const basicAfterDeduction = round2(
    Math.max(0, basicSalary - totalDeductions),
  );

  const overtime = 0;

  const allowanceAmounts = {
    overtime,
    living: livingAllowance,
    food: foodAllowance,
    holiday: 0,
    ramazan: ramazanAllowance,
    zv: zvAllowance,
    phone: phoneAllowance,
    job: round2(Math.max(0, jobAllowance - jobAllowanceLateFine)),
    attendanceBenefit,
  };

  const allowances: SalarySlipLine[] = ALLOWANCE_SLIP_LINES.map((line) => ({
    key: line.key,
    labelEn: line.en,
    labelDv: line.dv,
    amount: round2(allowanceAmounts[line.key]),
  }));

  const totalAllowances = round2(
    allowances.reduce((sum, line) => sum + line.amount, 0),
  );
  const netIncome = round2(basicAfterDeduction + totalAllowances);

  return {
    employeeId: employee.$id,
    periodLabel,
    periodTitle: formatPeriodTitle(periodLabel),
    staff: {
      recordCardNumber: employee.recordCardNumber?.trim() || "-",
      recordCardLabel: recordCardLabelForEmployee(
        employee.section,
        employee.designation,
      ),
      name: employee.name?.trim() || "-",
      address: employee.address?.trim() || "-",
      designation: employee.designation?.trim() || "-",
      office: COUNCIL_OFFICE,
      joinedDate: formatJoinedDate(employee.joinedDate),
    },
    basicSalary,
    deductions,
    totalDeductions,
    basicAfterDeduction,
    allowances,
    totalAllowances,
    overtime,
    netIncome,
    attendanceSummary: summary,
  };
}

export function computeSalarySlipsForPeriod(
  employees: EmployeeDoc[],
  periodLabel: string,
  attendanceRows: AttendanceDoc[],
  holidayDates: string[] = [],
): SalarySlipComputed[] {
  const holidaySet = new Set(holidayDates);
  const temporaryZvAllowances = computeTemporaryZvAllowances(
    employees,
    attendanceRows,
  );
  return employees
    .filter((e) => e.name?.trim())
    .map((employee) =>
      computeSalarySlip(
        employee,
        periodLabel,
        attendanceRows,
        holidaySet,
        temporaryZvAllowances.get(employee.$id) ?? 0,
      ),
    )
    .sort((a, b) => a.staff.name.localeCompare(b.staff.name));
}
