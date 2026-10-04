"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { COLLECTIONS } from "@/lib/firebase/admin";
import {
  appendDocumentArrayItem,
  createDocument,
  deleteFileFromR2,
  deleteDocument,
  deleteDocumentsAtomically,
  getDocument,
  listAllDocuments,
  listDocuments,
  newDocId,
  updateDocument,
  uploadBufferToR2,
} from "@/lib/firebase/repository";
import { requireAdmin } from "@/lib/auth/require-admin";
import { fineBetweenDates, fineBetweenDatesByRate, firstMonthFromSavedUnpaidCount, monthlyRentChargeByRate, olderFineMonthStartCorrection, reconstructStatementRateBreakdown, usesPostAugustMonthlyFine } from "@/lib/landrent/landRent.ratePeriods";
import type {
  LandLeaseDoc,
  LandParcelDoc,
  LandPaymentDoc,
  LandStatementDoc,
  LandStatementManualFine,
  LandStatementStatus,
  LandTenantDoc,
} from "@/lib/firebase/types";

export type {
  LandLeaseDoc,
  LandParcelDoc,
  LandPaymentDoc,
  LandStatementDoc,
  LandStatementStatus,
  LandTenantDoc,
} from "@/lib/firebase/types";

/* =============================== Types =============================== */

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
  endDate: string | null;
  doubleRateAfterEnd?: boolean;
  releasedDate: string | null;

  paymentDueDay: number;
  rateLariPerSqft: number;
  fineLariPerDay?: number | null;

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
      endDate: string | null;
      doubleRateAfterEnd?: boolean;
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
  tenant: LandTenantDoc;
  parcel: LandParcelDoc;
  lease: LandLeaseDoc;
};

export type LandRentFixedAdjustmentRow = {
  key: string;
  total: number;
  rentAmount: number;
  unpaidMonths: number;
  fineAmount: number;
  fineDays: number;
  periodLabel: string;
  rentRate: number;
  sizeOfLand: number;
};

export type LandRentGeneratedAdjustmentRow = LandRentFixedAdjustmentRow & {
  description: string;
  displayMode: "description";
};

export type LandRentRateBreakdownRow = {
  multiplier: 1 | 2;
  rentAmount: number;
  unpaidMonths: number;
  fineDays: number;
  fineAmount: number;
  total: number;
};

function sanitizeFixedAdjustmentRows(
  rows: unknown,
): LandRentFixedAdjustmentRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row, index) => {
      const r = row as Record<string, unknown>;
      const rentAmount = Math.max(0, Number(r.rentAmount ?? 0));
      const fineAmount = Math.max(0, Number(r.fineAmount ?? 0));
      const total = Math.max(0, Number(r.total ?? 0));

      return {
        key: String(r.key ?? `fixed-row-${index}-${newDocId()}`),
        total: round2(total),
        rentAmount: round2(rentAmount),
        unpaidMonths: Math.max(0, Math.floor(Number(r.unpaidMonths ?? 0))),
        fineAmount: round2(fineAmount),
        fineDays: Math.max(0, Math.floor(Number(r.fineDays ?? 0))),
        periodLabel: String(r.periodLabel ?? "").trim(),
        rentRate: Math.max(0, Number(r.rentRate ?? 0)),
        sizeOfLand: Math.max(0, Number(r.sizeOfLand ?? 0)),
      };
    })
    .filter(
      (row) =>
        row.total > 0 ||
        row.rentAmount > 0 ||
        row.fineAmount > 0 ||
        row.periodLabel,
    );
}

function getFixedLandRentAdjustmentsFromLease(
  lease: Record<string, unknown>,
): LandRentFixedAdjustmentRow[] {
  const raw = lease.fixedAdjustmentRowsJson;
  if (typeof raw === "string" && raw.trim()) {
    try {
      return sanitizeFixedAdjustmentRows(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  return sanitizeFixedAdjustmentRows(lease.fixedAdjustmentRows);
}

function fixedLandRentAdjustmentTotal(rows: LandRentFixedAdjustmentRow[]) {
  return round2(rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0));
}

function getStatementManualFines(statement?: Pick<LandStatementDoc, "manualFines">): LandStatementManualFine[] {
  if (!Array.isArray(statement?.manualFines)) return [];
  return statement.manualFines.filter((fine) =>
    fine && Number.isFinite(fine.amount) && fine.amount > 0 && typeof fine.description === "string",
  );
}

function statementManualFineTotal(statement?: Pick<LandStatementDoc, "manualFines">) {
  return round2(getStatementManualFines(statement).reduce((sum, fine) => sum + fine.amount, 0));
}

export async function addLandStatementManualFine(input: {
  statementId: string;
  leaseId: string;
  amount: number;
  description: string;
}) {
  await requireAdmin();
  if (!input.statementId || !input.leaseId) throw new Error("Statement and lease are required.");
  const amount = round2(input.amount);
  if (!Number.isFinite(input.amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw new Error("Enter a valid fine amount greater than zero.");
  }
  const description = String(input.description ?? "").trim();
  if (!description || description.length > 1000) throw new Error("Enter a fine description of up to 1000 characters.");
  const statement = await getDocument<LandStatementDoc>(COLLECTIONS.landStatements, input.statementId);
  if (statement.leaseId !== input.leaseId) throw new Error("Statement does not belong to this lease.");
  const fine: LandStatementManualFine = { id: newDocId(), amount, description, createdAt: new Date().toISOString() };
  // Keep the rent snapshot and its paid-through baseline intact. The added charge
  // is collected using the existing revised-balance flow for paid statements.
  await appendDocumentArrayItem(COLLECTIONS.landStatements, statement.$id, "manualFines", fine);
  return fine;
}

function withFixedLandRentAdjustments<T extends Record<string, any>>(
  details: T,
) {
  const rows = details.statement?.kind === "FINE_ONLY"
    ? []
    : sanitizeFixedAdjustmentRows(details.fixedAdjustmentRows);
  const fixedAdjustmentTotal = fixedLandRentAdjustmentTotal(rows);
  const generatedRows = Array.isArray(details.generatedAdjustmentRows)
    ? (details.generatedAdjustmentRows as LandRentGeneratedAdjustmentRow[])
    : [];
  const generatedAdjustmentTotal = fixedLandRentAdjustmentTotal(generatedRows);
  const manualFines = getStatementManualFines(details.statement);
  const manualFineTotal = statementManualFineTotal(details.statement);
  const totalRentPaymentMonthly = round2(
    Number(details.totalRentPaymentMonthly ?? 0) +
      fixedAdjustmentTotal +
      generatedAdjustmentTotal +
      manualFineTotal,
  );
  const paymentsTotal = Number(details.paymentsTotal ?? 0);
  const balanceRemaining = round2(
    Math.max(0, totalRentPaymentMonthly - paymentsTotal),
  );

  return {
    ...details,
    fixedAdjustmentRows: rows,
    fixedAdjustmentTotal,
    generatedAdjustmentRows: generatedRows,
    generatedAdjustmentTotal,
    manualFines,
    manualFineTotal,
    totalRentPaymentMonthly,
    balanceRemaining,
    isPaid: balanceRemaining <= 0.00001,
  };
}

/* =============================== Helpers =============================== */

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
  const { mime, base64 } = parseDataUrl(dataUrl);
  const buffer = Buffer.from(base64, "base64");
  const objectKey = `land-rent/payment-slips/${newDocId()}/${filename}`;
  const fileId = await uploadBufferToR2(objectKey, buffer, mime);
  return { fileId, mime };
}

/* =============================== PDF Storage Helpers =============================== */

async function uploadPdfFromBase64(
  base64Data: string,
  filename: string,
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const objectKey = `land-rent/agreements/${newDocId()}/${filename}`;
  return uploadBufferToR2(objectKey, buffer, "application/pdf");
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

async function createDocumentSmartRetry<T extends { $id: string }>(
  collectionId: string,
  data: Record<string, any>,
): Promise<T> {
  return createDocument<T>(collectionId, data);
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

const LAND_RENT_POST_CUTOFF_FINE_START_DATE = new Date(Date.UTC(2025, 7, 1));
const LEGACY_FINE_START_RULE_VERSION = 2;
const LAND_RENT_POST_CUTOFF_FINE_LABEL =
  "2025 އޮގަސްޓް މަހުން ފެށިގެން ޖޫރިމަނާ (އޮޑިޓް އޮފީހުން ޖޫރިމަނާ ހިސާބުކުރުމަށް އެންގި ގޮތަށް)";

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

function savedStatementOlderFineCorrection(args: {
  statement: LandStatementDoc;
  lease: LandLeaseDoc;
  monthlyRent: number;
  unpaidMonths: number;
  latestPaymentDate: string | null;
  fineDays: number;
  fineAmount: number;
}) {
  if (args.statement.kind === "FINE_ONLY") return null;
  if (Number(args.statement.snapshot_legacyFineStartRuleVersion ?? 0) >= LEGACY_FINE_START_RULE_VERSION) {
    return null;
  }

  const statementMonth = safeDateUTC(`${args.statement.monthKey}-01`);
  const rentStart = safeDateUTC(args.statement.startDate ?? args.lease.startDate ?? null);
  const rentEnd = safeDateUTC(args.statement.endDate ?? args.lease.endDate ?? null);
  const released = safeDateUTC(args.lease.releasedDate ?? args.statement.releasedDate ?? null);
  const lastPaid = safeDateUTC(args.latestPaymentDate ?? args.lease.lastPaymentDate ?? null);
  const firstFromPayment = lastPaid
    ? addMonthsUTC(startOfMonthUTC(lastPaid), 1)
    : rentStart ? startOfMonthUTC(rentStart) : null;
  const firstFromCount = statementMonth
    ? firstMonthFromSavedUnpaidCount(statementMonth, args.unpaidMonths, released)
    : null;
  const rentStartMonth = rentStart ? startOfMonthUTC(rentStart) : null;
  let fromMonth = firstFromCount ?? firstFromPayment;
  if (fromMonth && rentStartMonth && fromMonth < rentStartMonth) fromMonth = rentStartMonth;
  if (!fromMonth || !statementMonth || fromMonth > statementMonth) return null;

  const today = dateOnlyInTimeZoneUTC(new Date());
  const issuedAt = safeDateUTC(args.statement.recalculatedAt ?? args.statement.createdAt ?? args.statement.$createdAt);
  return olderFineMonthStartCorrection({
    fromMonth,
    paymentDueDay: clampInt(Number(args.statement.paymentDueDay ?? args.lease.paymentDueDay ?? 10), 1, 28),
    fineThrough: minDate(today, issuedAt) ?? today,
    normalMonthlyRent: args.monthlyRent,
    rentStart,
    rentEnd,
    doubleRateAfterEnd: args.statement.doubleRateAfterEnd ?? true,
    released,
    savedFineDays: args.fineDays,
    savedFineAmount: args.fineAmount,
  });
}

const fmtMonthYearUTC = (ms: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), 1)),
  );

/* =============================== Fetchers =============================== */

export const fetchLandLeaseBundle = async (leaseId: string) => {
  const lease = await getDocument<LandLeaseDoc>(
    COLLECTIONS.landLeases,
    leaseId,
  );

  const [parcel, tenant] = await Promise.all([
    getDocument<LandParcelDoc>(COLLECTIONS.landParcels, lease.parcelId),
    getDocument<LandTenantDoc>(COLLECTIONS.landTenants, lease.tenantId),
  ]);

  return { lease, parcel, tenant };
};

export const fetchLandLeaseOptions = async (): Promise<LandLeaseOption[]> => {
  const leases = await listAllDocuments<LandLeaseDoc>(COLLECTIONS.landLeases, {
    orderBy: [{ field: "$createdAt", direction: "desc" }],
  });

  const opts = await Promise.all(
    leases.map(async (l) => {
      const [parcel, tenant] = await Promise.all([
        getDocument<LandParcelDoc>(COLLECTIONS.landParcels, l.parcelId),
        getDocument<LandTenantDoc>(COLLECTIONS.landTenants, l.tenantId),
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

export const updateLandRentFixedAdjustmentRows = async (input: {
  leaseId: string;
  rows: unknown[];
}) => {
  const leaseId = String(input.leaseId ?? "").trim();
  if (!leaseId) throw new Error("Lease is required.");

  await getDocument<LandLeaseDoc>(COLLECTIONS.landLeases, leaseId);
  const rows = sanitizeFixedAdjustmentRows(input.rows);

  await updateDocument(COLLECTIONS.landLeases, leaseId, {
    fixedAdjustmentRowsJson: JSON.stringify(rows),
  });

  return {
    rows,
    fixedAdjustmentTotal: fixedLandRentAdjustmentTotal(rows),
  };
};

export const updateLandRentLease = async (input: {
  leaseId: string;
  landName: string;
  renterName: string;
  agreementNumber: string;
  rentStartDate: string;
  doubleRateAfterEnd?: boolean;
  rentEndDate: string | null;
  letGoDate: string | null;
  lastPaymentDate: string | null;
  sizeSqft: number;
  rate: number;
  paymentDueDay: number;
  finePerDay: number;
}) => {
  await requireAdmin();

  const leaseId = String(input.leaseId ?? "").trim();
  if (!leaseId) throw new Error("Lease is required.");

  const lease = await getDocument<LandLeaseDoc>(
    COLLECTIONS.landLeases,
    leaseId,
  );

  const landName = String(input.landName ?? "").trim();
  const renterName = String(input.renterName ?? "").trim();
  const agreementNumber = String(input.agreementNumber ?? "").trim();

  if (!landName) throw new Error("Land name is required.");
  if (!renterName) throw new Error("Renter name is required.");
  if (!agreementNumber) throw new Error("Agreement number is required.");

  const startISO = toIsoDateTimeOrNull(input.rentStartDate);
  const endISO = toIsoDateTimeOrNull(input.rentEndDate);
  if (!startISO) throw new Error("Invalid rent start date.");
  if (input.rentEndDate?.trim() && !endISO) throw new Error("Invalid rent end date.");

  const releasedISO = input.letGoDate
    ? toIsoDateTimeOrNull(input.letGoDate)
    : null;
  const lastPaymentISO = input.lastPaymentDate
    ? toIsoDateTimeOrNull(input.lastPaymentDate)
    : null;

  const sizeSqft = Math.max(0, Number(input.sizeSqft ?? 0));
  const rate = Math.max(0, Number(input.rate ?? 0));
  const paymentDueDay = clampInt(Number(input.paymentDueDay ?? 10), 1, 28);
  const finePerDay = round2((sizeSqft * rate / 30) * 0.25);

  await Promise.all([
    updateDocument(COLLECTIONS.landParcels, lease.parcelId, {
      name: landName,
      sizeSqft,
    }),
    updateDocument(COLLECTIONS.landTenants, lease.tenantId, {
      fullName: renterName,
    }),
    updateDocument(COLLECTIONS.landLeases, leaseId, {
      startDate: startISO,
      endDate: endISO,
      doubleRateAfterEnd: endISO !== null && (input.doubleRateAfterEnd ?? lease.doubleRateAfterEnd ?? false),
      agreementNumber,
      releasedDate: releasedISO,
      lastPaymentDate: lastPaymentISO,
      rateLariPerSqft: rate,
      paymentDueDay,
      fineLariPerDay: finePerDay,
      monthlyRent: round2(sizeSqft * rate),
    } as any),
  ]);

  const statements = await listAllDocuments<LandStatementDoc>(
    COLLECTIONS.landStatements,
    { where: [["leaseId", "==", leaseId]] },
  );

  await Promise.all(
    statements.map(async (statement) => {
      const baseStatementUpdate = {
        landName,
        tenantName: renterName,
        agreementNumber,
        startDate: startISO,
        endDate: endISO,
        releasedDate: releasedISO,
        sizeSqft,
        rateLariPerSqft: rate,
        paymentDueDay,
        fineLariPerDay: finePerDay,
        monthlyRent: round2(sizeSqft * rate),
      } as any;

      if (statement.status !== "OPEN" || statement.kind === "FINE_ONLY") {
        await updateDocument(
          COLLECTIONS.landStatements,
          statement.$id,
          baseStatementUpdate,
        );
        return;
      }

      const paymentDocs = await listLandPaymentsForStatement(statement.$id);
      const snapshot = await computeStatementFromBaseline({
        leaseId,
        monthKey: statement.monthKey,
        capToEndDate: Boolean((statement as any).snapshot_capToEndDate),
        payments: paymentDocs.map((payment) => ({
          paidAt: payment.paidAt,
          amount: Number(payment.amount ?? 0),
        })),
      });

      await updateDocument(COLLECTIONS.landStatements, statement.$id, {
        ...baseStatementUpdate,
        recalculatedAt: new Date().toISOString(),
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
        snapshot_fineBreakdownJson: JSON.stringify(
          snapshot.fineBreakdown ?? [],
        ),
        snapshot_generatedAdjustmentRowsJson: JSON.stringify(
          snapshot.generatedAdjustmentRows ?? [],
        ),
        doubleRateAfterEnd: snapshot.doubleRateAfterEnd,
        snapshot_rateBreakdownJson: JSON.stringify(snapshot.rateBreakdown ?? []),
        snapshot_legacyFineStartRuleVersion: LEGACY_FINE_START_RULE_VERSION,
      });
    }),
  );

  return { ok: true };
};

export const deleteLandRentLease = async (input: { leaseId: string }) => {
  await requireAdmin();

  const leaseId = String(input.leaseId ?? "").trim();
  if (!leaseId) throw new Error("Lease is required.");

  const lease = await getDocument<LandLeaseDoc>(
    COLLECTIONS.landLeases,
    leaseId,
  );

  const [statements, payments] = await Promise.all([
    listAllDocuments<LandStatementDoc>(COLLECTIONS.landStatements, {
      where: [["leaseId", "==", leaseId]],
    }),
    listAllDocuments<LandPaymentDoc>(COLLECTIONS.landPayments, {
      where: [["leaseId", "==", leaseId]],
    }),
  ]);

  await Promise.all([
    ...payments.map((payment) =>
      deleteDocument(COLLECTIONS.landPayments, payment.$id),
    ),
    ...statements.map((statement) =>
      deleteDocument(COLLECTIONS.landStatements, statement.$id),
    ),
  ]);

  await deleteDocument(COLLECTIONS.landLeases, leaseId);

  await Promise.allSettled([
    deleteDocument(COLLECTIONS.landParcels, lease.parcelId),
    deleteDocument(COLLECTIONS.landTenants, lease.tenantId),
  ]);

  return {
    ok: true,
    deletedStatements: statements.length,
    deletedPayments: payments.length,
  };
};

/* =============================== Statements (NEW flow) =============================== */

export const deleteLandRentStatement = async (input: {
  statementId: string;
  leaseId: string;
}) => {
  await requireAdmin();
  const statementId = String(input.statementId ?? "").trim();
  const leaseId = String(input.leaseId ?? "").trim();
  if (!statementId || !leaseId) throw new Error("Statement and lease are required.");
  const statement = await getDocument<LandStatementDoc>(COLLECTIONS.landStatements, statementId);
  if (statement.leaseId !== leaseId) throw new Error("This statement does not belong to the selected lease.");
  const payments = await listLandPaymentsForStatement(statementId);
  await deleteDocumentsAtomically([
    ...payments.map((payment) => ({ collectionPath: COLLECTIONS.landPayments, id: payment.$id })),
    { collectionPath: COLLECTIONS.landStatements, id: statementId },
  ]);
  return { ok: true, deletedPayments: payments.length };
};

export const listLandStatementsForLease = async (leaseId: string) => {
  const rows = await listAllDocuments<LandStatementDoc>(
    COLLECTIONS.landStatements,
    {
      where: [["leaseId", "==", leaseId]],
    },
  );

  rows.sort((a, b) => monthKeyCompare(a.monthKey, b.monthKey));
  return rows;
};

export const fetchOpenLandStatementForLease = async (leaseId: string) => {
  const rows = await listLandStatementsForLease(leaseId);
  return rows.find((row) => row.status === "OPEN") ?? null;
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

  const sizeSqft = Number(parcel.sizeSqft ?? 0);
  const rate = Number(lease.rateLariPerSqft ?? 0);
  const monthlyRent = round2(sizeSqft * rate);
  const fineLariPerDay = round2((monthlyRent / 30) * 0.25);

  const rentStart = safeDateUTC((lease as any).startDate ?? null);
  const rentEnd = safeDateUTC((lease as any).endDate ?? null);
  const released = safeDateUTC((lease as any).releasedDate ?? null);
  const fixedAdjustmentRows = getFixedLandRentAdjustmentsFromLease(
    lease as any,
  );

  // Baseline = month AFTER the last paid month.
  // Prefer lease.lastPaymentDate (stored in land_leases). Fall back to last PAID statement, then rentStart.
  const allStatements = await listLandStatementsForLease(args.leaseId);
  const lastPaidStatement = allStatements
    .filter((s) => s.status === "PAID" && s.kind !== "FINE_ONLY")
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
        endDate: lease.endDate || null,
      },
      doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
      agreementNumber: String(lease.agreementNumber ?? ""),
      fixedAdjustmentRows,
      generatedAdjustmentRows: [],
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
      rateBreakdown: [] as LandRentRateBreakdownRow[],

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
  // Cap at today so "days overdue" counts from 11th of each month through today (not end of statement month)
  let effectiveCap = today;
  let effectiveFineCap = today;

  if (args.capToEndDate && rentEnd) {
    effectiveCap = minDate(effectiveCap, rentEnd) ?? effectiveCap;
  }
  if (released) {
    effectiveCap = minDate(effectiveCap, released) ?? effectiveCap;
    effectiveFineCap = minDate(effectiveFineCap, released) ?? effectiveFineCap;
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
    rentStart,
    rentEnd,
    doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
    released,
    effectiveCap,
    payments: pays,
  });

  const generatedAdjustmentRows = computePostCutoffFineRows({
    fromMonth,
    toMonth,
    effectiveCap: effectiveFineCap,
    paymentDueDay,
    monthlyRent,
    fineLariPerDay,
    rentStart,
    rentEnd,
    doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
    released,
    rentRate: rate,
    sizeSqft,
    payments: pays,
  });

  const latestPay = pays.length
    ? pays
        .slice()
        .sort(
          (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
        )[0]
    : null;

  const continuousFine = computeContinuousFineFromLastPayment({
    fromMonth,
    rentStart,
    rentEnd,
    doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
    released,
    effectiveCap: effectiveFineCap,
    monthlyRent,
  });

  const rateBreakdown: LandRentRateBreakdownRow[] = ([1, 2] as const).map((multiplier) => {
    const normal = multiplier === 1;
    const rentAmount = round2(computed.buckets.reduce(
      (sum, bucket) => sum + (normal ? bucket.normalPrincipalDue : bucket.doublePrincipalDue),
      0,
    ));
    const unpaidMonths = computed.buckets.reduce(
      (sum, bucket) => sum + (
        (normal ? bucket.normalPrincipalDue : bucket.doublePrincipalDue) > 0
          ? (normal ? bucket.normalMonths : bucket.doubleMonths)
          : 0
      ),
      0,
    );
    const fineDays = normal
      ? continuousFine.byRate.normalDays
      : continuousFine.byRate.doubleDays;
    const fineAmount = normal
      ? continuousFine.byRate.normalAmount
      : continuousFine.byRate.doubleAmount;
    return {
      multiplier,
      rentAmount,
      unpaidMonths: Math.floor(unpaidMonths),
      fineDays,
      fineAmount,
      total: round2(rentAmount + fineAmount),
    };
  });

  const totalOutstanding = round2(
    computed.grossRentAmount + continuousFine.fineAmount,
  );

  const formatYMD = (d: Date) =>
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
      d.getUTCDate(),
    )}`;

  const latestPaymentDate = latestPay
    ? formatYMD(dateOnlyUTC(new Date(latestPay.paidAt)))
    : leaseLastPaidDate
      ? formatYMD(leaseLastPaidDate)
      : null;

  const balanceRemaining = totalOutstanding;

  return {
    landName: String(parcel.name ?? ""),
    rentingPerson: String(tenant.fullName ?? ""),
    rentDuration: {
      startDate: String((lease as any).startDate ?? ""),
      endDate: lease.endDate || null,
    },
    doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
    agreementNumber: String(lease.agreementNumber ?? ""),
    fixedAdjustmentRows,
    generatedAdjustmentRows,
    letGoDate: (lease as any).releasedDate
      ? String((lease as any).releasedDate)
      : null,

    rentFeePerMonth: monthlyRent,
    sizeOfLand: sizeSqft,
    rentRate: rate,

    latestPaymentDate,

    numberOfFineDays: continuousFine.numberOfFineDays,
    fineAmount: continuousFine.fineAmount,
    numberOfDaysRentNotPaid: continuousFine.numberOfFineDays,

    monthlyRentPaymentAmount: monthlyRent,
    totalRentPaymentMonthly: balanceRemaining,

    fineLariPerDay,
    paymentDueDay,
    monthKey: args.monthKey,

    unpaidMonths: computed.buckets.length,
    outstandingFees: computed.grossRentAmount,
    fineBreakdown: continuousFine.fineBreakdown,
    rateBreakdown,

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
  const details = await computeStatementFromBaseline({
    leaseId: params.leaseId,
    monthKey: params.monthKey,
    capToEndDate: params.capToEndDate,
    payments: [],
  });
  return withFixedLandRentAdjustments(details);
};

export const createLandStatement = async (params: {
  leaseId: string;
  monthKey: string;
  createdBy?: string;
  capToEndDate?: boolean;
  kind?: "RENT" | "FINE_ONLY";
  fineAmount?: number;
  fineDescription?: string;
}) => {
  if (!monthKeyIsValid(params.monthKey)) throw new Error("Invalid monthKey.");
  if (params.kind && params.kind !== "RENT" && params.kind !== "FINE_ONLY") {
    throw new Error("Invalid statement type.");
  }
  const fineOnly = params.kind === "FINE_ONLY";
  const manualFine = round2(Number(params.fineAmount));
  if (fineOnly && (!Number.isFinite(manualFine) || manualFine <= 0)) {
    throw new Error("Enter a fine amount greater than 0.");
  }

  const open = await fetchOpenLandStatementForLease(params.leaseId);
  if (open) {
    throw new Error("There is already an OPEN statement for this lease.");
  }

  const { lease, parcel, tenant } = await fetchLandLeaseBundle(params.leaseId);

  // Prevent creating a statement before the next allowed month
  const all = await listLandStatementsForLease(params.leaseId);
  const lastPaidStatement = all
    .filter((s) => s.status === "PAID" && s.kind !== "FINE_ONLY")
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

  if (paidThrough && !fineOnly) {
    const nextAllowed = addMonthsToMonthKey(paidThrough, 1);
    if (monthKeyCompare(params.monthKey, nextAllowed) < 0) {
      throw new Error(`Next statement must be ${nextAllowed} or later.`);
    }
  }

  const paymentDueDay =
    typeof lease.paymentDueDay === "number"
      ? clampInt(lease.paymentDueDay, 1, 28)
      : 10;

  const sizeSqft = Number(parcel.sizeSqft ?? 0);
  const rate = Number(lease.rateLariPerSqft ?? 0);
  const monthlyRent = round2(sizeSqft * rate);
  const fineLariPerDay = round2((monthlyRent / 30) * 0.25);

  // A manually assessed fine bills no rent and does not advance paid-through rent.
  const snapshot = fineOnly ? {
    totalRentPaymentMonthly: manualFine,
    monthlyRentPaymentAmount: monthlyRent,
    unpaidMonths: 0,
    outstandingFees: 0,
    numberOfFineDays: 0,
    fineAmount: manualFine,
    latestPaymentDate: leaseLastPaidDate?.toISOString().slice(0, 10) ?? null,
    fineBreakdown: [{ key: "manual-fine", label: params.fineDescription?.trim() || "Outstanding fine", days: 0, fine: manualFine }],
    generatedAdjustmentRows: [],
    rateBreakdown: [],
  } : await computeStatementFromBaseline({
    leaseId: params.leaseId,
    monthKey: params.monthKey,
    capToEndDate: params.capToEndDate,
    payments: [], // ✅ snapshot ignores payments
  });

  const data: any = {
    leaseId: params.leaseId,
    kind: fineOnly ? "FINE_ONLY" : "RENT",
    doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
    fineDescription: fineOnly ? (params.fineDescription?.trim() || "Outstanding fine") : null,
    monthKey: params.monthKey,
    status: "OPEN" as LandStatementStatus,
    createdAt: new Date().toISOString(),
    createdBy: params.createdBy ?? "",

    landName: String(parcel.name ?? ""),
    tenantName: String(tenant.fullName ?? ""),
    agreementNumber: String(lease.agreementNumber ?? ""),

    startDate: String((lease as any).startDate ?? ""),
    endDate: lease.endDate || null,
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
    snapshot_generatedAdjustmentRowsJson: JSON.stringify(
      snapshot.generatedAdjustmentRows ?? [],
    ),
    snapshot_rateBreakdownJson: JSON.stringify(snapshot.rateBreakdown ?? []),
    snapshot_legacyFineStartRuleVersion: LEGACY_FINE_START_RULE_VERSION,

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
    COLLECTIONS.landStatements,
    dataForCreate,
  );
};

export const listLandPaymentsForStatement = async (statementId: string) => {
  const rows = await listAllDocuments<LandPaymentDoc>(COLLECTIONS.landPayments, {
    where: [["statementId", "==", statementId]],
    orderBy: [{ field: "paidAt", direction: "asc" }],
  });

  return rows;
};

export const getLandStatementDetails = async (params: {
  statementId: string;
  capToEndDate?: boolean;
}) => {
  const statement = await getDocument<LandStatementDoc>(
    COLLECTIONS.landStatements,
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

  const sizeSqft = Number((parcel as any).sizeSqft ?? 0);
  const rentRate = Number((lease as any).rateLariPerSqft ?? 0);
  const fineLariPerDay = round2((round2(sizeSqft * rentRate) / 30) * 0.25);

  const rentDuration = {
    startDate: String((lease as any).startDate ?? ""),
    endDate: lease.endDate || null,
  };
  const fixedAdjustmentRows = getFixedLandRentAdjustmentsFromLease(
    lease as any,
  );

  // ✅ Load payments (real-time)
  const paysDocs = await listLandPaymentsForStatement(params.statementId);
  const payments = paysDocs.map((p) => ({
    $id: p.$id,
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
  let snapshot_generatedAdjustmentRows: LandRentGeneratedAdjustmentRow[] | null = null;
  let snapshot_rateBreakdown: LandRentRateBreakdownRow[] | null = null;

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
    try {
      const parsed = JSON.parse(String(stAny.snapshot_generatedAdjustmentRowsJson));
      if (Array.isArray(parsed)) snapshot_generatedAdjustmentRows = parsed;
    } catch {
      // Older statements did not save this row.
    }
    try {
      const parsed = JSON.parse(String(stAny.snapshot_rateBreakdownJson));
      if (Array.isArray(parsed)) snapshot_rateBreakdown = parsed;
    } catch {
      // Older statements did not save the rate split.
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
    snapshot_generatedAdjustmentRows = computedSnap.generatedAdjustmentRows;
    snapshot_rateBreakdown = computedSnap.rateBreakdown;
    statement.recalculatedAt = new Date().toISOString();
    statement.doubleRateAfterEnd = computedSnap.doubleRateAfterEnd;
    statement.snapshot_legacyFineStartRuleVersion = LEGACY_FINE_START_RULE_VERSION;

    // Best-effort backfill (won't break if attributes not created yet)
    try {
      await updateDocument(COLLECTIONS.landStatements, statement.$id, {
        recalculatedAt: statement.recalculatedAt,
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
        snapshot_generatedAdjustmentRowsJson: JSON.stringify(
          snapshot_generatedAdjustmentRows ?? [],
        ),
        doubleRateAfterEnd: computedSnap.doubleRateAfterEnd,
        snapshot_rateBreakdownJson: JSON.stringify(snapshot_rateBreakdown ?? []),
        snapshot_legacyFineStartRuleVersion: LEGACY_FINE_START_RULE_VERSION,
        snapshot_capToEndDate: !!params.capToEndDate,
      });
    } catch {
      // ignore (attributes may not exist yet)
    }
  }

  if (!snapshot_generatedAdjustmentRows && statement.kind !== "FINE_ONLY") {
    const rentStart = safeDateUTC(lease.startDate ?? null);
    const lastPaid = safeDateUTC(
      snapshot_latestPaymentDate ?? lease.lastPaymentDate ?? null,
    );
    const firstUnpaid = lastPaid
      ? startOfMonthUTC(addMonthsUTC(lastPaid, 1))
      : rentStart
        ? startOfMonthUTC(rentStart)
        : LAND_RENT_POST_CUTOFF_FINE_START_DATE;
    const fromMonth = rentStart && firstUnpaid.getTime() < rentStart.getTime()
      ? startOfMonthUTC(rentStart)
      : firstUnpaid;
    const statementReleased = safeDateUTC(lease.releasedDate ?? null);
    const today = dateOnlyInTimeZoneUTC(new Date());
    const issuedAt = safeDateUTC(statement.recalculatedAt ?? statement.createdAt ?? statement.$createdAt);
    const fineCap = minDate(today, issuedAt) ?? today;
    snapshot_generatedAdjustmentRows = computePostCutoffFineRows({
      fromMonth,
      toMonth: startOfMonthUTC(safeDateUTC(`${statement.monthKey}-01`) ?? today),
      effectiveCap: statementReleased
        ? (minDate(fineCap, statementReleased) ?? fineCap)
        : fineCap,
      paymentDueDay,
      monthlyRent: round2(sizeSqft * rentRate),
      fineLariPerDay,
      rentStart,
      rentEnd: safeDateUTC(lease.endDate ?? null),
      doubleRateAfterEnd: statement.doubleRateAfterEnd ?? true,
      released: statementReleased,
      rentRate,
      sizeSqft,
      payments: [],
    });
  }

  const olderFineCorrection = hasSnapshot ? savedStatementOlderFineCorrection({
    statement,
    lease,
    monthlyRent: snapshot_monthlyRentPaymentAmount || round2(sizeSqft * rentRate),
    unpaidMonths: snapshot_unpaidMonths,
    latestPaymentDate: snapshot_latestPaymentDate,
    fineDays: snapshot_numberOfFineDays,
    fineAmount: snapshot_fineAmount,
  }) : null;
  if (olderFineCorrection && olderFineCorrection.addedDays > 0) {
    snapshot_totalRentPaymentMonthly = round2(snapshot_totalRentPaymentMonthly + olderFineCorrection.addedAmount);
    snapshot_fineAmount = round2(snapshot_fineAmount + olderFineCorrection.addedAmount);
    snapshot_numberOfFineDays += olderFineCorrection.addedDays;
    const oldFineRow = snapshot_fineBreakdown.find((row) => row?.key === "continuous-fine-period");
    if (oldFineRow) {
      oldFineRow.days = Number(oldFineRow.days ?? 0) + olderFineCorrection.addedDays;
      oldFineRow.fine = round2(Number(oldFineRow.fine ?? 0) + olderFineCorrection.addedAmount);
    } else {
      snapshot_fineBreakdown.push({
        key: "older-fine-start-correction",
        label: "Older fine adjustment from first unpaid day",
        days: olderFineCorrection.addedDays,
        fine: olderFineCorrection.addedAmount,
      });
    }
    if (snapshot_rateBreakdown?.length) {
      for (const [multiplier, amount, days] of [
        [1, olderFineCorrection.normalAddedAmount, olderFineCorrection.normalAddedDays],
        [2, olderFineCorrection.doubleAddedAmount, olderFineCorrection.doubleAddedDays],
      ] as const) {
        if (days <= 0) continue;
        let row = snapshot_rateBreakdown.find((entry) => entry.multiplier === multiplier);
        if (!row) {
          row = { multiplier, rentAmount: 0, unpaidMonths: 0, fineDays: 0, fineAmount: 0, total: 0 };
          snapshot_rateBreakdown.push(row);
        }
        row.fineDays += days;
        row.fineAmount = round2(row.fineAmount + amount);
        row.total = round2(row.rentAmount + row.fineAmount);
      }
    }
  }

  if (statement.kind !== "FINE_ONLY" && (!snapshot_rateBreakdown || snapshot_rateBreakdown.length === 0) &&
      (snapshot_totalRentPaymentMonthly > 0 || snapshot_fineAmount > 0)) {
    const rentStart = safeDateUTC(statement.startDate ?? lease.startDate ?? null);
    const rentEnd = safeDateUTC(statement.endDate ?? lease.endDate ?? null);
    const released = safeDateUTC(lease.releasedDate ?? statement.releasedDate ?? null);
    const lastPaid = safeDateUTC(snapshot_latestPaymentDate ?? lease.lastPaymentDate ?? null);
    const firstUnpaidFromPayment = lastPaid
      ? addMonthsUTC(startOfMonthUTC(lastPaid), 1)
      : rentStart ? startOfMonthUTC(rentStart) : null;
    const rentStartMonth = rentStart ? startOfMonthUTC(rentStart) : null;
    const toMonth = safeDateUTC(`${statement.monthKey}-01`);
    const firstUnpaid = toMonth
      ? firstMonthFromSavedUnpaidCount(toMonth, snapshot_unpaidMonths, released) ?? firstUnpaidFromPayment
      : firstUnpaidFromPayment;
    const fromMonth = firstUnpaid && rentStartMonth
      ? (firstUnpaid > rentStartMonth ? firstUnpaid : rentStartMonth)
      : firstUnpaid ?? rentStartMonth;
    const issueDate = safeDateUTC(statement.recalculatedAt ?? statement.createdAt ?? statement.$createdAt);
    if (fromMonth && toMonth) {
      snapshot_rateBreakdown = reconstructStatementRateBreakdown({
        fromMonth,
        toMonth,
        fineThrough: minDate(issueDate, dateOnlyInTimeZoneUTC(new Date())) ?? dateOnlyInTimeZoneUTC(new Date()),
        normalMonthlyRent: Number(snapshot_monthlyRentPaymentAmount || statement.monthlyRent || round2(sizeSqft * rentRate)),
        rentStart,
        rentEnd,
        doubleRateAfterEnd: statement.doubleRateAfterEnd ?? true,
        released,
        savedRentAmount: round2(Math.max(0, snapshot_totalRentPaymentMonthly - snapshot_fineAmount)),
        savedFineAmount: snapshot_fineAmount,
        savedUnpaidMonths: snapshot_unpaidMonths,
        savedFineDays: snapshot_numberOfFineDays,
      });
    }
  }
  snapshot_rateBreakdown = snapshot_rateBreakdown?.map((row) => {
    const months = Number(row.unpaidMonths ?? 0);
    return {
      ...row,
      unpaidMonths: Number.isFinite(months) ? Math.max(0, Math.floor(months)) : 0,
    };
  }) ?? null;

  // Live remaining balance (ONLY thing that changes with payments)
  const balanceRemaining = round2(
    Math.max(0, snapshot_totalRentPaymentMonthly - paymentsTotal),
  );

  const isPaid = balanceRemaining <= 0.00001;

  return withFixedLandRentAdjustments({
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
    fixedAdjustmentRows,
    generatedAdjustmentRows: snapshot_generatedAdjustmentRows,
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
    rateBreakdown: snapshot_rateBreakdown ?? [],

    // IMPORTANT: This is the frozen "fees+fine" total (pre-payments)
    totalRentPaymentMonthly: snapshot_totalRentPaymentMonthly,

    // ✅ Live payment fields (these change as you accept payments)
    payments,
    paymentsTotal,
    balanceRemaining,
    isPaid,
  });
};

/** Recompute fine (and snapshot) for an OPEN statement and update the document. */
export const recalculateLandStatementFines = async (params: {
  statementId: string;
  capToEndDate?: boolean;
}) => {
  const statement = await getDocument<LandStatementDoc>(
    COLLECTIONS.landStatements,
    params.statementId,
  );

  if (statement.kind === "FINE_ONLY") {
    // The entered fine is fixed; automated rent calculations must not overwrite it.
    return getLandStatementDetails(params);
  }
  if (statement.status !== "OPEN") {
    throw new Error("Only OPEN statements can be recalculated.");
  }

  const paysDocs = await listLandPaymentsForStatement(params.statementId);
  const payments = paysDocs.map((p) => ({
    paidAt: p.paidAt,
    amount: Number((p as any).amount ?? 0),
  }));

  const computed = await computeStatementFromBaseline({
    leaseId: statement.leaseId,
    monthKey: statement.monthKey,
    capToEndDate: params.capToEndDate,
    payments,
  });

  const snapshot_totalRentPaymentMonthly = Number(
    (computed as any).totalRentPaymentMonthly ?? 0,
  );
  const snapshot_monthlyRentPaymentAmount = Number(
    (computed as any).monthlyRentPaymentAmount ?? 0,
  );
  const snapshot_unpaidMonths = Number((computed as any).unpaidMonths ?? 0);
  const snapshot_outstandingFees = Number(
    (computed as any).outstandingFees ?? 0,
  );
  const snapshot_numberOfFineDays = Number(
    (computed as any).numberOfFineDays ?? 0,
  );
  const snapshot_fineAmount = Number((computed as any).fineAmount ?? 0);
  const snapshot_latestPaymentDate = ((computed as any).latestPaymentDate ??
    null) as string | null;
  const snapshot_fineBreakdown = Array.isArray((computed as any).fineBreakdown)
    ? (computed as any).fineBreakdown
    : [];

  await updateDocument(COLLECTIONS.landStatements, params.statementId, {
    recalculatedAt: new Date().toISOString(),
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
    snapshot_generatedAdjustmentRowsJson: JSON.stringify(
      computed.generatedAdjustmentRows ?? [],
    ),
    doubleRateAfterEnd: computed.doubleRateAfterEnd,
    snapshot_rateBreakdownJson: JSON.stringify(computed.rateBreakdown ?? []),
    snapshot_legacyFineStartRuleVersion: LEGACY_FINE_START_RULE_VERSION,
    snapshot_capToEndDate: !!params.capToEndDate,
  });

  return { ok: true };
};

export const recalculateAllLandRentLeases = async () => {
  await requireAdmin();

  const [leases, openStatements] = await Promise.all([
    listAllDocuments<LandLeaseDoc>(COLLECTIONS.landLeases),
    listAllDocuments<LandStatementDoc>(COLLECTIONS.landStatements, {
      where: [["status", "==", "OPEN"]],
    }),
  ]);
  const leaseIds = new Set(leases.map((lease) => lease.$id));
  const statements = openStatements.filter(
    (statement) => leaseIds.has(statement.leaseId) && statement.kind !== "FINE_ONLY",
  );
  let updatedStatements = 0;
  const failures: { leaseId: string; statementId: string; message: string }[] = [];

  // Limit concurrent calculations so a batch does not overwhelm Firestore.
  for (let offset = 0; offset < statements.length; offset += 3) {
    await Promise.all(statements.slice(offset, offset + 3).map(async (statement) => {
      try {
        await recalculateLandStatementFines({
          statementId: statement.$id,
          capToEndDate: !!statement.snapshot_capToEndDate,
        });
        updatedStatements += 1;
      } catch (error) {
        failures.push({
          leaseId: statement.leaseId,
          statementId: statement.$id,
          message: error instanceof Error ? error.message : "Failed to recalculate this lease.",
        });
      }
    }));
  }

  return { totalLeases: leases.length, updatedStatements, failures };
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
  const details = await getLandStatementDetails({ statementId, capToEndDate });
  const alreadyPaid = details.statement.status === "PAID";
  const shouldBePaid = details.isPaid;

  if (!alreadyPaid && shouldBePaid) {
    await updateDocument(COLLECTIONS.landStatements, statementId, {
      status: "PAID",
    });
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
  const amount = Number(input.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("Invalid paidAt date.");
  }

  const st = await getDocument<LandStatementDoc>(COLLECTIONS.landStatements, input.statementId);

  if (st.status === "PAID") {
    const details = await getLandStatementDetails({ statementId: input.statementId, capToEndDate: input.capToEndDate });
    if (details.balanceRemaining <= 0) {
      throw new Error("This statement has no balance remaining.");
    }
  }

  const uploaded =
    input.slipDataUrl && input.slipFilename
      ? await uploadSlipFromDataUrl(input.slipDataUrl, input.slipFilename)
      : null;

  const slipFileId = uploaded?.fileId ?? null;
  const slipMime = uploaded?.mime ?? null;
  const slipFileName = uploaded ? input.slipFilename : null;

  const created = await createDocument<LandPaymentDoc>(COLLECTIONS.landPayments, {
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
  });

  // After saving payment, mark statement PAID if fully settled
  await maybeMarkStatementPaid(input.statementId, input.capToEndDate);

  return created;
};

export const updateLandRentPayment = async (input: {
  paymentId: string;
  paidAt: string;
  amount: number;
  method: string;
  reference?: string;
  note?: string;
  receivedBy?: string;
  slipDataUrl?: string | null;
  slipFilename?: string | null;
  removeSlip?: boolean;
}) => {
  const paymentId = String(input.paymentId ?? "").trim();
  if (!paymentId) throw new Error("Payment is required.");

  const amount = round2(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new Error("Invalid payment date/time.");
  }

  if (input.removeSlip && input.slipDataUrl) {
    throw new Error("Choose either a replacement slip or remove the existing slip.");
  }
  if (Boolean(input.slipDataUrl) !== Boolean(input.slipFilename)) {
    throw new Error("The replacement slip and filename are both required.");
  }

  const payment = await getDocument<LandPaymentDoc>(COLLECTIONS.landPayments, paymentId);
  await getDocument<LandStatementDoc>(COLLECTIONS.landStatements, payment.statementId);

  const uploaded = input.slipDataUrl && input.slipFilename
    ? await uploadSlipFromDataUrl(input.slipDataUrl, input.slipFilename)
    : null;
  const slipUpdate = uploaded
    ? { slipFileId: uploaded.fileId, slipFileName: input.slipFilename, slipMime: uploaded.mime }
    : input.removeSlip
      ? { slipFileId: null, slipFileName: null, slipMime: null }
      : {};

  try {
    await updateDocument(COLLECTIONS.landPayments, paymentId, {
      paidAt: paidAt.toISOString(),
      amount,
      method: String(input.method ?? "").trim(),
      reference: String(input.reference ?? "").trim(),
      note: String(input.note ?? "").trim(),
      receivedBy: String(input.receivedBy ?? "").trim(),
      ...slipUpdate,
    });
  } catch (error) {
    if (uploaded) await deleteFileFromR2(uploaded.fileId).catch(() => undefined);
    throw error;
  }

  if ((uploaded || input.removeSlip) && payment.slipFileId?.startsWith("land-rent/payment-slips/")) {
    await deleteFileFromR2(payment.slipFileId).catch((error) => {
      console.warn("Could not remove the previous payment slip", error);
    });
  }

  await maybeMarkStatementPaid(payment.statementId);
  return getDocument<LandPaymentDoc>(COLLECTIONS.landPayments, paymentId);
};

/* =============================== Core Computation =============================== */

const computeBucketsWithPaymentsUTC = (args: {
  fromMonth: Date;
  toMonth: Date;
  paymentDueDay: number;
  monthlyRent: number;
  fineLariPerDay: number;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
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
    normalPrincipalDue: number;
    doublePrincipalDue: number;
    normalPrincipalRemaining: number;
    doublePrincipalRemaining: number;
    normalMonths: number;
    doubleMonths: number;

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
    const rent = monthlyRentChargeByRate({
      monthStart: ms,
      normalMonthlyRent: args.monthlyRent,
      rentStart: args.rentStart,
      rentEnd: args.rentEnd,
      doubleRateAfterEnd: args.doubleRateAfterEnd,
      released: args.released,
    });
    const principalDue = rent.total;
    if (principalDue <= 0) continue;
    const dueDate = new Date(
      Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth(), args.paymentDueDay),
    );
    const dueDateOnly = dateOnlyUTC(dueDate);

    // Fine starts the day after the monthly due date.
    const fineStart = addDaysUTC(dueDateOnly, 1);

    buckets.push({
      key: `${ms.getUTCFullYear()}-${pad2(ms.getUTCMonth() + 1)}`,
      label: fmtMonthYearUTC(ms),

      monthStart: ms,
      dueDate: dueDateOnly,
      fineStart,

      principalDue,
      principalPaid: 0,
      principalRemaining: principalDue,
      normalPrincipalDue: rent.normalAmount,
      doublePrincipalDue: rent.doubleAmount,
      normalPrincipalRemaining: rent.normalAmount,
      doublePrincipalRemaining: rent.doubleAmount,
      normalMonths: rent.normalMonths,
      doubleMonths: rent.doubleMonths,

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
    if (!usesPostAugustMonthlyFine(b.monthStart)) return;

    const thru = dateOnlyUTC(thruDate);
    if (thru.getTime() < b.fineStart.getTime()) return;

    const start =
      b.lastFineAccrualDate.getTime() < b.fineStart.getTime()
        ? b.fineStart
        : b.lastFineAccrualDate;

    if (thru.getTime() < start.getTime()) return;

    const fine = fineBetweenDates({
      from: start,
      through: thru,
      normalMonthlyRent: args.monthlyRent,
      rentStart: args.rentStart,
      rentEnd: args.rentEnd,
      doubleRateAfterEnd: args.doubleRateAfterEnd,
      released: args.released,
      regime: "from-august-2025",
    });
    b.fineDaysAccrued += fine.days;

    b.fineAccrued = round2(b.fineAccrued + fine.amount);
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
        const payNormal = Math.min(pay, b.normalPrincipalRemaining);
        const payDouble = round2(pay - payNormal);
        b.normalPrincipalRemaining = round2(b.normalPrincipalRemaining - payNormal);
        b.doublePrincipalRemaining = round2(b.doublePrincipalRemaining - payDouble);
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
  const grossRentAmount = round2(
    buckets.reduce((sum, b) => sum + b.principalDue, 0),
  );
  const grossFineAmount = round2(
    buckets.reduce((sum, b) => sum + b.fineAccrued, 0),
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
    grossRentAmount,
    numberOfFineDays,
    fineAmount,
    grossFineAmount,
    totalOutstanding,
    fineBreakdown,
  };
};

function computePostCutoffFineRows(args: {
  fromMonth: Date;
  toMonth: Date;
  effectiveCap: Date;
  paymentDueDay: number;
  monthlyRent: number;
  fineLariPerDay: number;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
  rentRate: number;
  sizeSqft: number;
  payments: Array<{ paidAt: string; amount: number }>;
}): LandRentGeneratedAdjustmentRow[] {
  const effectiveCap = dateOnlyUTC(args.effectiveCap);
  const fromMonth = startOfMonthUTC(args.fromMonth);
  const cutoffMonth = startOfMonthUTC(LAND_RENT_POST_CUTOFF_FINE_START_DATE);
  const chargeFrom = fromMonth.getTime() > cutoffMonth.getTime()
    ? fromMonth
    : cutoffMonth;
  const toMonth = startOfMonthUTC(args.toMonth);
  if (
    effectiveCap.getTime() < LAND_RENT_POST_CUTOFF_FINE_START_DATE.getTime() ||
    toMonth.getTime() < chargeFrom.getTime()
  ) return [];

  const computed = computeBucketsWithPaymentsUTC({
    fromMonth,
    toMonth,
    paymentDueDay: args.paymentDueDay,
    monthlyRent: args.monthlyRent,
    fineLariPerDay: args.fineLariPerDay,
    rentStart: args.rentStart,
    rentEnd: args.rentEnd,
    doubleRateAfterEnd: args.doubleRateAfterEnd,
    released: args.released,
    effectiveCap,
    payments: args.payments,
  });

  if (computed.grossFineAmount <= 0) return [];

  const periodLabel = `${LAND_RENT_POST_CUTOFF_FINE_LABEL} (${dateToMonthKeyUTC(chargeFrom)}–${dateToMonthKeyUTC(toMonth)})`;

  return [
    {
      key: "generated-post-july-2025-fine",
      total: computed.grossFineAmount,
      rentAmount: 0,
      unpaidMonths: computed.buckets.filter((bucket) => bucket.fineAccrued > 0).length,
      fineAmount: computed.grossFineAmount,
      fineDays: computed.buckets.reduce((sum, bucket) => sum + bucket.fineDaysAccrued, 0),
      periodLabel,
      rentRate: round2(args.rentRate),
      sizeOfLand: round2(args.sizeSqft),
      description: periodLabel,
      displayMode: "description",
    },
  ];
}

function computeContinuousFineFromLastPayment(args: {
  fromMonth: Date;
  rentStart: Date | null;
  rentEnd: Date | null;
  doubleRateAfterEnd?: boolean;
  released: Date | null;
  effectiveCap: Date;
  monthlyRent: number;
}) {
  const fine = fineBetweenDatesByRate({
    from: startOfMonthUTC(args.fromMonth),
    through: args.effectiveCap,
    normalMonthlyRent: args.monthlyRent,
    rentStart: args.rentStart,
    rentEnd: args.rentEnd,
    doubleRateAfterEnd: args.doubleRateAfterEnd,
    released: args.released,
    regime: "before-august-2025",
  });

  return {
    numberOfFineDays: fine.normalDays + fine.doubleDays,
    fineAmount: fine.total,
    byRate: fine,
    fineBreakdown:
      fine.total > 0
        ? [
            {
              key: "continuous-fine-period",
              label: "Overdue fine through July 31, 2025",
              days: fine.normalDays + fine.doubleDays,
              fine: fine.total,
            },
          ]
        : [],
  };
}

/* =============================== Optional: Overview (kept) =============================== */

export const fetchLandRentOverview = async (params?: {
  monthKey?: string;
  capToEndDate?: boolean;
}): Promise<LandRentOverviewRow[]> => {
  const mk =
    params?.monthKey ??
    `${new Date().getFullYear()}-${pad2(new Date().getMonth() + 1)}`;

  const capToEndDate = !!params?.capToEndDate;

  const [leases, parcels, tenants, openStatements, currentMonthStatements, paidStatements] =
    await Promise.all([
      listAllDocuments<LandLeaseDoc>(COLLECTIONS.landLeases, {
        orderBy: [{ field: "$createdAt", direction: "desc" }],
      }),
      listAllDocuments<LandParcelDoc>(COLLECTIONS.landParcels, {
        orderBy: [{ field: "$createdAt", direction: "asc" }],
      }),
      listAllDocuments<LandTenantDoc>(COLLECTIONS.landTenants, {
        orderBy: [{ field: "$createdAt", direction: "asc" }],
      }),
      listAllDocuments<LandStatementDoc>(COLLECTIONS.landStatements, {
        where: [["status", "==", "OPEN"]],
      }),
      listAllDocuments<LandStatementDoc>(COLLECTIONS.landStatements, {
        where: [["monthKey", "==", mk]],
      }),
      listAllDocuments<LandStatementDoc>(COLLECTIONS.landStatements, {
        where: [["status", "==", "PAID"]],
      }),
    ]);

  const leaseById = new Map(leases.map((lease) => [lease.$id, lease]));
  const parcelById = new Map(parcels.map((p) => [p.$id, p]));
  const tenantById = new Map(tenants.map((t) => [t.$id, t]));
  const paidStatementsWithSnapshots = paidStatements.flatMap((statement) => {
    const lease = leaseById.get(statement.leaseId);
    if (!lease || statement.snapshot_totalRentPaymentMonthly == null || statement.snapshot_fineAmount == null) return [];
    const parcel = parcelById.get(lease.parcelId);
    const monthlyRent = Number(statement.snapshot_monthlyRentPaymentAmount ??
      round2(Number(parcel?.sizeSqft ?? 0) * Number(lease.rateLariPerSqft ?? 0)));
    const correction = savedStatementOlderFineCorrection({
      statement,
      lease,
      monthlyRent,
      unpaidMonths: Number(statement.snapshot_unpaidMonths ?? 0),
      latestPaymentDate: statement.snapshot_latestPaymentDate ?? null,
      fineDays: Number(statement.snapshot_numberOfFineDays ?? 0),
      fineAmount: Number(statement.snapshot_fineAmount ?? 0),
    });
    return [{ statement, addedFineAmount: correction?.addedAmount ?? 0 }];
  });
  const payments = await listAllDocuments<LandPaymentDoc>(COLLECTIONS.landPayments);
  const openStatementByLease = new Map(
    openStatements.map((statement) => [statement.leaseId, statement]),
  );
  const monthStatementByLease = new Map(
    currentMonthStatements.map((statement) => [statement.leaseId, statement]),
  );
  const paymentsByStatement = new Map<string, LandPaymentDoc[]>();
  for (const payment of payments) {
    const statementId = String((payment as any).statementId ?? "");
    if (!statementId) continue;
    const list = paymentsByStatement.get(statementId) ?? [];
    list.push(payment);
    paymentsByStatement.set(statementId, list);
  }
  const revisedPaidDueById = new Map<string, number>();
  const revisedPaidDueByLease = new Map<string, number>();
  for (const { statement, addedFineAmount } of paidStatementsWithSnapshots) {
    const lease = leaseById.get(statement.leaseId);
    if (!lease) continue;
    const originalTotal = Number(statement.snapshot_totalRentPaymentMonthly ?? 0);
    let generatedRows: LandRentFixedAdjustmentRow[] = [];
    try {
      generatedRows = sanitizeFixedAdjustmentRows(
        JSON.parse(String(statement.snapshot_generatedAdjustmentRowsJson ?? "[]")),
      );
    } catch {
      // Older statements may not have a generated fine snapshot.
    }
    const adjustmentTotal = round2(
      (statement.kind === "FINE_ONLY" ? 0 : fixedLandRentAdjustmentTotal(getFixedLandRentAdjustmentsFromLease(lease))) +
        fixedLandRentAdjustmentTotal(generatedRows) + statementManualFineTotal(statement),
    );
    const paid = round2((paymentsByStatement.get(statement.$id) ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0), 0,
    ));
    const due = round2(Math.max(0, originalTotal + addedFineAmount + adjustmentTotal - paid));
    if (due <= 0) continue;
    revisedPaidDueById.set(statement.$id, due);
    revisedPaidDueByLease.set(statement.leaseId, round2((revisedPaidDueByLease.get(statement.leaseId) ?? 0) + due));
  }

  const overviewFromStatement = (
    lease: LandLeaseDoc,
    statement: LandStatementDoc,
    statusFallback: string,
  ): LandRentOverviewRow => {
    const parcel = parcelById.get(lease.parcelId);
    const tenant = tenantById.get(lease.tenantId);
    const sizeSqft = Number(parcel?.sizeSqft ?? 0);
    const rate = Number(lease.rateLariPerSqft ?? 0);
    const statementPayments = paymentsByStatement.get(statement.$id) ?? [];
    const paymentsTotal = round2(
      statementPayments.reduce(
        (sum, payment) => sum + Number((payment as any).amount ?? 0),
        0,
      ),
    );
    const latestPayment = statementPayments
      .slice()
      .sort((a, b) =>
        String((b as any).paidAt ?? "").localeCompare(
          String((a as any).paidAt ?? ""),
        ),
      )[0];
    const snapshotTotal = Number(
      (statement as any).snapshot_totalRentPaymentMonthly ??
        (statement as any).totalRentPaymentMonthly ??
        0,
    );
    const olderFineCorrection = savedStatementOlderFineCorrection({
      statement,
      lease,
      monthlyRent: Number(statement.snapshot_monthlyRentPaymentAmount ?? round2(sizeSqft * rate)),
      unpaidMonths: Number(statement.snapshot_unpaidMonths ?? 0),
      latestPaymentDate: statement.snapshot_latestPaymentDate ?? null,
      fineDays: Number(statement.snapshot_numberOfFineDays ?? 0),
      fineAmount: Number(statement.snapshot_fineAmount ?? 0),
    });
    let generatedRows: LandRentFixedAdjustmentRow[] = [];
    try {
      generatedRows = sanitizeFixedAdjustmentRows(
        JSON.parse(String(statement.snapshot_generatedAdjustmentRowsJson ?? "[]")),
      );
    } catch {
      // Older statements may not have a generated fine snapshot.
    }
    const totalWithAdjustments = round2(
      snapshotTotal +
        Number(olderFineCorrection?.addedAmount ?? 0) +
        (statement.kind === "FINE_ONLY" ? 0 : fixedLandRentAdjustmentTotal(getFixedLandRentAdjustmentsFromLease(lease))) +
        fixedLandRentAdjustmentTotal(generatedRows) + statementManualFineTotal(statement),
    );

    return {
      leaseId: lease.$id,
      landName: String(parcel?.name ?? ""),
      tenantName: String(tenant?.fullName ?? ""),
      agreementNumber: String(lease.agreementNumber ?? ""),
      startDate: String(lease.startDate ?? ""),
      endDate: lease.endDate || null,
      doubleRateAfterEnd: lease.doubleRateAfterEnd === true,
      releasedDate: lease.releasedDate ? String(lease.releasedDate) : null,
      paymentDueDay: Number(lease.paymentDueDay ?? 10),
      rateLariPerSqft: rate,
      fineLariPerDay: round2((round2(sizeSqft * rate) / 30) * 0.25),
      sizeSqft,
      monthlyRent: round2(sizeSqft * rate),
      lastPaymentDate: latestPayment?.paidAt
        ? new Date(String(latestPayment.paidAt)).toISOString().slice(0, 10)
        : ((statement as any).snapshot_latestPaymentDate ?? null),
      openingOutstandingTotal: round2(
        Math.max(0, totalWithAdjustments - paymentsTotal) +
          (revisedPaidDueByLease.get(lease.$id) ?? 0) -
          (revisedPaidDueById.get(statement.$id) ?? 0),
      ),
      status: String((statement as any).status ?? statusFallback),
      agreementPdfFileId: lease.agreementPdfFileId ?? null,
      agreementPdfFilename: lease.agreementPdfFilename ?? null,
    } satisfies LandRentOverviewRow;
  };

  const rows = await Promise.all(
    leases.map(async (l) => {
      const parcel = parcelById.get(l.parcelId);
      const tenant = tenantById.get(l.tenantId);

      const sizeSqft = Number(parcel?.sizeSqft ?? 0);
      const rate = Number(l.rateLariPerSqft ?? 0);
      const monthlyRent = round2(sizeSqft * rate);

      // 1) If there is an OPEN statement: use LIVE remaining balance (payments included)
      const open = openStatementByLease.get(l.$id) ?? null;
      if (open) {
        return overviewFromStatement(l, open, "OPEN");
      }

      // 2) If a statement exists for the selected monthKey, use it (instead of preview)
      const cachedStatement = monthStatementByLease.get(l.$id) ?? null;
      if (cachedStatement) {
        return overviewFromStatement(l, cachedStatement, "PAID");
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
        endDate: l.endDate || null,
        doubleRateAfterEnd: l.doubleRateAfterEnd === true,
        releasedDate: l.releasedDate ? String(l.releasedDate) : null,
        paymentDueDay: Number(l.paymentDueDay ?? 10),
        rateLariPerSqft: rate,
        fineLariPerDay: round2((monthlyRent / 30) * 0.25),
        sizeSqft,
        monthlyRent,

        lastPaymentDate: preview.latestPaymentDate ?? null,
        openingOutstandingTotal: round2(Number(preview.totalRentPaymentMonthly ?? 0) +
          (revisedPaidDueByLease.get(l.$id) ?? 0)),
        status: (l as any).status ? String((l as any).status) : null,
        agreementPdfFileId: l.agreementPdfFileId ?? null,
        agreementPdfFilename: l.agreementPdfFilename ?? null,
      } satisfies LandRentOverviewRow;
    }),
  );

  // Preserve the leases' creation-date order so the newest additions appear first.
  return rows;
};

/* =============================== Create bundle (kept) =============================== */

export async function createLandRentBundle(
  payload: CreateLandRentPayload,
): Promise<CreatedLandRentBundle> {
  const tenant = await createDocument<LandTenantDoc>(COLLECTIONS.landTenants, {
    fullName: payload.tenant.fullName,
  });

  const parcel = await createDocument<LandParcelDoc>(COLLECTIONS.landParcels, {
    name: payload.parcel.name,
    sizeSqft: payload.parcel.sizeSqft,
  });

  const lease = await createDocument<LandLeaseDoc>(COLLECTIONS.landLeases, {
    parcelId: parcel.$id,
    tenantId: tenant.$id,

    startDate: payload.lease.startDate,
    endDate: payload.lease.endDate,
    doubleRateAfterEnd: !!payload.lease.endDate && payload.lease.doubleRateAfterEnd === true,
    agreementNumber: payload.lease.agreementNumber,
    releasedDate: payload.lease.releasedDate ?? null,

    rateLariPerSqft: payload.lease.rateLariPerSqft,
    paymentDueDay: payload.lease.paymentDueDay,
    fineLariPerDay: payload.lease.fineLariPerDay,
  });

  return { tenant, parcel, lease };
}

export const createLandRentHolder = async (input: {
  landName: string;
  renterName: string;

  rentStartDate: string; // "YYYY-MM-DD" or ISO
  doubleRateAfterEnd?: boolean;
  rentEndDate: string | null; // "YYYY-MM-DD" or ISO

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
  const landName = String(input.landName ?? "").trim();
  const renterName = String(input.renterName ?? "").trim();
  const agreementNumber = String(input.agreementNumber ?? "").trim();

  if (!landName) throw new Error("Land name is required.");
  if (!renterName) throw new Error("Renter name is required.");
  if (!agreementNumber) throw new Error("Agreement number is required.");

  const startISO = toIsoDateTimeOrNull(input.rentStartDate);
  const endISO = toIsoDateTimeOrNull(input.rentEndDate);
  if (!startISO) throw new Error("Invalid rentStartDate.");
  if (input.rentEndDate?.trim() && !endISO) throw new Error("Invalid rentEndDate.");

  const releasedISO = input.letGoDate
    ? toIsoDateTimeOrNull(input.letGoDate)
    : null;
  const lastPaidISO = input.lastPaymentDate
    ? toIsoDateTimeOrNull(input.lastPaymentDate)
    : null;

  const sizeSqft = Number(input.sizeSqft ?? 0);
  const rate = Number(input.rate ?? 0);
  const monthlyRent = round2(sizeSqft * rate);

  const paymentDueDay = clampInt(Number(input.paymentDueDay ?? 10), 1, 28);
  const finePerDay = round2((monthlyRent / 30) * 0.25);

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

  // 1) Tenant
  const tenant = await createDocumentSmartRetry<LandTenantDoc>(
    COLLECTIONS.landTenants,
    {
      fullName: renterName,
    },
  );

  // 2) Parcel
  const parcel = await createDocumentSmartRetry<LandParcelDoc>(
    COLLECTIONS.landParcels,
    {
      name: landName,
      sizeSqft,
    },
  );

  // 3) Lease
  const lease = await createDocumentSmartRetry<LandLeaseDoc>(
    COLLECTIONS.landLeases,
    {
      parcelId: parcel.$id,
      tenantId: tenant.$id,

      startDate: startISO,
      endDate: endISO,
      doubleRateAfterEnd: endISO !== null && input.doubleRateAfterEnd === true,
      agreementNumber,
      releasedDate: releasedISO,

      rateLariPerSqft: rate,
      paymentDueDay,
      fineLariPerDay: finePerDay,

      agreementPdfFileId,
      agreementPdfFilename: input.agreementPdfFilename,

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
};
