import { getCurrentUser } from "@/lib/actions/user.actions";
import { createAdminClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import {
  downloadCorrespondenceFromR2,
  isCorrespondenceR2Configured,
} from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

function requireCollectionId() {
  const id = appwriteConfig.correspondenceCollectionId;
  if (!id) return null;
  return id;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const collectionId = requireCollectionId();
  if (!collectionId) {
    return new NextResponse("Document receiver is not configured", {
      status: 503,
    });
  }
  if (!isCorrespondenceR2Configured()) {
    return new NextResponse(
      "Correspondence file storage (R2_CORRESPONDENCE_BUCKET_NAME) is not configured",
      { status: 503 },
    );
  }

  const { databases } = await createAdminClient();
  let doc: Record<string, unknown>;
  try {
    doc = (await databases.getDocument(
      appwriteConfig.databaseId,
      collectionId,
      params.id,
    )) as unknown as Record<string, unknown>;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const objectKey =
    doc.storageFileId == null || doc.storageFileId === ""
      ? null
      : String(doc.storageFileId);
  if (!objectKey) {
    return new NextResponse("No file attached", { status: 404 });
  }

  const fileName =
    doc.fileName == null || doc.fileName === ""
      ? "attachment"
      : String(doc.fileName);

  try {
    const { buffer, contentType } =
      await downloadCorrespondenceFromR2(objectKey);
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${asciiName}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    console.error("document-reciever R2 download", e);
    return new NextResponse("Failed to load file", { status: 500 });
  }
}
