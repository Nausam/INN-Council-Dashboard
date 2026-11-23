/** Escalation levels for unpaid land rent, in the order they are sent. */
export const LAND_NOTICE_TYPES = ["REMINDER", "SECOND", "FINAL"] as const;
export type LandNoticeType = (typeof LAND_NOTICE_TYPES)[number];

export const LAND_NOTICE_TYPE_LABELS: Record<LandNoticeType, string> = {
  REMINDER: "First reminder",
  SECOND: "Second notice",
  FINAL: "Final notice",
};

/** The lease figures a notice quotes, frozen when the notice is created. */
export type LandNoticeLeaseSnapshot = {
  leaseId: string;
  landName: string;
  tenantName: string;
  agreementNumber: string;
  monthlyRent: number;
  outstanding: number;
  lastPaymentDate: string | null;
  paymentDueDay: number;
};

export type LandNotice = LandNoticeLeaseSnapshot & {
  $id: string;
  $createdAt: string;
  noticeNumber: string;
  noticeType: LandNoticeType;
  /** YYYY-MM-DD */
  issueDate: string;
  /** YYYY-MM-DD: pay by this date. */
  dueDate: string;
  note: string;
  createdBy: string | null;
};

export type CreateLandNoticesInput = {
  issueDate: string;
  dueDate: string;
  note?: string;
  notices: Array<LandNoticeLeaseSnapshot & { noticeType: LandNoticeType }>;
};

export function isLandNoticeType(value: unknown): value is LandNoticeType {
  return typeof value === "string" && (LAND_NOTICE_TYPES as readonly string[]).includes(value);
}

/**
 * The next level for a lease: a first reminder when it has no notice yet, or
 * when it has paid since its latest notice (the earlier run is settled);
 * otherwise one step up from the latest, staying at final.
 */
export function nextLandNoticeType(
  latest: Pick<LandNotice, "noticeType" | "issueDate"> | null | undefined,
  lastPaymentDate: string | null | undefined,
): LandNoticeType {
  if (!latest) return "REMINDER";
  const paid = String(lastPaymentDate ?? "").slice(0, 10);
  if (paid && paid > latest.issueDate) return "REMINDER";
  if (latest.noticeType === "REMINDER") return "SECOND";
  return "FINAL";
}
