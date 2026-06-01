export function fileProxyUrl(
  objectKey: string,
  mode: "view" | "download" = "view",
): string {
  return `/api/files/r2?key=${encodeURIComponent(objectKey)}&mode=${mode}`;
}
