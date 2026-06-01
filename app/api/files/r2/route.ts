import { NextRequest, NextResponse } from "next/server";

import {
  getPresignedDownloadUrl,
  getPresignedViewUrl,
  isR2Configured,
} from "@/lib/r2";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const mode = request.nextUrl.searchParams.get("mode") ?? "view";
  const filename = request.nextUrl.searchParams.get("filename") ?? undefined;

  if (!key?.trim()) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 is not configured" }, { status: 503 });
  }

  try {
    const url =
      mode === "download"
        ? await getPresignedDownloadUrl(key, filename)
        : await getPresignedViewUrl(key);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("R2 file proxy error:", error);
    return NextResponse.json({ error: "Failed to generate file URL" }, { status: 500 });
  }
}
