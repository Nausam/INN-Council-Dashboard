import type {
  DocumentData,
  Query,
  WhereFilterOp,
} from "firebase-admin/firestore";

import {
  fromFirestoreDoc,
  fromFirestoreDocs,
  stripLegacyFields,
  withTimestamps,
} from "./adapters";
import { getFirestoreDb } from "./admin";
import { listAllDocs, newDocId } from "./query";

export type WhereClause = [string, WhereFilterOp, unknown];

export type ListQueryOptions = {
  where?: WhereClause[];
  orderBy?: { field: string; direction?: "asc" | "desc" }[];
  limit?: number;
};

function mapField(field: string): string {
  return field === "$createdAt" ? "createdAt" : field;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function getDocField(doc: Record<string, unknown>, field: string): unknown {
  const mapped = mapField(field);
  if (mapped === "createdAt") {
    return doc.$createdAt ?? doc.createdAt;
  }
  return doc[mapped];
}

function matchesWhere(
  doc: Record<string, unknown>,
  [field, op, value]: WhereClause,
): boolean {
  const v = getDocField(doc, field);
  switch (op) {
    case "==":
      return v === value;
    case "!=":
      return v !== value;
    case ">":
      return compareValues(v, value) > 0;
    case ">=":
      return compareValues(v, value) >= 0;
    case "<":
      return compareValues(v, value) < 0;
    case "<=":
      return compareValues(v, value) <= 0;
    case "in":
      return Array.isArray(value) && value.includes(v);
    case "not-in":
      return Array.isArray(value) && !value.includes(v);
    case "array-contains":
      return Array.isArray(v) && v.includes(value);
    default:
      return true;
  }
}

/** True when Firestore can run the query without a manual composite index. */
function canRunOnFirestore(options: ListQueryOptions): boolean {
  const wheres = options.where ?? [];
  const orderBys = options.orderBy ?? [];

  if (orderBys.length > 0) {
    return wheres.length === 0 && orderBys.length === 1;
  }

  if (wheres.length <= 1) return true;

  const equality = wheres.filter(([, op]) => op === "==");
  const nonEquality = wheres.filter(([, op]) => op !== "==");

  if (equality.length === 0 && nonEquality.length >= 2) {
    const fields = new Set(nonEquality.map(([field]) => field));
    return fields.size === 1;
  }

  if (equality.length > 0 && nonEquality.length > 0) {
    return false;
  }

  if (equality.length > 1) {
    return false;
  }

  return true;
}

function sortDocuments<T extends { $id: string }>(
  docs: T[],
  orderBy: NonNullable<ListQueryOptions["orderBy"]>,
): T[] {
  return [...docs].sort((a, b) => {
    for (const ob of orderBy) {
      const field = mapField(ob.field);
      const av =
        field === "createdAt"
          ? (a as Record<string, unknown>).$createdAt ??
            (a as Record<string, unknown>).createdAt
          : (a as Record<string, unknown>)[field];
      const bv =
        field === "createdAt"
          ? (b as Record<string, unknown>).$createdAt ??
            (b as Record<string, unknown>).createdAt
          : (b as Record<string, unknown>)[field];
      const cmp = compareValues(av, bv);
      if (cmp !== 0) {
        return ob.direction === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function pickPrefetchWhere(wheres: WhereClause[]): WhereClause | undefined {
  const equality = wheres.filter(([, op]) => op === "==");
  if (equality.length > 0) return equality[0];
  if (wheres.length === 1) return wheres[0];
  return undefined;
}

async function queryDocumentsInMemory<T extends { $id: string }>(
  collectionPath: string,
  options: ListQueryOptions = {},
): Promise<T[]> {
  const wheres = options.where ?? [];
  const prefetch = pickPrefetchWhere(wheres);

  let docs: T[];
  if (prefetch) {
    const [field, op, value] = prefetch;
    docs = await listAllDocs<T>(collectionPath, (q) =>
      q.where(mapField(field), op, value),
    );
  } else {
    docs = await listAllDocs<T>(collectionPath);
  }

  let filtered = docs;
  if (wheres.length > 0) {
    filtered = docs.filter((doc) =>
      wheres.every((clause) =>
        matchesWhere(doc as unknown as Record<string, unknown>, clause),
      ),
    );
  }

  if (options.orderBy?.length) {
    filtered = sortDocuments(filtered, options.orderBy);
  }

  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

function applyQuery(
  collectionPath: string,
  options: ListQueryOptions = {},
): Query<DocumentData> {
  let q: Query<DocumentData> = getFirestoreDb().collection(collectionPath);

  for (const [field, op, value] of options.where ?? []) {
    q = q.where(mapField(field), op, value);
  }

  for (const ob of options.orderBy ?? []) {
    q = q.orderBy(mapField(ob.field), ob.direction ?? "asc");
  }

  if (options.limit) q = q.limit(options.limit);
  return q;
}

async function runListQuery<T extends { $id: string }>(
  collectionPath: string,
  options: ListQueryOptions = {},
): Promise<T[]> {
  if (canRunOnFirestore(options)) {
    const snap = await applyQuery(collectionPath, options).get();
    return fromFirestoreDocs<T>(snap.docs);
  }
  return queryDocumentsInMemory<T>(collectionPath, options);
}

export async function getDocument<T extends { $id: string }>(
  collectionPath: string,
  id: string,
): Promise<T> {
  const snap = await getFirestoreDb().collection(collectionPath).doc(id).get();
  const doc = fromFirestoreDoc<T>(snap);
  if (!doc) throw new Error(`Document not found: ${collectionPath}/${id}`);
  return doc;
}

export async function listDocuments<T extends { $id: string }>(
  collectionPath: string,
  options: ListQueryOptions = {},
): Promise<{ documents: T[]; total: number }> {
  const documents = await runListQuery<T>(collectionPath, options);
  return { documents, total: documents.length };
}

export async function listAllDocuments<T extends { $id: string }>(
  collectionPath: string,
  options: Omit<ListQueryOptions, "limit"> = {},
): Promise<T[]> {
  if (canRunOnFirestore(options)) {
    return listAllDocs<T>(collectionPath, (q) => {
      let next = q;
      for (const [field, op, value] of options.where ?? []) {
        next = next.where(mapField(field), op, value);
      }
      for (const ob of options.orderBy ?? []) {
        next = next.orderBy(mapField(ob.field), ob.direction ?? "asc");
      }
      return next;
    });
  }
  return queryDocumentsInMemory<T>(collectionPath, options);
}

export async function createDocument<T extends { $id: string }>(
  collectionPath: string,
  data: Record<string, unknown>,
  id?: string,
): Promise<T> {
  const db = getFirestoreDb();
  const docId = id ?? newDocId();
  const payload = withTimestamps(stripLegacyFields(data), true);
  await db.collection(collectionPath).doc(docId).set(payload);
  return getDocument<T>(collectionPath, docId);
}

export async function updateDocument(
  collectionPath: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await getFirestoreDb()
    .collection(collectionPath)
    .doc(id)
    .update(withTimestamps(stripLegacyFields(data)));
}

export async function deleteDocument(
  collectionPath: string,
  id: string,
): Promise<void> {
  await getFirestoreDb().collection(collectionPath).doc(id).delete();
}

export { newDocId };

export { fileProxyUrl } from "@/lib/files";

export async function uploadBufferToR2(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const { uploadToR2 } = await import("@/lib/r2");
  await uploadToR2(objectKey, buffer, contentType);
  return objectKey;
}
