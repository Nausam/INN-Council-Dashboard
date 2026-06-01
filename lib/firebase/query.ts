import {
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { fromFirestoreDocs } from "./adapters";
import { getFirestoreDb } from "./admin";

export async function listAllDocs<T extends { $id: string }>(
  collectionPath: string,
  buildQuery?: (q: Query<DocumentData>) => Query<DocumentData>,
): Promise<T[]> {
  const db = getFirestoreDb();
  const results: T[] = [];
  let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;
  const pageSize = 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q: Query<DocumentData> = db.collection(collectionPath);
    if (buildQuery) q = buildQuery(q);
    q = q.limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    results.push(...fromFirestoreDocs<T>(snap.docs));
    if (snap.docs.length < pageSize) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return results;
}

export function newDocId(): string {
  return getFirestoreDb().collection("_").doc().id;
}
