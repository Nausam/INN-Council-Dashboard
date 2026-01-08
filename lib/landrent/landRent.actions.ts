/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Databases, Models, Query } from "appwrite";
import { ID } from "node-appwrite";

/* =============================== Config =============================== */

export const appwriteConfig = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "68fafb190023ef05bc17",
  databaseId: "68fafc1000231aecbf69",

  // ✅ Add these (create collections in Appwrite)
  landParcelsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION ?? "",
  landTenantsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION ?? "",
  landLeasesCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION ?? "",
  landPaymentsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION ?? "",
};

const {
  endpoint,
  projectId,
  databaseId,
  landParcelsCollectionId,
  landTenantsCollectionId,
  landLeasesCollectionId,
  landPaymentsCollectionId,
} = appwriteConfig;

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);

const databases = new Databases(client);

/* =============================== Types =============================== */

/* =============================== Helpers for statement calc =============================== */

const pad2 = (n: number) => String(n).padStart(2, "0");

const parseMonthKey2 = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  return { y, m };
};

const dateOnlyUTC2 = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const startOfMonthUTC2 = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const addMonthsUTC2 = (d: Date, months: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));

const endOfMonthUTC2 = (y: number, m: number) => new Date(Date.UTC(y, m, 0)); // last day of month (m is 1-12)

const daysBetweenUTC2 = (a: Date, b: Date) => {
  const ms = 24 * 60 * 60 * 1000;
  const aa = dateOnlyUTC2(a).getTime();
  const bb = dateOnlyUTC2(b).getTime();
  return Math.max(0, Math.floor((bb - aa) / ms));
};

const monthStartsBetweenInclusiveUTC2 = (
  fromMonthStart: Date,
  toMonthStart: Date
) => {
  const out: Date[] = [];
  let cur = startOfMonthUTC2(fromMonthStart);
  const end = startOfMonthUTC2(toMonthStart);

  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur.getTime()));
    cur = addMonthsUTC2(cur, 1);
  }

  return out;
};

const clampInt2 = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(v)));

const safeDateUTC2 = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateOnlyUTC2(d);
};

const minDate2 = (a: Date | null, b: Date | null) => {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
};

export type LandParcelDoc = Models.Document & {
  name: string; // Land name
  sizeSqft: number; // Size of land (sqft)
};

export type LandTenantDoc = Models.Document & {
  fullName: string; // Person/company renting
};

export type LandLeaseDoc = Models.Document & {
  parcelId: string; // FK -> land_parcels.$id
  tenantId: string; // FK -> land_tenants.$id

  startDate: string; // ISO
  endDate: string; // ISO (or planned end)

  agreementNumber: string;

  releasedDate?: string | null; // optional

  // Rent config
  rateLariPerSqft: number; // e.g. 0.90
  paymentDueDay?: number; // default 10
  fineLariPerDay?: number; // default 0
};

export type LandPaymentDoc = Models.Document & {
  leaseId: string; // FK -> land_leases.$id
  paidAt: string; // datetime
  amount: number; // double
  method?: string;
  reference?: string;
  note?: string;
  receivedBy?: string;
};

/* =============================== Helpers =============================== */

const round2 = (n: number) => Math.round(n * 100) / 100;

const parseMonthKey = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  return { y, m };
};

const ymdUTC = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

const diffDays = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

const todayUTC = () => {
  // Maldives time is UTC+5, but your Appwrite dates are usually ISO;
  // We keep logic simple: count based on UTC "today".
  const now = new Date();
  return ymdUTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
};

export type LandParcelCreate = {
  name: string;
  sizeSqft: number;
};

export type LandTenantCreate = {
  fullName: string;
};

export type LandLeaseCreate = {
  parcelId: string;
  tenantId: string;

  startDate: string; // ISO
  endDate: string; // ISO
  agreementNumber: string;

  releasedDate?: string | null;

  rateLariPerSqft: number;
  paymentDueDay: number; // default 10
  fineLariPerDay: number; // default 0
};

export type CreateLandRentPayload = {
  parcel: LandParcelCreate;
  tenant: LandTenantCreate;
  lease: Omit<LandLeaseCreate, "parcelId" | "tenantId">;
};

export type CreatedLandRentBundle = {
  tenant: Models.Document;
  parcel: Models.Document;
  lease: Models.Document;
};

export type LandLeaseOption = {
  leaseId: string;
  landName: string;
  tenantName: string;
};

export type CreateLandRentHolderInput = {
  landName: string;
  renterName: string;

  rentStartDate: string; // ISO date (YYYY-MM-DD)
  rentEndDate: string; // ISO date (YYYY-MM-DD)

  agreementNumber: string;
  letGoDate?: string | null; // ISO date or null

  sizeSqft: number;
  rate: number; // your UI expects size * rate = monthly
  monthlyRent: number;

  paymentDueDay: number; // 1-28
  finePerDay: number;

  // NEW: opening snapshot
  lastPaymentDate?: string | null; // ISO date or null
  openingFineDays: number;
  openingFineMonths: number;
  openingTotalFine: number;
  openingOutstandingFees: number;
  openingOutstandingTotal: number;
};

export type LandRentOverviewRow = {
  leaseId: string;
  landName: string;
  tenantName: string;

  agreementNumber: string;
  startDate: string;
  endDate: string;
  releasedDate: string | null;

  paymentDueDay: number;
  rateLariPerSqft: number;

  sizeSqft: number;
  monthlyRent: number;

  lastPaymentDate: string | null;
  openingOutstandingTotal: number;
  status: string | null;
};

/** Pagination helper (same approach as your attendance month fetch). */
const listAllDocuments = async <T extends Models.Document>(
  collectionId: string,
  queries: string[] = []
): Promise<T[]> => {
  const results: T[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const res = await databases.listDocuments<T>(databaseId, collectionId, [
      ...queries,
      Query.limit(limit),
      Query.offset(offset),
    ]);

    results.push(...res.documents);
    hasMore = res.documents.length === limit;
    offset += hasMore ? limit : 0;
  }

  return results;
};

/* =============================== Core Computation =============================== */

/**
 * Computes the monthly statement fields for a lease + monthKey.
 * - monthly rent = sizeSqft * rateLariPerSqft
 * - unpaid days counted from due day to today (or released date)
 * - fine days = unpaid days (you can adjust rule later)
 * - fine amount = fineDays * fineLariPerDay
 * - total = rent + fine
 */
export const computeMonthlyLandRent = (params: {
  monthKey: string; // YYYY-MM
  sizeSqft: number;
  rateLariPerSqft: number;
  paymentDueDay: number;
  fineLariPerDay: number;

  releasedDateISO?: string | null;

  latestPaymentISO?: string | null;
  isPaidForThisMonth: boolean;
}) => {
  const { y, m } = parseMonthKey(params.monthKey);

  const monthlyRent = round2(params.sizeSqft * params.rateLariPerSqft);

  const dueDate = ymdUTC(y, m, params.paymentDueDay);

  const today = todayUTC();

  const capDate = (() => {
    if (!params.releasedDateISO) return today;
    const rd = new Date(params.releasedDateISO);
    const cap = ymdUTC(
      rd.getUTCFullYear(),
      rd.getUTCMonth() + 1,
      rd.getUTCDate()
    );
    return cap < today ? cap : today;
  })();

  const daysNotPaid = params.isPaidForThisMonth
    ? 0
    : diffDays(dueDate, capDate);
  const fineDays = params.isPaidForThisMonth ? 0 : daysNotPaid;
  const fineAmount = round2(fineDays * params.fineLariPerDay);

  const totalMonthly = round2(monthlyRent + fineAmount);

  return {
    monthlyRent,
    daysNotPaid,
    fineDays,
    fineAmount,
    totalMonthly,
    latestPaymentISO: params.latestPaymentISO ?? null,
  };
};

/* =============================== Fetchers =============================== */

// Get a single lease bundle (lease + parcel + tenant)
export const fetchLandLeaseBundle = async (leaseId: string) => {
  const lease = await databases.getDocument<LandLeaseDoc>(
    databaseId,
    landLeasesCollectionId,
    leaseId
  );

  const [parcel, tenant] = await Promise.all([
    databases.getDocument<LandParcelDoc>(
      databaseId,
      landParcelsCollectionId,
      lease.parcelId
    ),
    databases.getDocument<LandTenantDoc>(
      databaseId,
      landTenantsCollectionId,
      lease.tenantId
    ),
  ]);

  return { lease, parcel, tenant };
};

export const createLandRentPayment = async (input: {
  leaseId: string;
  paidAt: string; // ISO datetime
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
  receivedBy?: string;
}) => {
  if (!appwriteConfig.landPaymentsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION");

  const amount = Number(input.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  // basic sanity for paidAt
  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("Invalid paidAt date.");
  }

  return databases.createDocument<LandPaymentDoc>(
    appwriteConfig.databaseId,
    appwriteConfig.landPaymentsCollectionId,
    ID.unique(),
    {
      leaseId: input.leaseId,
      paidAt: paidAt.toISOString(),
      amount,
      method: input.method ?? "",
      reference: input.reference ?? "",
      note: input.note ?? "",
      receivedBy: input.receivedBy ?? "",
    }
  );
};

export const listLandPaymentsForLease = async (leaseId: string) => {
  if (!appwriteConfig.landPaymentsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION");

  const payments = await listAllDocuments<LandPaymentDoc>(
    appwriteConfig.landPaymentsCollectionId,
    [Query.equal("leaseId", leaseId), Query.orderAsc("paidAt")]
  );

  return payments;
};

export const listLandPaymentsUpTo = async (params: {
  leaseId: string;
  capIso?: string; // ✅ allow ISO directly
  capDate?: Date; // ✅ or allow Date
  afterDate?: Date | null | undefined; // optional lower bound
}) => {
  if (!appwriteConfig.landPaymentsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION");

  const capIso =
    params.capIso ??
    (params.capDate ? params.capDate.toISOString() : undefined);

  if (!capIso) {
    throw new Error("listLandPaymentsUpTo: provide capIso or capDate.");
  }

  const queries: string[] = [
    Query.equal("leaseId", params.leaseId),
    Query.lessThanEqual("paidAt", capIso),
    Query.orderAsc("paidAt"),
  ];

  if (params.afterDate) {
    queries.splice(
      2,
      0,
      Query.greaterThan("paidAt", params.afterDate.toISOString())
    );
  }

  const payments = await listAllDocuments<LandPaymentDoc>(
    appwriteConfig.landPaymentsCollectionId,
    queries
  );

  return payments;
};

// Latest payment for lease (any month)
export const fetchLatestPaymentForLease = async (
  leaseId: string
): Promise<LandPaymentDoc | null> => {
  const res = await databases.listDocuments<LandPaymentDoc>(
    databaseId,
    landPaymentsCollectionId,
    [Query.equal("leaseId", leaseId), Query.orderDesc("paidAt"), Query.limit(1)]
  );
  return res.documents[0] ?? null;
};

// Check if a given month was paid
export const isMonthPaid = async (params: {
  leaseId: string;
  monthKey: string; // YYYY-MM
  capToEndDate?: boolean;
}) => {
  const { lease, parcel } = await fetchLandLeaseBundle(params.leaseId);

  const monthlyRent = round2(
    Number(parcel.sizeSqft ?? 0) * Number(lease.rateLariPerSqft ?? 0)
  );

  const paymentDueDay =
    typeof lease.paymentDueDay === "number"
      ? clampInt2(lease.paymentDueDay, 1, 28)
      : 10;

  const rentStart = safeDateUTC2((lease as any).startDate ?? null);
  const rentEnd = safeDateUTC2((lease as any).endDate ?? null);
  const released = safeDateUTC2((lease as any).releasedDate ?? null);

  // baseline last payment date (used as “history start”)
  const baselineLastPaid = safeDateUTC2((lease as any).lastPaymentDate ?? null);

  const { y, m } = parseMonthKey2(params.monthKey);

  const today = dateOnlyUTC2(new Date());
  const capBySelectedMonth = endOfMonthUTC2(y, m);
  let effectiveCap = minDate2(today, capBySelectedMonth) ?? today;

  if (params.capToEndDate && rentEnd) {
    effectiveCap = minDate2(effectiveCap, rentEnd) ?? effectiveCap;
  }
  if (released) {
    effectiveCap = minDate2(effectiveCap, released) ?? effectiveCap;
  }

  // If the lease starts after this month, then it’s “not due”
  if (rentStart) {
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    if (monthStart.getTime() < startOfMonthUTC2(rentStart).getTime()) {
      return true;
    }
  }

  // If due day hasn’t been reached within this month cap, treat it as not due yet => paid
  const dueDateForMonth = new Date(Date.UTC(y, m - 1, paymentDueDay));
  if (effectiveCap.getTime() <= dateOnlyUTC2(dueDateForMonth).getTime()) {
    return true;
  }

  // Determine fromMonth (baseline)
  let fromMonth = (() => {
    if (baselineLastPaid)
      return addMonthsUTC2(startOfMonthUTC2(baselineLastPaid), 1);
    if (rentStart) return startOfMonthUTC2(rentStart);
    return new Date(Date.UTC(y, m - 1, 1));
  })();

  if (rentStart) {
    const rentStartMonth = startOfMonthUTC2(rentStart);
    if (fromMonth.getTime() < rentStartMonth.getTime())
      fromMonth = rentStartMonth;
  }

  const toMonth = new Date(Date.UTC(y, m - 1, 1));
  if (toMonth.getTime() < fromMonth.getTime()) return true;

  // Payments up to effectiveCap, but after baseline lastPaymentDate (if any)
  const payments = await listLandPaymentsUpTo({
    leaseId: params.leaseId,
    capDate: effectiveCap,
    afterDate: baselineLastPaid,
  });

  let remainingPayment = round2(
    payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  );

  // Allocate oldest->newest, and check selected month’s remaining
  for (const ms of monthStartsBetweenInclusiveUTC2(fromMonth, toMonth)) {
    const need = monthlyRent;
    const pay = Math.min(remainingPayment, need);
    remainingPayment = round2(remainingPayment - pay);

    const key = `${ms.getUTCFullYear()}-${String(ms.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;

    if (key === params.monthKey) {
      const remaining = round2(need - pay);
      return remaining <= 0;
    }

    if (remainingPayment <= 0) {
      // no more money to allocate; remaining months will be unpaid
      continue;
    }
  }

  // If it never matched, treat as unpaid
  return false;
};

// List leases (optional: active only)
export const fetchLandLeases = async (opts?: {
  limit?: number;
  offset?: number;
}) => {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const res = await databases.listDocuments<LandLeaseDoc>(
    databaseId,
    landLeasesCollectionId,
    [Query.orderDesc("$createdAt"), Query.limit(limit), Query.offset(offset)]
  );

  return { leases: res.documents, totalCount: res.total };
};

/* =============================== Main: Monthly Invoice Details =============================== */

/**
 * Returns exactly the fields you listed, computed for a specific lease + monthKey.
 */
const computeBucketsWithPaymentsUTC2 = (args: {
  fromMonth: Date; // month start UTC
  toMonth: Date; // month start UTC
  paymentDueDay: number;
  monthlyRent: number;
  fineLariPerDay: number;
  effectiveCap: Date; // dateOnly UTC
  payments: Array<{ paidAt: string; amount: number }>; // already filtered up to cap
}) => {
  type Bucket = {
    key: string;
    label: string;

    monthStart: Date;
    dueDate: Date; // dateOnly UTC
    fineStart: Date; // dateOnly UTC (dueDate + 1)

    principalDue: number;
    principalPaid: number;
    principalRemaining: number;

    fineDaysAccrued: number;
    fineAccrued: number;
    finePaid: number;
    fineRemaining: number;

    lastFineAccrualDate: Date; // dateOnly UTC
    principalClearedAt: Date | null; // dateOnly UTC when principal hits 0
  };

  const buckets: Bucket[] = [];

  // Build buckets (chronological)
  for (const ms of monthStartsBetweenInclusiveUTC2(
    args.fromMonth,
    args.toMonth
  )) {
    const dueDate = new Date(
      Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), args.paymentDueDay)
    );
    const dueDateOnly = dateOnlyUTC2(dueDate);
    const fineStart = addDaysUTC2(dueDateOnly, 1);

    buckets.push({
      key: `${ms.getUTCFullYear()}-${String(ms.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}`,
      label: fmtMonthYearUTC2(ms),

      monthStart: ms,
      dueDate: dueDateOnly,
      fineStart,

      principalDue: round2(args.monthlyRent),
      principalPaid: 0,
      principalRemaining: round2(args.monthlyRent),

      fineDaysAccrued: 0,
      fineAccrued: 0,
      finePaid: 0,
      fineRemaining: 0,

      lastFineAccrualDate: fineStart,
      principalClearedAt: null,
    });
  }

  const accrueFineThrough = (b: Bucket, thruDate: Date) => {
    // Fine only accrues while principal is still unpaid
    if (b.principalRemaining <= 0) return;

    const thru = dateOnlyUTC2(thruDate);

    // no fine until after dueDate
    if (thru.getTime() < b.fineStart.getTime()) return;

    // accrue from lastFineAccrualDate .. thru (inclusive)
    const start =
      b.lastFineAccrualDate.getTime() < b.fineStart.getTime()
        ? b.fineStart
        : b.lastFineAccrualDate;

    if (thru.getTime() < start.getTime()) return;

    const days = daysBetweenUTC2(start, thru) + 1;
    b.fineDaysAccrued += days;

    b.fineAccrued = round2(b.fineAccrued + days * args.fineLariPerDay);
    b.fineRemaining = round2(b.fineAccrued - b.finePaid);

    // next accrual starts tomorrow (because we included `thru`)
    b.lastFineAccrualDate = addDaysUTC2(thru, 1);
  };

  // Sort payments oldest -> newest
  const paymentsSorted = [...args.payments].sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
  );

  // Apply payments to oldest unpaid bucket first
  for (const p of paymentsSorted) {
    let remaining = round2(Number(p.amount ?? 0));
    if (!Number.isFinite(remaining) || remaining <= 0) continue;

    const payDate = dateOnlyUTC2(new Date(p.paidAt));
    const payDateClamped =
      minDate2(payDate, args.effectiveCap) ?? args.effectiveCap;

    for (let i = 0; i < buckets.length && remaining > 0; i += 1) {
      const b = buckets[i];

      const hasBalance = b.principalRemaining > 0 || b.fineRemaining > 0;
      if (!hasBalance) continue;

      // accrue fine for THIS bucket up to the payment date (inclusive)
      accrueFineThrough(b, payDateClamped);

      // pay principal first (rent)
      if (b.principalRemaining > 0 && remaining > 0) {
        const pay = Math.min(remaining, b.principalRemaining);
        b.principalPaid = round2(b.principalPaid + pay);
        b.principalRemaining = round2(b.principalRemaining - pay);
        remaining = round2(remaining - pay);

        if (b.principalRemaining <= 0 && !b.principalClearedAt) {
          b.principalClearedAt = payDateClamped;
          // fine should not accrue after this date (we already accrued inclusive today)
        }
      }

      // then pay accrued fine for that month
      if (b.fineRemaining > 0 && remaining > 0) {
        const pay = Math.min(remaining, b.fineRemaining);
        b.finePaid = round2(b.finePaid + pay);
        b.fineRemaining = round2(b.fineRemaining - pay);
        remaining = round2(remaining - pay);
      }
    }
  }

  // Final fine accrual up to cap (inclusive) for any months still unpaid
  for (const b of buckets) {
    accrueFineThrough(b, args.effectiveCap);
  }

  // Totals
  const unpaidBuckets = buckets.filter((b) => b.principalRemaining > 0);

  const unpaidMonths = unpaidBuckets.length;
  const outstandingFees = round2(
    unpaidBuckets.reduce((sum, b) => sum + b.principalRemaining, 0)
  );
  const fineAmount = round2(
    unpaidBuckets.reduce((sum, b) => sum + b.fineRemaining, 0)
  );
  const numberOfFineDays = unpaidBuckets.reduce(
    (sum, b) => sum + b.fineDaysAccrued,
    0
  );
  const totalOutstanding = round2(outstandingFees + fineAmount);

  const fineBreakdown = unpaidBuckets.map((b) => ({
    key: b.key,
    label: b.label,
    days: b.fineDaysAccrued,
    fine: round2(b.fineRemaining),
  }));

  return {
    buckets,
    unpaidMonths,
    outstandingFees,
    numberOfFineDays,
    fineAmount,
    totalOutstanding,
    fineBreakdown,
  };
};

const addDaysUTC2 = (d: Date, days: number) =>
  new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

const endOfDayUTC2 = (d: Date) =>
  new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

const fmtMonthYearUTC2 = (ms: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), 1))
  );

export const getLandRentMonthlyDetails = async (params: {
  leaseId: string;
  monthKey: string; // YYYY-MM
  capToEndDate?: boolean;
}) => {
  const { lease, parcel, tenant } = await fetchLandLeaseBundle(params.leaseId);

  const monthlyRent = round2(
    Number(parcel.sizeSqft ?? 0) * Number(lease.rateLariPerSqft ?? 0)
  );

  const paymentDueDay =
    typeof lease.paymentDueDay === "number"
      ? clampInt2(lease.paymentDueDay, 1, 28)
      : 10;

  const fineLariPerDay =
    typeof lease.fineLariPerDay === "number"
      ? Number(lease.fineLariPerDay ?? 0)
      : 0;

  // ✅ opening snapshot ONLY (never changes with payments)
  const openingLastPaid = safeDateUTC2((lease as any).lastPaymentDate ?? null);

  const rentStart = safeDateUTC2((lease as any).startDate ?? null);
  const rentEnd = safeDateUTC2((lease as any).endDate ?? null);
  const released = safeDateUTC2((lease as any).releasedDate ?? null);

  const { y, m } = parseMonthKey2(params.monthKey);

  const today = dateOnlyUTC2(new Date());
  const capBySelectedMonth = endOfMonthUTC2(y, m);

  let effectiveCap = minDate2(today, capBySelectedMonth) ?? today;

  if (params.capToEndDate && rentEnd) {
    effectiveCap = minDate2(effectiveCap, rentEnd) ?? effectiveCap;
  }
  if (released) {
    effectiveCap = minDate2(effectiveCap, released) ?? effectiveCap;
  }

  let fromMonth = (() => {
    if (openingLastPaid)
      return addMonthsUTC2(startOfMonthUTC2(openingLastPaid), 1);
    if (rentStart) return startOfMonthUTC2(rentStart);
    return startOfMonthUTC2(effectiveCap);
  })();

  if (rentStart) {
    const rentStartMonth = startOfMonthUTC2(rentStart);
    if (fromMonth.getTime() < rentStartMonth.getTime())
      fromMonth = rentStartMonth;
  }

  let toMonth = new Date(Date.UTC(y, m - 1, 1));
  const dueThisMonth = new Date(
    Date.UTC(toMonth.getUTCFullYear(), toMonth.getUTCMonth(), paymentDueDay)
  );

  if (effectiveCap.getTime() <= dateOnlyUTC2(dueThisMonth).getTime()) {
    toMonth = addMonthsUTC2(toMonth, -1);
  }

  // Latest payment date displayed in snapshot is ONLY the opening snapshot.
  const latestPaymentDate = openingLastPaid
    ? `${openingLastPaid.getUTCFullYear()}-${pad2(
        openingLastPaid.getUTCMonth() + 1
      )}-${pad2(openingLastPaid.getUTCDate())}`
    : null;

  if (toMonth.getTime() < fromMonth.getTime()) {
    return {
      landName: String(parcel.name ?? ""),
      rentingPerson: String(tenant.fullName ?? ""),
      rentDuration: {
        startDate: String((lease as any).startDate ?? ""),
        endDate: String((lease as any).endDate ?? ""),
      },
      agreementNumber: String(lease.agreementNumber ?? ""),
      letGoDate: (lease as any).releasedDate
        ? String((lease as any).releasedDate)
        : null,

      rentFeePerMonth: monthlyRent,
      sizeOfLand: Number(parcel.sizeSqft ?? 0),
      rentRate: Number(lease.rateLariPerSqft ?? 0),

      latestPaymentDate,

      numberOfFineDays: 0,
      fineAmount: 0,
      numberOfDaysRentNotPaid: 0,

      monthlyRentPaymentAmount: monthlyRent,
      totalRentPaymentMonthly: 0,

      isPaidForThisMonth: false,
      fineLariPerDay,
      paymentDueDay,
      monthKey: params.monthKey,

      unpaidMonths: 0,
      outstandingFees: 0,
      fineBreakdown: [],

      // keep fields (but always empty) to avoid breaking old UI
      payments: [],
      paymentsTotal: 0,
    };
  }

  // ✅ IMPORTANT: ignore payments completely for snapshot
  const computed = computeBucketsWithPaymentsUTC2({
    fromMonth,
    toMonth,
    paymentDueDay,
    monthlyRent,
    fineLariPerDay,
    effectiveCap,
    payments: [], // <- always empty now
  });

  return {
    landName: String(parcel.name ?? ""),
    rentingPerson: String(tenant.fullName ?? ""),
    rentDuration: {
      startDate: String((lease as any).startDate ?? ""),
      endDate: String((lease as any).endDate ?? ""),
    },
    agreementNumber: String(lease.agreementNumber ?? ""),
    letGoDate: (lease as any).releasedDate
      ? String((lease as any).releasedDate)
      : null,

    rentFeePerMonth: monthlyRent,
    sizeOfLand: Number(parcel.sizeSqft ?? 0),
    rentRate: Number(lease.rateLariPerSqft ?? 0),

    latestPaymentDate, // <- opening snapshot only

    numberOfFineDays: computed.numberOfFineDays,
    fineAmount: computed.fineAmount,
    numberOfDaysRentNotPaid: computed.numberOfFineDays,

    monthlyRentPaymentAmount: monthlyRent,
    totalRentPaymentMonthly: computed.totalOutstanding,

    isPaidForThisMonth: false,
    fineLariPerDay,
    paymentDueDay,
    monthKey: params.monthKey,

    unpaidMonths: computed.unpaidMonths,
    outstandingFees: computed.outstandingFees,
    fineBreakdown: computed.fineBreakdown,

    payments: [], // <- always empty now
    paymentsTotal: 0, // <- always 0 now
  };
};

/* =============================== Optional: Bulk Monthly Statements =============================== */

/**
 * Get monthly details for ALL leases for a given monthKey.
 * Useful to generate everyone’s slip list.
 */
export const getAllLandRentMonthlyDetails = async (monthKey: string) => {
  const leases = await listAllDocuments<LandLeaseDoc>(landLeasesCollectionId, [
    Query.orderDesc("$createdAt"),
  ]);

  const results = await Promise.all(
    leases.map(async (l) =>
      getLandRentMonthlyDetails({ leaseId: l.$id, monthKey })
    )
  );

  return results;
};

export async function createLandRentBundle(
  payload: CreateLandRentPayload
): Promise<CreatedLandRentBundle> {
  const db = appwriteConfig.databaseId;

  if (!appwriteConfig.landTenantsCollectionId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");
  }
  if (!appwriteConfig.landParcelsCollectionId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  }
  if (!appwriteConfig.landLeasesCollectionId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");
  }

  // 1) tenant
  const tenant = await databases.createDocument(
    db,
    appwriteConfig.landTenantsCollectionId,
    ID.unique(),
    {
      fullName: payload.tenant.fullName,
    }
  );

  // 2) parcel
  const parcel = await databases.createDocument(
    db,
    appwriteConfig.landParcelsCollectionId,
    ID.unique(),
    {
      name: payload.parcel.name,
      sizeSqft: payload.parcel.sizeSqft,
    }
  );

  // 3) lease (links)
  const lease = await databases.createDocument(
    db,
    appwriteConfig.landLeasesCollectionId,
    ID.unique(),
    {
      parcelId: parcel.$id,
      tenantId: tenant.$id,

      startDate: payload.lease.startDate,
      endDate: payload.lease.endDate,
      agreementNumber: payload.lease.agreementNumber,

      releasedDate: payload.lease.releasedDate ?? null,

      rateLariPerSqft: payload.lease.rateLariPerSqft,
      paymentDueDay: payload.lease.paymentDueDay,
      fineLariPerDay: payload.lease.fineLariPerDay,
    }
  );

  return { tenant, parcel, lease };
}

export const fetchLandLeaseOptions = async (): Promise<LandLeaseOption[]> => {
  if (!appwriteConfig.landLeasesCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");
  if (!appwriteConfig.landParcelsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  if (!appwriteConfig.landTenantsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");

  // Get leases (paginate)
  const leases: LandLeaseDoc[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const res = await databases.listDocuments<LandLeaseDoc>(
      appwriteConfig.databaseId,
      appwriteConfig.landLeasesCollectionId,
      [Query.orderDesc("$createdAt"), Query.limit(limit), Query.offset(offset)]
    );

    leases.push(...res.documents);
    hasMore = res.documents.length === limit;
    offset += hasMore ? limit : 0;
  }

  // Build options by fetching parcel + tenant for each lease
  const opts = await Promise.all(
    leases.map(async (l) => {
      const [parcel, tenant] = await Promise.all([
        databases.getDocument<LandParcelDoc>(
          appwriteConfig.databaseId,
          appwriteConfig.landParcelsCollectionId,
          l.parcelId
        ),
        databases.getDocument<LandTenantDoc>(
          appwriteConfig.databaseId,
          appwriteConfig.landTenantsCollectionId,
          l.tenantId
        ),
      ]);

      return {
        leaseId: l.$id,
        landName: String(parcel.name ?? ""),
        tenantName: String(tenant.fullName ?? ""),
      } satisfies LandLeaseOption;
    })
  );

  // sort nice
  opts.sort((a, b) =>
    `${a.landName} ${a.tenantName}`.localeCompare(
      `${b.landName} ${b.tenantName}`
    )
  );

  return opts;
};

export const createLandRentHolder = async (
  input: CreateLandRentHolderInput
) => {
  if (!appwriteConfig.landTenantsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");
  if (!appwriteConfig.landParcelsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  if (!appwriteConfig.landLeasesCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");

  const toISODateTime = (yyyyMmDd: string) =>
    new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();

  // 1) Create tenant
  const tenant = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.landTenantsCollectionId,
    ID.unique(),
    {
      fullName: input.renterName,
    }
  );

  // 2) Create land parcel
  const parcel = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.landParcelsCollectionId,
    ID.unique(),
    {
      name: input.landName,
      sizeSqft: input.sizeSqft,
    }
  );

  // 3) Create lease (MATCHES your Appwrite schema)
  const lease = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.landLeasesCollectionId,
    ID.unique(),
    {
      tenantId: tenant.$id,
      parcelId: parcel.$id,

      agreementNumber: input.agreementNumber,

      // Appwrite columns: startDate, endDate, releasedDate (datetime)
      startDate: toISODateTime(input.rentStartDate),
      endDate: toISODateTime(input.rentEndDate),
      releasedDate: input.letGoDate ? toISODateTime(input.letGoDate) : null,

      // Appwrite columns: rateLariPerSqft, paymentDueDay, fineLariPerDay
      rateLariPerSqft: input.rate,
      paymentDueDay: input.paymentDueDay,
      fineLariPerDay: input.finePerDay,

      // Optional (if you use it)
      status: "active",

      // Opening snapshot (only fields that exist in your schema)
      lastPaymentDate: input.lastPaymentDate
        ? toISODateTime(input.lastPaymentDate)
        : null,
      openingFineDays: input.openingFineDays ?? 0,
      openingFineMonths: input.openingFineMonths ?? 0,
      openingOutstandingFees: input.openingOutstandingFees ?? 0,
      openingOutstandingTotal: input.openingOutstandingTotal ?? 0,
    }
  );

  return { tenant, parcel, lease };
};

export const fetchLandRentOverview = async (): Promise<
  LandRentOverviewRow[]
> => {
  if (!appwriteConfig.landLeasesCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");
  if (!appwriteConfig.landParcelsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  if (!appwriteConfig.landTenantsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");

  const [leases, parcels, tenants] = await Promise.all([
    listAllDocuments<LandLeaseDoc>(appwriteConfig.landLeasesCollectionId, [
      Query.orderDesc("$createdAt"),
    ]),
    listAllDocuments<LandParcelDoc>(appwriteConfig.landParcelsCollectionId, [
      Query.orderAsc("$createdAt"),
    ]),
    listAllDocuments<LandTenantDoc>(appwriteConfig.landTenantsCollectionId, [
      Query.orderAsc("$createdAt"),
    ]),
  ]);

  const parcelById = new Map(parcels.map((p) => [p.$id, p]));
  const tenantById = new Map(tenants.map((t) => [t.$id, t]));

  const rows = leases.map((l) => {
    const parcel = parcelById.get(l.parcelId);
    const tenant = tenantById.get(l.tenantId);

    const sizeSqft = Number(parcel?.sizeSqft ?? 0);
    const rate = Number(l.rateLariPerSqft ?? 0);

    return {
      leaseId: l.$id,
      landName: String(parcel?.name ?? ""),
      tenantName: String(tenant?.fullName ?? ""),

      agreementNumber: String(l.agreementNumber ?? ""),
      startDate: String(l.startDate ?? ""),
      endDate: String(l.endDate ?? ""),
      releasedDate: l.releasedDate ? String(l.releasedDate) : null,

      paymentDueDay: Number(l.paymentDueDay ?? 10),
      rateLariPerSqft: rate,

      sizeSqft,
      monthlyRent: round2(sizeSqft * rate),

      lastPaymentDate: l.lastPaymentDate ? String(l.lastPaymentDate) : null,
      openingOutstandingTotal: Number((l as any).openingOutstandingTotal ?? 0),
      status: (l as any).status ? String((l as any).status) : null,
    } satisfies LandRentOverviewRow;
  });

  rows.sort((a, b) =>
    `${a.landName} ${a.tenantName}`.localeCompare(
      `${b.landName} ${b.tenantName}`
    )
  );

  return rows;
};
