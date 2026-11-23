"use server";

import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { deleteDocument, listAllDocuments, newDocId } from "@/lib/firebase/repository";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  isLandNoticeType,
  type CreateLandNoticesInput,
  type LandNotice,
} from "@/lib/landrent/landRentNotice.types";

const MAX_NOTICES_PER_BATCH = 400;
const MAX_NOTE_LENGTH = 1000;

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isYmd(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function text(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function toNotice(doc: Record<string, unknown> & { $id: string }): LandNotice {
  return {
    $id: doc.$id,
    $createdAt: String(doc.$createdAt ?? ""),
    noticeNumber: String(doc.noticeNumber ?? ""),
    noticeType: isLandNoticeType(doc.noticeType) ? doc.noticeType : "REMINDER",
    issueDate: String(doc.issueDate ?? ""),
    dueDate: String(doc.dueDate ?? ""),
    note: String(doc.note ?? ""),
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    leaseId: String(doc.leaseId ?? ""),
    landName: String(doc.landName ?? ""),
    tenantName: String(doc.tenantName ?? ""),
    agreementNumber: String(doc.agreementNumber ?? ""),
    monthlyRent: Number(doc.monthlyRent ?? 0),
    outstanding: Number(doc.outstanding ?? 0),
    lastPaymentDate: doc.lastPaymentDate ? String(doc.lastPaymentDate) : null,
    paymentDueDay: Number(doc.paymentDueDay ?? 10),
  };
}

/** Every notice issued, newest first. */
export const listLandNotices = async (): Promise<LandNotice[]> => {
  const docs = await listAllDocuments<Record<string, unknown> & { $id: string }>(
    COLLECTIONS.landNotices,
    { orderBy: [{ field: "$createdAt", direction: "desc" }] },
  );
  return docs.map(toNotice);
};

/**
 * Saves one notice per lease with consecutive numbers (LRN-<year>-001) from
 * the issue date's year. Numbers and notices are written in one transaction,
 * so two people creating notices at once never share a number.
 */
export const createLandNotices = async (input: CreateLandNoticesInput): Promise<LandNotice[]> => {
  const profile = await requireAdmin();

  if (!isYmd(input.issueDate)) throw new Error("Choose a valid issue date.");
  if (!isYmd(input.dueDate)) throw new Error("Choose a valid pay-by date.");
  if (input.dueDate < input.issueDate) throw new Error("The pay-by date can't be before the issue date.");

  const items = Array.isArray(input.notices) ? input.notices : [];
  if (items.length === 0) throw new Error("Select at least one lease.");
  if (items.length > MAX_NOTICES_PER_BATCH) {
    throw new Error(`Create at most ${MAX_NOTICES_PER_BATCH} notices at a time.`);
  }

  const note = text(input.note, MAX_NOTE_LENGTH);
  const seen = new Set<string>();
  const rows = items.map((item) => {
    const leaseId = text(item.leaseId, 200);
    if (!leaseId) throw new Error("A selected lease has no ID.");
    if (seen.has(leaseId)) throw new Error("A lease was selected twice.");
    seen.add(leaseId);
    if (!isLandNoticeType(item.noticeType)) throw new Error("Choose a notice type.");
    const outstanding = round2(Number(item.outstanding ?? 0));
    if (!Number.isFinite(outstanding) || outstanding <= 0) {
      throw new Error(`${text(item.agreementNumber) || leaseId} has nothing outstanding.`);
    }
    const lastPayment = text(item.lastPaymentDate, 10);
    return {
      leaseId,
      noticeType: item.noticeType,
      landName: text(item.landName),
      tenantName: text(item.tenantName),
      agreementNumber: text(item.agreementNumber, 100),
      monthlyRent: round2(Number(item.monthlyRent ?? 0)) || 0,
      outstanding,
      lastPaymentDate: isYmd(lastPayment) ? lastPayment : null,
      paymentDueDay: Math.min(31, Math.max(1, Math.round(Number(item.paymentDueDay ?? 10)) || 10)),
    };
  });

  const year = input.issueDate.slice(0, 4);
  const db = getFirestoreDb();
  const counterRef = db.collection(COLLECTIONS.counters).doc(`land-notice-${year}`);
  const now = new Date();
  const ids = rows.map(() => newDocId());

  const numbers = await db.runTransaction(async (tx) => {
    const counter = await tx.get(counterRef);
    const first = Math.max(1, Number(counter.data()?.nextNumber ?? 1));
    const assigned = rows.map((_, index) => `LRN-${year}-${String(first + index).padStart(3, "0")}`);
    tx.set(counterRef, { key: `land-notice-${year}`, nextNumber: first + rows.length, updatedAt: now }, { merge: true });
    rows.forEach((row, index) => {
      tx.set(db.collection(COLLECTIONS.landNotices).doc(ids[index]), {
        ...row,
        noticeNumber: assigned[index],
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        note,
        createdBy: profile.fullName || profile.email || null,
        createdAt: now,
        updatedAt: now,
      });
    });
    return assigned;
  });

  return rows.map((row, index) => ({
    ...row,
    $id: ids[index],
    $createdAt: now.toISOString(),
    noticeNumber: numbers[index],
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    note,
    createdBy: profile.fullName || profile.email || null,
  }));
};

/** Removes a notice created by mistake. Its number is not reused. */
export const deleteLandNotice = async (noticeId: string) => {
  await requireAdmin();
  const id = text(noticeId, 200);
  if (!id) throw new Error("Missing notice.");
  await deleteDocument(COLLECTIONS.landNotices, id);
  return { ok: true as const };
};
