/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import CouncilInvoiceTemplate from "@/components/landRent/CouncilInvoiceTemplate";
import {
  fetchLandLeaseOptions,
  getLandRentMonthlyDetails,
  LandLeaseOption,
} from "@/lib/landrent/landRent.actions";

function getThisMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
  // simple readable format (you can switch to Dhivehi format later)
  return d.toISOString().slice(0, 10);
}

export default function Page() {
  const [options, setOptions] = useState<LandLeaseOption[]>([]);
  const [leaseId, setLeaseId] = useState<string>("");
  const [monthKey, setMonthKey] = useState<string>(getThisMonthKey());
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [details, setDetails] = useState<Awaited<
    ReturnType<typeof getLandRentMonthlyDetails>
  > | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadingOptions(true);
    setError(null);

    fetchLandLeaseOptions()
      .then((opts) => {
        if (!alive) return;
        setOptions(opts);
        // auto select first if none selected
        if (!leaseId && opts.length) setLeaseId(opts[0].leaseId);
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

    getLandRentMonthlyDetails({ leaseId, monthKey })
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
  }, [leaseId, monthKey]);

  const selectedLabel = useMemo(() => {
    const o = options.find((x) => x.leaseId === leaseId);
    if (!o) return "";
    return `${o.landName} — ${o.tenantName}`;
  }, [options, leaseId]);

  // Build template props when details ready
  const template = useMemo(() => {
    if (!details) return null;

    const rentDurationText = `${fmtDateShort(
      details.rentDuration.startDate
    )} އިން ${fmtDateShort(details.rentDuration.endDate)} އަށް`;

    const releasedText = details.letGoDate
      ? fmtDateShort(details.letGoDate)
      : "-";

    const monthlyRent = fmtMoney(details.monthlyRentPaymentAmount);
    const totalMonthly = fmtMoney(details.totalRentPaymentMonthly);

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
        title="ކުލި ދައްކަންޖެހޭގޮތުގެ ތަފްޞީލް"
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
            "ކުލި ފައިސާ އެކައުންޓަށް ޖަމާކުރާނަމަ ސްލިޕް މިއިދާރާއަށް 3 ދުވަސްތެރޭގައި ފޮނުވުން އެދެން.",
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
            c3: {
              value: String(details.numberOfDaysRentNotPaid),
              highlight: true,
            },
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
          text: `ނޯޓް: ކުލީގެ ތަފްސީލް (${monthKey})`,
          highlight: true,
        }}
      />
    );
  }, [details, monthKey]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 space-y-6">
      {/* Controls */}
      <div className="surface p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="h5">Land rent statement</div>
          <div className="body-2 text-muted-foreground">
            Select land/owner, choose month, then print.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:items-end">
          <div className="space-y-1">
            <label className="subtitle-2">Land / Owner</label>
            <select
              value={leaseId}
              onChange={(e) => setLeaseId(e.target.value)}
              className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-3 py-2 font-dh1"
              disabled={loadingOptions || options.length === 0}
            >
              {loadingOptions ? (
                <option value="">Loading...</option>
              ) : options.length === 0 ? (
                <option value="">No leases found</option>
              ) : (
                options.map((o) => (
                  <option key={o.leaseId} value={o.leaseId}>
                    {o.landName} — {o.tenantName}
                  </option>
                ))
              )}
            </select>
            {selectedLabel ? (
              <div className="caption text-muted-foreground font-dh1">
                {selectedLabel}
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="subtitle-2">Month</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="w-full rounded-2xl ring-1 ring-black/10 bg-white px-3 py-2"
            />
          </div>
        </div>
      </div>

      {error ? <div className="surface p-4 text-red-600">{error}</div> : null}

      {loading ? (
        <div className="surface p-6">Loading statement…</div>
      ) : template ? (
        template
      ) : (
        <div className="surface p-6">Select a lease to view statement.</div>
      )}
    </div>
  );
}
