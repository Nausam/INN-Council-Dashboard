/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  CouncilCard,
  CouncilDatePicker,
  PageHeader,
  PageShell,
} from "@/components/design-system";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { createLandRentHolder } from "@/lib/landrent/landRent.actions";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  Receipt,
  RotateCcw,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const ms = 24 * 60 * 60 * 1000;
  const aa = dateOnly(a).getTime();
  const bb = dateOnly(b).getTime();
  return Math.max(0, Math.floor((bb - aa) / ms));
}

function monthStartsBetweenInclusive(fromMonthStart: Date, toMonthStart: Date) {
  const out: Date[] = [];
  let cur = new Date(
    fromMonthStart.getFullYear(),
    fromMonthStart.getMonth(),
    1,
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
  label: string;
  days: number;
  fine: number;
};

const formGrid = "grid gap-5 md:grid-cols-2";
const inputClass =
  "council-input h-11 w-full min-w-0 px-4 py-0 text-sm font-medium";

function FormField({
  label,
  children,
  className,
  hint,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
  htmlFor?: string;
}) {
  const labelClass = "block text-sm font-semibold text-slate-700";

  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <p className={labelClass}>{label}</p>
      )}
      {children}
      {hint ? <p className="text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ComputedStat({
  label,
  value,
  suffix = "MVR",
  className,
}: {
  label: string;
  value: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/80",
        className,
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-slate-900">
        {value}
        {suffix ? (
          <span className="ml-1.5 text-sm font-semibold text-slate-500">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function FormSectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <CouncilCard interactive="none" className="mb-6 overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/20">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </CouncilCard>
  );
}

export default function Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"success" | "error">("error");

  const [landName, setLandName] = useState("");
  const [renterName, setRenterName] = useState("");

  const [rentStartDate, setRentStartDate] = useState("");
  const [rentEndDate, setRentEndDate] = useState("");

  const [agreementNumber, setAgreementNumber] = useState("");
  const [letGoDate, setLetGoDate] = useState<string>("");

  const [sizeSqft, setSizeSqft] = useState("1800");
  const [rate, setRate] = useState("1.7");

  const [agreementPdf, setAgreementPdf] = useState<File | null>(null);
  const [agreementPdfBase64, setAgreementPdfBase64] = useState<string>("");
  const [pdfError, setPdfError] = useState<string>("");

  const monthlyRent = useMemo(() => {
    const v = num(sizeSqft) * num(rate);
    return Number.isFinite(v) ? v : 0;
  }, [sizeSqft, rate]);

  const [paymentDueDay, setPaymentDueDay] = useState("10");

  const finePerDay = useMemo(() => {
    const v = (monthlyRent / 30) * 0.25;
    return Number.isFinite(v) ? v : 0;
  }, [monthlyRent]);

  const [lastPaymentDate, setLastPaymentDate] = useState<string>("");

  const [openingFineDays, setOpeningFineDays] = useState("0");
  const [openingFineMonths, setOpeningFineMonths] = useState("0");
  const [openingTotalFine, setOpeningTotalFine] = useState("0");
  const [openingOutstandingFees, setOpeningOutstandingFees] = useState("0");

  const openingOutstandingTotal = useMemo(() => {
    return num(openingOutstandingFees) + num(openingTotalFine);
  }, [openingOutstandingFees, openingTotalFine]);

  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPdfError("");

    if (!file) {
      setAgreementPdf(null);
      setAgreementPdfBase64("");
      return;
    }

    if (file.type !== "application/pdf") {
      setPdfError("Please select a PDF file");
      setAgreementPdf(null);
      setAgreementPdfBase64("");
      e.target.value = "";
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setPdfError("PDF file must be smaller than 10MB");
      setAgreementPdf(null);
      setAgreementPdfBase64("");
      e.target.value = "";
      return;
    }

    setAgreementPdf(file);

    try {
      const base64 = await fileToBase64(file);
      setAgreementPdfBase64(base64);
    } catch {
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

    const fail = (message: string) => {
      setMsgTone("error");
      setMsg(message);
    };

    if (!landName.trim()) return fail("Land name is required.");
    if (!renterName.trim()) return fail("Renter name is required.");
    if (!rentStartDate) return fail("Rent duration start is required.");
    if (!rentEndDate) return fail("Rent duration end is required.");
    if (!agreementNumber.trim()) return fail("Agreement number is required.");

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

        agreementPdfBase64: agreementPdfBase64 || null,
        agreementPdfFilename: agreementPdf?.name || null,

        sizeSqft: num(sizeSqft),
        rate: num(rate),
        monthlyRent,

        paymentDueDay: due,
        finePerDay,

        lastPaymentDate: lastPaymentDate ? toISODate(lastPaymentDate) : null,
        openingFineDays: Math.floor(num(openingFineDays)),
        openingFineMonths: Math.floor(num(openingFineMonths)),
        openingTotalFine: num(openingTotalFine),
        openingOutstandingFees: num(openingOutstandingFees),
        openingOutstandingTotal:
          num(openingOutstandingFees) + num(openingTotalFine),
      });

      setMsgTone("success");
      setMsg("Land rent holder created successfully.");
      toast({
        title: "Created",
        description: "The lease is ready in the land rent overview.",
      });
      router.push("/landRent");
    } catch (e: any) {
      setMsgTone("error");
      setMsg(e?.message ?? "Failed to create.");
      toast({
        variant: "destructive",
        title: "Could not create",
        description: e?.message ?? "Failed to create.",
      });
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

    const realToday = dateOnly(new Date());
    const capA = letGo ? dateOnly(letGo) : null;
    const capB = end ? dateOnly(end) : null;

    let effectiveToday = realToday;
    if (capA && capA.getTime() < effectiveToday.getTime())
      effectiveToday = capA;
    if (capB && capB.getTime() < effectiveToday.getTime())
      effectiveToday = capB;

    let fromMonth = addMonths(startOfMonth(lastPaid), 1);

    if (start) {
      const rentStartMonth = startOfMonth(start);
      if (fromMonth.getTime() < rentStartMonth.getTime())
        fromMonth = rentStartMonth;
    }

    let toMonth = startOfMonth(effectiveToday);
    const dueThisMonth = new Date(
      toMonth.getFullYear(),
      toMonth.getMonth(),
      dueDay,
    );
    if (effectiveToday.getTime() <= dateOnly(dueThisMonth).getTime()) {
      toMonth = addMonths(toMonth, -1);
    }

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
        dueDate.getDate() + 1,
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

  const pdfInputId = "land-rent-agreement-pdf";

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/landRent"
          aria-label="Back to land rent"
          className={buttonVariants({
            variant: "council-outline",
            className: "mb-6 h-11 rounded-xl px-4",
          })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <PageHeader
          icon={Landmark}
          title="Create land rent holder"
          subtitle="Register the parcel, lease terms, and any opening arrears so statements can be generated from day one."
          className="mb-8"
        />

        <FormSectionCard
          icon={MapPin}
          title="Land & renter"
          description="Basic identity for the parcel and the person or entity renting it."
        >
          <div className={formGrid}>
            <FormField label="Land name">
              <input
                value={landName}
                onChange={(e) => setLandName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Plot 12, Ward A"
              />
            </FormField>

            <FormField label="Renter name">
              <input
                value={renterName}
                onChange={(e) => setRenterName(e.target.value)}
                className={inputClass}
                placeholder="Full legal name"
              />
            </FormField>
          </div>
        </FormSectionCard>

        <FormSectionCard
          icon={FileText}
          title="Agreement"
          description="Lease dates, reference number, and an optional signed PDF."
        >
          <div className={formGrid}>
            <FormField label="Rent start">
              <CouncilDatePicker
                value={rentStartDate}
                onChange={setRentStartDate}
                placeholder="Start date"
              />
            </FormField>

            <FormField label="Rent end">
              <CouncilDatePicker
                value={rentEndDate}
                onChange={setRentEndDate}
                placeholder="End date"
              />
            </FormField>

            <FormField label="Agreement number">
              <input
                value={agreementNumber}
                onChange={(e) => setAgreementNumber(e.target.value)}
                className={inputClass}
                placeholder="Council agreement reference"
              />
            </FormField>

            <FormField
              label="Let go date"
              hint="Optional. Caps fines when the lease ends early."
            >
              <CouncilDatePicker
                value={letGoDate}
                onChange={setLetGoDate}
                placeholder="Not set"
              />
            </FormField>
          </div>

          <FormField
            label="Agreement PDF"
            htmlFor={pdfInputId}
            hint="Optional. PDF only, max 10MB."
          >
            <label
              htmlFor={pdfInputId}
              className={cn(
                "flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
                agreementPdf && !pdfError
                  ? "border-teal-200 bg-teal-50/40"
                  : "border-slate-200 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/30",
              )}
            >
              <input
                id={pdfInputId}
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="sr-only"
              />
              {agreementPdf && !pdfError ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-teal-600" />
                  <span className="text-sm font-semibold text-teal-800">
                    {agreementPdf.name}
                  </span>
                  <span className="text-xs text-teal-700/80">
                    {(agreementPdf.size / 1024).toFixed(1)} KB · tap to replace
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    Upload agreement PDF
                  </span>
                  <span className="text-xs text-slate-500">
                    Click to browse
                  </span>
                </>
              )}
            </label>
            {pdfError ? (
              <p className="text-sm font-medium text-rose-600">{pdfError}</p>
            ) : null}
          </FormField>
        </FormSectionCard>

        <FormSectionCard
          icon={Banknote}
          title="Rent & fines"
          description="Monthly rent is size × rate. Fine per day is 25% of the daily rent."
        >
          <div className={formGrid}>
            <FormField label="Size (sqft)">
              <input
                value={sizeSqft}
                onChange={(e) => setSizeSqft(e.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </FormField>

            <FormField label="Rate (MVR per sqft)">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </FormField>

            <FormField
              label="Payment due day"
              hint="Day of the month (1–28) when rent is due."
            >
              <input
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value)}
                inputMode="numeric"
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ComputedStat
              label="Monthly rent"
              value={monthlyRent.toFixed(2)}
            />
            <ComputedStat
              label="Fine per day"
              value={finePerDay.toFixed(2)}
            />
          </div>
        </FormSectionCard>

        <FormSectionCard
          icon={Receipt}
          title="Opening arrears"
          description="Only if the renter already owes rent or fines before you start tracking."
        >
          <FormField
            label="Last payment date"
            hint="Leave empty if there is no prior payment history. Fills in the totals below automatically."
          >
            <CouncilDatePicker
              value={lastPaymentDate}
              onChange={setLastPaymentDate}
              placeholder="No prior payment"
            />
          </FormField>

          {breakdown.length > 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                Fine breakdown by month
              </p>
              <ul className="divide-y divide-slate-200/80">
                {breakdown.map((b) => (
                  <li
                    key={b.key}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="font-medium text-slate-600">
                      {b.label}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {b.days} days · {b.fine.toFixed(2)} MVR
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ComputedStat
              label="Chargeable fine days"
              value={openingFineDays}
              suffix=""
            />
            <ComputedStat
              label="Chargeable fine months"
              value={openingFineMonths}
              suffix=""
            />
            <ComputedStat label="Total fine" value={openingTotalFine} />
            <ComputedStat
              label="Outstanding fees"
              value={openingOutstandingFees}
            />
            <ComputedStat
              label="Total outstanding"
              value={openingOutstandingTotal.toFixed(2)}
              className="sm:col-span-2 lg:col-span-3"
            />
          </div>
        </FormSectionCard>

        {msg ? (
          <div
            role="alert"
            className={cn(
              "mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ring-1",
              msgTone === "success"
                ? "bg-teal-50 text-teal-900 ring-teal-200"
                : "bg-rose-50 text-rose-900 ring-rose-200",
            )}
          >
            {msgTone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{msg}</span>
          </div>
        ) : null}

        <CouncilCard
          interactive="none"
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <p className="text-sm text-slate-600">
            Creates the tenant, parcel, and lease records in one step.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="council"
              className="h-11 rounded-xl px-6"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create holder"
              )}
            </Button>

            <Button
              type="button"
              variant="council-outline"
              className="h-11 rounded-xl px-6"
              onClick={reset}
              disabled={submitting}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CouncilCard>
      </div>
    </PageShell>
  );
}
