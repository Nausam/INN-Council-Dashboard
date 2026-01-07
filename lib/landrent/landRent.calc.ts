// lib/landRent/landRent.calc.ts
const MVR_DECIMALS = 2;
const MALDIVES_OFFSET_HOURS = 5;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function ymdUTC(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

function parseMonthKey(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return { y, m };
}

function todayYMDMaldives() {
  const now = Date.now() + MALDIVES_OFFSET_HOURS * 3600 * 1000;
  const d = new Date(now);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function diffDays(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function computeMonthlyLandRent(params: {
  monthKey: string; // YYYY-MM
  sizeSqft: number;
  rateLariPerSqft: number; // e.g. 0.90
  paymentDueDay: number; // default 10
  fineLariPerDay: number; // can be 0
  paidAtISO?: string | null; // latest payment date (any month)
  paidForThisMonth?: boolean; // whether monthKey is already paid
  releasedDateISO?: string | null;
}) {
  const { y, m } = parseMonthKey(params.monthKey);

  const monthlyRent = round2(params.sizeSqft * params.rateLariPerSqft);
  const dueDate = ymdUTC(y, m, params.paymentDueDay);

  const today = (() => {
    const t = todayYMDMaldives();
    return ymdUTC(t.y, t.m, t.day);
  })();

  // If released date exists and is earlier than today, stop counting after release
  const endCap = (() => {
    if (!params.releasedDateISO) return today;
    const rd = new Date(params.releasedDateISO);
    const cap = ymdUTC(
      rd.getUTCFullYear(),
      rd.getUTCMonth() + 1,
      rd.getUTCDate()
    );
    return cap < today ? cap : today;
  })();

  const daysUnpaid = params.paidForThisMonth ? 0 : diffDays(dueDate, endCap);

  const fineDays = params.paidForThisMonth ? 0 : daysUnpaid;
  const fineAmount = round2(fineDays * params.fineLariPerDay);

  const totalMonthly = round2(monthlyRent + fineAmount);

  return {
    monthlyRent: round2(monthlyRent),
    dueDateISO: dueDate.toISOString(),
    daysUnpaid,
    fineDays,
    fineAmount: round2(fineAmount),
    totalMonthly: round2(totalMonthly),
    latestPaymentDateISO: params.paidAtISO ?? null,
  };
}
