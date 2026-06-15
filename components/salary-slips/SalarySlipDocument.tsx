"use client";

import type { SalarySlipComputed } from "@/lib/salary-slips/compute-slip";
import { SLIP_LABELS } from "@/lib/salary-slips/slip-labels";
import { formatSlipAmount, formatMvr } from "@/lib/salary-slips/format";
import { salarySlipFontClassName } from "@/lib/salary-slips/slip-fonts";
import { cn } from "@/lib/utils";
import "./salary-slip-pdf.css";

type SalarySlipDocumentProps = {
  slip: SalarySlipComputed;
  className?: string;
};

function LineRow({
  labelEn,
  labelDv,
  amount,
  alwaysShowAmount,
  bold,
}: {
  labelEn: string;
  labelDv: string;
  amount: number;
  alwaysShowAmount?: boolean;
  bold?: boolean;
}) {
  const text = alwaysShowAmount ? formatMvr(amount) : formatSlipAmount(amount);
  return (
    <div className={cn("salary-slip-pdf__line", bold && "salary-slip-pdf__line--bold")}>
      <span className="salary-slip-pdf__line-en">{labelEn}</span>
      <span className="salary-slip-pdf__line-amt">{text}</span>
      <span className="salary-slip-pdf__line-dv" lang="dv" dir="rtl">
        {labelDv}
      </span>
    </div>
  );
}

function PanelHead({
  labelEn,
  labelDv,
}: {
  labelEn: string;
  labelDv: string;
}) {
  return (
    <div className="salary-slip-pdf__panel-head">
      <span className="salary-slip-pdf__line-en">{labelEn}</span>
      <span className="salary-slip-pdf__line-amt" aria-hidden />
      <span className="salary-slip-pdf__line-dv" lang="dv" dir="rtl">
        {labelDv}
      </span>
    </div>
  );
}

const STAFF_FIELDS: Array<
  | { key: keyof SalarySlipComputed["staff"]; label: string }
  | {
      key: "recordCardNumber";
      labelKey: "recordCardLabel";
    }
> = [
  { key: "recordCardNumber", labelKey: "recordCardLabel" as const },
  { key: "name", label: "Name" },
  { key: "address", label: "Address" },
  { key: "designation", label: "Designation" },
  { key: "office", label: "Office" },
  { key: "joinedDate", label: "Joined Date" },
];

export function SalarySlipDocument({ slip, className }: SalarySlipDocumentProps) {
  const L = SLIP_LABELS;

  return (
    <article
      className={cn("salary-slip-pdf", salarySlipFontClassName, className)}
    >
      <header className="salary-slip-pdf__masthead">
        <div className="salary-slip-pdf__masthead-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset inside a printable document */}
          <img
            src="/council-logo-white.png"
            alt=""
            className="salary-slip-pdf__logo"
          />
          <div className="salary-slip-pdf__masthead-main">
            <p className="salary-slip-pdf__office">{slip.staff.office}</p>
            <h1 className="salary-slip-pdf__title">Salary Slip</h1>
          </div>
        </div>
        <div className="salary-slip-pdf__period-badge">
          <span className="salary-slip-pdf__period-label">Pay Period</span>
          <span className="salary-slip-pdf__period-value">
            {slip.periodTitle}
          </span>
        </div>
      </header>

      <section className="salary-slip-pdf__staff" aria-label="Staff details">
        <h2 className="salary-slip-pdf__staff-title">Staff Details</h2>
        <div className="salary-slip-pdf__staff-grid">
          {STAFF_FIELDS.map((field) => (
            <div key={field.key} className="salary-slip-pdf__staff-cell">
              <span className="salary-slip-pdf__staff-label">
                {"labelKey" in field
                  ? slip.staff[field.labelKey]
                  : field.label}
              </span>
              <span className="salary-slip-pdf__staff-value">
                {slip.staff[field.key]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="salary-slip-pdf__body" aria-label="Salary details">
        <div className="salary-slip-pdf__salary-head">
          <span className="salary-slip-pdf__line-en">{L.salaryDetails.en}</span>
          <span className="salary-slip-pdf__line-amt" aria-hidden />
          <span className="salary-slip-pdf__line-dv" lang="dv" dir="rtl">
            {L.salaryDetails.dv}
          </span>
        </div>

        <div className="salary-slip-pdf__basic">
          <LineRow
            labelEn={L.basicSalary.en}
            labelDv={L.basicSalary.dv}
            amount={slip.basicSalary}
            alwaysShowAmount
            bold
          />
        </div>

        <div className="salary-slip-pdf__panel salary-slip-pdf__panel--deduction">
          <PanelHead labelEn={L.deductionsHead.en} labelDv={L.deductionsHead.dv} />
          <div className="salary-slip-pdf__panel-rows">
            {slip.deductions.map((line) => (
              <LineRow
                key={line.key}
                labelEn={line.labelEn}
                labelDv={line.labelDv}
                amount={line.amount}
              />
            ))}
          </div>
          <div className="salary-slip-pdf__panel-total">
            <LineRow
              labelEn={L.totalDeductions.en}
              labelDv={L.totalDeductions.dv}
              amount={slip.totalDeductions}
              alwaysShowAmount
              bold
            />
          </div>
        </div>

        <div className="salary-slip-pdf__carry">
          <LineRow
            labelEn={L.basicAfterDeduction.en}
            labelDv={L.basicAfterDeduction.dv}
            amount={slip.basicAfterDeduction}
            alwaysShowAmount
            bold
          />
        </div>

        <div className="salary-slip-pdf__panel salary-slip-pdf__panel--allowance">
          <PanelHead labelEn={L.allowancesHead.en} labelDv={L.allowancesHead.dv} />
          <div className="salary-slip-pdf__panel-rows">
            {slip.allowances.map((line) => (
              <LineRow
                key={line.key}
                labelEn={line.labelEn}
                labelDv={line.labelDv}
                amount={line.amount}
              />
            ))}
          </div>
          <div className="salary-slip-pdf__panel-total">
            <LineRow
              labelEn={L.totalAllowances.en}
              labelDv={L.totalAllowances.dv}
              amount={slip.totalAllowances}
              alwaysShowAmount
              bold
            />
          </div>
        </div>

        <div className="salary-slip-pdf__net">
          <span className="salary-slip-pdf__net-en">{L.netIncome.en}</span>
          <span className="salary-slip-pdf__net-amt">
            {formatMvr(slip.netIncome)}
          </span>
          <span className="salary-slip-pdf__net-dv" lang="dv" dir="rtl">
            {L.netIncome.dv}
          </span>
        </div>
      </section>
    </article>
  );
}
