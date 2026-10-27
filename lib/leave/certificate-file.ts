import { LEAVE_CERTIFICATE_MAX_BYTES } from "@/lib/leave/salaam-family-types";

const MAX_SIDE = 2000;
const QUALITY = 0.85;

/** Why a chosen certificate can't be used: not an image or PDF, or too large. */
export class CertificateFileError extends Error {
  constructor(readonly reason: "type" | "size") {
    super(reason);
  }
}

/**
 * Gets a chosen medical certificate ready to upload. PDFs go as they are;
 * photos are turned upright and shrunk to at most 2000px JPEG in the browser,
 * so a phone camera picture stays readable but small.
 */
export async function prepareCertificateFile(file: File): Promise<File> {
  if (file.type === "application/pdf") {
    if (file.size > LEAVE_CERTIFICATE_MAX_BYTES) throw new CertificateFileError("size");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new CertificateFileError("type");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new CertificateFileError("type");
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new CertificateFileError("type");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new CertificateFileError("type");
    if (blob.size > LEAVE_CERTIFICATE_MAX_BYTES) throw new CertificateFileError("size");
    const name = `${file.name.replace(/\.[^.]*$/, "") || "certificate"}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
