import { adminErrorStatus, requireAdmin } from "@/lib/auth/require-admin";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    if (!/^[\w-]{1,128}$/.test(params.id)) {
      return new Response("Invalid request", { status: 400 });
    }
    const snap = await getFirestoreDb()
      .collection(COLLECTIONS.familyLeaveDocuments)
      .doc(params.id)
      .get();
    if (!snap.exists) return new Response("Form not found", { status: 404 });
    const base64 = snap.data()?.dataBase64;
    if (typeof base64 !== "string") {
      return new Response("Form unavailable", { status: 500 });
    }
    const bytes = Buffer.from(base64, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          `attachment; filename="Salaam-Family-Leave-${params.id}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response("Unable to download form", {
      status: adminErrorStatus(error),
    });
  }
}
