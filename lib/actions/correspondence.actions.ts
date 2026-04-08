"use server";

import { getCurrentUser } from "@/lib/actions/user.actions";
import { createAdminClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { isCorrespondenceOverdue } from "@/lib/correspondence/overdue";
import {
  deleteCorrespondenceFromR2,
  isCorrespondenceR2Configured,
  uploadCorrespondenceToR2,
} from "@/lib/r2";
import { parseStringify } from "@/lib/utils";
import {
  CORRESPONDENCE_CHANNELS,
  CORRESPONDENCE_FIELD_LIMITS,
  CORRESPONDENCE_STATUSES,
  type CorrespondenceChannel,
  type CorrespondenceDoc,
  type CorrespondenceStatus,
} from "@/types/correspondence";
import { endOfWeek, startOfWeek } from "date-fns";
import { ID, Query } from "node-appwrite";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CHANNEL_SET = new Set<string>(CORRESPONDENCE_CHANNELS);
const STATUS_SET = new Set<string>(CORRESPONDENCE_STATUSES);

function requireCollectionId() {
  const id = appwriteConfig.correspondenceCollectionId;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_APPWRITE_CORRESPONDENCE_COLLECTION is not configured.",
    );
  }
  return id;
}

async function requireStaffUser() {
  const user = await getCurrentUser();
  if (!user || typeof user !== "object" || !("$id" in user)) {
    throw new Error("Unauthorized");
  }
  return user as { $id: string };
}

function parseChannel(v: string): CorrespondenceChannel {
  const t = v.trim();
  if (!CHANNEL_SET.has(t)) throw new Error("Invalid channel");
  return t as CorrespondenceChannel;
}

function parseStatus(v: string): CorrespondenceStatus {
  const t = v.trim();
  if (!STATUS_SET.has(t)) throw new Error("Invalid status");
  return t as CorrespondenceStatus;
}

function toIsoDateTimeOptional(
  value: string | null | undefined,
): string | null {
  if (value == null || String(value).trim() === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toIsoDateTimeRequired(value: string): string {
  const d = new Date(String(value).trim());
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d.toISOString();
}

async function generateReferenceNumber(
  databases: Awaited<ReturnType<typeof createAdminClient>>["databases"],
  collectionId: string,
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const monthlyPrefix = `DOC-${year}-${month}`;

  let nextSequence = 1;
  try {
    const latestForMonth = await databases.listDocuments(
      appwriteConfig.databaseId,
      collectionId,
      [
        Query.startsWith("referenceNumber", monthlyPrefix),
        Query.orderDesc("referenceNumber"),
        Query.limit(1),
      ],
    );
    const latestRef = String(latestForMonth.documents[0]?.referenceNumber ?? "");
    const match = latestRef.match(/^DOC-\d{4}-\d{4}(\d+)$/);
    if (match) {
      const current = Number(match[1]);
      if (Number.isFinite(current) && current > 0) {
        nextSequence = current + 1;
      }
    }
  } catch {
    // Fallback to first sequence if lookup fails.
    nextSequence = 1;
  }

  const sequencePart = String(nextSequence).padStart(2, "0");
  return `DOC-${year}-${month}${day}${sequencePart}`;
}

function mapChannelLoose(v: unknown): CorrespondenceChannel {
  const t = String(v ?? "").trim();
  if (CHANNEL_SET.has(t)) return t as CorrespondenceChannel;
  return "other";
}

function mapStatusLoose(v: unknown): CorrespondenceStatus {
  const t = String(v ?? "").trim();
  if (STATUS_SET.has(t)) return t as CorrespondenceStatus;
  return "pending";
}

function mapNotesFromRow(row: Record<string, unknown>): string | null {
  const n = row.notes;
  if (n != null && String(n).trim() !== "") return String(n);
  const legacySummary = row.summary;
  const legacyInternal = row.internalNotes;
  const parts: string[] = [];
  if (legacySummary != null && String(legacySummary).trim() !== "") {
    parts.push(String(legacySummary));
  }
  if (legacyInternal != null && String(legacyInternal).trim() !== "") {
    parts.push(String(legacyInternal));
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function sanitizeCorrespondenceObjectName(name: string): string {
  const trimmed = name.trim().slice(0, 180);
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  return safe;
}

function mapRow(row: Record<string, unknown>): CorrespondenceDoc {
  return {
    $id: String(row.$id),
    $createdAt:
      typeof row.$createdAt === "string" ? row.$createdAt : undefined,
    $updatedAt:
      typeof row.$updatedAt === "string" ? row.$updatedAt : undefined,
    referenceNumber: String(row.referenceNumber ?? ""),
    channel: mapChannelLoose(row.channel),
    subject: String(row.subject ?? ""),
    senderName: String(row.senderName ?? ""),
    senderOrganization:
      row.senderOrganization == null || row.senderOrganization === ""
        ? null
        : String(row.senderOrganization),
    receivedAt: String(row.receivedAt ?? ""),
    dueAt:
      row.dueAt == null || row.dueAt === "" ? null : String(row.dueAt),
    status: mapStatusLoose(row.status),
    answeredAt:
      row.answeredAt == null || row.answeredAt === ""
        ? null
        : String(row.answeredAt),
    notes: mapNotesFromRow(row),
    assignedToUserId:
      row.assignedToUserId == null || row.assignedToUserId === ""
        ? null
        : String(row.assignedToUserId),
    // storageFileId = Cloudflare R2 object key
    storageFileId:
      row.storageFileId == null || row.storageFileId === ""
        ? null
        : String(row.storageFileId),
    fileName:
      row.fileName == null || row.fileName === "" ? null : String(row.fileName),
    fileSize:
      typeof row.fileSize === "number"
        ? row.fileSize
        : row.fileSize == null
          ? null
          : Number(row.fileSize),
    createdByUserId: String(row.createdByUserId ?? ""),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };
}

async function uploadAttachment(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File must be 20MB or smaller");
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only PDF, JPEG, PNG, or WebP files are allowed");
  }
  if (!isCorrespondenceR2Configured()) {
    throw new Error(
      "File storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_CORRESPONDENCE_BUCKET_NAME.",
    );
  }
  const objectKey = `document-receiver/${ID.unique()}/${sanitizeCorrespondenceObjectName(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await uploadCorrespondenceToR2(objectKey, buf, file.type);
  return {
    storageFileId: objectKey,
    fileName: file.name,
    fileSize: file.size,
  };
}

async function deleteAttachment(objectKey: string | null | undefined) {
  if (!objectKey) return;
  if (!isCorrespondenceR2Configured()) return;
  try {
    await deleteCorrespondenceFromR2(objectKey);
  } catch (e) {
    console.warn("correspondence: deleteCorrespondenceFromR2", objectKey, e);
  }
}

function nextAnsweredAt(
  prevStatus: CorrespondenceStatus,
  nextStatus: CorrespondenceStatus,
  prevAnsweredAt: string | null | undefined,
): string | null {
  if (nextStatus === "answered") {
    return prevAnsweredAt ?? new Date().toISOString();
  }
  return null;
}

export async function createCorrespondence(formData: FormData) {
  try {
    const staff = await requireStaffUser();
    const { databases } = await createAdminClient();
    const collectionId = requireCollectionId();

    const subject = String(formData.get("subject") ?? "")
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.subject);
    if (!subject) return { ok: false as const, error: "Document title is required" };

    const channel = parseChannel(String(formData.get("channel") ?? ""));
    const senderName = String(formData.get("senderName") ?? "")
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.senderName);
    if (!senderName) {
      return { ok: false as const, error: "Sender name is required" };
    }

    const senderOrganization = String(
      formData.get("senderOrganization") ?? "",
    )
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.senderOrganization);
    const receivedAt = toIsoDateTimeRequired(
      String(formData.get("receivedAt") ?? ""),
    );
    const dueAt = toIsoDateTimeOptional(String(formData.get("dueAt") ?? ""));
    const status = parseStatus(String(formData.get("status") ?? "pending"));
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const notes = notesRaw
      ? notesRaw.slice(0, CORRESPONDENCE_FIELD_LIMITS.notes)
      : null;
    let referenceNumber = String(
      formData.get("referenceNumber") ?? "",
    )
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.referenceNumber);
    if (!referenceNumber) {
      referenceNumber = await generateReferenceNumber(databases, collectionId);
    }

    const assignedRaw = String(formData.get("assignedToUserId") ?? "").trim();
    const assignedToUserId = assignedRaw || null;

    const now = new Date().toISOString();
    const answeredAt = status === "answered" ? now : null;

    const file = formData.get("file");
    let storageFileId: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (file instanceof File && file.size > 0) {
      const up = await uploadAttachment(file);
      storageFileId = up.storageFileId;
      fileName = up.fileName;
      fileSize = up.fileSize;
    }

    const doc = await databases.createDocument(
      appwriteConfig.databaseId,
      collectionId,
      ID.unique(),
      {
        referenceNumber,
        channel,
        subject,
        senderName,
        senderOrganization: senderOrganization || null,
        receivedAt,
        dueAt,
        status,
        answeredAt,
        notes,
        assignedToUserId,
        storageFileId,
        fileName,
        fileSize,
        createdByUserId: staff.$id,
        updatedAt: now,
      },
    );

    return { ok: true as const, id: doc.$id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create record";
    console.error("createCorrespondence", e);
    return { ok: false as const, error: msg };
  }
}

export type ListCorrespondenceParams = {
  limit?: number;
  offset?: number;
  status?: CorrespondenceStatus | "all";
  receivedFrom?: string;
  receivedTo?: string;
  search?: string;
};

export async function listCorrespondence(params: ListCorrespondenceParams = {}) {
  await requireStaffUser();
  const { databases } = await createAdminClient();
  const collectionId = requireCollectionId();

  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const queries: string[] = [
    Query.orderDesc("receivedAt"),
    Query.limit(limit),
    Query.offset(offset),
  ];

  if (params.status && params.status !== "all") {
    queries.push(Query.equal("status", params.status));
  }

  if (params.receivedFrom?.trim()) {
    queries.push(
      Query.greaterThanEqual(
        "receivedAt",
        toIsoDateTimeRequired(params.receivedFrom.trim()),
      ),
    );
  }
  if (params.receivedTo?.trim()) {
    queries.push(
      Query.lessThanEqual(
        "receivedAt",
        toIsoDateTimeRequired(params.receivedTo.trim()),
      ),
    );
  }

  const search = params.search?.trim();
  if (search) {
    queries.push(
      Query.or([
        Query.contains("subject", search),
        Query.contains("senderName", search),
        Query.contains("referenceNumber", search),
      ]),
    );
  }

  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    queries,
  );

  const documents = res.documents.map((d) =>
    mapRow(d as unknown as Record<string, unknown>),
  );
  return parseStringify({ documents, total: res.total });
}

export async function getCorrespondenceById(id: string) {
  await requireStaffUser();
  const { databases } = await createAdminClient();
  const collectionId = requireCollectionId();
  const doc = await databases.getDocument(
    appwriteConfig.databaseId,
    collectionId,
    id,
  );
  return parseStringify(
    mapRow(doc as unknown as Record<string, unknown>),
  ) as CorrespondenceDoc;
}

export async function updateCorrespondence(id: string, formData: FormData) {
  try {
    await requireStaffUser();
    const { databases } = await createAdminClient();
    const collectionId = requireCollectionId();

    const existing = await databases.getDocument(
      appwriteConfig.databaseId,
      collectionId,
      id,
    );
    const prev = mapRow(existing as unknown as Record<string, unknown>);

    const subject = String(formData.get("subject") ?? "")
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.subject);
    if (!subject) return { ok: false as const, error: "Document title is required" };

    const channel = parseChannel(String(formData.get("channel") ?? ""));
    const senderName = String(formData.get("senderName") ?? "")
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.senderName);
    if (!senderName) {
      return { ok: false as const, error: "Sender name is required" };
    }

    const senderOrganization = String(
      formData.get("senderOrganization") ?? "",
    )
      .trim()
      .slice(0, CORRESPONDENCE_FIELD_LIMITS.senderOrganization);
    const receivedAt = toIsoDateTimeRequired(
      String(formData.get("receivedAt") ?? ""),
    );
    const dueAt = toIsoDateTimeOptional(String(formData.get("dueAt") ?? ""));
    const status = parseStatus(String(formData.get("status") ?? prev.status));
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const notes = notesRaw
      ? notesRaw.slice(0, CORRESPONDENCE_FIELD_LIMITS.notes)
      : null;
    const referenceNumber =
      String(formData.get("referenceNumber") ?? "")
        .trim()
        .slice(0, CORRESPONDENCE_FIELD_LIMITS.referenceNumber) ||
      prev.referenceNumber;

    const assignedRaw = String(formData.get("assignedToUserId") ?? "").trim();
    const assignedToUserId = assignedRaw || null;

    const now = new Date().toISOString();
    const answeredAt = nextAnsweredAt(prev.status, status, prev.answeredAt);

    const removeFile = formData.get("removeFile") === "1";
    const file = formData.get("file");

    let storageFileId = prev.storageFileId;
    let fileName = prev.fileName;
    let fileSize = prev.fileSize;

    if (removeFile) {
      await deleteAttachment(prev.storageFileId);
      storageFileId = null;
      fileName = null;
      fileSize = null;
    }

    if (file instanceof File && file.size > 0) {
      await deleteAttachment(storageFileId);
      const up = await uploadAttachment(file);
      storageFileId = up.storageFileId;
      fileName = up.fileName;
      fileSize = up.fileSize;
    }

    await databases.updateDocument(
      appwriteConfig.databaseId,
      collectionId,
      id,
      {
        referenceNumber,
        channel,
        subject,
        senderName,
        senderOrganization: senderOrganization || null,
        receivedAt,
        dueAt,
        status,
        answeredAt,
        notes,
        assignedToUserId,
        storageFileId,
        fileName,
        fileSize,
        updatedAt: now,
      },
    );

    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update record";
    console.error("updateCorrespondence", e);
    return { ok: false as const, error: msg };
  }
}

export async function archiveCorrespondence(id: string) {
  try {
    await requireStaffUser();
    const { databases } = await createAdminClient();
    const collectionId = requireCollectionId();
    const now = new Date().toISOString();
    await databases.updateDocument(
      appwriteConfig.databaseId,
      collectionId,
      id,
      {
        status: "archived",
        updatedAt: now,
      },
    );
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to archive";
    return { ok: false as const, error: msg };
  }
}

/** Removes the Appwrite document and any attachment object in R2. */
export async function deleteCorrespondence(id: string) {
  try {
    await requireStaffUser();
    const { databases } = await createAdminClient();
    const collectionId = requireCollectionId();

    let existing: unknown;
    try {
      existing = await databases.getDocument(
        appwriteConfig.databaseId,
        collectionId,
        id,
      );
    } catch {
      return { ok: false as const, error: "Record not found" };
    }

    const prev = mapRow(existing as unknown as Record<string, unknown>);
    await deleteAttachment(prev.storageFileId);

    await databases.deleteDocument(
      appwriteConfig.databaseId,
      collectionId,
      id,
    );

    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete record";
    console.error("deleteCorrespondence", e);
    return { ok: false as const, error: msg };
  }
}

export async function exportCorrespondenceCsv(
  params: Omit<ListCorrespondenceParams, "limit" | "offset"> = {},
) {
  await requireStaffUser();
  const { databases } = await createAdminClient();
  const collectionId = requireCollectionId();

  const queries: string[] = [Query.orderDesc("receivedAt"), Query.limit(5000)];

  if (params.status && params.status !== "all") {
    queries.push(Query.equal("status", params.status));
  }
  if (params.receivedFrom?.trim()) {
    queries.push(
      Query.greaterThanEqual(
        "receivedAt",
        toIsoDateTimeRequired(params.receivedFrom.trim()),
      ),
    );
  }
  if (params.receivedTo?.trim()) {
    queries.push(
      Query.lessThanEqual(
        "receivedAt",
        toIsoDateTimeRequired(params.receivedTo.trim()),
      ),
    );
  }
  const search = params.search?.trim();
  if (search) {
    queries.push(
      Query.or([
        Query.contains("subject", search),
        Query.contains("senderName", search),
        Query.contains("referenceNumber", search),
      ]),
    );
  }

  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    queries,
  );

  const rows = res.documents.map((d) =>
    mapRow(d as unknown as Record<string, unknown>),
  );

  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = [
    "referenceNumber",
    "channel",
    "subject",
    "senderName",
    "senderOrganization",
    "receivedAt",
    "dueAt",
    "status",
    "answeredAt",
    "notes",
    "hasFile",
    "overdue",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        esc(r.referenceNumber),
        esc(r.channel),
        esc(r.subject),
        esc(r.senderName),
        esc(r.senderOrganization),
        esc(r.receivedAt),
        esc(r.dueAt),
        esc(r.status),
        esc(r.answeredAt),
        esc(r.notes),
        esc(r.storageFileId ? "yes" : "no"),
        esc(isCorrespondenceOverdue(r) ? "yes" : "no"),
      ].join(","),
    ),
  ];

  return "\uFEFF" + lines.join("\r\n");
}

export async function getCorrespondenceDashboardStats() {
  await requireStaffUser();
  const { databases } = await createAdminClient();
  const collectionId = requireCollectionId();
  const now = new Date().toISOString();

  const pendingRes = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    [Query.equal("status", "pending"), Query.limit(1)],
  );

  const overdueRes = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    [
      Query.equal("status", "pending"),
      Query.isNotNull("dueAt"),
      Query.lessThan("dueAt", now),
      Query.limit(1),
    ],
  );

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

  const answeredWeekRes = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId,
    [
      Query.equal("status", "answered"),
      Query.isNotNull("answeredAt"),
      Query.greaterThanEqual("answeredAt", weekStart),
      Query.lessThanEqual("answeredAt", weekEnd),
      Query.limit(1),
    ],
  );

  return parseStringify({
    pending: pendingRes.total,
    overdue: overdueRes.total,
    answeredThisWeek: answeredWeekRes.total,
  });
}
