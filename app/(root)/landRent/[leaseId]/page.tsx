/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import CouncilInvoiceTemplate from "@/components/landRent/CouncilInvoiceTemplate";
import {
  createLandRentPayment,
  fetchLandLeaseOptions,
  getLandRentMonthlyDetails,
  LandLeaseOption,
  LandPaymentDoc,
  listLandPaymentsForLease,
} from "@/lib/landrent/landRent.actions";
import html2pdf from "html2pdf.js";
import { CreditCard, Hash, Receipt, User2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function getThisMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthKeyToFullDate(monthKey: string, day = 1) {
  // monthKey: "YYYY-MM"
  const [y, m] = monthKey.split("-");
  if (!y || !m) return monthKey;
  const dd = String(day).padStart(2, "0");
  const mm = String(Number(m)).padStart(2, "0");
  return `${dd}-${mm}-${y}`; // "01-01-2026"
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDateShort(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function fmtDateTimeShort(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function toDatetimeLocalValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function Page() {
  const [options, setOptions] = useState<LandLeaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capToEndDate, setCapToEndDate] = useState(false);

  const searchParams = useSearchParams();

  const [leaseId, setLeaseId] = useState<string>(
    searchParams.get("leaseId") ?? ""
  );

  const [monthKey, setMonthKey] = useState<string>(
    searchParams.get("monthKey") ?? getThisMonthKey()
  );

  const [details, setDetails] = useState<Awaited<
    ReturnType<typeof getLandRentMonthlyDetails>
  > | null>(null);

  // Payments UI
  const [payments, setPayments] = useState<LandPaymentDoc[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [payAmount, setPayAmount] = useState<string>("");
  const [payAtLocal, setPayAtLocal] = useState<string>(
    toDatetimeLocalValue(new Date())
  );
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payReference, setPayReference] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [payReceivedBy, setPayReceivedBy] = useState<string>("");

  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentOk, setPaymentOk] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadingOptions(true);
    setError(null);

    fetchLandLeaseOptions()
      .then((opts) => {
        if (!alive) return;
        setOptions(opts);
        setLeaseId((prev) => prev || (opts[0]?.leaseId ?? ""));
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Failed to load leases.");
      })
      .finally(() => {
        if (!alive) return;
        setLoadingOptions(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leaseId || !monthKey) return;

    let alive = true;
    setLoading(true);
    setError(null);

    getLandRentMonthlyDetails({ leaseId, monthKey, capToEndDate })
      .then((d) => {
        if (!alive) return;
        setDetails(d);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Failed to load statement.");
        setDetails(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [leaseId, monthKey, capToEndDate]);

  useEffect(() => {
    if (!leaseId) {
      setPayments([]);
      return;
    }

    let alive = true;
    setPaymentsLoading(true);

    listLandPaymentsForLease(leaseId)
      .then((rows) => {
        if (!alive) return;
        setPayments(rows ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setPayments([]);
      })
      .finally(() => {
        if (!alive) return;
        setPaymentsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [leaseId]);

  const paymentsTotal = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number((p as any).amount ?? 0), 0);
  }, [payments]);

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.leaseId === leaseId);
    if (!o) return "";
    return `${o.landName} — ${o.tenantName}`;
  }, [options, leaseId]);

  const template = useMemo(() => {
    if (!details) return null;

    const remainingOutstanding = Math.max(
      0,
      Number(details.totalRentPaymentMonthly ?? 0) - Number(paymentsTotal ?? 0)
    );

    const rentDurationText = `${fmtDateShort(
      details.rentDuration.startDate
    )} އިން ${fmtDateShort(details.rentDuration.endDate)} އަށް`;

    const releasedText = details.letGoDate
      ? fmtDateShort(details.letGoDate)
      : "-";

    const monthlyRent = fmtMoney(details.monthlyRentPaymentAmount);
    const totalMonthly = fmtMoney(details.totalRentPaymentMonthly);

    // ✅ Payment record (from Payments history)
    const latestPaymentRecord = payments.length
      ? payments
          .slice()
          .sort(
            (a, b) =>
              new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
          )[0]
      : null;

    const balanceAfterPayments =
      Number(details.totalRentPaymentMonthly ?? 0) - Number(paymentsTotal ?? 0);

    return (
      <CouncilInvoiceTemplate
        leftLogoSrc="/assets/images/innamaadhoo-logo.png"
        crestSrc="/assets/images/crest.png"
        headerCenterLines={[
          {
            text: "މާޅޮސްމަޑުލު އުތުރުބުރީ އިންނަމާދޫ ކައުންސިލް އިދާރާ",
            highlight: true,
          },
          {
            text: "ރ.އިންނަމާދޫ، ދިވެހިރާއްޖެ",
            highlight: true,
          },
        ]}
        title={{ text: "ކުލި ދައްކަންޖެހޭގޮތުގެ ތަފްޞީލް", highlight: true }}
        leftInfo={{
          lines: [
            {
              text: "ކުލި ޖަމާކުރާ އެކައުންޓް: 001 700406 7717 ( ރެވެނިޔު 01)",
              highlight: true,
            },
            {
              text: "ކުލި ދައްކަންޖެހޭ މުއްދަތު: ކޮންމެ މީލާދީ މަހެއްގެ 10 ވަނަ ދުވަހުގެ ކުރިން",
              highlight: true,
            },
            {
              text: `މަހަކު ދައްކަންޖެހޭ: ${monthlyRent}`,
              highlight: true,
            },
            {
              text: "ކުލި ފައިސާ އެކައުންޓަށް ޖަމާކުރާނަމަ ސްލިޕް މިއިދާރާއަށް 3 ދުވަސްތެރޭގައި ފޮނުވުން އެދެން.",
              highlight: true,
            },
          ],
          amount: "",
        }}
        rightInfo={{
          lines: [
            { text: `ތަނުގެ ނަން: ${details.landName}`, highlight: true },
            {
              text: `ކުއްޔަށް ހިފި ފަރާތް: ${details.rentingPerson}`,
              highlight: true,
            },
            {
              text: `ކުއްޔަށް ދޫކުރި މުއްދަތު: ${rentDurationText}`,
              highlight: true,
            },
            {
              text: `އެގްރިމެންޓްގެ ނަންބަރު: ${details.agreementNumber}`,
              highlight: true,
            },
            {
              text: `ދޫކޮއްލި / ވަކިކުރި ތާރީޙް: ${releasedText}`,
              highlight: true,
            },
          ],
        }}
        contact={{
          email: "finance@innamaadhoo.gov.mv",
          phone: "7380052",
          whatsapp: "",
        }}
        columns={[
          {
            key: "c1",
            label: { text: "ޖުމްލަ ކުލީގެ އަދަދު", highlight: true },
          },
          { key: "c2", label: { text: "މަހުގެ ކުލި", highlight: true } },
          {
            key: "c3",
            label: { text: "ކުލި ނުދައްކާ ދުވަހުގެ އަދަދު", highlight: true },
          },
          {
            key: "c4",
            label: { text: "ޖޫރިމަނާ ފައިސާގެ އަދަދު", highlight: true },
          },
          {
            key: "c5",
            label: { text: "ޖޫރިމަނާ ދުވަހުގެ އަދަދު", highlight: true },
          },
          {
            key: "c6",
            label: { text: "އެންމެފަހުން ދެއްކި ތާރީޚް", highlight: true },
          },
          { key: "c7", label: { text: "ކުލި ރޭޓް (ލާރި)", highlight: true } },
          {
            key: "c8",
            label: { text: "ބިމުގެ ބޮޑުމިން (އަކަފޫޓް)", highlight: true },
          },
        ]}
        rows={[
          {
            c1: { value: totalMonthly, highlight: true },
            c2: { value: monthlyRent, highlight: true },
            c3: { value: String(details.unpaidMonths), highlight: true },
            c4: { value: fmtMoney(details.fineAmount), highlight: true },
            c5: { value: String(details.numberOfFineDays), highlight: true },
            c6: {
              value: fmtDateShort(details.latestPaymentDate),
              highlight: true,
            },
            c7: { value: String(details.rentRate), highlight: true },
            c8: { value: String(details.sizeOfLand), highlight: true },
          },
        ]}
        totalLabel={{ text: "ޖުމްލަ: (ރުފިޔާ)", highlight: true }}
        totalAmount={{ text: totalMonthly, highlight: true }}
        footerNote={{
          text: `ނޯޓް: ކުލީގެ ތަފްސީލް ހެދިފައިވަނީ ${monthKeyToFullDate(
            monthKey,
            1
          )} ވަނަ ދުވަހުގެ ނިޔަލަށް އަރާފައިވާ ކުއްޔާއި ޖޫރިމަނާއެވެ.`,
          highlight: true,
        }}
      >
        {/* ✅ Payment record (RTL + statement style) */}
        {/* Payment record (RTL) */}
        <div
          dir="rtl"
          className="mt-4 rounded-2xl ring-1 ring-black/10 overflow-hidden font-dh1"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white">
            <div className="text-md font-semibold tracking-tight font-dh1">
              ދެއްކި ފައިސާގެ ރެކޯޑު
            </div>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[140px_1fr_140px] bg-[#064E3B] text-white">
            <div className="px-4 py-3 text-md font-semibold font-dh1 text-right">
              ތާރީޚް
            </div>
            <div className="px-4 py-3 text-md font-semibold font-dh1 text-center">
              ތަފްޞީލް
            </div>
            <div className="px-4 py-3 text-md font-semibold font-dh1 text-left">
              އަދަދު
            </div>
          </div>

          {/* Rows */}
          <div className="bg-white">
            {(payments ?? []).length === 0 ? (
              <div className="px-4 py-6 text-sm text-black/60 font-dh1">
                ޕޭމަންޓެއް ނޯޓުވެއެވެ.
              </div>
            ) : (
              <div className="divide-y divide-black/10">
                {(payments ?? [])
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.paidAt).getTime() -
                      new Date(a.paidAt).getTime()
                  )
                  .map((p) => {
                    const method = String((p as any).method ?? "").trim();
                    const note = String((p as any).note ?? "").trim();
                    const amount = Number((p as any).amount ?? 0);

                    return (
                      <div
                        key={p.$id}
                        className="grid grid-cols-[140px_1fr_140px] items-center"
                      >
                        {/* Date */}
                        <div className="px-4 py-3 text-sm font-semibold tabular-nums text-right">
                          {fmtDateShort(p.paidAt)}
                        </div>

                        {/* Details (one line, centered) */}
                        <div className="px-4 py-3 min-w-0">
                          <div className="flex flex-nowrap items-center justify-center gap-2 min-w-0 whitespace-nowrap">
                            {note ? (
                              <span className="min-w-0 truncate text-md text-black/60 max-w-[520px]">
                                {note}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="px-4 py-3 text-left">
                          <span className="inline-flex items-center rounded-full bg-black/[0.03] px-3 py-1.5 ring-1 ring-black/10">
                            <span className="text-sm font-semibold tabular-nums">
                              {fmtMoney(amount)}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Footer (2 rows, not wide, no placeholder) */}
            <div className="border-t border-black/10 bg-black/[0.03] px-4 py-3">
              <div className="mr-auto w-fit text-left">
                <div className="flex items-baseline justify-between gap-8">
                  <div className="text-md text-emerald-800 font-dh1">
                    ޖުމްލަ ދެއްކި
                  </div>
                  <div className="text-md font-semibold tabular-nums text-emerald-800">
                    {fmtMoney(paymentsTotal)}
                  </div>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-8">
                  <div className="text-md text-red-700 font-dh1">ބާކީ</div>
                  <div className="text-md font-semibold tabular-nums text-red-700">
                    {fmtMoney(remainingOutstanding)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CouncilInvoiceTemplate>
    );
  }, [details, monthKey, payments, paymentsTotal]);

  const latestPaymentRecord = useMemo(() => {
    if (!payments.length) return null;
    return payments
      .slice()
      .sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      )[0];
  }, [payments]);

  const balanceAfterPayments = useMemo(() => {
    if (!details) return 0;
    const base = Number(details.totalRentPaymentMonthly ?? 0);
    return base - Number(paymentsTotal ?? 0);
  }, [details, paymentsTotal]);

  async function refreshStatement() {
    if (!leaseId || !monthKey) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getLandRentMonthlyDetails({
        leaseId,
        monthKey,
        capToEndDate,
      });
      setDetails(d);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load statement.");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPayments() {
    if (!leaseId) return;
    setPaymentsLoading(true);
    try {
      const rows = await listLandPaymentsForLease(leaseId);
      setPayments(rows ?? []);
    } catch {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function onSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!leaseId) return;

    setSavingPayment(true);
    setPaymentOk(null);
    setPaymentError(null);

    try {
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount greater than 0.");
      }

      const paidAt = new Date(payAtLocal);
      if (Number.isNaN(paidAt.getTime())) {
        throw new Error("Invalid payment date/time.");
      }

      await createLandRentPayment({
        leaseId,
        paidAt: paidAt.toISOString(),
        amount,
        method: payMethod || "",
        reference: payReference || "",
        note: payNote || "",
        receivedBy: payReceivedBy || "",
      });

      setPayAmount("");
      setPayReference("");
      setPayNote("");
      setPaymentOk("Payment saved. Statement updated.");

      await refreshPayments();
    } catch (err: any) {
      setPaymentError(err?.message ?? "Failed to save payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  const invoiceRef = useRef<HTMLDivElement>(null);

  async function onDownloadPdf() {
    const el = invoiceRef.current;
    if (!el) return;

    const margin = 6; // mm
    const A4_LANDSCAPE = { w: 297, h: 210 }; // mm

    const rect = el.getBoundingClientRect();
    const pxToMm = (px: number) => (px * 25.4) / 96;

    const contentWmm = pxToMm(rect.width);
    const contentHmm = pxToMm(rect.height);

    const maxW = A4_LANDSCAPE.w - margin * 2;
    const maxH = A4_LANDSCAPE.h - margin * 2;
    const fitScale = Math.min(maxW / contentWmm, maxH / contentHmm, 1);

    const prevTransform = el.style.transform;
    const prevOrigin = el.style.transformOrigin;

    el.style.transformOrigin = "top left";
    el.style.transform = `scale(${fitScale})`;

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    try {
      const worker = (html2pdf() as any).from(el).set({
        filename: `land-rent-${leaseId || "statement"}-${monthKey}.pdf`,
        margin,
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        html2canvas: {
          scale: 3,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      });

      await worker
        .toPdf()
        .get("pdf")
        .then((pdf: any) => {
          const n = pdf.internal.getNumberOfPages();
          // remove trailing pages (your issue: last page is blank)
          for (let i = n; i >= 2; i--) pdf.deletePage(i);
        });

      await worker.save();
    } finally {
      el.style.transform = prevTransform;
      el.style.transformOrigin = prevOrigin;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 space-y-6">
      {/* Controls */}
      <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-sky-500/25 via-fuchsia-500/15 to-emerald-500/20">
        <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-[0_10px_30px_-20px_rgba(0,0,0,.35)]">
          {/* inner wash */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_20%_-10%,rgba(56,189,248,.12),transparent_60%),radial-gradient(900px_420px_at_90%_0%,rgba(217,70,239,.10),transparent_55%)]" />

          <div className="relative p-4 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_2fr] lg:items-center">
              {/* Left copy */}
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/[0.04] ring-1 ring-black/10">
                    {/* simple inline icon so you don't need imports */}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-black/70"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 12h6" />
                      <path d="M9 16h6" />
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-lg font-semibold tracking-tight">
                      Land rent statement
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Select land/owner, choose month, then print.
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Land / Owner */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Land / Owner
                  </label>

                  <div className="relative">
                    <select
                      value={leaseId}
                      onChange={(e) => setLeaseId(e.target.value)}
                      disabled={loadingOptions || options.length === 0}
                      className="h-12 w-full appearance-none rounded-2xl bg-white px-4 pr-10 font-dh1 leading-tight
                           ring-1 ring-black/10 shadow-sm transition
                           focus:outline-none focus:ring-2 focus:ring-black/15
                           disabled:opacity-60"
                    >
                      {loadingOptions ? (
                        <option value="">Loading...</option>
                      ) : options.length === 0 ? (
                        <option value="">No leases found</option>
                      ) : (
                        options.map((o) => (
                          <option
                            className="text-right"
                            key={o.leaseId}
                            value={o.leaseId}
                          >
                            {o.landName}
                          </option>
                        ))
                      )}
                    </select>

                    {/* chevron */}
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Month */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Month
                  </label>

                  <input
                    type="month"
                    value={monthKey}
                    onChange={(e) => setMonthKey(e.target.value)}
                    className="h-12 w-full rounded-2xl bg-white px-4
                         ring-1 ring-black/10 shadow-sm transition
                         focus:outline-none focus:ring-2 focus:ring-black/15"
                  />

                  <div className="text-[11px] text-muted-foreground">
                    Pick the month to generate the statement period.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="surface p-4 text-red-600">{error}</div> : null}

      {/* Monthly calculation (above statement) */}
      {details ? (
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-sky-500/25 via-fuchsia-500/15 to-emerald-500/20">
          <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-[0_10px_30px_-20px_rgba(0,0,0,.35)]">
            {/* inner wash */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_20%_-10%,rgba(56,189,248,.12),transparent_60%),radial-gradient(900px_420px_at_90%_0%,rgba(16,185,129,.10),transparent_55%)]" />

            <div className="relative p-4 md:p-6">
              {/* Header row */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/[0.04] ring-1 ring-black/10">
                      {/* calculator icon (inline) */}
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 text-black/70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="6" y="2" width="12" height="20" rx="2" />
                        <path d="M9 6h6" />
                        <path d="M9 10h.01" />
                        <path d="M12 10h.01" />
                        <path d="M15 10h.01" />
                        <path d="M9 13h.01" />
                        <path d="M12 13h.01" />
                        <path d="M15 13h.01" />
                        <path d="M9 16h6" />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <div className="text-lg font-semibold tracking-tight">
                        Monthly calculation
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        <span className="font-medium font-dh1 text-black/80">
                          {details.landName}
                        </span>{" "}
                        <span className="text-black/25">•</span>{" "}
                        <span className="font-medium font-dh1 text-black/80">
                          {details.rentingPerson}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="rounded-2xl bg-white/80 ring-1 ring-black/10 shadow-sm">
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                    {/* Latest payment */}
                    <div className="flex items-center gap-3 px-1">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-black/[0.04] ring-1 ring-black/10">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4.5 w-4.5 text-black/70"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 8v4l2 2" />
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </div>
                      <div className="leading-tight">
                        <div className="text-[11px] text-muted-foreground">
                          Latest payment date
                        </div>
                        <div className="text-sm font-semibold tabular-nums">
                          {fmtDateShort(details.latestPaymentDate)}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block h-8 w-px bg-black/10" />

                    {/* Fine cap */}
                    <label className="flex items-center gap-3 select-none px-1">
                      <span className="relative inline-flex h-6 w-11 items-center">
                        <input
                          type="checkbox"
                          checked={capToEndDate}
                          onChange={(e) => setCapToEndDate(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="absolute inset-0 rounded-full bg-black/10 ring-1 ring-black/15 transition peer-checked:bg-black" />
                        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                      </span>

                      <div className="leading-tight">
                        <div className="text-[11px] text-muted-foreground">
                          Fine cap
                        </div>
                        <div className="text-sm font-medium">
                          {capToEndDate
                            ? "Up to end date"
                            : "Up to today / month"}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  {
                    label: "Monthly rent",
                    value: fmtMoney(details.monthlyRentPaymentAmount),
                  },
                  {
                    label: "Unpaid months",
                    value: String((details as any).unpaidMonths ?? "-"),
                  },
                  {
                    label: "Outstanding fees",
                    value: fmtMoney((details as any).outstandingFees ?? 0),
                  },
                  {
                    label: "Fine days",
                    value: String(details.numberOfFineDays),
                  },
                  {
                    label: "Total fine",
                    value: fmtMoney(details.fineAmount),
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl bg-white/80 ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="p-4">
                      <div className="text-[11px] text-muted-foreground">
                        {s.label}
                      </div>
                      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                        {s.value}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total card */}
                <div className="relative overflow-hidden rounded-2xl bg-black text-white ring-1 ring-black/20 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_400px_at_20%_-10%,rgba(255,255,255,.18),transparent_55%)]" />
                  <div className="relative p-4">
                    <div className="text-[11px] text-white/70">Fees + fine</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                      {fmtMoney(details.totalRentPaymentMonthly)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fine breakdown */}
              {(details as any).fineBreakdown?.length ? (
                <div className="mt-5 relative rounded-2xl p-[1px] bg-gradient-to-br from-black/10 to-black/5">
                  <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_420px_at_15%_-10%,rgba(0,0,0,.04),transparent_60%)]" />

                    <div className="relative flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tight">
                          Fine breakdown
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Per unpaid month
                        </div>
                      </div>

                      <span className="shrink-0 inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-black/70 ring-1 ring-black/10">
                        {(details as any).fineBreakdown.length} months
                      </span>
                    </div>

                    <div className="h-px bg-black/5" />

                    <div className="relative max-h-[420px] overflow-auto p-3">
                      <div className="grid gap-2">
                        {(details as any).fineBreakdown.map((b: any) => (
                          <div
                            key={b.key}
                            className="rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="flex items-center justify-between gap-4 p-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-black/80">
                                  {b.label}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                  {b.days} days overdue
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div className="inline-flex items-center rounded-xl bg-black/[0.03] px-3 py-1.5 ring-1 ring-black/10">
                                  <span className="text-sm font-semibold tabular-nums">
                                    {fmtMoney(Number(b.fine ?? 0))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Collect payment + Payments list */}
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {/* Collect payment (redesigned) */}
                <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-black/10 to-black/5">
                  <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-sm">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_420px_at_15%_-10%,rgba(0,0,0,.04),transparent_60%)]" />

                    <div className="relative p-4 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold tracking-tight">
                            Collect payment
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Applied to the{" "}
                            <span className="font-medium">oldest unpaid</span>{" "}
                            months first.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPayAtLocal(toDatetimeLocalValue(new Date()));
                            setPaymentOk(null);
                            setPaymentError(null);
                          }}
                          className="shrink-0 rounded-xl bg-black/[0.03] ring-1 ring-black/10 px-3 py-1.5 text-xs font-medium
                               transition hover:bg-black/[0.05] hover:-translate-y-0.5"
                        >
                          Set time to now
                        </button>
                      </div>

                      <form
                        onSubmit={onSubmitPayment}
                        className="mt-4 grid gap-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">
                              Amount (MVR)
                            </label>
                            <input
                              inputMode="decimal"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder="0.00"
                              className="h-11 w-full rounded-2xl bg-white px-4 tabular-nums
                                   ring-1 ring-black/10 shadow-sm transition
                                   focus:outline-none focus:ring-2 focus:ring-black/15"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">
                              Paid at
                            </label>
                            <input
                              type="datetime-local"
                              value={payAtLocal}
                              onChange={(e) => setPayAtLocal(e.target.value)}
                              className="h-11 w-full rounded-2xl bg-white px-4
                                   ring-1 ring-black/10 shadow-sm transition
                                   focus:outline-none focus:ring-2 focus:ring-black/15"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">
                              Method
                            </label>
                            <div className="relative">
                              <select
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value)}
                                className="h-11 w-full appearance-none rounded-2xl bg-white px-4 pr-10
                                     ring-1 ring-black/10 shadow-sm transition
                                     focus:outline-none focus:ring-2 focus:ring-black/15"
                              >
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="transfer">Transfer</option>
                                <option value="cheque">Cheque</option>
                                <option value="other">Other</option>
                              </select>

                              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50">
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">
                              Received by
                            </label>
                            <input
                              value={payReceivedBy}
                              onChange={(e) => setPayReceivedBy(e.target.value)}
                              placeholder="Staff name (optional)"
                              className="h-11 w-full rounded-2xl bg-white px-4
                                   ring-1 ring-black/10 shadow-sm transition
                                   focus:outline-none focus:ring-2 focus:ring-black/15"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] text-muted-foreground">
                            Reference
                          </label>
                          <input
                            value={payReference}
                            onChange={(e) => setPayReference(e.target.value)}
                            placeholder="Receipt / slip / transaction no. (optional)"
                            className="h-11 w-full rounded-2xl bg-white px-4
                                 ring-1 ring-black/10 shadow-sm transition
                                 focus:outline-none focus:ring-2 focus:ring-black/15"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[11px] text-muted-foreground">
                            Note
                          </label>
                          <textarea
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            placeholder="Optional note"
                            rows={3}
                            className="w-full rounded-2xl bg-white px-4 py-3 text-sm
                                 ring-1 ring-black/10 shadow-sm transition
                                 focus:outline-none focus:ring-2 focus:ring-black/15"
                          />
                        </div>

                        {paymentError ? (
                          <div className="rounded-2xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-700">
                            {paymentError}
                          </div>
                        ) : null}

                        {paymentOk ? (
                          <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-sm text-emerald-700">
                            {paymentOk}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={savingPayment || !leaseId}
                            className="h-11 rounded-2xl bg-black px-5 text-sm font-semibold text-white
                                 transition hover:-translate-y-0.5 disabled:opacity-50"
                          >
                            {savingPayment ? "Saving…" : "Save payment"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              refreshStatement();
                              refreshPayments();
                            }}
                            disabled={savingPayment || !leaseId}
                            className="h-11 rounded-2xl bg-black/[0.03] ring-1 ring-black/10 px-5 text-sm font-semibold
                                 transition hover:bg-black/[0.05] hover:-translate-y-0.5 disabled:opacity-50"
                          >
                            Refresh
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Payments (redesigned - FULL, with records) */}
                <div className="relative rounded-2xl p-[1px] ">
                  <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-[0_10px_30px_-20px_rgba(0,0,0,.35)]">
                    {/* subtle inner wash */}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(56,189,248,.12),transparent_60%),radial-gradient(900px_400px_at_90%_0%,rgba(16,185,129,.10),transparent_55%)]" />

                    {/* Header */}
                    <div className="relative flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/[0.04] ring-1 ring-black/10">
                          <Receipt className="h-5 w-5 text-black/70" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold tracking-tight">
                              Payments
                            </div>
                            <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-black/70 ring-1 ring-black/10">
                              {paymentsLoading
                                ? "Loading…"
                                : `${payments.length} record${
                                    payments.length === 1 ? "" : "s"
                                  }`}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Latest payments are shown first
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-muted-foreground">
                          Total paid
                        </div>
                        <div className="text-base font-semibold tabular-nums tracking-tight">
                          {fmtMoney(paymentsTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-black/5" />

                    {/* List */}
                    <div className="relative max-h-[420px] overflow-auto p-3">
                      {payments.length === 0 ? (
                        <div className="grid place-items-center rounded-xl bg-black/[0.02] p-8 ring-1 ring-black/5">
                          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white ring-1 ring-black/10 shadow-sm">
                            <CreditCard className="h-5 w-5 text-black/60" />
                          </div>
                          <div className="mt-3 text-sm font-medium">
                            No payments yet
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground text-center max-w-xs">
                            Payments recorded for this lease will appear here.
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2 font-dh1">
                          {payments
                            .slice()
                            .sort(
                              (a, b) =>
                                new Date(b.paidAt).getTime() -
                                new Date(a.paidAt).getTime()
                            )
                            .map((p) => {
                              const method = (p as any).method
                                ? String((p as any).method)
                                : null;
                              const reference = (p as any).reference
                                ? String((p as any).reference)
                                : null;
                              const receivedBy = (p as any).receivedBy
                                ? String((p as any).receivedBy)
                                : null;
                              const note = (p as any).note
                                ? String((p as any).note)
                                : null;
                              const amount = Number((p as any).amount ?? 0);

                              return (
                                <div
                                  key={p.$id}
                                  className="group rounded-xl bg-white/80 ring-1 ring-black/5 shadow-sm transition
                             hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between gap-4 p-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-semibold tabular-nums">
                                          {fmtDateTimeShort(p.paidAt)}
                                        </div>

                                        {method ? (
                                          <span className="inline-flex items-center rounded-full bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/70 ring-1 ring-black/10">
                                            {method}
                                          </span>
                                        ) : null}
                                      </div>

                                      {reference || receivedBy ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                          {reference ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.02] px-2 py-0.5 ring-1 ring-black/5">
                                              <Hash className="h-3.5 w-3.5" />
                                              <span className="tabular-nums">
                                                {reference}
                                              </span>
                                            </span>
                                          ) : null}

                                          {receivedBy ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.02] px-2 py-0.5 ring-1 ring-black/5">
                                              <User2 className="h-3.5 w-3.5" />
                                              <span className="truncate max-w-[220px]">
                                                {receivedBy}
                                              </span>
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}

                                      {note ? (
                                        <div className="mt-2 text-xs text-muted-foreground">
                                          <div className="rounded-lg bg-black/[0.02] px-2.5 py-2 ring-1 ring-black/5">
                                            <div className="line-clamp-2 py-1">
                                              {note}
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="shrink-0 text-right">
                                      <div className="inline-flex items-center rounded-xl bg-black/[0.03] px-3 py-1.5 ring-1 ring-black/10">
                                        <span className="text-sm font-semibold tabular-nums">
                                          {fmtMoney(amount)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="surface p-6">Loading statement…</div>
      ) : template ? (
        <div ref={invoiceRef} id="invoice-pdf">
          {template}
        </div>
      ) : (
        <div className="surface p-6">Select a lease to view statement.</div>
      )}

      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={!template}
        className="inline-flex items-center gap-2 h-11 rounded-2xl bg-black px-5 text-sm font-semibold text-white
             ring-1 ring-black/10 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md
             disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4.5 w-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
        Download PDF
      </button>
    </div>
  );
}
