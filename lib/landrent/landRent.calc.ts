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

export const computeMonthlyLandRent = (params: {
  monthKey: string; // YYYY-MM
  sizeSqft: number;
  rateLariPerSqft: number;
  paymentDueDay: number;
  fineLariPerDay: number;

  releasedDateISO?: string | null;

  latestPaymentISO?: string | null;
  isPaidForThisMonth: boolean;
}) => {
  const { y, m } = parseMonthKey(params.monthKey);

  const monthlyRent = round2(params.sizeSqft * params.rateLariPerSqft);

  // ✅ Use LOCAL dates (browser time) to avoid UTC offset issues
  const dateOnlyLocal = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const ymdLocal = (yy: number, mm: number, dd: number) =>
    new Date(yy, mm - 1, dd);

  const diffDaysLocal = (from: Date, to: Date) => {
    const a = dateOnlyLocal(from).getTime();
    const b = dateOnlyLocal(to).getTime();
    return Math.max(0, Math.floor((b - a) / 86400000));
  };

  const monthStart = ymdLocal(y, m, 1);
  const dueDate = ymdLocal(y, m, params.paymentDueDay);

  const today = dateOnlyLocal(new Date());

  const capDate = (() => {
    if (!params.releasedDateISO) return today;
    const rd = new Date(params.releasedDateISO);
    const cap = dateOnlyLocal(rd);
    return cap < today ? cap : today;
  })();

  // ✅ If not paid, show days since month started (so it won't be 0)
  const daysNotPaid = params.isPaidForThisMonth
    ? 0
    : diffDaysLocal(monthStart, capDate) + 1;

  // ✅ Fine only starts after due day
  const fineDays =
    params.isPaidForThisMonth || capDate <= dueDate
      ? 0
      : diffDaysLocal(
          new Date(
            dueDate.getFullYear(),
            dueDate.getMonth(),
            dueDate.getDate() + 1
          ),
          capDate
        ) + 1;

  const fineAmount = round2(fineDays * params.fineLariPerDay);
  const totalMonthly = round2(monthlyRent + fineAmount);

  return {
    monthlyRent,
    daysNotPaid,
    fineDays,
    fineAmount,
    totalMonthly,
    latestPaymentISO: params.latestPaymentISO ?? null,
  };
};
