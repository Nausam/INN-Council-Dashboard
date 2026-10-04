"use server";

import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import { requireAdmin } from "@/lib/auth/require-admin";
import { EMPLOYEE_PHOTO_MAX_BYTES, EMPLOYEE_PHOTO_PREFIX } from "@/lib/employees/photo";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2";

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

/** Checks the file's first bytes, so a renamed non-image is rejected. */
function matchesImageSignature(bytes: Uint8Array, type: keyof typeof IMAGE_TYPES): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

async function employeeRef(employeeId: string) {
  if (!/^[\w-]{1,128}$/.test(employeeId)) throw new Error("Invalid employee");
  const ref = getFirestoreDb().collection(COLLECTIONS.employees).doc(employeeId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Employee not found");
  const previousKey = snap.get("photoKey");
  return { ref, previousKey: typeof previousKey === "string" ? previousKey : null };
}

async function deleteOldPhoto(key: string | null) {
  if (!key?.startsWith(EMPLOYEE_PHOTO_PREFIX)) return;
  // The record no longer points at it; a failed delete only leaves an orphan.
  await deleteFromR2(key).catch((error) => console.error("Could not delete old employee photo:", error));
}

export async function uploadEmployeePhoto(
  employeeId: string,
  formData: FormData,
): Promise<{ photoKey: string }> {
  await requireAdmin();
  if (!isR2Configured()) throw new Error("File storage is not configured");
  const file = formData.get("photo");
  if (!(file instanceof Blob) || file.size === 0) throw new Error("Choose a photo to upload");
  if (file.size > EMPLOYEE_PHOTO_MAX_BYTES) throw new Error("The photo is too large");
  const type = file.type as keyof typeof IMAGE_TYPES;
  if (!(type in IMAGE_TYPES)) throw new Error("Use a JPG, PNG, or WebP photo");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, type)) throw new Error("This file is not a valid image");

  const { ref, previousKey } = await employeeRef(employeeId);
  const photoKey = `${EMPLOYEE_PHOTO_PREFIX}${employeeId}/${randomUUID()}.${IMAGE_TYPES[type]}`;
  await uploadToR2(photoKey, bytes, type);
  await ref.update({ photoKey, updatedAt: new Date() });
  await deleteOldPhoto(previousKey);
  return { photoKey };
}

export async function removeEmployeePhoto(employeeId: string): Promise<void> {
  await requireAdmin();
  const { ref, previousKey } = await employeeRef(employeeId);
  if (!previousKey) return;
  await ref.update({ photoKey: FieldValue.delete(), updatedAt: new Date() });
  await deleteOldPhoto(previousKey);
}
