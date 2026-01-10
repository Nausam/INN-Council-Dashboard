import { Models } from "node-appwrite";

export type LandRentOverviewRow = {
  leaseId: string;

  parcelId?: string | null;
  tenantId?: string | null;

  landName?: string | null;
  tenantName?: string | null;

  agreementNumber?: string | null;

  monthlyRent?: number | null;

  startDate?: string | null;
  endDate?: string | null;
  lastPaymentDate?: string | null;

  // what Overview uses most
  outstandingNow?: number | null;

  // optional fallbacks (your UI row already supports these)
  currentOutstanding?: number | null;
  outstandingTotal?: number | null;
  openingOutstandingTotal?: number | null;
};

export type LandLeaseOption = {
  leaseId: string;
  landName: string;
  tenantName: string;
};

export type LandPaymentDoc = Models.Document & {
  leaseId: string;
  statementId: string;
  paidAt: string;
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
  receivedBy?: string;
};

export type LandStatementDoc = Models.Document & {
  leaseId: string;
  monthKey: string;
  status: "OPEN" | "PAID";
  createdAt: string;
  createdBy?: string;

  landName?: string;
  tenantName?: string;
  agreementNumber?: string;

  startDate?: string;
  endDate?: string;
  releasedDate?: string;

  sizeSqft?: number;
  rateLariPerSqft?: number;
  paymentDueDay?: number;
  fineLariPerDay?: number;
  monthlyRent?: number;

  // ✅ add these columns (optional) in Appwrite
  unpaidMonths?: number;
  outstandingFees?: number;
  fineDays?: number;
  fineAmount?: number;
  totalDue?: number;
  latestPaymentDate?: string;
};

export type FineBreakdownRow = {
  key: string; // YYYY-MM
  label: string;
  days: number;
  fine: number;
};

export type MonthlyDetails = {
  leaseId: string;
  monthKey: string;

  landName: string;
  rentingPerson: string;
  agreementNumber: string;

  rentDuration: { startDate: string | null; endDate: string | null };
  letGoDate: string | null;

  sizeOfLand: number;
  rentRate: number;

  paymentDueDay: number;
  finePerDay: number;

  monthlyRentPaymentAmount: number;

  latestPaymentDate: string | null;

  unpaidMonths: number;
  outstandingFees: number;

  numberOfFineDays: number;
  fineAmount: number;

  totalRentPaymentMonthly: number;

  fineBreakdown: FineBreakdownRow[];
};
