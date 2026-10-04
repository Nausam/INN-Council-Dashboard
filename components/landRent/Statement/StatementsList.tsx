"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import CouncilInvoiceTemplate from "@/components/landRent/CouncilInvoiceTemplate";
import ManualFineButton from "@/components/landRent/Statement/ManualFineButton";
import PaymentEditDialog, { type EditableLandRentPayment } from "@/components/landRent/Statement/PaymentEditDialog";
import StatementDeleteDialog, { type DeletableLandStatement } from "@/components/landRent/Statement/StatementDeleteDialog";
import { downloadElementAsPdf } from "@/components/landRent/Statement/landRentPdf.utils";
import {
    fmtDateShort,
    fmtDateDhivehi,
    fmtMoney,
    fmtStatementPeriodDhivehi,
} from "@/components/landRent/Statement/landRentStatement.utils";
import type { StatementDetails } from "@/components/landRent/Statement/useLandRentStatementPage";
import React, { useMemo, useState } from "react";

export default function StatementsList({
  statements,
  latestInvoiceRef,
  onCollectRemaining,
  onPaymentUpdated,
  onStatementDeleted,
}: {
  statements: StatementDetails[];
  latestInvoiceRef: React.RefObject<HTMLDivElement>;
  onCollectRemaining: (statementId: string) => void;
  onPaymentUpdated: () => Promise<void>;
  onStatementDeleted?: (statementId: string) => Promise<void>;
}) {
  const [editingPayment, setEditingPayment] = useState<EditableLandRentPayment | null>(null);
  const [deletingStatement, setDeletingStatement] = useState<DeletableLandStatement | null>(null);
  const rendered = useMemo(() => {
    if (!statements.length) return null;

    return (
      <div className="space-y-8">
        {statements.map((s, idx) => {
          const details = s as any;

          const fixedAdjustmentRows = Array.isArray(details.fixedAdjustmentRows)
            ? details.fixedAdjustmentRows
            : [];
          const generatedAdjustmentRows = Array.isArray(
            details.generatedAdjustmentRows
          )
            ? details.generatedAdjustmentRows
            : [];
          const fixedAdjustmentTotal = Number(
            details.fixedAdjustmentTotal ?? 0
          );
          const generatedAdjustmentTotal = Number(
            details.generatedAdjustmentTotal ?? 0
          );
          const invoiceTotalNumber = Number(
            details.totalRentPaymentMonthly ?? 0
          );
          const manualFines = details.manualFines ?? [];
          const manualFineTotal = Number(details.manualFineTotal ?? 0);
          const manualFineRows = manualFines.map((fine: { description: string; amount: number }) => ({
            __spanText: { text: fine.description, highlight: true },
            c1: { value: fmtMoney(fine.amount), highlight: true },
          }));
          const liveTotalMonthly = Math.max(
            0,
            invoiceTotalNumber - fixedAdjustmentTotal - generatedAdjustmentTotal - manualFineTotal
          );
          const totalMonthly = fmtMoney(liveTotalMonthly);
          const invoiceTotal = fmtMoney(invoiceTotalNumber);
          const monthlyRent = fmtMoney(
            Number(details.monthlyRentPaymentAmount ?? 0)
          );
          const calculatedRentTotal = fmtMoney(
            Number(details.outstandingFees ?? 0)
          );
          const rateBreakdown = Array.isArray(details.rateBreakdown)
            ? details.rateBreakdown.filter((row: any) =>
                Number(row.rentAmount ?? 0) > 0 || Number(row.fineAmount ?? 0) > 0
              )
            : [];
          const formatMonths = (value: number) =>
            String(Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
          const paymentsTotal = fmtMoney(Number(details.paymentsTotal ?? 0));
          const balance = fmtMoney(
            Math.max(0, Number(details.balanceRemaining ?? 0))
          );

          const rentDurationText = details.rentDuration?.endDate
            ? `${fmtDateDhivehi(fmtDateShort(details.rentDuration?.startDate ?? null))} އިން ${fmtDateDhivehi(fmtDateShort(details.rentDuration.endDate))} އަށް`
            : `${fmtDateDhivehi(fmtDateShort(details.rentDuration?.startDate ?? null))} އިން މަސައްކަތް ނިމެންދެން`;

          const releasedText = details.letGoDate
            ? fmtDateDhivehi(fmtDateShort(details.letGoDate))
            : "-";

          const isOpen = details.statement?.status === "OPEN";
          const isFineOnly = details.statement?.kind === "FINE_ONLY";
          const revisedBalanceDue = details.statement?.status === "PAID" &&
            Number(details.balanceRemaining ?? 0) > 0;
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
                text: isFineOnly ? "ޖޫރިމަނާ ދައްކަންޖެހޭގޮތުގެ ތަފްޞީލް" : "ކުލި ދައްކަންޖެހޭގޮތުގެ ތަފްޞީލް",
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
                    text: "އެގްރިމެންޓްގެ ނަންބަރު:",
                    ltrSuffix: String(details.agreementNumber ?? ""),
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
                    text: "ކުލި ނުދައްކާ މަހުގެ އަދަދު",
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
              rows={isFineOnly ? [{
                c1: { value: fmtMoney(0), highlight: true },
                c2: { value: calculatedRentTotal, highlight: true },
                c3: { value: String(details.unpaidMonths ?? 0), highlight: true },
                c4: { value: fmtMoney(0), highlight: true },
                c5: { value: String(details.numberOfFineDays ?? 0), highlight: true },
                c6: { value: fmtDateDhivehi(details.latestPaymentDate ?? null), highlight: true },
                c7: { value: String(details.rentRate ?? 0), highlight: true },
                c8: { value: String(details.sizeOfLand ?? 0), highlight: true },
              }, {
                __spanText: {
                  text: details.statement.fineDescription || "Outstanding fine",
                  highlight: true,
                },
                c1: { value: totalMonthly, highlight: true },
              }, ...manualFineRows] : [
                ...fixedAdjustmentRows.map((row: any) => ({
                  c1: {
                    value: fmtMoney(Number(row.total ?? 0)),
                    highlight: true,
                  },
                  c2: {
                    value: fmtMoney(Number(row.rentAmount ?? 0)),
                    highlight: true,
                  },
                  c3: {
                    value: String(row.unpaidMonths ?? 0),
                    highlight: true,
                  },
                  c4: {
                    value: fmtMoney(Number(row.fineAmount ?? 0)),
                    highlight: true,
                  },
                  c5: {
                    value: String(row.fineDays ?? 0),
                    highlight: true,
                  },
                  c6: {
                    value: String(row.periodLabel ?? ""),
                    highlight: true,
                  },
                  c7: {
                    value: String(row.rentRate ?? 0),
                    highlight: true,
                  },
                  c8: {
                    value: String(row.sizeOfLand ?? 0),
                    highlight: true,
                  },
                })),
                ...(rateBreakdown.length
                  ? rateBreakdown.map((row: any) => ({
                      c1: { value: fmtMoney(Number(row.total ?? 0)), highlight: true },
                      c2: { value: fmtMoney(Number(row.rentAmount ?? 0)), highlight: true },
                      c3: { value: formatMonths(Number(row.unpaidMonths ?? 0)), highlight: true },
                      c4: { value: fmtMoney(Number(row.fineAmount ?? 0)), highlight: true },
                      c5: { value: String(row.fineDays ?? 0), highlight: true },
                      c6: { value: fmtDateDhivehi(details.latestPaymentDate ?? null), highlight: true },
                      c7: {
                        value: String(Number(details.rentRate ?? 0) * Number(row.multiplier ?? 1)),
                        highlight: true,
                      },
                      c8: { value: String(details.sizeOfLand ?? 0), highlight: true },
                    }))
                  : [{
                      c1: { value: totalMonthly, highlight: true },
                      c2: { value: calculatedRentTotal, highlight: true },
                      c3: { value: String(details.unpaidMonths ?? 0), highlight: true },
                      c4: { value: fmtMoney(Number(details.fineAmount ?? 0)), highlight: true },
                      c5: { value: String(details.numberOfFineDays ?? 0), highlight: true },
                      c6: { value: fmtDateDhivehi(details.latestPaymentDate ?? null), highlight: true },
                      c7: { value: String(details.rentRate ?? 0), highlight: true },
                      c8: { value: String(details.sizeOfLand ?? 0), highlight: true },
                    }]),
                ...generatedAdjustmentRows.map((row: any) => ({
                  __spanText: {
                    text: fmtStatementPeriodDhivehi(String(
                        row.description ??
                        row.periodLabel ??
                        "2025 އޮގަސްޓް މަހުން ފެށިގެން ޖޫރިމަނާ (އޮޑިޓް އޮފީހުން ޖޫރިމަނާ ހިސާބުކުރުމަށް އެންގި ގޮތަށް)"
                    )),
                    highlight: true,
                  },
                  c1: {
                    value: fmtMoney(Number(row.total ?? 0)),
                    highlight: true,
                  },
                })),
                ...manualFineRows,
              ]}
              totalLabel={{ text: "ޖުމްލަ: (ރުފިޔާ)", highlight: true }}
              totalAmount={{ text: invoiceTotal, highlight: true }}
              footerNote={{
                text: `ނޯޓް: ކުލީގެ ތަފްސީލް ހެދިފައިވަނީ ${fmtDateDhivehi(
                  details.statement.recalculatedAt ??
                    details.statement.createdAt ??
                    details.statement.$createdAt ??
                    null
                )} ވަނަ ދުވަހުގެ ނިޔަލަށެވެ.`,
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

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] bg-[#064E3B] items-center text-white">
                  <div className="min-w-0 px-2 py-4 text-lg font-semibold font-dh1 text-right sm:px-4">
                    ތާރީޚް
                  </div>
                  <div className="min-w-0 px-2 py-3 text-lg font-semibold font-dh1 text-center sm:px-4">
                    ތަފްޞީލް
                  </div>
                  <div className="min-w-0 px-2 py-3 text-lg font-semibold font-dh1 text-left sm:px-4">
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
                              className="avoid-break grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center"
                            >
                              <div className="min-w-0 break-words px-2 py-4 text-sm font-semibold tabular-nums text-right sm:px-4">
                                {fmtDateDhivehi(fmtDateShort(p.paidAt ?? null))}
                              </div>

                              <div className="min-w-0 px-2 py-4 sm:px-4">
                                <div className="flex min-w-0 flex-col items-center justify-center gap-2">
                                  {note ? (
                                    <span className="block w-full whitespace-pre-wrap break-words text-center text-sm leading-8 text-black/70">
                                      {note}
                                    </span>
                                  ) : null}
                                  {p.$id ? (
                                    <button
                                      type="button"
                                      data-pdf-exclude="true"
                                      onClick={() => setEditingPayment(p)}
                                      className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                                    >
                                      Edit
                                    </button>
                                  ) : null}
                                </div>
                              </div>

                              <div className="min-w-0 px-2 py-4 text-left sm:px-4">
                                <span className="inline-flex max-w-full items-center rounded-full bg-black/[0.03] px-2 py-1.5 ring-1 ring-black/10 sm:px-3">
                                  <span className="break-all text-sm font-semibold tabular-nums">
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
                    {isFineOnly ? "Fine statement:" : "Statement:"}{" "}
                    <span className="tabular-nums">
                      {details.statement.monthKey}
                    </span>{" "}
                    <span className="text-black/30">•</span>{" "}
                    <span
                      className={isOpen ? "text-emerald-700" : "text-black/70"}
                    >
                      {revisedBalanceDue ? "PAID · REVISED BALANCE DUE" : details.statement.status}
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

                <div className="flex flex-wrap gap-2">
                <ManualFineButton
                  statement={{ statementId: details.statement.$id, leaseId: details.statement.leaseId, monthKey: details.statement.monthKey }}
                  onSaved={onPaymentUpdated}
                />
                {onStatementDeleted ? (
                  <button
                    type="button"
                    onClick={() => setDeletingStatement({
                      statementId: details.statement.$id,
                      leaseId: details.statement.leaseId,
                      monthKey: details.statement.monthKey,
                      paymentCount: (details.payments ?? []).length,
                      paymentsTotal,
                    })}
                    className="h-11 rounded-xl bg-rose-50 px-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                  >
                    Delete statement
                  </button>
                ) : null}
                {revisedBalanceDue ? (
                  <button
                    type="button"
                    onClick={() => onCollectRemaining(details.statement.$id)}
                    className="h-11 rounded-xl bg-amber-50 px-5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                  >
                    Collect remaining balance
                  </button>
                ) : null}
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
  }, [statements, latestInvoiceRef, onCollectRemaining, onStatementDeleted, onPaymentUpdated]);

  return <>
    {rendered}
    {deletingStatement && onStatementDeleted ? (
      <StatementDeleteDialog
        key={deletingStatement.statementId}
        statement={deletingStatement}
        onClose={() => setDeletingStatement(null)}
        onDeleted={onStatementDeleted}
      />
    ) : null}
    {editingPayment ? (
      <PaymentEditDialog
        key={editingPayment.$id}
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSaved={onPaymentUpdated}
      />
    ) : null}
  </>;
}
