import { config } from "dotenv";
config({ path: ".env.local" });

import { COLLECTIONS, getFirestoreDb } from "../lib/firebase/admin";

function searchTokens(input: {
  referenceNumber?: unknown;
  subject?: unknown;
  senderName?: unknown;
  senderOrganization?: unknown;
}): string[] {
  const text = [
    input.referenceNumber,
    input.subject,
    input.senderName,
    input.senderOrganization,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return Array.from(
    new Set(
      text
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .slice(0, 80),
    ),
  );
}

async function main() {
  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.correspondence).get();
  let batch = db.batch();
  let pending = 0;
  let updated = 0;

  const commit = async () => {
    if (pending === 0) return;
    await batch.commit();
    batch = db.batch();
    pending = 0;
  };

  for (const doc of snap.docs) {
    const data = doc.data();
    const tokens = searchTokens(data);
    batch.update(doc.ref, { searchTokens: tokens });
    pending += 1;
    updated += 1;
    if (pending >= 450) await commit();
  }

  await commit();
  console.log(`Backfilled searchTokens for ${updated} correspondence records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
