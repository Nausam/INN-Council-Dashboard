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

type RowTone =
  | "default"
  | "primary"
  | "deduction"
  | "deduction-bold"
  | "allowance"
  | "allowance-bold"
  | "net";

function SlipAmountCell({
  amount,
  alwaysShow,
  ruleAbove,
  netUnderline,
}: {
  amount: number;
  alwaysShow?: boolean;
  ruleAbove?: boolean;
  netUnderline?: boolean;
}) {
  const text = alwaysShow ? formatMvr(amount) : formatSlipAmount(amount);
  return (
    <span
      className={cn(
        "salary-slip-pdf__col-amt",
        ruleAbove && "salary-slip-pdf__col-amt--rule",
        netUnderline && "salary-slip-pdf__col-amt--net",
      )}
    >
      {text}
    </span>
  );
}

function TripleRow({
  labelEn,
  labelDv,
  amount,
  tone = "default",
  alwaysShowAmount,
  ruleAbove,
  netUnderline,
}: {
  labelEn: string;
  labelDv: string;
  amount: number;
  tone?: RowTone;
  alwaysShowAmount?: boolean;
  ruleAbove?: boolean;
  netUnderline?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "salary-slip-pdf__tone-primary"
      : tone === "deduction"
        ? "salary-slip-pdf__tone-deduction"
        : tone === "deduction-bold"
          ? "salary-slip-pdf__tone-deduction-bold"
          : tone === "allowance"
            ? "salary-slip-pdf__tone-allowance"
            : tone === "allowance-bold"
              ? "salary-slip-pdf__tone-allowance-bold"
              : tone === "net"
                ? "salary-slip-pdf__tone-net"
                : "";

  return (
    <div className={cn("salary-slip-pdf__triple-row", toneClass)}>
      <span className="salary-slip-pdf__col-en">{labelEn}</span>
      <SlipAmountCell
        amount={amount}
        alwaysShow={alwaysShowAmount}
        ruleAbove={ruleAbove}
        netUnderline={netUnderline}
      />
      <span className="salary-slip-pdf__col-dv" lang="dv" dir="rtl">
        {labelDv}
      </span>
    </div>
  );
}

function SectionHeadRow({
  labelEn,
  labelDv,
  variant,
}: {
  labelEn: string;
  labelDv: string;
  variant: "deduction" | "allowance";
}) {
  return (
    <div
      className={cn(
        "salary-slip-pdf__triple-row salary-slip-pdf__section-head",
        variant === "deduction"
          ? "salary-slip-pdf__section-head--deduction"
          : "salary-slip-pdf__section-head--allowance",
      )}
    >
      <span className="salary-slip-pdf__col-en">{labelEn}</span>
      <span className="salary-slip-pdf__col-amt" aria-hidden />
      <span className="salary-slip-pdf__col-dv" lang="dv" dir="rtl">
        {labelDv}
      </span>
    </div>
  );
}

const STAFF_FIELDS: Array<{
  key: keyof SalarySlipComputed["staff"];
  label: string;
}> = [
  { key: "staffSerialNumber", label: "Staff Serial Number" },
  { key: "recordCardNumber", label: "Record Card No" },
  { key: "name", label: "Name" },
  { key: "designation", label: "Designation" },
  { key: "section", label: "Section" },
  { key: "office", label: "Office" },
];

export function SalarySlipDocument({ slip, className }: SalarySlipDocumentProps) {
  const L = SLIP_LABELS;

  return (
    <article
      className={cn("salary-slip-pdf", salarySlipFontClassName, className)}
    >
      <header className="salary-slip-pdf__header">
        <p className="salary-slip-pdf__eyebrow">Staff Details</p>
        <h1 className="salary-slip-pdf__title">Salary Slip</h1>
        <p className="salary-slip-pdf__period">{slip.periodTitle}</p>
      </header>

      <section className="salary-slip-pdf__staff" aria-label="Staff details">
        {STAFF_FIELDS.map(({ key, label }) => (
          <div key={key} className="salary-slip-pdf__staff-row">
            <span className="salary-slip-pdf__staff-label">{label}</span>
            <span className="salary-slip-pdf__staff-value">
              {slip.staff[key]}
            </span>
          </div>
        ))}
      </section>

      <section className="salary-slip-pdf__body" aria-label="Salary details">
        <div className="salary-slip-pdf__triple-grid">
          <div className="salary-slip-pdf__triple-row salary-slip-pdf__tone-primary">
            <span className="salary-slip-pdf__col-en">{L.salaryDetails.en}</span>
            <span className="salary-slip-pdf__col-amt" aria-hidden />
            <span className="salary-slip-pdf__col-dv" lang="dv" dir="rtl">
              {L.salaryDetails.dv}
            </span>
          </div>

          <TripleRow
            labelEn={L.basicSalary.en}
            labelDv={L.basicSalary.dv}
            amount={slip.basicSalary}
            tone="primary"
            alwaysShowAmount
          />

          <SectionHeadRow
            labelEn={L.deductionsHead.en}
            labelDv={L.deductionsHead.dv}
            variant="deduction"
          />

          {slip.deductions.map((line) => (
            <TripleRow
              key={line.key}
              labelEn={line.labelEn}
              labelDv={line.labelDv}
              amount={line.amount}
              tone="deduction"
            />
          ))}

          <TripleRow
            labelEn={L.totalDeductions.en}
            labelDv={L.totalDeductions.dv}
            amount={slip.totalDeductions}
            tone="deduction-bold"
            alwaysShowAmount
            ruleAbove
          />

          <TripleRow
            labelEn={L.basicAfterDeduction.en}
            labelDv={L.basicAfterDeduction.dv}
            amount={slip.basicAfterDeduction}
            tone="primary"
            alwaysShowAmount
            ruleAbove
          />

          <SectionHeadRow
            labelEn={L.allowancesHead.en}
            labelDv={L.allowancesHead.dv}
            variant="allowance"
          />

          {slip.allowances.map((line) => (
            <TripleRow
              key={line.key}
              labelEn={line.labelEn}
              labelDv={line.labelDv}
              amount={line.amount}
              tone="allowance"
            />
          ))}

          <TripleRow
            labelEn={L.totalAllowances.en}
            labelDv={L.totalAllowances.dv}
            amount={slip.totalAllowances}
            tone="allowance-bold"
            alwaysShowAmount
            ruleAbove
          />

          <TripleRow
            labelEn={L.netIncome.en}
            labelDv={L.netIncome.dv}
            amount={slip.netIncome}
            tone="net"
            alwaysShowAmount
            ruleAbove
            netUnderline
          />
        </div>
      </section>
    </article>
  );
}
