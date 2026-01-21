/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, Databases, ID, Models, Query, Storage } from "appwrite";

/* =============================== Config =============================== */

export const appwriteConfig = {
  endpoint: "https://cloud.appwrite.io/v1",
  projectId: "68fafb190023ef05bc17",
  databaseId: "68fafc1000231aecbf69",

  landParcelsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION ?? "",
  landTenantsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION ?? "",
  landLeasesCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION ?? "",
  landPaymentsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION ?? "",
  landStatementsCollectionId:
    process.env.NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION ?? "",
  agreementsBucketId: process.env.NEXT_PUBLIC_APPWRITE_AGREEMENTS_BUCKET ?? "",
};

const {
  endpoint,
  projectId,
  databaseId,
  landParcelsCollectionId,
  landTenantsCollectionId,
  landLeasesCollectionId,
  landPaymentsCollectionId,
  landStatementsCollectionId,
  agreementsBucketId,
} = appwriteConfig;

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId);

const databases = new Databases(client);

const storage = new Storage(client);

/* =============================== Types =============================== */

export type LandParcelDoc = Models.Document & {
  name: string;
  sizeSqft: number;
};

export type LandTenantDoc = Models.Document & {
  fullName: string;
};

export type LandLeaseDoc = Models.Document & {
  parcelId: string;
  tenantId: string;

  startDate: string; // ISO
  endDate: string; // ISO
  agreementNumber: string;

  releasedDate?: string | null;

  rateLariPerSqft: number;
  paymentDueDay?: number;
  fineLariPerDay?: number;

  agreementPdfFileId?: string | null;
  agreementPdfFilename?: string | null;

  status?: string | null;
};

export type LandStatementStatus = "OPEN" | "PAID";

export type LandStatementDoc = Models.Document & {
  leaseId: string;
  monthKey: string; // YYYY-MM
  status: LandStatementStatus;

  createdAt: string; // datetime (your custom field)
  createdBy?: string | null;

  // Denormalized fields (optional but you have them)
  landName?: string | null;
  tenantName?: string | null;
  agreementNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  releasedDate?: string | null;

  sizeSqft?: number | null;
  rateLariPerSqft?: number | null;
  paymentDueDay?: number | null;
  fineLariPerDay?: number | null;
  monthlyRent?: number | null;

  snapshot_totalRentPaymentMonthly?: number | null;
  snapshot_monthlyRentPaymentAmount?: number | null;
  snapshot_unpaidMonths?: number | null;
  snapshot_outstandingFees?: number | null;
  snapshot_numberOfFineDays?: number | null;
  snapshot_fineAmount?: number | null;

  snapshot_latestPaymentDate?: string | null;
  snapshot_fineBreakdownJson?: string | null;

  snapshot_capToEndDate?: boolean | null;
};

export type LandPaymentDoc = Models.Document & {
  leaseId: string;
  statementId: string;
  paidAt: string;
  amount: number;
  method?: string;

  note?: string;
  receivedBy?: string;

  slipFileId: string;
  slipFileName: string;
  slipMime?: string | null;
};

export type LandLeaseOption = {
  leaseId: string;
  landName: string;
  tenantName: string;
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

  agreementPdfFileId?: string | null;
  agreementPdfFilename?: string | null;

  slipFileId?: string | null;
  slipFilename?: string | null;
  slipMime?: string | null;
};

export type CreateLandRentPayload = {
  parcel: { name: string; sizeSqft: number };
  tenant: { fullName: string };
  lease: Omit<
    {
      parcelId: string;
      tenantId: string;
      startDate: string;
      endDate: string;
      agreementNumber: string;
      releasedDate?: string | null;
      rateLariPerSqft: number;
      paymentDueDay: number;
      fineLariPerDay: number;
    },
    "parcelId" | "tenantId"
  >;
};

export type CreatedLandRentBundle = {
  tenant: Models.Document;
  parcel: Models.Document;
  lease: Models.Document;
};

/* =============================== Helpers =============================== */

export function getPaymentSlipDownloadUrl(fileId: string): string {
  if (!agreementsBucketId) return "";
  return `${endpoint}/storage/buckets/${agreementsBucketId}/files/${fileId}/download?project=${projectId}`;
}

function parseDataUrl(dataUrl: string) {
  // "data:<mime>;base64,<data>"
  const m = String(dataUrl).match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("Invalid slip data (expected data URL).");
  return { mime: m[1], base64: m[2] };
}

async function uploadSlipFromDataUrl(
  dataUrl: string,
  filename: string,
): Promise<{ fileId: string; mime: string }> {
  if (!agreementsBucketId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_PAYMENT_SLIPS_BUCKET");
  }

  const { mime, base64 } = parseDataUrl(dataUrl);

  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mime });
  const file = new File([blob], filename, { type: mime });

  const result = await storage.createFile(
    agreementsBucketId,
    ID.unique(),
    file,
  );

  return { fileId: result.$id, mime };
}

export function getPaymentSlipUrl(fileId: string): string {
  if (!agreementsBucketId) return "";
  return `${endpoint}/storage/buckets/${agreementsBucketId}/files/${fileId}/view?project=${projectId}`;
}

/* =============================== PDF Storage Helpers =============================== */

export function getAgreementPdfDownloadUrl(fileId: string): string {
  if (!agreementsBucketId) return "";
  return `${endpoint}/storage/buckets/${agreementsBucketId}/files/${fileId}/download?project=${projectId}`;
}

async function uploadPdfFromBase64(
  base64Data: string,
  filename: string,
): Promise<string> {
  if (!agreementsBucketId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_AGREEMENTS_BUCKET");
  }

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const file = new File([blob], filename, { type: "application/pdf" });

  const result = await storage.createFile(
    agreementsBucketId,
    ID.unique(),
    file,
  );

  return result.$id;
}

export function getAgreementPdfUrl(fileId: string): string {
  if (!agreementsBucketId) return "";
  return `${endpoint}/storage/buckets/${agreementsBucketId}/files/${fileId}/view?project=${projectId}`;
}

async function deletePdfFile(fileId: string): Promise<void> {
  if (!agreementsBucketId) return;
  try {
    await storage.deleteFile(agreementsBucketId, fileId);
  } catch (error) {
    console.warn("Failed to delete PDF file:", error);
  }
}

const MALDIVES_TZ = "Indian/Maldives";

const dateOnlyInTimeZoneUTC = (d: Date, timeZone = MALDIVES_TZ) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(y, m - 1, day));
};

function unwrapAppwriteErrorMessage(e: any) {
  return (
    e?.response?.message ||
    e?.message ||
    e?.response ||
    "Unknown Appwrite error"
  );
}

// Converts "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00.000Z"
// Leaves full ISO datetimes as-is. Returns null for empty/invalid.
function toIsoDateTimeOrNull(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // If already looks like datetime
  if (s.includes("T")) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // If "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // last attempt
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Smart create: if schema rejects unknown attributes, remove them and retry.
// Also fixes datetime format errors when possible.
async function createDocumentSmartRetry<T extends Models.Document>(
  collectionId: string,
  data: Record<string, any>,
  maxRetries = 20,
): Promise<T> {
  const payload: Record<string, any> = { ...data }; // ✅ const is fine (we mutate keys)
  const removed: string[] = [];

  for (let i = 0; i < maxRetries; i += 1) {
    try {
      const doc = await databases.createDocument<T>(
        databaseId,
        collectionId,
        ID.unique(),
        payload as any, // ✅ Appwrite typing expects Omit<T, keyof Document>; we’re dynamic here
      );

      if (removed.length) {
        console.warn(
          `[land_statements] Created after stripping unknown fields:`,
          removed,
        );
      }

      return doc;
    } catch (e: any) {
      const msg = unwrapAppwriteErrorMessage(e);

      // Unknown attribute: xxx
      let m =
        String(msg).match(/Unknown attribute:?[\s"]+([A-Za-z0-9_]+)/i) ||
        String(msg).match(
          /attribute[\s"]+([A-Za-z0-9_]+)[\s"]+is not allowed/i,
        );

      if (m?.[1]) {
        const key = m[1];
        if (key in payload) {
          delete payload[key];
          removed.push(key);
          continue;
        }
      }

      // Invalid attribute format (often datetime)
      m = String(msg).match(/attribute[\s"]+([A-Za-z0-9_]+)[\s"]+.*invalid/i);
      if (m?.[1]) {
        const key = m[1];
        if (key in payload) {
          const fixed = toIsoDateTimeOrNull(payload[key]);
          if (fixed) {
            payload[key] = fixed;
            continue;
          }
          delete payload[key];
          removed.push(key);
          continue;
        }
      }

      throw new Error(msg);
    }
  }

  throw new Error(
    "Could not create statement: land_statements schema mismatches the payload (too many unknown fields).",
  );
}

function dateToMonthKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, "0");

const parseMonthKey = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  return { y, m };
};

const monthKeyIsValid = (monthKey: string) =>
  /^\d{4}-\d{2}$/.test(monthKey) && !Number.isNaN(parseMonthKey(monthKey).y);

const monthKeyCompare = (a: string, b: string) => a.localeCompare(b);

const addMonthsToMonthKey = (monthKey: string, delta: number) => {
  const { y, m } = parseMonthKey(monthKey);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
};

const ymdUTC = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

const dateOnlyUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const startOfMonthUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const addMonthsUTC = (d: Date, months: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));

const endOfMonthUTC = (y: number, m: number) => new Date(Date.UTC(y, m, 0)); // m is 1..12

const endOfDayUTC = (d: Date) =>
  new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

const addDaysUTC = (d: Date, days: number) =>
  new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

const safeDateUTC = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateOnlyUTC(d);
};

const minDate = (a: Date | null, b: Date | null) => {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() <= b.getTime() ? a : b;
};

const daysBetweenUTC = (a: Date, b: Date) => {
  const ms = 24 * 60 * 60 * 1000;
  const aa = dateOnlyUTC(a).getTime();
  const bb = dateOnlyUTC(b).getTime();
  return Math.max(0, Math.floor((bb - aa) / ms));
};

const monthStartsBetweenInclusiveUTC = (
  fromMonthStart: Date,
  toMonthStart: Date,
) => {
  const out: Date[] = [];
  let cur = startOfMonthUTC(fromMonthStart);
  const end = startOfMonthUTC(toMonthStart);

  while (cur.getTime() <= end.getTime()) {
    out.push(new Date(cur.getTime()));
    cur = addMonthsUTC(cur, 1);
  }
  return out;
};

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(v)));

const fmtMonthYearUTC = (ms: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), 1)),
  );

/** Pagination helper. */
const listAllDocuments = async <T extends Models.Document>(
  collectionId: string,
  queries: string[] = [],
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

/* =============================== Fetchers =============================== */

export const fetchLandLeaseBundle = async (leaseId: string) => {
  const lease = await databases.getDocument<LandLeaseDoc>(
    databaseId,
    landLeasesCollectionId,
    leaseId,
  );

  const [parcel, tenant] = await Promise.all([
    databases.getDocument<LandParcelDoc>(
      databaseId,
      landParcelsCollectionId,
      lease.parcelId,
    ),
    databases.getDocument<LandTenantDoc>(
      databaseId,
      landTenantsCollectionId,
      lease.tenantId,
    ),
  ]);

  return { lease, parcel, tenant };
};

export const fetchLandLeaseOptions = async (): Promise<LandLeaseOption[]> => {
  if (!landLeasesCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");
  if (!landParcelsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  if (!landTenantsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");

  const leases = await listAllDocuments<LandLeaseDoc>(landLeasesCollectionId, [
    Query.orderDesc("$createdAt"),
  ]);

  const opts = await Promise.all(
    leases.map(async (l) => {
      const [parcel, tenant] = await Promise.all([
        databases.getDocument<LandParcelDoc>(
          databaseId,
          landParcelsCollectionId,
          l.parcelId,
        ),
        databases.getDocument<LandTenantDoc>(
          databaseId,
          landTenantsCollectionId,
          l.tenantId,
        ),
      ]);

      return {
        leaseId: l.$id,
        landName: String(parcel.name ?? ""),
        tenantName: String(tenant.fullName ?? ""),
      } satisfies LandLeaseOption;
    }),
  );

  opts.sort((a, b) =>
    `${a.landName} ${a.tenantName}`.localeCompare(
      `${b.landName} ${b.tenantName}`,
    ),
  );

  return opts;
};

/* =============================== Statements (NEW flow) =============================== */

export const listLandStatementsForLease = async (leaseId: string) => {
  if (!landStatementsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION");

  const rows = await listAllDocuments<LandStatementDoc>(
    landStatementsCollectionId,
    [Query.equal("leaseId", leaseId), Query.orderAsc("monthKey")],
  );

  // Ensure stable order even if monthKey duplicates (shouldn't)
  rows.sort((a, b) => monthKeyCompare(a.monthKey, b.monthKey));
  return rows;
};

export const fetchOpenLandStatementForLease = async (leaseId: string) => {
  if (!landStatementsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION");

  const res = await databases.listDocuments<LandStatementDoc>(
    databaseId,
    landStatementsCollectionId,
    [
      Query.equal("leaseId", leaseId),
      Query.equal("status", "OPEN"),
      Query.limit(1),
    ],
  );

  return res.documents[0] ?? null;
};

const computeStatementFromBaseline = async (args: {
  leaseId: string;
  monthKey: string;
  capToEndDate?: boolean;
  payments?: Array<{ paidAt: string; amount: number }>;
}) => {
  const { lease, parcel, tenant } = await fetchLandLeaseBundle(args.leaseId);

  const paymentDueDay =
    typeof lease.paymentDueDay === "number"
      ? clampInt(lease.paymentDueDay, 1, 28)
      : 10;

  const fineLariPerDay =
    typeof lease.fineLariPerDay === "number"
      ? Number(lease.fineLariPerDay ?? 0)
      : 0;

  const sizeSqft = Number(parcel.sizeSqft ?? 0);
  const rate = Number(lease.rateLariPerSqft ?? 0);
  const monthlyRent = round2(sizeSqft * rate);

  const rentStart = safeDateUTC((lease as any).startDate ?? null);
  const rentEnd = safeDateUTC((lease as any).endDate ?? null);
  const released = safeDateUTC((lease as any).releasedDate ?? null);

  // Baseline = month AFTER the last paid month.
  // Prefer lease.lastPaymentDate (stored in land_leases). Fall back to last PAID statement, then rentStart.
  const allStatements = await listLandStatementsForLease(args.leaseId);
  const lastPaidStatement = allStatements
    .filter((s) => s.status === "PAID")
    .sort((a, b) => monthKeyCompare(a.monthKey, b.monthKey))
    .slice(-1)[0];

  // IMPORTANT: adjust these field names if your lease uses a different one
  const leaseLastPaidDate = safeDateUTC(
    (lease as any).lastPaymentDate ??
      (lease as any).lastPaidDate ??
      (lease as any).lastPaymentAt ??
      null,
  );

  const paidThroughFromLease = leaseLastPaidDate
    ? dateToMonthKeyUTC(leaseLastPaidDate)
    : null;

  const paidThroughFromStatements = lastPaidStatement?.monthKey ?? null;

  const paidThrough = (() => {
    if (paidThroughFromLease && paidThroughFromStatements) {
      return monthKeyCompare(paidThroughFromLease, paidThroughFromStatements) >=
        0
        ? paidThroughFromLease
        : paidThroughFromStatements;
    }
    return paidThroughFromLease ?? paidThroughFromStatements;
  })();

  const baselineFromMonthStart = (() => {
    if (paidThrough) {
      const nextKey = addMonthsToMonthKey(paidThrough, 1);
      const { y, m } = parseMonthKey(nextKey);
      return new Date(Date.UTC(y, m - 1, 1));
    }
    if (rentStart) return startOfMonthUTC(rentStart);
    return startOfMonthUTC(dateOnlyUTC(new Date()));
  })();

  // Clamp baseline to rentStart month
  let fromMonth = baselineFromMonthStart;
  if (rentStart) {
    const rs = startOfMonthUTC(rentStart);
    if (fromMonth.getTime() < rs.getTime()) fromMonth = rs;
  }

  if (!monthKeyIsValid(args.monthKey)) throw new Error("Invalid monthKey.");

  const { y, m } = parseMonthKey(args.monthKey);
  const toMonth = new Date(Date.UTC(y, m - 1, 1));

  // Don't allow statements before baseline
  if (toMonth.getTime() < fromMonth.getTime()) {
    // Nothing due in range => return zeros but keep identity fields
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
      sizeOfLand: sizeSqft,
      rentRate: rate,

      latestPaymentDate: null,

      numberOfFineDays: 0,
      fineAmount: 0,
      numberOfDaysRentNotPaid: 0,

      monthlyRentPaymentAmount: monthlyRent,
      totalRentPaymentMonthly: 0,

      fineLariPerDay,
      paymentDueDay,
      monthKey: args.monthKey,

      unpaidMonths: 0,
      outstandingFees: 0,
      fineBreakdown: [],

      payments: [],
      paymentsTotal: 0,
      balanceRemaining: 0,

      __range: {
        fromMonthKey: `${fromMonth.getUTCFullYear()}-${pad2(
          fromMonth.getUTCMonth() + 1,
        )}`,
        toMonthKey: null,
        effectiveCap: null,
      },
    };
  }

  const today = dateOnlyInTimeZoneUTC(new Date());
  const capBySelectedMonth = endOfMonthUTC(y, m);
  let effectiveCap = minDate(today, capBySelectedMonth) ?? today;

  if (args.capToEndDate && rentEnd) {
    effectiveCap = minDate(effectiveCap, rentEnd) ?? effectiveCap;
  }
  if (released) {
    effectiveCap = minDate(effectiveCap, released) ?? effectiveCap;
  }

  const pays = (args.payments ?? []).slice();
  const paymentsTotal = round2(
    pays.reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
  );

  const computed = computeBucketsWithPaymentsUTC({
    fromMonth,
    toMonth,
    paymentDueDay,
    monthlyRent,
    fineLariPerDay,
    effectiveCap,
    payments: pays,
  });

  const latestPay = pays.length
    ? pays
        .slice()
        .sort(
          (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
        )[0]
    : null;

  const formatYMD = (d: Date) =>
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
      d.getUTCDate(),
    )}`;

  const latestPaymentDate = latestPay
    ? formatYMD(dateOnlyUTC(new Date(latestPay.paidAt)))
    : leaseLastPaidDate
      ? formatYMD(leaseLastPaidDate)
      : null;

  const balanceRemaining = round2(computed.totalOutstanding);

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
    sizeOfLand: sizeSqft,
    rentRate: rate,

    latestPaymentDate,

    numberOfFineDays: computed.numberOfFineDays,
    fineAmount: computed.fineAmount,
    numberOfDaysRentNotPaid: computed.numberOfFineDays,

    monthlyRentPaymentAmount: monthlyRent,
    totalRentPaymentMonthly: balanceRemaining,

    fineLariPerDay,
    paymentDueDay,
    monthKey: args.monthKey,

    unpaidMonths: computed.unpaidMonths,
    outstandingFees: computed.outstandingFees,
    fineBreakdown: computed.fineBreakdown,

    payments: pays,
    paymentsTotal,
    balanceRemaining,

    __range: {
      fromMonthKey: `${fromMonth.getUTCFullYear()}-${pad2(
        fromMonth.getUTCMonth() + 1,
      )}`,
      toMonthKey: `${toMonth.getUTCFullYear()}-${pad2(
        toMonth.getUTCMonth() + 1,
      )}`,
      effectiveCap: effectiveCap.toISOString(),
    },
  };
};

export const previewLandRentStatement = async (params: {
  leaseId: string;
  monthKey: string;
  capToEndDate?: boolean;
}) => {
  // Preview ignores payments (because no statement exists yet)
  return computeStatementFromBaseline({
    leaseId: params.leaseId,
    monthKey: params.monthKey,
    capToEndDate: params.capToEndDate,
    payments: [],
  });
};

export const createLandStatement = async (params: {
  leaseId: string;
  monthKey: string;
  createdBy?: string;
  capToEndDate?: boolean;
}) => {
  if (!landStatementsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION");

  if (!monthKeyIsValid(params.monthKey)) throw new Error("Invalid monthKey.");

  const open = await fetchOpenLandStatementForLease(params.leaseId);
  if (open) {
    throw new Error("There is already an OPEN statement for this lease.");
  }

  const { lease, parcel, tenant } = await fetchLandLeaseBundle(params.leaseId);

  // Prevent creating a statement before the next allowed month
  const all = await listLandStatementsForLease(params.leaseId);
  const lastPaidStatement = all
    .filter((s) => s.status === "PAID")
    .sort((a, b) => monthKeyCompare(a.monthKey, b.monthKey))
    .slice(-1)[0];

  const leaseLastPaidDate = safeDateUTC(
    (lease as any).lastPaymentDate ??
      (lease as any).lastPaidDate ??
      (lease as any).lastPaymentAt ??
      null,
  );

  const paidThroughFromLease = leaseLastPaidDate
    ? dateToMonthKeyUTC(leaseLastPaidDate)
    : null;

  const paidThroughFromStatements = lastPaidStatement?.monthKey ?? null;

  const paidThrough = (() => {
    if (paidThroughFromLease && paidThroughFromStatements) {
      return monthKeyCompare(paidThroughFromLease, paidThroughFromStatements) >=
        0
        ? paidThroughFromLease
        : paidThroughFromStatements;
    }
    return paidThroughFromLease ?? paidThroughFromStatements;
  })();

  if (paidThrough) {
    const nextAllowed = addMonthsToMonthKey(paidThrough, 1);
    if (monthKeyCompare(params.monthKey, nextAllowed) < 0) {
      throw new Error(`Next statement must be ${nextAllowed} or later.`);
    }
  }

  const paymentDueDay =
    typeof lease.paymentDueDay === "number"
      ? clampInt(lease.paymentDueDay, 1, 28)
      : 10;

  const fineLariPerDay =
    typeof lease.fineLariPerDay === "number"
      ? Number(lease.fineLariPerDay ?? 0)
      : 0;

  const sizeSqft = Number(parcel.sizeSqft ?? 0);
  const rate = Number(lease.rateLariPerSqft ?? 0);
  const monthlyRent = round2(sizeSqft * rate);

  const snapshot = await computeStatementFromBaseline({
    leaseId: params.leaseId,
    monthKey: params.monthKey,
    capToEndDate: params.capToEndDate,
    payments: [], // ✅ snapshot ignores payments
  });

  const data: any = {
    leaseId: params.leaseId,
    monthKey: params.monthKey,
    status: "OPEN" as LandStatementStatus,
    createdAt: new Date().toISOString(),
    createdBy: params.createdBy ?? "",

    landName: String(parcel.name ?? ""),
    tenantName: String(tenant.fullName ?? ""),
    agreementNumber: String(lease.agreementNumber ?? ""),

    startDate: String((lease as any).startDate ?? ""),
    endDate: String((lease as any).endDate ?? ""),
    releasedDate: (lease as any).releasedDate
      ? String((lease as any).releasedDate)
      : null,

    snapshot_totalRentPaymentMonthly: Number(
      snapshot.totalRentPaymentMonthly ?? 0,
    ),
    snapshot_monthlyRentPaymentAmount: Number(
      snapshot.monthlyRentPaymentAmount ?? 0,
    ),
    snapshot_unpaidMonths: Number(snapshot.unpaidMonths ?? 0),
    snapshot_outstandingFees: Number(snapshot.outstandingFees ?? 0),
    snapshot_numberOfFineDays: Number(snapshot.numberOfFineDays ?? 0),
    snapshot_fineAmount: Number(snapshot.fineAmount ?? 0),

    snapshot_latestPaymentDate: snapshot.latestPaymentDate ?? null,
    snapshot_fineBreakdownJson: JSON.stringify(snapshot.fineBreakdown ?? []),

    snapshot_capToEndDate: !!params.capToEndDate,

    sizeSqft,
    rateLariPerSqft: rate,
    paymentDueDay,
    fineLariPerDay,
    monthlyRent,
  };

  const dataForCreate: any = { ...data };

  // Normalize dates (only if present)
  dataForCreate.createdAt =
    toIsoDateTimeOrNull(dataForCreate.createdAt) ?? new Date().toISOString();

  if (dataForCreate.startDate)
    dataForCreate.startDate = toIsoDateTimeOrNull(dataForCreate.startDate);

  if (dataForCreate.endDate)
    dataForCreate.endDate = toIsoDateTimeOrNull(dataForCreate.endDate);

  if (dataForCreate.releasedDate)
    dataForCreate.releasedDate = toIsoDateTimeOrNull(
      dataForCreate.releasedDate,
    );

  // createdBy: keep as string (don’t force null unless your schema allows it)
  dataForCreate.createdBy = String(dataForCreate.createdBy ?? "").trim();

  return createDocumentSmartRetry<LandStatementDoc>(
    landStatementsCollectionId,
    dataForCreate,
  );
};

export const listLandPaymentsForStatement = async (statementId: string) => {
  if (!landPaymentsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION");

  const rows = await listAllDocuments<LandPaymentDoc>(
    landPaymentsCollectionId,
    [Query.equal("statementId", statementId), Query.orderAsc("paidAt")],
  );

  return rows;
};

export const getLandStatementDetails = async (params: {
  statementId: string;
  capToEndDate?: boolean;
}) => {
  if (!landStatementsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION");

  const statement = await databases.getDocument<LandStatementDoc>(
    databaseId,
    landStatementsCollectionId,
    params.statementId,
  );

  // Load lease bundle for stable identity fields used by invoice/table
  const { lease, parcel, tenant } = await fetchLandLeaseBundle(
    statement.leaseId,
  );

  const paymentDueDay =
    typeof (lease as any).paymentDueDay === "number"
      ? clampInt(Number((lease as any).paymentDueDay), 1, 28)
      : 10;

  const fineLariPerDay =
    typeof (lease as any).fineLariPerDay === "number"
      ? Number((lease as any).fineLariPerDay ?? 0)
      : 0;

  const sizeSqft = Number((parcel as any).sizeSqft ?? 0);
  const rentRate = Number((lease as any).rateLariPerSqft ?? 0);

  const rentDuration = {
    startDate: String((lease as any).startDate ?? ""),
    endDate: String((lease as any).endDate ?? ""),
  };

  // ✅ Load payments (real-time)
  const paysDocs = await listLandPaymentsForStatement(params.statementId);
  const payments = paysDocs.map((p) => ({
    paidAt: p.paidAt,
    amount: Number((p as any).amount ?? 0),
    method: String((p as any).method ?? ""),
    reference: String((p as any).reference ?? ""),
    note: String((p as any).note ?? ""),
    receivedBy: String((p as any).receivedBy ?? ""),

    slipFileId: (p as any).slipFileId ?? null,
    slipFileName: (p as any).slipFileName ?? null,
    slipMime: (p as any).slipMime ?? null,
  }));

  const paymentsTotal = round2(
    payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
  );

  // -----------------------------
  // ✅ Snapshot totals (frozen)
  // -----------------------------
  const stAny = statement as any;

  const hasSnapshot =
    Number.isFinite(Number(stAny.snapshot_totalRentPaymentMonthly ?? NaN)) &&
    Number.isFinite(Number(stAny.snapshot_outstandingFees ?? NaN)) &&
    Number.isFinite(Number(stAny.snapshot_fineAmount ?? NaN));

  let snapshot_totalRentPaymentMonthly = 0;
  let snapshot_monthlyRentPaymentAmount = 0;
  let snapshot_unpaidMonths = 0;
  let snapshot_outstandingFees = 0;
  let snapshot_numberOfFineDays = 0;
  let snapshot_fineAmount = 0;
  let snapshot_latestPaymentDate: string | null = null;
  let snapshot_fineBreakdown: any[] = [];

  if (hasSnapshot) {
    snapshot_totalRentPaymentMonthly = Number(
      stAny.snapshot_totalRentPaymentMonthly ?? 0,
    );
    snapshot_monthlyRentPaymentAmount = Number(
      stAny.snapshot_monthlyRentPaymentAmount ?? 0,
    );
    snapshot_unpaidMonths = Number(stAny.snapshot_unpaidMonths ?? 0);
    snapshot_outstandingFees = Number(stAny.snapshot_outstandingFees ?? 0);
    snapshot_numberOfFineDays = Number(stAny.snapshot_numberOfFineDays ?? 0);
    snapshot_fineAmount = Number(stAny.snapshot_fineAmount ?? 0);
    snapshot_latestPaymentDate = (stAny.snapshot_latestPaymentDate ??
      null) as any;

    try {
      snapshot_fineBreakdown = stAny.snapshot_fineBreakdownJson
        ? JSON.parse(String(stAny.snapshot_fineBreakdownJson))
        : [];
    } catch {
      snapshot_fineBreakdown = [];
    }
  } else {
    // Fallback for old statements that don't have snapshot fields yet:
    // compute once (WITHOUT payments) then backfill snapshot fields.
    const computedSnap = await computeStatementFromBaseline({
      leaseId: statement.leaseId,
      monthKey: statement.monthKey,
      capToEndDate: params.capToEndDate,
      payments: [], // IMPORTANT: snapshot ignores payments
    });

    snapshot_totalRentPaymentMonthly = Number(
      (computedSnap as any).totalRentPaymentMonthly ?? 0,
    );
    snapshot_monthlyRentPaymentAmount = Number(
      (computedSnap as any).monthlyRentPaymentAmount ?? 0,
    );
    snapshot_unpaidMonths = Number((computedSnap as any).unpaidMonths ?? 0);
    snapshot_outstandingFees = Number(
      (computedSnap as any).outstandingFees ?? 0,
    );
    snapshot_numberOfFineDays = Number(
      (computedSnap as any).numberOfFineDays ?? 0,
    );
    snapshot_fineAmount = Number((computedSnap as any).fineAmount ?? 0);
    snapshot_latestPaymentDate = ((computedSnap as any).latestPaymentDate ??
      null) as any;
    snapshot_fineBreakdown = Array.isArray((computedSnap as any).fineBreakdown)
      ? (computedSnap as any).fineBreakdown
      : [];

    // Best-effort backfill (won't break if attributes not created yet)
    try {
      await databases.updateDocument(
        databaseId,
        landStatementsCollectionId,
        statement.$id,
        {
          snapshot_totalRentPaymentMonthly,
          snapshot_monthlyRentPaymentAmount,
          snapshot_unpaidMonths,
          snapshot_outstandingFees,
          snapshot_numberOfFineDays,
          snapshot_fineAmount,
          snapshot_latestPaymentDate,
          snapshot_fineBreakdownJson: JSON.stringify(
            snapshot_fineBreakdown ?? [],
          ),
          snapshot_capToEndDate: !!params.capToEndDate,
        },
      );
    } catch {
      // ignore (attributes may not exist yet)
    }
  }

  // Live remaining balance (ONLY thing that changes with payments)
  const balanceRemaining = round2(
    Math.max(0, snapshot_totalRentPaymentMonthly - paymentsTotal),
  );

  const isPaid = balanceRemaining <= 0.00001;

  return {
    statement,

    // Stable identity fields used around the UI/PDF
    landName: String((parcel as any).name ?? (statement as any).landName ?? ""),
    rentingPerson: String(
      (tenant as any).fullName ?? (statement as any).tenantName ?? "",
    ),
    rentDuration,
    agreementNumber: String(
      (lease as any).agreementNumber ??
        (statement as any).agreementNumber ??
        "",
    ),
    letGoDate: (lease as any).releasedDate
      ? String((lease as any).releasedDate)
      : null,

    rentRate,
    sizeOfLand: sizeSqft,
    fineLariPerDay,
    paymentDueDay,
    monthKey: statement.monthKey,

    // ✅ Frozen snapshot fields (never change after create)
    latestPaymentDate: snapshot_latestPaymentDate,
    numberOfFineDays: snapshot_numberOfFineDays,
    fineAmount: snapshot_fineAmount,
    numberOfDaysRentNotPaid: snapshot_numberOfFineDays,

    monthlyRentPaymentAmount: snapshot_monthlyRentPaymentAmount,
    unpaidMonths: snapshot_unpaidMonths,
    outstandingFees: snapshot_outstandingFees,
    fineBreakdown: snapshot_fineBreakdown,

    // IMPORTANT: This is the frozen "fees+fine" total (pre-payments)
    totalRentPaymentMonthly: snapshot_totalRentPaymentMonthly,

    // ✅ Live payment fields (these change as you accept payments)
    payments,
    paymentsTotal,
    balanceRemaining,
    isPaid,
  };
};

export const fetchLandStatementsWithDetails = async (params: {
  leaseId: string;
  capToEndDate?: boolean;
}) => {
  const statements = await listLandStatementsForLease(params.leaseId);
  const details = await Promise.all(
    statements.map((s) =>
      getLandStatementDetails({
        statementId: s.$id,
        capToEndDate: params.capToEndDate,
      }),
    ),
  );

  // Ensure same order as statements
  details.sort((a, b) =>
    monthKeyCompare(a.statement.monthKey, b.statement.monthKey),
  );
  return details;
};

const maybeMarkStatementPaid = async (
  statementId: string,
  capToEndDate?: boolean,
) => {
  if (!landStatementsCollectionId) return;

  const details = await getLandStatementDetails({ statementId, capToEndDate });
  const alreadyPaid = details.statement.status === "PAID";
  const shouldBePaid = details.isPaid;

  if (!alreadyPaid && shouldBePaid) {
    await databases.updateDocument(
      databaseId,
      landStatementsCollectionId,
      statementId,
      {
        status: "PAID",
      },
    );
  }
};

export const createLandRentPayment = async (input: {
  statementId: string;
  paidAt: string; // ISO datetime
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
  receivedBy?: string;
  slipDataUrl?: string | null;
  slipFilename?: string | null;
  capToEndDate?: boolean; // used only for auto-mark-paid calc
}) => {
  if (!landPaymentsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PAYMENTS_COLLECTION");
  if (!landStatementsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_STATEMENTS_COLLECTION");

  const amount = Number(input.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("Invalid paidAt date.");
  }

  const st = await databases.getDocument<LandStatementDoc>(
    databaseId,
    landStatementsCollectionId,
    input.statementId,
  );

  if (st.status === "PAID") {
    throw new Error(
      "This statement is already PAID. Create the next statement.",
    );
  }

  if (!input.slipDataUrl || !input.slipFilename) {
    throw new Error("Payment slip is required.");
  }

  const uploaded = await uploadSlipFromDataUrl(
    input.slipDataUrl,
    input.slipFilename,
  );

  const slipFileId = uploaded.fileId;
  const slipMime = uploaded.mime;
  const slipFileName = input.slipFilename;

  const created = await databases.createDocument<LandPaymentDoc>(
    databaseId,
    landPaymentsCollectionId,
    ID.unique(),
    {
      leaseId: st.leaseId,
      statementId: input.statementId,
      paidAt: paidAt.toISOString(),
      amount,
      method: input.method ?? "",
      reference: input.reference ?? "",
      note: input.note ?? "",
      receivedBy: input.receivedBy ?? "",
      slipFileId,
      slipFileName,
      slipMime,
    },
  );

  // After saving payment, mark statement PAID if fully settled
  await maybeMarkStatementPaid(input.statementId, input.capToEndDate);

  return created;
};

/* =============================== Core Computation =============================== */

const computeBucketsWithPaymentsUTC = (args: {
  fromMonth: Date;
  toMonth: Date;
  paymentDueDay: number;
  monthlyRent: number;
  fineLariPerDay: number;
  effectiveCap: Date;
  payments: Array<{ paidAt: string; amount: number }>;
}) => {
  type Bucket = {
    key: string;
    label: string;

    monthStart: Date;
    dueDate: Date;
    fineStart: Date;

    principalDue: number;
    principalPaid: number;
    principalRemaining: number;

    fineDaysAccrued: number;
    fineAccrued: number;
    finePaid: number;
    fineRemaining: number;

    lastFineAccrualDate: Date;
    principalClearedAt: Date | null;
  };

  const buckets: Bucket[] = [];

  for (const ms of monthStartsBetweenInclusiveUTC(
    args.fromMonth,
    args.toMonth,
  )) {
    const dueDate = new Date(
      Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), args.paymentDueDay),
    );
    const dueDateOnly = dateOnlyUTC(dueDate);

    // ✅ Fine starts on the due day (10th), not the next day
    const fineStart = addDaysUTC(dueDateOnly, 1);

    buckets.push({
      key: `${ms.getUTCFullYear()}-${pad2(ms.getUTCMonth() + 1)}`,
      label: fmtMonthYearUTC(ms),

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
    // Fine accrues only while principal is unpaid
    if (b.principalRemaining <= 0) return;

    const thru = dateOnlyUTC(thruDate);
    if (thru.getTime() < b.fineStart.getTime()) return;

    const start =
      b.lastFineAccrualDate.getTime() < b.fineStart.getTime()
        ? b.fineStart
        : b.lastFineAccrualDate;

    if (thru.getTime() < start.getTime()) return;

    const days = daysBetweenUTC(start, thru) + 1;
    b.fineDaysAccrued += days;

    b.fineAccrued = round2(b.fineAccrued + days * args.fineLariPerDay);
    b.fineRemaining = round2(b.fineAccrued - b.finePaid);

    b.lastFineAccrualDate = addDaysUTC(thru, 1);
  };

  const paymentsSorted = [...args.payments].sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
  );

  for (const p of paymentsSorted) {
    let remaining = round2(Number(p.amount ?? 0));
    if (!Number.isFinite(remaining) || remaining <= 0) continue;

    const payDate = dateOnlyInTimeZoneUTC(new Date(p.paidAt));
    const payDateClamped =
      minDate(payDate, args.effectiveCap) ?? args.effectiveCap;

    for (let i = 0; i < buckets.length && remaining > 0; i += 1) {
      const b = buckets[i];

      const hasBalance = b.principalRemaining > 0 || b.fineRemaining > 0;
      if (!hasBalance) continue;

      accrueFineThrough(b, payDateClamped);

      // principal first
      if (b.principalRemaining > 0 && remaining > 0) {
        const pay = Math.min(remaining, b.principalRemaining);
        b.principalPaid = round2(b.principalPaid + pay);
        b.principalRemaining = round2(b.principalRemaining - pay);
        remaining = round2(remaining - pay);

        if (b.principalRemaining <= 0 && !b.principalClearedAt) {
          b.principalClearedAt = payDateClamped;
        }
      }

      // then fine
      if (b.fineRemaining > 0 && remaining > 0) {
        const pay = Math.min(remaining, b.fineRemaining);
        b.finePaid = round2(b.finePaid + pay);
        b.fineRemaining = round2(b.fineRemaining - pay);
        remaining = round2(remaining - pay);
      }
    }
  }

  // accrue fines up to cap for buckets still unpaid
  for (const b of buckets) {
    accrueFineThrough(b, args.effectiveCap);
  }

  const unpaidBuckets = buckets.filter(
    (b) => b.principalRemaining > 0 || b.fineRemaining > 0,
  );

  const unpaidMonths = unpaidBuckets.length;
  const outstandingFees = round2(
    unpaidBuckets.reduce((sum, b) => sum + b.principalRemaining, 0),
  );
  const fineAmount = round2(
    unpaidBuckets.reduce((sum, b) => sum + b.fineRemaining, 0),
  );
  const numberOfFineDays = unpaidBuckets.reduce(
    (sum, b) => sum + b.fineDaysAccrued,
    0,
  );
  const totalOutstanding = round2(outstandingFees + fineAmount);

  const fineBreakdown = unpaidBuckets
    .filter((b) => b.fineRemaining > 0)
    .map((b) => ({
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

/* =============================== Optional: Overview (kept) =============================== */

export const fetchLandRentOverview = async (params?: {
  monthKey?: string;
  capToEndDate?: boolean;
}): Promise<LandRentOverviewRow[]> => {
  const mk =
    params?.monthKey ??
    `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}`;

  const capToEndDate = !!params?.capToEndDate;

  const leases = await listAllDocuments<LandLeaseDoc>(landLeasesCollectionId, [
    Query.orderDesc("$createdAt"),
  ]);

  const parcels = await listAllDocuments<LandParcelDoc>(
    landParcelsCollectionId,
    [Query.orderAsc("$createdAt")],
  );

  const tenants = await listAllDocuments<LandTenantDoc>(
    landTenantsCollectionId,
    [Query.orderAsc("$createdAt")],
  );

  const parcelById = new Map(parcels.map((p) => [p.$id, p]));
  const tenantById = new Map(tenants.map((t) => [t.$id, t]));

  const rows = await Promise.all(
    leases.map(async (l) => {
      const parcel = parcelById.get(l.parcelId);
      const tenant = tenantById.get(l.tenantId);

      const sizeSqft = Number(parcel?.sizeSqft ?? 0);
      const rate = Number(l.rateLariPerSqft ?? 0);
      const monthlyRent = round2(sizeSqft * rate);

      // 1) If there is an OPEN statement: use LIVE remaining balance (payments included)
      const open = await fetchOpenLandStatementForLease(l.$id);
      if (open) {
        const details = await getLandStatementDetails({
          statementId: open.$id,
          capToEndDate,
        });

        const lastPay =
          (details.payments ?? [])
            .slice()
            .sort(
              (a: any, b: any) =>
                new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
            )[0] ?? null;

        const lastPaymentDate = lastPay?.paidAt
          ? new Date(lastPay.paidAt).toISOString().slice(0, 10)
          : (details.latestPaymentDate ?? null);

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
          monthlyRent,

          lastPaymentDate,
          // ✅ IMPORTANT: show remaining, not snapshot total
          openingOutstandingTotal: Number(details.balanceRemaining ?? 0),
          status: "OPEN",

          agreementPdfFileId: l.agreementPdfFileId ?? null, // ADD THIS
          agreementPdfFilename: l.agreementPdfFilename ?? null, // ADD THIS
        } satisfies LandRentOverviewRow;
      }

      // 2) If a statement exists for the selected monthKey, use it (instead of preview)
      const stForMonth = await databases.listDocuments<LandStatementDoc>(
        databaseId,
        landStatementsCollectionId,
        [
          Query.equal("leaseId", l.$id),
          Query.equal("monthKey", mk),
          Query.limit(1),
        ],
      );

      const st = stForMonth.documents[0] ?? null;
      if (st) {
        const details = await getLandStatementDetails({
          statementId: st.$id,
          capToEndDate,
        });

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
          monthlyRent,

          lastPaymentDate: details.latestPaymentDate ?? null,
          openingOutstandingTotal: Number(details.balanceRemaining ?? 0),
          status: String(details.statement.status ?? "PAID"),
          agreementPdfFileId: l.agreementPdfFileId ?? null,
          agreementPdfFilename: l.agreementPdfFilename ?? null,
        } satisfies LandRentOverviewRow;
      }

      // 3) No statement yet: fallback to preview (computed)
      const preview = await previewLandRentStatement({
        leaseId: l.$id,
        monthKey: mk,
        capToEndDate,
      });

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
        monthlyRent,

        lastPaymentDate: preview.latestPaymentDate ?? null,
        openingOutstandingTotal: Number(preview.totalRentPaymentMonthly ?? 0),
        status: (l as any).status ? String((l as any).status) : null,
        agreementPdfFileId: l.agreementPdfFileId ?? null,
        agreementPdfFilename: l.agreementPdfFilename ?? null,
      } satisfies LandRentOverviewRow;
    }),
  );

  rows.sort((a, b) =>
    `${a.landName} ${a.tenantName}`.localeCompare(
      `${b.landName} ${b.tenantName}`,
    ),
  );

  return rows;
};

/* =============================== Create bundle (kept) =============================== */

export async function createLandRentBundle(
  payload: CreateLandRentPayload,
): Promise<CreatedLandRentBundle> {
  const db = databaseId;

  if (!landTenantsCollectionId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");
  }
  if (!landParcelsCollectionId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  }
  if (!landLeasesCollectionId) {
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");
  }

  const tenant = await databases.createDocument(
    db,
    landTenantsCollectionId,
    ID.unique(),
    {
      fullName: payload.tenant.fullName,
    },
  );

  const parcel = await databases.createDocument(
    db,
    landParcelsCollectionId,
    ID.unique(),
    {
      name: payload.parcel.name,
      sizeSqft: payload.parcel.sizeSqft,
    },
  );

  const lease = await databases.createDocument(
    db,
    landLeasesCollectionId,
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
    },
  );

  return { tenant, parcel, lease };
}

export const createLandRentHolder = async (input: {
  landName: string;
  renterName: string;

  rentStartDate: string; // "YYYY-MM-DD" or ISO
  rentEndDate: string; // "YYYY-MM-DD" or ISO

  agreementNumber: string;
  letGoDate: string | null; // "YYYY-MM-DD" or ISO or null

  // PDF agreement fields
  agreementPdfBase64?: string | null;
  agreementPdfFilename?: string | null;

  sizeSqft: number;
  rate: number;
  monthlyRent: number;

  paymentDueDay: number;
  finePerDay: number;

  // Opening snapshot (optional but you're sending them)
  lastPaymentDate: string | null; // "YYYY-MM-DD" or ISO or null
  openingFineDays: number;
  openingFineMonths: number;
  openingTotalFine: number;
  openingOutstandingFees: number;
  openingOutstandingTotal: number;
}) => {
  if (!landTenantsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_TENANTS_COLLECTION");
  if (!landParcelsCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_PARCELS_COLLECTION");
  if (!landLeasesCollectionId)
    throw new Error("Missing NEXT_PUBLIC_APPWRITE_LAND_LEASES_COLLECTION");

  const landName = String(input.landName ?? "").trim();
  const renterName = String(input.renterName ?? "").trim();
  const agreementNumber = String(input.agreementNumber ?? "").trim();

  if (!landName) throw new Error("Land name is required.");
  if (!renterName) throw new Error("Renter name is required.");
  if (!agreementNumber) throw new Error("Agreement number is required.");

  const startISO = toIsoDateTimeOrNull(input.rentStartDate);
  const endISO = toIsoDateTimeOrNull(input.rentEndDate);
  if (!startISO) throw new Error("Invalid rentStartDate.");
  if (!endISO) throw new Error("Invalid rentEndDate.");

  const releasedISO = input.letGoDate
    ? toIsoDateTimeOrNull(input.letGoDate)
    : null;
  const lastPaidISO = input.lastPaymentDate
    ? toIsoDateTimeOrNull(input.lastPaymentDate)
    : null;

  const sizeSqft = Number(input.sizeSqft ?? 0);
  const rate = Number(input.rate ?? 0);
  const monthlyRent = Number(input.monthlyRent ?? 0);

  const paymentDueDay = clampInt(Number(input.paymentDueDay ?? 10), 1, 28);
  const finePerDay = Math.max(0, Number(input.finePerDay ?? 0));

  // Upload PDF if provided
  let agreementPdfFileId: string | null = null;
  if (input.agreementPdfBase64 && input.agreementPdfFilename) {
    try {
      agreementPdfFileId = await uploadPdfFromBase64(
        input.agreementPdfBase64,
        input.agreementPdfFilename,
      );
    } catch (error) {
      console.error("Failed to upload PDF:", error);
      throw new Error("Failed to upload agreement PDF. Please try again.");
    }
  }

  try {
    // 1) Tenant
    const tenant = await createDocumentSmartRetry<LandTenantDoc>(
      landTenantsCollectionId,
      {
        fullName: renterName,
      },
    );

    // 2) Parcel
    const parcel = await createDocumentSmartRetry<LandParcelDoc>(
      landParcelsCollectionId,
      {
        name: landName,
        sizeSqft,
      },
    );

    // 3) Lease
    // NOTE: if your Appwrite lease schema does not have these opening fields yet,
    // createDocumentSmartRetry will strip them. (But you should add lastPaymentDate at minimum.)
    const lease = await createDocumentSmartRetry<LandLeaseDoc>(
      landLeasesCollectionId,
      {
        parcelId: parcel.$id,
        tenantId: tenant.$id,

        startDate: startISO,
        endDate: endISO,
        agreementNumber,
        releasedDate: releasedISO,

        rateLariPerSqft: rate,
        paymentDueDay,
        fineLariPerDay: finePerDay,

        // PDF fields
        agreementPdfFileId,
        agreementPdfFilename: input.agreementPdfFilename,

        // Optional denorm/helpers (safe to keep; stripped if not in schema)
        monthlyRent,
        lastPaymentDate: lastPaidISO,
        openingFineDays: Math.floor(Number(input.openingFineDays ?? 0)),
        openingFineMonths: Math.floor(Number(input.openingFineMonths ?? 0)),
        openingTotalFine: Number(input.openingTotalFine ?? 0),
        openingOutstandingFees: Number(input.openingOutstandingFees ?? 0),
        openingOutstandingTotal: Number(input.openingOutstandingTotal ?? 0),

        status: "ACTIVE",
      } as any,
    );

    return { tenant, parcel, lease };
  } catch (error) {
    // If lease creation fails and we uploaded a PDF, clean it up
    if (agreementPdfFileId) {
      await deletePdfFile(agreementPdfFileId);
    }
    throw error;
  }
};
