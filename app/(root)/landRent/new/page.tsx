/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createLandRentHolder } from "@/lib/landrent/landRent.actions";
import { useEffect, useMemo, useState } from "react";

function toISODate(v: string) {
  return v || "";
}

function num(v: string) {
  const cleaned = (v ?? "").toString().replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function safeParseDate(yyyyMmDd: string) {
  if (!yyyyMmDd) return null;
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function daysBetween(a: Date, b: Date) {
  // whole days between (a -> b), assuming a <= b
  const ms = 24 * 60 * 60 * 1000;
  const aa = dateOnly(a).getTime();
  const bb = dateOnly(b).getTime();
  return Math.max(0, Math.floor((bb - aa) / ms));
}

function monthStartsBetweenInclusive(fromMonthStart: Date, toMonthStart: Date) {
  // Return an ARRAY (not a generator) to avoid TS downlevelIteration issues.
  const out: Date[] = [];

  let cur = new Date(
    fromMonthStart.getFullYear(),
    fromMonthStart.getMonth(),
    1
  );
  const end = new Date(toMonthStart.getFullYear(), toMonthStart.getMonth(), 1);

  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur.getFullYear(), cur.getMonth(), 1));
    cur = addMonths(cur, 1);
  }

  return out;
}

function fmtMonthYear(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(d);
}

type BreakdownRow = {
  key: string;
  label: string; // "May 2025"
  days: number;
  fine: number;
};

export default function Page() {
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Base
  const [landName, setLandName] = useState("");
  const [renterName, setRenterName] = useState("");

  const [rentStartDate, setRentStartDate] = useState("");
  const [rentEndDate, setRentEndDate] = useState("");

  const [agreementNumber, setAgreementNumber] = useState("");
  const [letGoDate, setLetGoDate] = useState<string>("");

  const [sizeSqft, setSizeSqft] = useState("1800");
  const [rate, setRate] = useState("1.7");

  // PDF Upload State
  const [agreementPdf, setAgreementPdf] = useState<File | null>(null);
  const [agreementPdfBase64, setAgreementPdfBase64] = useState<string>("");
  const [pdfError, setPdfError] = useState<string>("");

  const monthlyRent = useMemo(() => {
    const v = num(sizeSqft) * num(rate);
    return Number.isFinite(v) ? v : 0;
  }, [sizeSqft, rate]);

  const [paymentDueDay, setPaymentDueDay] = useState("10");

  // Fine per day auto: (monthly / 30) * 25%
  const finePerDay = useMemo(() => {
    const v = (monthlyRent / 30) * 0.25;
    return Number.isFinite(v) ? v : 0;
  }, [monthlyRent]);

  // Opening snapshot fields
  const [lastPaymentDate, setLastPaymentDate] = useState<string>("");

  const [openingFineDays, setOpeningFineDays] = useState("0");
  const [openingFineMonths, setOpeningFineMonths] = useState("0");
  const [openingTotalFine, setOpeningTotalFine] = useState("0");
  const [openingOutstandingFees, setOpeningOutstandingFees] = useState("0");

  const openingOutstandingTotal = useMemo(() => {
    return num(openingOutstandingFees) + num(openingTotalFine);
  }, [openingOutstandingFees, openingTotalFine]);

  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);

  // Handle PDF file selection
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPdfError("");

    if (!file) {
      setAgreementPdf(null);
      setAgreementPdfBase64("");
      return;
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      setPdfError("Please select a PDF file");
      setAgreementPdf(null);
      setAgreementPdfBase64("");
      e.target.value = "";
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setPdfError("PDF file must be smaller than 10MB");
      setAgreementPdf(null);
      setAgreementPdfBase64("");
      e.target.value = "";
      return;
    }

    setAgreementPdf(file);

    // Convert to base64
    try {
      const base64 = await fileToBase64(file);
      setAgreementPdfBase64(base64);
    } catch (error) {
      setPdfError("Failed to process PDF file");
      setAgreementPdf(null);
      setAgreementPdfBase64("");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const reset = () => {
    setLandName("");
    setRenterName("");
    setRentStartDate("");
    setRentEndDate("");
    setAgreementNumber("");
    setLetGoDate("");
    setSizeSqft("1800");
    setRate("1.7");
    setPaymentDueDay("10");

    setAgreementPdf(null);
    setAgreementPdfBase64("");
    setPdfError("");

    setLastPaymentDate("");
    setOpeningFineDays("0");
    setOpeningFineMonths("0");
    setOpeningTotalFine("0");
    setOpeningOutstandingFees("0");
    setBreakdown([]);

    setMsg(null);
  };

  const onSubmit = async () => {
    setMsg(null);

    if (!landName.trim()) return setMsg("Land name is required.");
    if (!renterName.trim()) return setMsg("Renter name is required.");
    if (!rentStartDate) return setMsg("Rent duration start is required.");
    if (!rentEndDate) return setMsg("Rent duration end is required.");
    if (!agreementNumber.trim()) return setMsg("Agreement number is required.");

    const due = clampInt(num(paymentDueDay), 1, 28);
    if (String(due) !== paymentDueDay) setPaymentDueDay(String(due));

    setSubmitting(true);
    try {
      await createLandRentHolder({
        landName: landName.trim(),
        renterName: renterName.trim(),

        rentStartDate: toISODate(rentStartDate),
        rentEndDate: toISODate(rentEndDate),

        agreementNumber: agreementNumber.trim(),
        letGoDate: letGoDate ? toISODate(letGoDate) : null,

        // PDF agreement (optional)
        agreementPdfBase64: agreementPdfBase64 || null,
        agreementPdfFilename: agreementPdf?.name || null,

        sizeSqft: num(sizeSqft),
        rate: num(rate),
        monthlyRent,

        paymentDueDay: due,
        finePerDay, // auto

        // Opening snapshot
        lastPaymentDate: lastPaymentDate ? toISODate(lastPaymentDate) : null,
        openingFineDays: Math.floor(num(openingFineDays)),
        openingFineMonths: Math.floor(num(openingFineMonths)),
        openingTotalFine: num(openingTotalFine),
        openingOutstandingFees: num(openingOutstandingFees),
        openingOutstandingTotal:
          num(openingOutstandingFees) + num(openingTotalFine),
      });

      setMsg("Created successfully.");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to create.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const lastPaid = safeParseDate(lastPaymentDate);
    if (!lastPaid) {
      setOpeningFineDays("0");
      setOpeningFineMonths("0");
      setOpeningTotalFine("0");
      setOpeningOutstandingFees("0");
      setBreakdown([]);
      return;
    }

    const start = safeParseDate(rentStartDate);
    const end = safeParseDate(rentEndDate);
    const letGo = safeParseDate(letGoDate);

    const dueDay = clampInt(num(paymentDueDay || "10"), 1, 28);

    // Effective "today" is capped by letGo / rentEnd (if they are earlier than today)
    const realToday = dateOnly(new Date());
    const capA = letGo ? dateOnly(letGo) : null;
    const capB = end ? dateOnly(end) : null;

    let effectiveToday = realToday;
    if (capA && capA.getTime() < effectiveToday.getTime())
      effectiveToday = capA;
    if (capB && capB.getTime() < effectiveToday.getTime())
      effectiveToday = capB;

    // Unpaid months start: month after last payment month
    let fromMonth = addMonths(startOfMonth(lastPaid), 1);

    // Don’t allow fromMonth before rentStart month (if present)
    if (start) {
      const rentStartMonth = startOfMonth(start);
      if (fromMonth.getTime() < rentStartMonth.getTime())
        fromMonth = rentStartMonth;
    }

    // Last considered month:
    // - Normally current month of effectiveToday,
    // - BUT if effectiveToday is in current month and we have NOT reached due day yet,
    //   then last considered month is previous month.
    let toMonth = startOfMonth(effectiveToday);
    const dueThisMonth = new Date(
      toMonth.getFullYear(),
      toMonth.getMonth(),
      dueDay
    );
    if (effectiveToday.getTime() <= dateOnly(dueThisMonth).getTime()) {
      toMonth = addMonths(toMonth, -1);
    }

    // If no unpaid months
    if (toMonth.getTime() < fromMonth.getTime()) {
      setOpeningFineDays("0");
      setOpeningFineMonths("0");
      setOpeningTotalFine("0");
      setOpeningOutstandingFees("0");
      setBreakdown([]);
      return;
    }

    const rows: BreakdownRow[] = [];
    let totalDays = 0;
    let totalFine = 0;
    let monthCount = 0;

    for (const m of monthStartsBetweenInclusive(fromMonth, toMonth)) {
      monthCount += 1;

      const dueDate = new Date(m.getFullYear(), m.getMonth(), dueDay);
      const fineStart = new Date(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate() + 1
      );

      const days =
        effectiveToday.getTime() > dateOnly(dueDate).getTime()
          ? daysBetween(fineStart, effectiveToday) + 1
          : 0;

      const fine = days * finePerDay;

      totalDays += days;
      totalFine += fine;

      rows.push({
        key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
        label: fmtMonthYear(m),
        days,
        fine,
      });
    }

    const outstandingFees = monthCount * monthlyRent;

    setBreakdown(rows);
    setOpeningFineMonths(String(monthCount));
    setOpeningFineDays(String(totalDays));
    setOpeningOutstandingFees(String(Number(outstandingFees.toFixed(2))));
    setOpeningTotalFine(String(Number(totalFine.toFixed(2))));
  }, [
    lastPaymentDate,
    rentStartDate,
    rentEndDate,
    letGoDate,
    paymentDueDay,
    monthlyRent,
    finePerDay,
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="surface p-6 md:p-8">
        <div className="space-y-1">
          <h1 className="h2">Create Land Rent Holder</h1>
          <p className="body-2 text-muted-foreground">
            This creates Tenant + Land Parcel + Lease in Appwrite.
          </p>
        </div>

        <div className="mt-7 space-y-6">
          {/* Row 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="subtitle-2">Land name</label>
              <input
                value={landName}
                onChange={(e) => setLandName(e.target.value)}
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="subtitle-2">Renter name</label>
              <input
                value={renterName}
                onChange={(e) => setRenterName(e.target.value)}
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="subtitle-2">Rent duration (start)</label>
              <input
                type="date"
                value={rentStartDate}
                onChange={(e) => setRentStartDate(e.target.value)}
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="subtitle-2">Rent duration (end)</label>
              <input
                type="date"
                value={rentEndDate}
                onChange={(e) => setRentEndDate(e.target.value)}
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>
          </div>

          {/* Agreement */}
          <div className="space-y-1.5">
            <label className="subtitle-2">Agreement number</label>
            <input
              value={agreementNumber}
              onChange={(e) => setAgreementNumber(e.target.value)}
              className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
            />
          </div>

          {/* PDF Upload Section */}
          <div className="space-y-1.5">
            <label className="subtitle-2">Agreement PDF (optional)</label>
            <div className="space-y-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:bg-black/5 file:text-black hover:file:bg-black/10 file:cursor-pointer"
              />
              {pdfError && <p className="text-sm text-red-600">{pdfError}</p>}
              {agreementPdf && !pdfError && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>
                    {agreementPdf.name} ({(agreementPdf.size / 1024).toFixed(1)}{" "}
                    KB)
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a PDF copy of the rental agreement (max 10MB)
            </p>
          </div>

          {/* Let go */}
          <div className="space-y-1.5">
            <label className="subtitle-2">Let go date (optional)</label>
            <input
              type="date"
              value={letGoDate}
              onChange={(e) => setLetGoDate(e.target.value)}
              className="w-full max-w-sm rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
            />
          </div>

          {/* Size / Rate / Monthly */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="subtitle-2">Size (sqft)</label>
              <input
                value={sizeSqft}
                onChange={(e) => setSizeSqft(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="subtitle-2">Rate (lari per sqft)</label>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="subtitle-2">Monthly rent (auto)</label>
              <input
                value={monthlyRent.toFixed(2)}
                readOnly
                className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
              />
            </div>
          </div>

          {/* Due day / fine per day */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="subtitle-2">Payment due day (1–28)</label>
              <input
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="subtitle-2">Fine (lari per day) (auto)</label>
              <input
                value={finePerDay.toFixed(2)}
                readOnly
                className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
              />
            </div>
          </div>

          {/* Existing fines */}
          <div className="pt-2">
            <div className="h4">Existing fines / arrears (if any)</div>
            <p className="body-2 text-muted-foreground mt-1">
              Use this only if the renter already has unpaid rent or fines from
              before you started tracking.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="subtitle-2">Last payment date</label>
                <input
                  type="date"
                  value={lastPaymentDate}
                  onChange={(e) => setLastPaymentDate(e.target.value)}
                  className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-4 py-3 outline-none"
                />

                {breakdown.length > 0 ? (
                  <div className="mt-3 rounded-2xl bg-black/[0.03] ring-1 ring-black/10 p-4">
                    <div className="subtitle-2 mb-2">
                      Fine breakdown (per unpaid month)
                    </div>
                    <div className="space-y-1.5 text-[13px]">
                      {breakdown.map((b) => (
                        <div
                          key={b.key}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="text-muted-foreground">
                            {b.label}:
                          </div>
                          <div className="font-semibold tabular-nums">
                            {b.days} days • {b.fine.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="subtitle-2">Chargeable fine days</label>
                <input
                  value={openingFineDays}
                  readOnly
                  className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="subtitle-2">Chargeable fine months</label>
                <input
                  value={openingFineMonths}
                  readOnly
                  className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="subtitle-2">Total fine</label>
                <input
                  value={openingTotalFine}
                  readOnly
                  className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="subtitle-2">Total outstanding fees</label>
                <input
                  value={openingOutstandingFees}
                  readOnly
                  className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="subtitle-2">
                  Total outstanding (fees + fine)
                </label>
                <input
                  value={(
                    num(openingOutstandingFees) + num(openingTotalFine)
                  ).toFixed(2)}
                  readOnly
                  className="w-full rounded-2xl ring-1 ring-black/10 bg-black/[0.03] px-4 py-3 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="rounded-2xl bg-black px-6 py-3 text-white button disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create"}
            </button>

            <button
              type="button"
              onClick={reset}
              className="rounded-2xl ring-1 ring-black/10 px-6 py-3 button bg-white"
            >
              Reset
            </button>

            {msg ? (
              <div className="ml-auto body-2 text-muted-foreground">{msg}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
