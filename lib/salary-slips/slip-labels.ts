/** Bilingual salary slip labels — word-for-word match to council payslip PDF. */

export type SlipLabelPair = { en: string; dv: string };

export const SLIP_LABELS = {
  salaryDetails: {
    en: "Salary Details",
    dv: "މުސާރައިގެ ތަފްސީލް",
  },
  basicSalary: {
    en: "Basic Salary",
    dv: "އަސާސީ މުސާރަ",
  },
  deductionsHead: {
    en: "(-) Deductions",
    dv: "(-) އުނިކުރި ފައިސާގެ ތަފްސީލް",
  },
  totalDeductions: {
    en: "Total Deductions",
    dv: "ޖުމްލަ އުނިކުރި އަދަދު",
  },
  basicAfterDeduction: {
    en: "Basic Salary (after deduction)",
    dv: "އުނިކުރުމަށްފަހު މުސާރައިގެ ބާކީ",
  },
  allowancesHead: {
    en: "(+) Allowances",
    dv: "(+) އިނާޔަތްތައް",
  },
  totalAllowances: {
    en: "Total Allowances",
    dv: "އިނާޔަތްތަކުގެ ޖުމްލަ",
  },
  netIncome: {
    en: "Total Take Home (Net Income)",
    dv: "ގެއަށް ގެންދެވޭ ޖުމްލަ އަދަދު",
  },
} as const satisfies Record<string, SlipLabelPair>;

/** Deduction rows — fixed order matching payslip. */
export const DEDUCTION_SLIP_LINES = [
  {
    key: "lateMinutes" as const,
    en: "Late Minutes Fine",
    dv: "ގަޑި ޖެހުނު މިނެޓްގެ ލާރި",
  },
  {
    key: "creditScheme" as const,
    en: "Credit Scheme",
    dv: "ކްރެޑިޓް ސްކީމް",
  },
  {
    key: "pension" as const,
    en: "Pension",
    dv: "ޕެންޝަން ފަންޑު",
  },
  {
    key: "absentDays" as const,
    en: "Absent Days",
    dv: "ހާޒިރު ނުވާ ދުވަސްތަކަށް",
  },
];

/** Allowance rows — fixed order matching payslip. */
export const ALLOWANCE_SLIP_LINES = [
  {
    key: "overtime" as const,
    en: "Over time",
    dv: "އިތުރުގަޑި",
  },
  {
    key: "living" as const,
    en: "Living Allowances",
    dv: "ލިވިންގ އެލަވަންސް",
  },
  {
    key: "holiday" as const,
    en: "Holiday Allowance",
    dv: "ބަންދު ދުވަހުގެ އިނާޔަތް",
  },
  {
    key: "ramazan" as const,
    en: "Ramazan Allowance",
    dv: "ރޯދަ މަހުގެ އިނާޔަތް",
  },
  {
    key: "zv" as const,
    en: "Vaguthee Hingumuge Allowance",
    dv: "ވަގުތީ ހިންގުމުގެ އިނާޔަތް",
  },
  {
    key: "phone" as const,
    en: "Phone allowance",
    dv: "ފޯނު އެލަވަންސް",
  },
  {
    key: "job" as const,
    en: "Job Allowance",
    dv: "ޖޮބް އެލަވަންސް",
  },
  {
    key: "attendanceBenefit" as const,
    en: "Attendance Benefit",
    dv: "ހާޒިރީ އިނާޔަތް",
  },
];
