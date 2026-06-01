import { fileProxyUrl } from "@/lib/files";

export function getPaymentSlipDownloadUrl(fileId: string): string {
  if (!fileId) return "";
  return fileProxyUrl(fileId, "download");
}

export function getPaymentSlipUrl(fileId: string): string {
  if (!fileId) return "";
  return fileProxyUrl(fileId, "view");
}

export function getAgreementPdfDownloadUrl(fileId: string): string {
  if (!fileId) return "";
  return fileProxyUrl(fileId, "download");
}

export function getAgreementPdfUrl(fileId: string): string {
  if (!fileId) return "";
  return fileProxyUrl(fileId, "view");
}
