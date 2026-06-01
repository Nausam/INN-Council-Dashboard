/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { unstable_noStore as noStore } from "next/cache";

import { COLLECTIONS } from "@/lib/firebase/admin";
import type { WasteFrequency } from "@/lib/billing/waste.types";
import {
  createDocument,
  getDocument,
  listAllDocuments,
  listDocuments,
  type ListQueryOptions,
  type WhereClause,
  updateDocument,
} from "@/lib/firebase/repository";

export type WasteInvoiceStatus =
  | "ISSUED"
  | "OVERDUE"
  | "PARTIALLY_PAID"
  | "PAID"
  | "WAIVED"
  | "CANCELLED";

const UNPAID_INVOICE_STATUSES = ["ISSUED", "OVERDUE", "PARTIALLY_PAID"];

function ymNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthToIndex(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return y * 12 + (m - 1);
}

function isYmValid(ym: string) {
  return /^\d{4}-\d{2}$/.test(ym);
}

function inRange(periodMonth: string, startMonth: string, endMonth: string) {
  const p = monthToIndex(periodMonth);
  const s = monthToIndex(startMonth);
  const e = monthToIndex(endMonth);
  return p >= s && p <= e;
}

function isDueByFrequency(params: {
  periodMonth: string;
  startMonth: string;
  frequency: "MONTHLY" | "QUARTERLY" | "YEARLY";
}) {
  const p = monthToIndex(params.periodMonth);
  const s = monthToIndex(params.startMonth);
  const diff = p - s;

  if (diff < 0) return false;

  if (params.frequency === "MONTHLY") return true;
  if (params.frequency === "QUARTERLY") return diff % 3 === 0;
  if (params.frequency === "YEARLY") return diff % 12 === 0;

  return true;
}

async function fetchDocumentsByIds<T extends { $id: string }>(
  collectionPath: string,
  ids: string[],
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return [];

  const docs: T[] = [];
  for (const id of unique) {
    try {
      docs.push(await getDocument<T>(collectionPath, id));
    } catch {
      // skip missing documents
    }
  }
  return docs;
}

async function listByFieldIn<T extends { $id: string }>(
  collectionPath: string,
  field: string,
  values: string[],
  options: Omit<ListQueryOptions, "where"> & { where?: WhereClause[] } = {},
): Promise<T[]> {
  const results: T[] = [];
  const chunkSize = 30;

  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    if (!chunk.length) continue;

    const res = await listDocuments<T>(collectionPath, {
      ...options,
      where: [...(options.where ?? []), [field, "in", chunk]],
    });
    results.push(...res.documents);
  }

  return results;
}

async function audit(
  action: string,
  entityType: string,
  entityId: string,
  meta: unknown,
) {
  await createDocument(COLLECTIONS.auditLogs, {
    actorUserId: "system",
    action,
    entityType,
    entityId,
    metaJson: JSON.stringify(meta ?? {}),
    createdAt: new Date().toISOString(),
  });
}

async function nextInvoiceNo(year: number) {
  const key = `WASTE-${year}`;

  const existing = await listDocuments(COLLECTIONS.counters, {
    where: [["key", "==", key]],
    limit: 1,
  });

  if (existing.total === 0) {
    await createDocument(COLLECTIONS.counters, {
      key,
      nextNumber: 2,
    });
    return `WM-${year}-000001`;
  }

  const doc = existing.documents[0] as any;
  const n = Number(doc.nextNumber ?? 1);

  await updateDocument(COLLECTIONS.counters, doc.$id, {
    nextNumber: n + 1,
  });

  return `WM-${year}-${String(n).padStart(6, "0")}`;
}

async function getLastWasteInvoiceSeq(year: string) {
  const prefix = `WM-${year}-`;

  const r = await listDocuments(COLLECTIONS.invoices, {
    where: [
      ["serviceType", "==", "WASTE"],
      ["invoiceNo", ">=", prefix],
      ["invoiceNo", "<", `${prefix}\uf8ff`],
    ],
    orderBy: [{ field: "invoiceNo", direction: "desc" }],
    limit: 1,
  });

  const last = (r.documents?.[0] as any)?.invoiceNo as string | undefined;
  if (!last || !last.startsWith(prefix)) return 0;

  const n = parseInt(last.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : 0;
}

function makeWasteInvoiceNo(year: string, seq: number) {
  return `WM-${year}-${String(seq).padStart(6, "0")}`;
}

export async function listWasteCustomersWithSubs(limit?: any) {
  noStore();

  const parsed =
    typeof limit === "number"
      ? limit
      : typeof limit === "string"
        ? parseInt(limit, 10)
        : NaN;

  const safeLimit = Number.isFinite(parsed)
    ? Math.min(5000, Math.max(1, Math.floor(parsed)))
    : 5000;

  const customersRes = await listDocuments(COLLECTIONS.wasteCustomers, {
    orderBy: [{ field: "fullName", direction: "asc" }],
    limit: safeLimit,
  });

  const customers = customersRes.documents as any[];

  const subsRes = await listDocuments(COLLECTIONS.wasteSubscriptions, {
    where: [["status", "==", "ACTIVE"]],
    limit: 5000,
  });

  const subs = subsRes.documents as any[];
  const subByCustomerId = new Map<string, any>();
  for (const s of subs) subByCustomerId.set(String(s.customerId), s);

  const merged = customers.map((c) => {
    const customerId = String(c.$id);
    const sub = subByCustomerId.get(customerId) ?? null;

    const derivedFee = defaultWasteFeeFromCategory(String(c.category ?? ""));
    const hasSub = !!sub;

    const effectiveFeeMvr = hasSub ? Number(sub.feeMvr ?? 0) : derivedFee ?? 0;

    const effectiveFrequency = hasSub
      ? String(sub.frequency ?? "MONTHLY")
      : DEFAULT_WASTE_FREQUENCY;

    return {
      customer: {
        $id: customerId,
        fullName: c.fullName ?? "",
        idCardNumber: c.idCardNumber ?? "",
        address: c.address ?? "",
        contactNumber: c.contactNumber ?? "",
        category: c.category ?? "",
      },
      subscription: sub,
      hasSubscription: hasSub,
      defaultFeeMvr: derivedFee,
      effectiveFeeMvr,
      effectiveFrequency,
    };
  });

  return { customers: merged };
}

export async function upsertWasteSubscription(input: {
  customerId: string;
  feeMvr: number;
  frequency: WasteFrequency;
  startMonth?: string;
  endMonth?: string; // optional from UI later
}) {
  const startMonth = input.startMonth ?? ymNow();

  // If your Appwrite schema requires endMonth, this makes it valid.
  // If endMonth is optional, this is still fine.
  const endMonth = input.endMonth?.trim() || "9999-12";

  const existing = await listDocuments(COLLECTIONS.wasteSubscriptions, {
    where: [["customerId", "==", input.customerId]],
    limit: 1,
  });

  const payload = {
    customerId: input.customerId,
    feeMvr: Math.round(input.feeMvr),
    frequency: input.frequency,
    startMonth,
    endMonth,
    status: "ACTIVE",
  };

  if (existing.total === 0) {
    const created = await createDocument(
      COLLECTIONS.wasteSubscriptions,
      payload,
    );
    await audit(
      "WASTE_SUB_CREATED",
      "waste_subscription",
      created.$id,
      payload,
    );
    return created;
  }

  const sub = existing.documents[0] as any;
  await updateDocument(COLLECTIONS.wasteSubscriptions, sub.$id, payload);
  const updated = await getDocument(COLLECTIONS.wasteSubscriptions, sub.$id);
  await audit("WASTE_SUB_UPDATED", "waste_subscription", updated.$id, payload);
  return updated;
}

// INVOICES
export async function generateWasteInvoicesForMonth(params: {
  periodMonth: string; // YYYY-MM
  dueInDays?: number;
  customerId?: string; // optional: generate only for one customer
}) {
  noStore();

  const periodMonth = params.periodMonth?.trim();
  if (!isYmValid(periodMonth))
    throw new Error("periodMonth must be in YYYY-MM format");

  const dueInDays = Math.max(0, Math.round(params.dueInDays ?? 10));

  // 1) Load active subscriptions (optionally for one customer)
  const subWhere: WhereClause[] = [["status", "==", "ACTIVE"]];
  if (params.customerId)
    subWhere.push(["customerId", "==", params.customerId]);

  const subsRes = await listDocuments(COLLECTIONS.wasteSubscriptions, {
    where: subWhere,
    limit: 5000,
  });
  const subs = subsRes.documents as any[];

  if (subs.length === 0) {
    return {
      createdCount: 0,
      skippedCount: 0,
      reason: "No subscriptions found.",
    };
  }

  // 2) Batch fetch customers
  const customerIds = Array.from(
    new Set(subs.map((s) => String(s.customerId)).filter(Boolean)),
  );

  const customerById = new Map<string, any>();
  if (customerIds.length) {
    const customers = await fetchDocumentsByIds<any>(
      COLLECTIONS.wasteCustomers,
      customerIds,
    );
    for (const c of customers) {
      customerById.set(String(c.$id), c);
    }
  }

  let createdCount = 0;
  let skippedCount = 0;

  // ✅ invoice numbering: WM-YYYY-000001
  const year = periodMonth.slice(0, 4);
  let seq = (await getLastWasteInvoiceSeq(year)) + 1;

  // 3) For each subscription, decide if it should generate
  for (const sub of subs) {
    const customerId = String(sub.customerId);
    const customer = customerById.get(customerId);

    // If customer missing in customer DB, skip (prevents bad invoices)
    if (!customer) {
      skippedCount++;
      continue;
    }

    const startMonth = String(sub.startMonth ?? "");
    const endMonth = String(sub.endMonth ?? "9999-12");
    const frequency = String(sub.frequency ?? "MONTHLY") as
      | "MONTHLY"
      | "QUARTERLY"
      | "YEARLY";

    if (!isYmValid(startMonth) || !isYmValid(endMonth)) {
      skippedCount++;
      continue;
    }

    // Rule 1: must be within start/end
    if (!inRange(periodMonth, startMonth, endMonth)) {
      skippedCount++;
      continue;
    }

    // Rule 2: must match frequency schedule
    if (!isDueByFrequency({ periodMonth, startMonth, frequency })) {
      skippedCount++;
      continue;
    }

    // Rule 3: must not already exist
    const exists = await listDocuments(COLLECTIONS.invoices, {
      where: [
        ["serviceType", "==", "WASTE"],
        ["customerId", "==", customerId],
        ["periodMonth", "==", periodMonth],
      ],
      limit: 1,
    });

    if (exists.total > 0) {
      skippedCount++;
      continue;
    }

    // Create invoice
    const issueDate = new Date().toISOString();
    const dueDate = new Date(
      Date.now() + dueInDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const fee = Math.max(0, Math.round(Number(sub.feeMvr ?? 0)));

    const invoicePayload: any = {
      serviceType: "WASTE",
      periodMonth,
      customerId,

      // ✅ Always set invoiceNo
      invoiceNo: makeWasteInvoiceNo(year, seq),

      customerName: customer.fullName ?? "Unknown",
      customerAddress: customer.address ?? "",
      customerIdCardNumber: customer.idCardNumber ?? "",

      issueDate,
      dueDate,

      subtotalMvr: fee,
      discountMvr: 0,
      penaltyMvr: 0,
      totalMvr: fee,

      paidMvr: 0,
      balanceMvr: fee,

      status: "ISSUED",
    };

    const inv = await createDocument(COLLECTIONS.invoices, invoicePayload);

    await createDocument(COLLECTIONS.invoiceItems, {
      invoiceId: inv.$id,
      label: `Waste Management Fee (${periodMonth})`,
      qty: 1,
      unitMvr: fee,
      lineTotalMvr: fee,
    });

    // ✅ increment only after successful create
    seq++;
    createdCount++;
  }

  await audit("WASTE_INVOICE_GENERATED_MONTH", "invoice", periodMonth, {
    periodMonth,
    customerId: params.customerId ?? null,
    createdCount,
    skippedCount,
  });

  return { createdCount, skippedCount };
}

export async function listWasteInvoices(params?: {
  periodMonth?: string; // YYYY-MM
  status?: WasteInvoiceStatus;
  customerId?: string;
  limit?: number;
}) {
  noStore();

  const limit = Math.min(200, Math.max(1, params?.limit ?? 200));

  const where: WhereClause[] = [["serviceType", "==", "WASTE"]];

  if (params?.periodMonth)
    where.push(["periodMonth", "==", params.periodMonth]);
  if (params?.status) where.push(["status", "==", params.status]);
  if (params?.customerId)
    where.push(["customerId", "==", params.customerId]);

  const res = await listDocuments(COLLECTIONS.invoices, {
    where,
    orderBy: [{ field: "issueDate", direction: "desc" }],
    limit,
  });
  return res.documents as any[];
}

export async function getWasteInvoiceWithItems(invoiceId: string) {
  noStore();

  const invoice = await getDocument(COLLECTIONS.invoices, invoiceId);

  const items = await listDocuments(COLLECTIONS.invoiceItems, {
    where: [["invoiceId", "==", invoiceId]],
    orderBy: [{ field: "label", direction: "asc" }],
    limit: 200,
  });

  return { invoice, items: items.documents };
}

export async function getWasteInvoiceSummary(params?: {
  periodMonth?: string;
}) {
  noStore();

  const where: WhereClause[] = [["serviceType", "==", "WASTE"]];
  if (params?.periodMonth)
    where.push(["periodMonth", "==", params.periodMonth]);

  const res = await listAllDocuments(COLLECTIONS.invoices, { where });

  let total = 0;
  let totalAmount = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  for (const d of res as any[]) {
    total++;
    totalAmount += Number(d.totalMvr ?? 0);
    totalPaid += Number(d.paidMvr ?? 0);
    totalBalance += Number(d.balanceMvr ?? 0);
  }

  return { total, totalAmount, totalPaid, totalBalance };
}

export async function markWasteInvoicesOverdue(params?: { asOf?: string }) {
  noStore();

  const asOfIso = params?.asOf?.trim() || new Date().toISOString();
  const asOfDate = new Date(asOfIso);

  const res = await listAllDocuments(COLLECTIONS.invoices, {
    where: [
      ["serviceType", "==", "WASTE"],
      ["status", "in", UNPAID_INVOICE_STATUSES],
    ],
  });

  let updated = 0;

  for (const inv of res as any[]) {
    const due = new Date(inv.dueDate);
    const balance = Number(inv.balanceMvr ?? 0);

    if (balance > 0 && due.getTime() < asOfDate.getTime()) {
      if (inv.status !== "OVERDUE") {
        await updateDocument(COLLECTIONS.invoices, inv.$id, {
          status: "OVERDUE",
        });
        updated++;
      }
    }
  }

  await audit("WASTE_INVOICE_MARK_OVERDUE", "invoice", "bulk", {
    asOf: asOfIso,
    updated,
  });

  return { updated };
}

// PAYMENTS
export async function listWasteCustomersLight(params?: { limit?: number }) {
  noStore();

  const limit = Math.min(500, Math.max(1, params?.limit ?? 500));

  const res = await listDocuments(COLLECTIONS.wasteCustomers, {
    orderBy: [{ field: "fullName", direction: "asc" }],
    limit,
  });

  return res.documents as any[];
}

export async function listCustomerUnpaidWasteInvoices(customerId: string) {
  noStore();

  const res = await listDocuments(COLLECTIONS.invoices, {
    where: [
      ["serviceType", "==", "WASTE"],
      ["customerId", "==", customerId],
      ["status", "in", UNPAID_INVOICE_STATUSES],
    ],
    orderBy: [{ field: "issueDate", direction: "asc" }],
    limit: 200,
  });

  const invoices = res.documents as any[];

  const totalBalance = invoices.reduce(
    (sum, i) => sum + Number(i.balanceMvr ?? 0),
    0,
  );

  return { invoices, totalBalance };
}

export async function recordWastePayment(params: {
  customerId: string;
  amountMvr: number;
  method: "CASH" | "TRANSFER" | "CHEQUE" | "OTHER";
  reference?: string;
  notes?: string;

  // if your schema requires it, set something meaningful here later:
  receivedByUserId?: string;
}) {
  noStore();

  const amount = Math.max(0, Math.round(params.amountMvr));
  if (amount <= 0) throw new Error("Amount must be greater than 0");

  // 1) Create payment row
  const payment = await createDocument(COLLECTIONS.payments, {
    customerId: params.customerId,
    receivedAt: new Date().toISOString(),
    amountMvr: amount,
    method: params.method,
    reference: params.reference?.trim() || "",

    // If your table column is required, keep a non-empty string.
    receivedByUserId: params.receivedByUserId?.trim() || "system",
    notes: params.notes?.trim() || "",
  });

  // 2) Get unpaid invoices (oldest first)
  const unpaid = await listDocuments(COLLECTIONS.invoices, {
    where: [
      ["serviceType", "==", "WASTE"],
      ["customerId", "==", params.customerId],
      ["status", "in", UNPAID_INVOICE_STATUSES],
    ],
    orderBy: [{ field: "issueDate", direction: "asc" }],
    limit: 200,
  });

  let remaining = amount;
  const allocations: { invoiceId: string; allocatedMvr: number }[] = [];

  // 3) Allocate payment
  for (const inv of unpaid.documents as any[]) {
    if (remaining <= 0) break;

    const bal = Number(inv.balanceMvr ?? 0);
    if (bal <= 0) continue;

    const take = Math.min(remaining, bal);
    allocations.push({ invoiceId: inv.$id, allocatedMvr: take });
    remaining -= take;
  }

  // 4) Write allocations + update invoices
  for (const a of allocations) {
    await createDocument(COLLECTIONS.paymentAllocations, {
      paymentId: payment.$id,
      invoiceId: a.invoiceId,
      allocatedMvr: a.allocatedMvr,
    });

    const inv = (await getDocument(
      COLLECTIONS.invoices,
      a.invoiceId,
    )) as any;

    const paid = Number(inv.paidMvr ?? 0) + a.allocatedMvr;
    const total = Number(inv.totalMvr ?? 0);
    const balance = Math.max(0, total - paid);

    const nextStatus =
      balance === 0
        ? "PAID"
        : paid > 0
          ? "PARTIALLY_PAID"
          : (inv.status as string);

    await updateDocument(COLLECTIONS.invoices, a.invoiceId, {
      paidMvr: paid,
      balanceMvr: balance,
      status: nextStatus,
    });
  }

  await audit("PAYMENT_RECORDED", "payment", payment.$id, {
    customerId: params.customerId,
    amountMvr: amount,
    allocations,
    unallocatedMvr: remaining,
  });

  return {
    paymentId: payment.$id,
    allocatedCount: allocations.length,
    allocatedTotal: allocations.reduce((s, a) => s + a.allocatedMvr, 0),
    unallocatedMvr: remaining,
    allocations,
  };
}

// RECEIPTS
export async function getWastePaymentReceipt(paymentId: string) {
  noStore();

  const payment = await getDocument(COLLECTIONS.payments, paymentId);

  const allocRes = await listDocuments(COLLECTIONS.paymentAllocations, {
    where: [["paymentId", "==", paymentId]],
    orderBy: [{ field: "$createdAt", direction: "asc" }],
    limit: 500,
  });

  const allocations = allocRes.documents as any[];

  const invoiceIds = Array.from(
    new Set(allocations.map((a) => String(a.invoiceId)).filter(Boolean)),
  );

  const invoiceById = new Map<string, any>();
  const invoices = await fetchDocumentsByIds<any>(
    COLLECTIONS.invoices,
    invoiceIds,
  );
  for (const inv of invoices) {
    invoiceById.set(String(inv.$id), inv);
  }

  const enriched = allocations.map((a) => {
    const inv = invoiceById.get(String(a.invoiceId));
    return {
      allocation: a,
      invoice: inv ?? null,
    };
  });

  return { payment, allocations: enriched };
}

// PAYMENT HISTORY
export async function listWastePayments(params?: {
  month?: string; // YYYY-MM
  q?: string; // search: customer name/id/ref/payment id
  method?: "ALL" | "CASH" | "TRANSFER" | "CHEQUE" | "OTHER";
  limit?: number;
}) {
  noStore();

  const limit = Math.min(200, Math.max(1, params?.limit ?? 200));
  const month = (params?.month || ymNow()).trim();
  const method = params?.method || "ALL";
  const q = (params?.q || "").trim().toLowerCase();

  // month range
  const [yy, mm] = month.split("-").map((x) => Number(x));
  const start = new Date(Date.UTC(yy, (mm || 1) - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(yy, mm || 1, 1, 0, 0, 0)); // next month

  const where: WhereClause[] = [
    ["receivedAt", ">=", start.toISOString()],
    ["receivedAt", "<", end.toISOString()],
  ];

  if (method !== "ALL") where.push(["method", "==", method]);

  const payRes = await listDocuments(COLLECTIONS.payments, {
    where,
    orderBy: [{ field: "receivedAt", direction: "desc" }],
    limit,
  });
  const payments = payRes.documents as any[];

  const paymentIds = payments.map((p) => String(p.$id));
  const customerIds = Array.from(
    new Set(payments.map((p) => String(p.customerId)).filter(Boolean)),
  );

  // allocations totals (chunked)
  const allocatedByPaymentId = new Map<string, number>();

  const allocs = await listByFieldIn<any>(
    COLLECTIONS.paymentAllocations,
    "paymentId",
    paymentIds,
  );

  for (const a of allocs) {
    const pid = String(a.paymentId);
    const amt = Number(a.allocatedMvr ?? 0);
    allocatedByPaymentId.set(pid, (allocatedByPaymentId.get(pid) ?? 0) + amt);
  }

  // customers snapshot (chunked)
  const customerById = new Map<string, any>();
  const customers = await fetchDocumentsByIds<any>(
    COLLECTIONS.wasteCustomers,
    customerIds,
  );
  for (const c of customers) {
    customerById.set(String(c.$id), c);
  }

  // build rows
  let rows = payments.map((p) => {
    const allocated = allocatedByPaymentId.get(String(p.$id)) ?? 0;
    const unallocated = Math.max(0, Number(p.amountMvr ?? 0) - allocated);

    const c = customerById.get(String(p.customerId));
    const customerName = c?.fullName ?? "Unknown";
    const idCardNumber = c?.idCardNumber ?? c?.idCard ?? "";

    return {
      paymentId: String(p.$id),
      receivedAt: String(p.receivedAt),
      customerId: String(p.customerId),
      customerName,
      idCardNumber,
      method: String(p.method),
      amountMvr: Number(p.amountMvr ?? 0),
      allocatedMvr: allocated,
      unallocatedMvr: unallocated,
      reference: String(p.reference ?? ""),
    };
  });

  // server-side search
  if (q) {
    rows = rows.filter((r) => {
      return (
        r.paymentId.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        String(r.idCardNumber ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }

  const summary = rows.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.amount += r.amountMvr;
      acc.allocated += r.allocatedMvr;
      acc.unallocated += r.unallocatedMvr;
      return acc;
    },
    { count: 0, amount: 0, allocated: 0, unallocated: 0 },
  );

  return { rows, summary, month };
}

// INVOICE ACTIONS
export async function addPenaltyToWasteInvoice(params: {
  invoiceId: string;
  amountMvr: number;
  reason?: string;
  appliedByUserId?: string;
}) {
  noStore();

  const amount = Math.max(0, Math.round(Number(params.amountMvr ?? 0)));
  if (amount <= 0) throw new Error("Penalty amount must be greater than 0.");

  const inv = (await getDocument(
    COLLECTIONS.invoices,
    params.invoiceId,
  )) as any;

  if (inv.serviceType !== "WASTE") throw new Error("Not a waste invoice.");
  if (["PAID", "WAIVED", "CANCELLED"].includes(String(inv.status)))
    throw new Error("Cannot add penalty to PAID/WAIVED/CANCELLED invoices.");

  const penaltyNow = Number(inv.penaltyMvr ?? 0) + amount;
  const subtotal = Number(inv.subtotalMvr ?? 0);
  const discount = Number(inv.discountMvr ?? 0);
  const paid = Number(inv.paidMvr ?? 0);

  const totalNow = Math.max(0, subtotal - discount + penaltyNow);
  const balanceNow = Math.max(0, totalNow - paid);

  const nextStatus =
    balanceNow === 0
      ? "PAID"
      : paid > 0
        ? "PARTIALLY_PAID"
        : String(inv.status ?? "ISSUED");

  await updateDocument(COLLECTIONS.invoices, inv.$id, {
    penaltyMvr: penaltyNow,
    totalMvr: totalNow,
    balanceMvr: balanceNow,
    status: nextStatus,
    penaltyReason: params.reason?.trim() || "",
    penaltyAppliedAt: new Date().toISOString(),
  });

  await audit("WASTE_INVOICE_PENALTY_ADDED", "invoice", inv.$id, {
    amountMvr: amount,
    penaltyMvr: penaltyNow,
    totalMvr: totalNow,
    balanceMvr: balanceNow,
    reason: params.reason?.trim() || "",
    appliedByUserId: params.appliedByUserId?.trim() || "system",
  });

  return { ok: true };
}

export async function waiveWasteInvoice(params: {
  invoiceId: string;
  reason: string;
  waivedByUserId?: string;
}) {
  noStore();

  const reason = params.reason?.trim();
  if (!reason) throw new Error("Waive reason is required.");

  const inv = (await getDocument(
    COLLECTIONS.invoices,
    params.invoiceId,
  )) as any;

  if (inv.serviceType !== "WASTE") throw new Error("Not a waste invoice.");
  if (["WAIVED", "CANCELLED"].includes(String(inv.status)))
    throw new Error("Invoice already waived/cancelled.");

  const paid = Number(inv.paidMvr ?? 0);
  const balance = Number(inv.balanceMvr ?? 0);

  if (String(inv.status) === "PAID" || balance <= 0)
    throw new Error("Nothing to waive on this invoice.");

  await updateDocument(COLLECTIONS.invoices, inv.$id, {
    status: "WAIVED",
    balanceMvr: 0,
    waivedReason: reason,
    waivedAt: new Date().toISOString(),
  });

  await audit("WASTE_INVOICE_WAIVED", "invoice", inv.$id, {
    reason,
    paidMvr: paid,
    previousBalanceMvr: balance,
    waivedByUserId: params.waivedByUserId?.trim() || "system",
  });

  return { ok: true };
}

export async function cancelWasteInvoice(params: {
  invoiceId: string;
  reason: string;
  cancelledByUserId?: string;
}) {
  noStore();

  const reason = params.reason?.trim();
  if (!reason) throw new Error("Cancel reason is required.");

  const inv = (await getDocument(
    COLLECTIONS.invoices,
    params.invoiceId,
  )) as any;

  if (inv.serviceType !== "WASTE") throw new Error("Not a waste invoice.");
  if (["CANCELLED"].includes(String(inv.status)))
    throw new Error("Invoice already cancelled.");

  const paid = Number(inv.paidMvr ?? 0);
  if (paid > 0)
    throw new Error(
      "Cannot cancel an invoice that has payments. Use Waive or adjustments.",
    );

  await updateDocument(COLLECTIONS.invoices, inv.$id, {
    status: "CANCELLED",
    balanceMvr: 0,
    cancelledReason: reason,
    cancelledAt: new Date().toISOString(),
  });

  await audit("WASTE_INVOICE_CANCELLED", "invoice", inv.$id, {
    reason,
    cancelledByUserId: params.cancelledByUserId?.trim() || "system",
  });

  return { ok: true };
}

//DEFAULT WASTE FEE
const DEFAULT_WASTE_FREQUENCY = "MONTHLY" as const;

function defaultWasteFeeFromCategory(category?: string): number | null {
  if (!category) return null;
  const m = category.match(/(\d{1,4})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// BULK CREATE WASTE SUBSCRIPTIONS
export async function applyWasteDefaultsForAllCustomers(params?: {
  startMonth?: string; // default current month
  frequency?: "MONTHLY" | "QUARTERLY" | "YEARLY"; // default MONTHLY
  endMonth?: string; // default 9999-12
  limit?: number; // optional safety
}) {
  noStore();

  const startMonth = String(params?.startMonth ?? "").trim() || ymNow();
  const frequency = (params?.frequency ?? "MONTHLY") as
    | "MONTHLY"
    | "QUARTERLY"
    | "YEARLY";
  const endMonth = String(params?.endMonth ?? "9999-12").trim() || "9999-12";

  // 1) load customers
  const customersRes = await listDocuments(COLLECTIONS.wasteCustomers, {
    limit: Math.min(5000, Math.max(1, Number(params?.limit ?? 5000))),
  });

  const customers = customersRes.documents as any[];

  // 2) load existing active subs
  const subsRes = await listDocuments(COLLECTIONS.wasteSubscriptions, {
    where: [["status", "==", "ACTIVE"]],
    limit: 5000,
  });

  const subByCustomerId = new Map<string, any>();
  for (const s of subsRes.documents as any[])
    subByCustomerId.set(String(s.customerId), s);

  let created = 0;
  let skipped = 0;

  for (const c of customers) {
    const customerId = String(c.$id);

    // already has subscription
    if (subByCustomerId.has(customerId)) {
      skipped++;
      continue;
    }

    // derive default fee
    const fee = defaultWasteFeeFromCategory(String(c.category ?? ""));
    if (!fee || fee <= 0) {
      skipped++;
      continue;
    }

    // create subscription
    await createDocument(COLLECTIONS.wasteSubscriptions, {
      customerId,
      feeMvr: fee,
      frequency,
      status: "ACTIVE",
      startMonth,
      endMonth,
    });

    created++;
  }

  await audit("WASTE_DEFAULTS_APPLIED", "subscription", "bulk", {
    created,
    skipped,
    startMonth,
    endMonth,
    frequency,
  });

  return { created, skipped };
}
