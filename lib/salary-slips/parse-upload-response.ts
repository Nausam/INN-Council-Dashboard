export type UploadApiError = {
  error: string;
  detail?: string;
  code?: string;
};

export async function parseUploadJsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new Error("Server returned invalid JSON.");
    }
  }

  const text = (await response.text()).trim();
  if (response.status === 413) {
    throw new Error(
      "Upload request was too large. Try uploading fewer PDFs at a time.",
    );
  }
  if (!text) {
    throw new Error(`Upload failed with HTTP ${response.status}.`);
  }

  throw new Error(text.slice(0, 300));
}

export function getUploadErrorMessage(
  data: Record<string, unknown> | null | undefined,
  fallback: string,
): UploadApiError {
  const error =
    typeof data?.error === "string" && data.error.trim()
      ? data.error.trim()
      : fallback;
  const detail =
    typeof data?.detail === "string" && data.detail.trim()
      ? data.detail.trim()
      : undefined;
  const code =
    typeof data?.code === "string" && data.code.trim()
      ? data.code.trim()
      : undefined;

  return { error, detail, code };
}
