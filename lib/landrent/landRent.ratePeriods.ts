const DAY_MS = 24 * 60 * 60 * 1000;
const FINE_CHANGE_DATE = Date.UTC(2025, 7, 1);

const dayUTC = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const round2 = (amount: number) => Math.round(amount * 100) / 100;

export function usesPostAugustMonthlyFine(monthStart: Date): boolean {
  return dayUTC(monthStart) >= FINE_CHANGE_DATE;
}

export function todayInMaldives(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Maldives",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

/** When selected, double rent starts the day after the agreement ends. */
export function rentMultiplierOnDay(day: Date, rentEnd: Date | null, doubleRateAfterEnd = false): number {
  return doubleRateAfterEnd && rentEnd && dayUTC(day) > dayUTC(rentEnd) ? 2 : 1;
}

/** A let-go date is the first day on which no rent or fine is charged. */
export function monthlyRentChargeByRate(args: {
  monthStart: Date;
  normalMonthlyRent: number;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
}): {
  normalAmount: number;
  doubleAmount: number;
  normalMonths: number;
  doubleMonths: number;
  total: number;
} {
  const { monthStart, normalMonthlyRent, rentStart, rentEnd, released } = args;
  const first = dayUTC(monthStart);
  const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  let normalAmount = 0;
  let doubleAmount = 0;
  let normalDays = 0;
  let doubleDays = 0;

  for (let offset = 0; offset < daysInMonth; offset += 1) {
    const timestamp = first + offset * DAY_MS;
    if (rentStart && timestamp < dayUTC(rentStart)) continue;
    if (released && timestamp >= dayUTC(released)) continue;
    if (rentMultiplierOnDay(new Date(timestamp), rentEnd, args.doubleRateAfterEnd) === 2) {
      doubleAmount += (normalMonthlyRent / daysInMonth) * 2;
      doubleDays += 1;
    } else {
      normalAmount += normalMonthlyRent / daysInMonth;
      normalDays += 1;
    }
  }

  const total = round2(normalAmount + doubleAmount);
  const roundedNormal = round2(normalAmount);
  return {
    normalAmount: roundedNormal,
    doubleAmount: round2(total - roundedNormal),
    normalMonths: normalDays / daysInMonth,
    doubleMonths: doubleDays / daysInMonth,
    total,
  };
}

export function monthlyRentCharge(args: Parameters<typeof monthlyRentChargeByRate>[0]): number {
  return monthlyRentChargeByRate(args).total;
}

export function fineBetweenDates(args: {
  from: Date;
  through: Date;
  normalMonthlyRent: number;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
  regime: "before-august-2025" | "from-august-2025";
}): { days: number; amount: number } {
  const result = fineBetweenDatesByRate(args);
  return { days: result.normalDays + result.doubleDays, amount: result.total };
}

export function fineBetweenDatesByRate(args: Parameters<typeof fineBetweenDates>[0]): {
  normalDays: number;
  doubleDays: number;
  normalAmount: number;
  doubleAmount: number;
  total: number;
} {
  const { normalMonthlyRent, rentStart, rentEnd, released, regime } = args;
  const first = Math.max(
    dayUTC(args.from),
    regime === "from-august-2025" ? FINE_CHANGE_DATE : -Infinity,
    rentStart ? dayUTC(rentStart) : -Infinity,
  );
  const last = Math.min(
    dayUTC(args.through),
    regime === "before-august-2025" ? FINE_CHANGE_DATE - DAY_MS : Infinity,
    released ? dayUTC(released) - DAY_MS : Infinity,
  );
  if (last < first) return { normalDays: 0, doubleDays: 0, normalAmount: 0, doubleAmount: 0, total: 0 };

  let normalAmount = 0;
  let doubleAmount = 0;
  let normalDays = 0;
  let doubleDays = 0;
  for (let timestamp = first; timestamp <= last; timestamp += DAY_MS) {
    const multiplier = rentMultiplierOnDay(new Date(timestamp), rentEnd, args.doubleRateAfterEnd);
    const daily = regime === "before-august-2025"
      ? (normalMonthlyRent * 12 * 0.25) / 365
      : (normalMonthlyRent / 30) * 0.25;
    if (multiplier === 2) {
      doubleAmount += daily * 2;
      doubleDays += 1;
    } else {
      normalAmount += daily;
      normalDays += 1;
    }
  }
  const total = round2(normalAmount + doubleAmount);
  const roundedNormal = round2(normalAmount);
  return {
    normalDays,
    doubleDays,
    normalAmount: roundedNormal,
    doubleAmount: round2(total - roundedNormal),
    total,
  };
}

/** Add the days omitted by statements made under the old due-day fine start. */
export function olderFineMonthStartCorrection(args: {
  fromMonth: Date;
  paymentDueDay: number;
  fineThrough: Date;
  normalMonthlyRent: number;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
  savedFineDays: number;
  savedFineAmount: number;
}) {
  const monthStart = new Date(Date.UTC(args.fromMonth.getUTCFullYear(), args.fromMonth.getUTCMonth(), 1));
  const oldStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), args.paymentDueDay + 1));
  const oldEffectiveStart = Math.max(dayUTC(oldStart), args.rentStart ? dayUTC(args.rentStart) : -Infinity);
  const through = args.savedFineDays > 0
    ? new Date(oldEffectiveStart + (Math.floor(args.savedFineDays) - 1) * DAY_MS)
    : args.fineThrough;
  const fineArgs = {
    through,
    normalMonthlyRent: args.normalMonthlyRent,
    rentStart: args.rentStart,
    rentEnd: args.rentEnd,
    doubleRateAfterEnd: args.doubleRateAfterEnd,
    released: args.released,
    regime: "before-august-2025" as const,
  };
  const omitted = fineBetweenDatesByRate({ ...fineArgs, from: monthStart, through: new Date(Math.min(dayUTC(through), dayUTC(oldStart) - DAY_MS)) });
  const addedDays = omitted.normalDays + omitted.doubleDays;
  if (addedDays === 0) {
    return { addedDays: 0, addedAmount: 0, normalAddedDays: 0, doubleAddedDays: 0, normalAddedAmount: 0, doubleAddedAmount: 0 };
  }

  const oldFine = fineBetweenDatesByRate({ ...fineArgs, from: oldStart });
  const newFine = fineBetweenDatesByRate({ ...fineArgs, from: monthStart });
  const matchesOldSnapshot = oldFine.normalDays + oldFine.doubleDays === args.savedFineDays &&
    Math.abs(oldFine.total - args.savedFineAmount) <= 0.02;
  const addedAmount = matchesOldSnapshot
    ? round2(newFine.total - args.savedFineAmount)
    : omitted.total;
  let normalAddedAmount = omitted.normalAmount;
  let doubleAddedAmount = omitted.doubleAmount;
  const roundingDifference = round2(addedAmount - normalAddedAmount - doubleAddedAmount);
  if (omitted.normalDays > 0) normalAddedAmount = round2(normalAddedAmount + roundingDifference);
  else doubleAddedAmount = round2(doubleAddedAmount + roundingDifference);

  return {
    addedDays,
    addedAmount,
    normalAddedDays: omitted.normalDays,
    doubleAddedDays: omitted.doubleDays,
    normalAddedAmount,
    doubleAddedAmount,
  };
}

/** Show the rate split of an older statement without changing its saved totals. */
export function reconstructStatementRateBreakdown(args: {
  fromMonth: Date;
  toMonth: Date;
  fineThrough: Date;
  normalMonthlyRent: number;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
  savedRentAmount: number;
  savedFineAmount: number;
  savedUnpaidMonths: number;
  savedFineDays: number;
}) {
  const day = (date: Date) => new Date(dayUTC(date));
  const month = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const from = month(args.fromMonth);
  const to = month(args.toMonth);
  let normalRent = 0;
  let doubleRent = 0;
  let normalMonths = 0;
  let doubleMonths = 0;

  for (
    let cursor = from;
    cursor <= to;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const charge = monthlyRentChargeByRate({
      monthStart: cursor,
      normalMonthlyRent: args.normalMonthlyRent,
      rentStart: args.rentStart,
      rentEnd: args.rentEnd,
      doubleRateAfterEnd: args.doubleRateAfterEnd,
      released: args.released,
    });
    normalRent += charge.normalAmount;
    doubleRent += charge.doubleAmount;
    normalMonths += charge.normalMonths;
    doubleMonths += charge.doubleMonths;
  }

  const fine = fineBetweenDatesByRate({
    from,
    through: day(args.fineThrough),
    normalMonthlyRent: args.normalMonthlyRent,
    rentStart: args.rentStart,
    rentEnd: args.rentEnd,
    doubleRateAfterEnd: args.doubleRateAfterEnd,
    released: args.released,
    regime: "before-august-2025",
  });

  const defaultDouble = args.doubleRateAfterEnd === true && args.rentEnd !== null && dayUTC(to) > dayUTC(args.rentEnd);
  const split = (total: number, normalWeight: number, doubleWeight: number, digits: number) => {
    const factor = 10 ** digits;
    const sum = normalWeight + doubleWeight;
    const normal = sum > 0
      ? Math.round((total * normalWeight / sum) * factor) / factor
      : defaultDouble ? 0 : total;
    return [normal, Math.round((total - normal) * factor) / factor] as const;
  };

  const [normalRentSaved, doubleRentSaved] = split(
    Math.max(0, args.savedRentAmount), normalRent, doubleRent, 2,
  );
  const [normalMonthsSaved, doubleMonthsSaved] = split(
    Math.max(0, args.savedUnpaidMonths), normalMonths, doubleMonths, 2,
  );
  const [normalFineSaved, doubleFineSaved] = split(
    Math.max(0, args.savedFineAmount), fine.normalAmount, fine.doubleAmount, 2,
  );
  const [normalDaysSaved, doubleDaysSaved] = split(
    Math.max(0, args.savedFineDays), fine.normalDays, fine.doubleDays, 0,
  );

  return ([
    {
      multiplier: 1 as const,
      rentAmount: normalRentSaved,
      unpaidMonths: Math.floor(normalMonthsSaved),
      fineDays: normalDaysSaved,
      fineAmount: normalFineSaved,
      total: round2(normalRentSaved + normalFineSaved),
    },
    {
      multiplier: 2 as const,
      rentAmount: doubleRentSaved,
      unpaidMonths: Math.floor(doubleMonthsSaved),
      fineDays: doubleDaysSaved,
      fineAmount: doubleFineSaved,
      total: round2(doubleRentSaved + doubleFineSaved),
    },
  ]).filter((row) => row.total > 0);
}

export function firstMonthFromSavedUnpaidCount(
  statementMonth: Date,
  unpaidMonths: number,
  released: Date | null,
): Date | null {
  if (!Number.isFinite(unpaidMonths) || unpaidMonths < 1) return null;
  const statementStart = new Date(Date.UTC(statementMonth.getUTCFullYear(), statementMonth.getUTCMonth(), 1));
  const lastChargeDay = released ? new Date(dayUTC(released) - DAY_MS) : statementStart;
  const lastChargeMonth = new Date(Date.UTC(lastChargeDay.getUTCFullYear(), lastChargeDay.getUTCMonth(), 1));
  const end = lastChargeMonth < statementStart ? lastChargeMonth : statementStart;
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - Math.floor(unpaidMonths) + 1, 1));
}
