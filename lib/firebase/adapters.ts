import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";

export type LegacyDoc = {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  [key: string]: unknown;
};

function toIso(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString();
  }
  return undefined;
}

export function fromFirestoreDoc<T extends LegacyDoc>(
  snap: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>,
): T | null {
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const { createdAt, updatedAt, ...rest } = data;

  return {
    ...rest,
    $id: snap.id,
    $createdAt: toIso(createdAt),
    $updatedAt: toIso(updatedAt),
  } as T;
}

export function fromFirestoreDocs<T extends LegacyDoc>(
  snaps: QueryDocumentSnapshot<DocumentData>[],
): T[] {
  return snaps
    .map((snap) => fromFirestoreDoc<T>(snap))
    .filter((doc): doc is T => doc !== null);
}

export function stripLegacyFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const {
    $id,
    $createdAt,
    $updatedAt,
    $collectionId,
    $databaseId,
    $permissions,
    ...rest
  } = data;
  void $id;
  void $createdAt;
  void $updatedAt;
  void $collectionId;
  void $databaseId;
  void $permissions;
  return rest;
}

export function withTimestamps(
  data: Record<string, unknown>,
  isCreate = false,
): Record<string, unknown> {
  const now = new Date();
  if (isCreate) {
    return { ...data, createdAt: now, updatedAt: now };
  }
  return { ...data, updatedAt: now };
}
