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
  monthKey: string; // YYYY-MM
  paidAt: string; // ISO
  amountMvr: number;
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
export const isMonthPaid = async (
  leaseId: string,
  monthKey: string
): Promise<boolean> => {
  const res = await databases.listDocuments<LandPaymentDoc>(
    databaseId,
    landPaymentsCollectionId,
    [
      Query.equal("leaseId", leaseId),
      Query.equal("monthKey", monthKey),
      Query.limit(1),
    ]
  );
  return res.total > 0;
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
export const getLandRentMonthlyDetails = async (params: {
  leaseId: string;
  monthKey: string; // YYYY-MM
}) => {
  const { lease, parcel, tenant } = await fetchLandLeaseBundle(params.leaseId);

  const [latestPayment, paidForMonth] = await Promise.all([
    fetchLatestPaymentForLease(params.leaseId),
    isMonthPaid(params.leaseId, params.monthKey),
  ]);

  const paymentDueDay =
    typeof lease.paymentDueDay === "number" ? lease.paymentDueDay : 10;
  const fineLariPerDay =
    typeof lease.fineLariPerDay === "number" ? lease.fineLariPerDay : 0;

  const calc = computeMonthlyLandRent({
    monthKey: params.monthKey,
    sizeSqft: Number(parcel.sizeSqft ?? 0),
    rateLariPerSqft: Number(lease.rateLariPerSqft ?? 0),
    paymentDueDay,
    fineLariPerDay,
    releasedDateISO: lease.releasedDate ?? null,
    latestPaymentISO: latestPayment?.paidAt ?? null,
    isPaidForThisMonth: paidForMonth,
  });

  return {
    // Your required fields:
    landName: String(parcel.name ?? ""),
    rentingPerson: String(tenant.fullName ?? ""),
    rentDuration: {
      startDate: String(lease.startDate ?? ""),
      endDate: String(lease.endDate ?? ""),
    },
    agreementNumber: String(lease.agreementNumber ?? ""),
    letGoDate: lease.releasedDate ? String(lease.releasedDate) : null,

    rentFeePerMonth: calc.monthlyRent, // monthly rent
    sizeOfLand: Number(parcel.sizeSqft ?? 0),
    rentRate: Number(lease.rateLariPerSqft ?? 0),

    latestPaymentDate: calc.latestPaymentISO,

    numberOfFineDays: calc.fineDays,
    fineAmount: calc.fineAmount,

    numberOfDaysRentNotPaid: calc.daysNotPaid,

    monthlyRentPaymentAmount: calc.monthlyRent,
    totalRentPaymentMonthly: calc.totalMonthly,

    // helpful extras
    isPaidForThisMonth: paidForMonth,
    fineLariPerDay,
    paymentDueDay,
    monthKey: params.monthKey,
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

  // 3) Create lease (includes opening snapshot fields)
  const lease = await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.landLeasesCollectionId,
    ID.unique(),
    {
      tenantId: tenant.$id,
      parcelId: parcel.$id,

      agreementNumber: input.agreementNumber,
      rentStartDate: input.rentStartDate,
      rentEndDate: input.rentEndDate,
      letGoDate: input.letGoDate ?? null,

      rate: input.rate,
      monthlyRent: input.monthlyRent,
      paymentDueDay: input.paymentDueDay,
      finePerDay: input.finePerDay,

      // Opening snapshot
      lastPaymentDate: input.lastPaymentDate ?? null,
      openingFineDays: input.openingFineDays ?? 0,
      openingFineMonths: input.openingFineMonths ?? 0,
      openingTotalFine: input.openingTotalFine ?? 0,
      openingOutstandingFees: input.openingOutstandingFees ?? 0,
      openingOutstandingTotal: input.openingOutstandingTotal ?? 0,
    }
  );

  return { tenant, parcel, lease };
};
