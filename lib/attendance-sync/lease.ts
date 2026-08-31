import { FieldValue } from "firebase-admin/firestore";

import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { getWorkerInstanceId } from "@/lib/attendance-sync/runtime";

const LEASE_DOC_ID = "attendance-sync-worker";
const LEASE_TTL_MS = 60_000;

export type WorkerLease = {
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
  renewedAt: string;
};

export async function tryAcquireWorkerLease(): Promise<boolean> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.integrationStatus).doc(LEASE_DOC_ID);
  const ownerId = getWorkerInstanceId();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as WorkerLease | undefined;
    if (current && current.expiresAt > nowIso && current.ownerId !== ownerId) {
      return false;
    }

    tx.set(
      ref,
      {
        ownerId,
        acquiredAt: current?.ownerId === ownerId ? current.acquiredAt : nowIso,
        renewedAt: nowIso,
        expiresAt,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
}

export async function renewWorkerLease(): Promise<boolean> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.integrationStatus).doc(LEASE_DOC_ID);
  const ownerId = getWorkerInstanceId();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + LEASE_TTL_MS).toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as WorkerLease | undefined;
    if (!current || current.ownerId !== ownerId) return false;
    if (current.expiresAt <= nowIso) return false;

    tx.set(
      ref,
      {
        renewedAt: nowIso,
        expiresAt,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
}

export async function releaseWorkerLease(): Promise<void> {
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.integrationStatus).doc(LEASE_DOC_ID);
  const ownerId = getWorkerInstanceId();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as WorkerLease | undefined;
    if (!current || current.ownerId !== ownerId) return;
    tx.delete(ref);
  });
}

export async function getWorkerLease(): Promise<WorkerLease | null> {
  const snap = await getFirestoreDb()
    .collection(COLLECTIONS.integrationStatus)
    .doc(LEASE_DOC_ID)
    .get();
  if (!snap.exists) return null;
  return snap.data() as WorkerLease;
}

export const WORKER_LEASE_RENEW_MS = 20_000;
