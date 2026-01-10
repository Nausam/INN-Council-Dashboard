"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import CouncilInvoiceTemplate from "@/components/landRent/CouncilInvoiceTemplate";
import { downloadElementAsPdf } from "@/components/landRent/Statement/landRentPdf.utils";
import {
  fmtDateShort,
  fmtMoney,
  monthKeyToFullDate,
} from "@/components/landRent/Statement/landRentStatement.utils";
import type { StatementDetails } from "@/components/landRent/Statement/useLandRentStatementPage";
import React, { useMemo } from "react";

export default function StatementsList({
  statements,
  latestInvoiceRef,
}: {
  statements: StatementDetails[];
  latestInvoiceRef: React.RefObject<HTMLDivElement>;
}) {
  const rendered = useMemo(() => {
    if (!statements.length) return null;

    return (
      <div className="space-y-8">
        {statements.map((s, idx) => {
          const details = s as any;

          const totalMonthly = fmtMoney(
            Number(details.totalRentPaymentMonthly ?? 0)
          );
          const monthlyRent = fmtMoney(
            Number(details.monthlyRentPaymentAmount ?? 0)
          );
          const paymentsTotal = fmtMoney(Number(details.paymentsTotal ?? 0));
          const balance = fmtMoney(
            Math.max(0, Number(details.balanceRemaining ?? 0))
          );

          const rentDurationText = `${fmtDateShort(
            details.rentDuration?.startDate ?? null
          )} އިން ${fmtDateShort(details.rentDuration?.endDate ?? null)} އަށް`;

          const releasedText = details.letGoDate
            ? fmtDateShort(details.letGoDate)
            : "-";

          const isOpen = details.statement?.status === "OPEN";
          const isLatest = idx === statements.length - 1;

          const invoice = (
            <CouncilInvoiceTemplate
              leftLogoSrc="/assets/images/innamaadhoo-logo.png"
              crestSrc="/assets/images/crest.png"
              headerCenterLines={[
                {
                  text: "މާޅޮސްމަޑުލު އުތުރުބުރީ އިންނަމާދޫ ކައުންސިލް އިދާރާ",
                  highlight: true,
                },
                { text: "ރ.އިންނަމާދޫ، ދިވެހިރާއްޖެ", highlight: true },
              ]}
              title={{
                text: "ކުލި ދައްކަންޖެހޭގޮތުގެ ތަފްޞީލް",
                highlight: true,
              }}
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
                  label: {
                    text: "ކުލި ނުދައްކާ ދުވަހުގެ އަދަދު",
                    highlight: true,
                  },
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
                  label: {
                    text: "އެންމެފަހުން ޤަވާއިދުން ކުލި ދެއްކި ތާރީޚް",
                    highlight: true,
                  },
                },
                {
                  key: "c7",
                  label: { text: "ކުލި ރޭޓް (ލާރި)", highlight: true },
                },
                {
                  key: "c8",
                  label: {
                    text: "ބިމުގެ ބޮޑުމިން (އަކަފޫޓް)",
                    highlight: true,
                  },
                },
              ]}
              rows={[
                {
                  c1: { value: totalMonthly, highlight: true },
                  c2: { value: monthlyRent, highlight: true },
                  c3: {
                    value: String(details.unpaidMonths ?? 0),
                    highlight: true,
                  },
                  c4: {
                    value: fmtMoney(Number(details.fineAmount ?? 0)),
                    highlight: true,
                  },
                  c5: {
                    value: String(details.numberOfFineDays ?? 0),
                    highlight: true,
                  },
                  c6: {
                    value: fmtDateShort(details.latestPaymentDate ?? null),
                    highlight: true,
                  },
                  c7: { value: String(details.rentRate ?? 0), highlight: true },
                  c8: {
                    value: String(details.sizeOfLand ?? 0),
                    highlight: true,
                  },
                },
              ]}
              totalLabel={{ text: "ޖުމްލަ: (ރުފިޔާ)", highlight: true }}
              totalAmount={{ text: totalMonthly, highlight: true }}
              footerNote={{
                text: `ނޯޓް: ކުލީގެ ތަފްސީލް ހެދިފައިވަނީ ${monthKeyToFullDate(
                  details.monthKey,
                  1
                )} ވަނަ ދުވަހުގެ ނިޔަލަށް އަރާފައިވާ ކުއްޔާއި ޖޫރިމަނާއެވެ.`,
                highlight: true,
              }}
            >
              {/* Payment summary inside template (unchanged from your original) */}
              <div
                dir="rtl"
                className="mt-4 rounded-2xl ring-1 ring-black/10 overflow-hidden font-dh1"
              >
                <div className="flex items-center justify-between px-4 py-6 bg-white">
                  <div className="text-xl font-semibold tracking-tight font-dh1">
                    ފައިސާ ދައްކަމުންދާ ގޮތުގެ ތަފްސީލު
                  </div>
                  {/* <div className="text-xs text-muted-foreground">
                    {isOpen ? "OPEN" : "PAID"}
                  </div> */}
                </div>

                <div className="grid grid-cols-[140px_1fr_140px] bg-[#064E3B] items-center text-white">
                  <div className="px-4 py-4 text-lg font-semibold font-dh1 text-right">
                    ތާރީޚް
                  </div>
                  <div className="px-4 py-3 text-lg font-semibold font-dh1 text-center">
                    ތަފްޞީލް
                  </div>
                  <div className="px-4 py-3 text-lg font-semibold font-dh1 text-left">
                    އަދަދު
                  </div>
                </div>

                <div className="bg-white">
                  {(details.payments ?? []).length === 0 ? (
                    <div className="px-4 py-6 text-sm text-black/60 font-dh1">
                      އެއްވެސް ފައިސާއެއް ދައްކާފައެއް ނުވޭ!
                    </div>
                  ) : (
                    <div className="divide-y divide-black/10">
                      {(details.payments ?? [])
                        .slice()
                        .sort(
                          (a: any, b: any) =>
                            new Date(b.paidAt).getTime() -
                            new Date(a.paidAt).getTime()
                        )
                        .map((p: any, pidx: number) => {
                          const note = String(p.note ?? "").trim();
                          const amount = Number(p.amount ?? 0);
                          const key =
                            p.$id ?? `${String(p.paidAt ?? "")}-${pidx}`;

                          return (
                            <div
                              key={key}
                              className="grid grid-cols-[140px_1fr_140px] items-center"
                            >
                              <div className="px-4 py-3 text-sm font-semibold tabular-nums text-right">
                                {fmtDateShort(p.paidAt ?? null)}
                              </div>

                              <div className="px-4 py-3 min-w-0">
                                <div className="flex flex-nowrap items-center justify-center gap-2 min-w-0 whitespace-nowrap">
                                  {note ? (
                                    <span className="min-w-0 truncate text-md text-black/60 max-w-[520px]">
                                      {note}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

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

                  <div className="border-t border-black/10 bg-black/[0.03] px-4 py-3">
                    <div className="mr-auto w-fit text-left">
                      <div className="flex items-baseline justify-between gap-8">
                        <div className="text-md text-emerald-800 font-dh1">
                          ޖުމްލަ ދެއްކި
                        </div>
                        <div className="text-md font-semibold tabular-nums text-emerald-800">
                          {paymentsTotal}
                        </div>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between gap-8">
                        <div className="text-md text-red-700 font-dh1">
                          ބާކީ
                        </div>
                        <div className="text-md font-semibold tabular-nums text-red-700">
                          {balance}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CouncilInvoiceTemplate>
          );

          return (
            <div key={details.statement.$id} className="space-y-3 mt-10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight">
                    Statement:{" "}
                    <span className="tabular-nums">
                      {details.statement.monthKey}
                    </span>{" "}
                    <span className="text-black/30">•</span>{" "}
                    <span
                      className={isOpen ? "text-emerald-700" : "text-black/70"}
                    >
                      {details.statement.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created:{" "}
                    {fmtDateShort(
                      details.statement.createdAt ??
                        details.statement.$createdAt ??
                        null
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const container = document.getElementById(
                      `invoice-${details.statement.$id}`
                    );
                    if (!container) return;

                    await downloadElementAsPdf(
                      container,
                      `land-rent-${details.statement.leaseId}-${details.statement.monthKey}.pdf`
                    );
                  }}
                  className="h-11 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0
                      bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600"
                >
                  Download PDF
                </button>
              </div>

              <div
                id={`invoice-${details.statement.$id}`}
                ref={isLatest ? latestInvoiceRef : undefined}
              >
                {invoice}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [statements, latestInvoiceRef]);

  return rendered;
}
