import assert from "node:assert/strict";
import test from "node:test";
import {
  fineBetweenDates,
  fineBetweenDatesByRate,
  firstMonthFromSavedUnpaidCount,
  monthlyRentCharge,
  monthlyRentChargeByRate,
  olderFineMonthStartCorrection,
  reconstructStatementRateBreakdown,
  usesPostAugustMonthlyFine,
} from "../lib/landrent/landRent.ratePeriods";

const day = (year: number, month: number, date: number) =>
  new Date(Date.UTC(year, month - 1, date));

test("expired rent stays at the normal rate unless doubling is selected", () => {
  const args = {
    monthStart: day(2025, 4, 1), normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1), rentEnd: day(2025, 3, 15), released: null,
  };
  for (const doubleRateAfterEnd of [undefined, false]) {
    const split = monthlyRentChargeByRate({ ...args, doubleRateAfterEnd });
    assert.equal(split.total, 1000);
    assert.equal(split.doubleAmount, 0);
    assert.equal(split.normalMonths, 1);
  }
  assert.equal(monthlyRentCharge({ ...args, doubleRateAfterEnd: true }), 2000);
});

test("both fine methods retain the normal rate after expiry when doubling is unticked", () => {
  for (const [regime, month, amount] of [
    ["before-august-2025", 7, 82.19],
    ["from-august-2025", 8, 83.33],
  ] as const) {
    const args = {
      from: day(2025, month, 11), through: day(2025, month, 20),
      normalMonthlyRent: 1000, rentStart: day(2025, 1, 1),
      rentEnd: day(2025, month, 10), released: null, regime,
    };
    const split = fineBetweenDatesByRate(args);
    assert.equal(split.total, amount);
    assert.equal(split.normalDays, 10);
    assert.equal(split.doubleDays, 0);
    assert.equal(fineBetweenDates({ ...args, doubleRateAfterEnd: false }).amount, amount);
  }
});

test("rent splits the expiry month and doubles from the next day", () => {
  assert.equal(monthlyRentCharge({
    monthStart: day(2025, 3, 1),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 3, 15),
    doubleRateAfterEnd: true,
    released: null,
  }), 1516.13);
  assert.equal(monthlyRentCharge({
    monthStart: day(2025, 4, 1),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 3, 15),
    doubleRateAfterEnd: true,
    released: null,
  }), 2000);
});

test("the statement can show normal and double rent as rows that add to the billed month", () => {
  const split = monthlyRentChargeByRate({
    monthStart: day(2025, 3, 1),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 3, 15),
    doubleRateAfterEnd: true,
    released: null,
  });
  assert.equal(split.normalAmount, 483.87);
  assert.equal(split.doubleAmount, 1032.26);
  assert.equal(split.normalAmount + split.doubleAmount, split.total);
  assert.equal(split.normalMonths, 15 / 31);
  assert.equal(split.doubleMonths, 16 / 31);
});

test("rent starts on the agreement date and stops on the let-go date", () => {
  assert.equal(monthlyRentCharge({
    monthStart: day(2025, 3, 1),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 3, 10),
    rentEnd: day(2025, 3, 15),
    doubleRateAfterEnd: true,
    released: day(2025, 3, 20),
  }), 451.61);
  assert.equal(monthlyRentCharge({
    monthStart: day(2025, 4, 1),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 3, 10),
    rentEnd: day(2025, 3, 15),
    doubleRateAfterEnd: true,
    released: day(2025, 3, 20),
  }), 0);
});

test("older fine uses the annual method and switches to double after expiry", () => {
  assert.deepEqual(fineBetweenDates({
    from: day(2025, 7, 11),
    through: day(2025, 8, 20),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 7, 15),
    doubleRateAfterEnd: true,
    released: null,
    regime: "before-august-2025",
  }), { days: 21, amount: 304.11 });
});

test("the older fine starts on the first unpaid day, including September 2024", () => {
  assert.deepEqual(fineBetweenDates({
    from: day(2024, 9, 1),
    through: day(2025, 7, 31),
    normalMonthlyRent: 2790,
    rentStart: day(2023, 10, 12),
    rentEnd: day(2028, 4, 6),
    doubleRateAfterEnd: true,
    released: null,
    regime: "before-august-2025",
  }), { days: 334, amount: 7659.12 });
});

test("an older saved statement gains the ten omitted September days once", () => {
  assert.deepEqual(olderFineMonthStartCorrection({
    fromMonth: day(2024, 9, 1),
    paymentDueDay: 10,
    fineThrough: day(2026, 9, 30),
    normalMonthlyRent: 2790,
    rentStart: day(2023, 10, 12),
    rentEnd: day(2028, 4, 6),
    doubleRateAfterEnd: true,
    released: null,
    savedFineDays: 324,
    savedFineAmount: 7429.81,
  }), {
    addedDays: 10,
    addedAmount: 229.31,
    normalAddedDays: 10,
    doubleAddedDays: 0,
    normalAddedAmount: 229.31,
    doubleAddedAmount: 0,
  });
});

test("older fine days and amounts split across the expiry date", () => {
  const split = fineBetweenDatesByRate({
    from: day(2025, 7, 11),
    through: day(2025, 8, 20),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 7, 15),
    doubleRateAfterEnd: true,
    released: null,
    regime: "before-august-2025",
  });
  assert.equal(split.normalDays, 5);
  assert.equal(split.doubleDays, 16);
  assert.equal(split.normalAmount + split.doubleAmount, split.total);
  assert.equal(split.total, 304.11);
});

test("August fine matches the monthly overdue example and doubles after expiry", () => {
  assert.deepEqual(fineBetweenDates({
    from: day(2025, 8, 11),
    through: day(2026, 9, 29),
    normalMonthlyRent: 3060,
    rentStart: day(2025, 1, 1),
    rentEnd: null,
    doubleRateAfterEnd: true,
    released: null,
    regime: "from-august-2025",
  }), { days: 415, amount: 10582.5 });
  assert.deepEqual(fineBetweenDates({
    from: day(2025, 8, 11),
    through: day(2025, 8, 31),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 8, 15),
    doubleRateAfterEnd: true,
    released: null,
    regime: "from-august-2025",
  }), { days: 21, amount: 308.33 });
});

test("let-go date stops fines from that day", () => {
  assert.deepEqual(fineBetweenDates({
    from: day(2026, 9, 11),
    through: day(2026, 9, 29),
    normalMonthlyRent: 1000,
    rentStart: day(2026, 1, 1),
    rentEnd: null,
    doubleRateAfterEnd: true,
    released: day(2026, 9, 20),
    regime: "from-august-2025",
  }), { days: 9, amount: 75 });
});

test("per-month fine rows begin with August 2025", () => {
  assert.equal(usesPostAugustMonthlyFine(day(2025, 7, 1)), false);
  assert.equal(usesPostAugustMonthlyFine(day(2025, 8, 1)), true);
});

test("an older saved statement displays both rates without changing its saved total", () => {
  const rows = reconstructStatementRateBreakdown({
    fromMonth: day(2025, 1, 1),
    toMonth: day(2025, 3, 1),
    fineThrough: day(2025, 7, 31),
    normalMonthlyRent: 1000,
    rentStart: day(2025, 1, 1),
    rentEnd: day(2025, 1, 15),
    doubleRateAfterEnd: true,
    released: null,
    savedRentAmount: 5432.10,
    savedFineAmount: 876.54,
    savedUnpaidMonths: 3,
    savedFineDays: 201,
  });
  assert.deepEqual(rows.map((row) => row.multiplier), [1, 2]);
  assert.equal(rows.reduce((sum, row) => sum + row.rentAmount, 0), 5432.10);
  assert.equal(rows.reduce((sum, row) => sum + row.fineAmount, 0), 876.54);
  assert.equal(rows.reduce((sum, row) => sum + row.fineDays, 0), 201);
  assert.equal(Math.round(rows.reduce((sum, row) => sum + row.total, 0) * 100) / 100, 6308.64);
  assert.ok(rows.every((row) => Number.isInteger(row.unpaidMonths)));
});

test("the two rate rows show 3 and 33 whole months for a split 37-month period", () => {
  const rows = reconstructStatementRateBreakdown({
    fromMonth: day(2023, 9, 1),
    toMonth: day(2026, 9, 1),
    fineThrough: day(2026, 9, 30),
    normalMonthlyRent: 2443.05,
    rentStart: day(2023, 9, 1),
    rentEnd: day(2023, 12, 20),
    doubleRateAfterEnd: true,
    released: null,
    savedRentAmount: 171880.39,
    savedFineAmount: 25682.14,
    savedUnpaidMonths: 37,
    savedFineDays: 690,
  });
  assert.deepEqual(rows.map((row) => row.unpaidMonths), [3, 33]);
  assert.equal(Math.round(rows.reduce((sum, row) => sum + row.total, 0) * 100) / 100, 197562.53);
});

test("legacy month count finds the original unpaid period, including a let-go cap", () => {
  assert.equal(firstMonthFromSavedUnpaidCount(day(2026, 9, 1), 37, null)?.toISOString().slice(0, 10), "2023-09-01");
  assert.equal(firstMonthFromSavedUnpaidCount(day(2026, 9, 1), 2, day(2026, 7, 1))?.toISOString().slice(0, 10), "2026-05-01");
});
