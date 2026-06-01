/**
 * Migrate Appwrite Storage files (land rent agreements/slips) to R2.
 * Updates Firestore land_leases.agreementPdfFileId and land_payments.slipFileId with R2 keys.
 *
 * Usage: npm run migrate:files
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(process.cwd());
if (existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local") });
}
config();

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Client, Storage } from "node-appwrite";
import { writeFileSync } from "fs";

import { COLLECTIONS } from "../lib/firebase/admin";

function initFirebase() {
  if (getApps().length === 0) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID ?? "council-hr-dashboard";
  return getFirestore(getApps()[0]!, dbId);
}

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function downloadAppwriteFile(
  storage: Storage,
  bucketId: string,
  fileId: string,
): Promise<{ buffer: Buffer; mime: string }> {
  const meta = await storage.getFile(bucketId, fileId);
  const url = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/download?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
  const res = await fetch(url, {
    headers: { "X-Appwrite-Key": process.env.NEXT_APPWRITE_KEY! },
  });
  if (!res.ok) throw new Error(`Download failed ${fileId}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime: meta.mimeType ?? "application/octet-stream" };
}

async function uploadR2(key: string, buffer: Buffer, contentType: string) {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

async function main() {
  const bucketId = process.env.NEXT_PUBLIC_APPWRITE_AGREEMENTS_BUCKET;
  if (!bucketId) {
    console.log("No NEXT_PUBLIC_APPWRITE_AGREEMENTS_BUCKET — skipping file migration.");
    return;
  }

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "68fafb190023ef05bc17";
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(process.env.NEXT_APPWRITE_KEY!);
  const storage = new Storage(client);
  const firestore = initFirebase();
  const mapping: Record<string, string> = {};

  const leases = await firestore.collection(COLLECTIONS.landLeases).get();
  for (const doc of leases.docs) {
    const fileId = doc.data().agreementPdfFileId;
    if (!fileId || String(fileId).startsWith("land-rent/")) continue;
    const r2Key = `land-rent/agreements/${doc.id}/${doc.data().agreementPdfFilename ?? "agreement.pdf"}`;
    try {
      const { buffer, mime } = await downloadAppwriteFile(storage, bucketId, String(fileId));
      await uploadR2(r2Key, buffer, mime);
      await doc.ref.update({ agreementPdfFileId: r2Key });
      mapping[String(fileId)] = r2Key;
      console.log(`Lease ${doc.id}: ${fileId} -> ${r2Key}`);
    } catch (e) {
      console.warn(`Lease ${doc.id} file ${fileId}:`, e);
    }
  }

  const payments = await firestore.collection(COLLECTIONS.landPayments).get();
  for (const doc of payments.docs) {
    const fileId = doc.data().slipFileId;
    if (!fileId || String(fileId).startsWith("land-rent/")) continue;
    const r2Key = `land-rent/payment-slips/${doc.id}/${doc.data().slipFileName ?? "slip.pdf"}`;
    try {
      const { buffer, mime } = await downloadAppwriteFile(storage, bucketId, String(fileId));
      await uploadR2(r2Key, buffer, mime);
      await doc.ref.update({ slipFileId: r2Key });
      mapping[String(fileId)] = r2Key;
      console.log(`Payment ${doc.id}: ${fileId} -> ${r2Key}`);
    } catch (e) {
      console.warn(`Payment ${doc.id} file ${fileId}:`, e);
    }
  }

  writeFileSync("file-migration-map.json", JSON.stringify(mapping, null, 2));
  console.log("File migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
