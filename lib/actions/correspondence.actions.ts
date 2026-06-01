"use server";

import { getAuthProfile } from "@/lib/actions/user.actions";
import { COLLECTIONS } from "@/lib/firebase/admin";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listAllDocuments,
  listDocuments,
  newDocId,
  updateDocument,
  type WhereClause,
} from "@/lib/firebase/repository";
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

const COLLECTION = COLLECTIONS.correspondence;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CHANNEL_SET = new Set<string>(CORRESPONDENCE_CHANNELS);
const STATUS_SET = new Set<string>(CORRESPONDENCE_STATUSES);

type CorrespondenceRow = Record<string, unknown> & { $id: string };

async function requireStaffUser() {
  const profile = await getAuthProfile();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  return { id: profile.id };
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

async function generateReferenceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const monthlyPrefix = `DOC-${year}-${month}`;

  let nextSequence = 1;
  try {
    const { documents } = await listDocuments<CorrespondenceRow>(COLLECTION, {
      where: [
        ["referenceNumber", ">=", monthlyPrefix],
        ["referenceNumber", "<", `${monthlyPrefix}\uf8ff`],
      ],
      orderBy: [{ field: "referenceNumber", direction: "desc" }],
      limit: 1,
    });
    const latestRef = String(documents[0]?.referenceNumber ?? "");
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

function buildCorrespondenceFilters(params: {
  status?: CorrespondenceStatus | "all";
  receivedFrom?: string;
  receivedTo?: string;
}): { where: WhereClause[] } {
  const where: WhereClause[] = [];

  if (params.status && params.status !== "all") {
    where.push(["status", "==", params.status]);
  }

  if (params.receivedFrom?.trim()) {
    where.push([
      "receivedAt",
      ">=",
      toIsoDateTimeRequired(params.receivedFrom.trim()),
    ]);
  }
  if (params.receivedTo?.trim()) {
    where.push([
      "receivedAt",
      "<=",
      toIsoDateTimeRequired(params.receivedTo.trim()),
    ]);
  }

  return { where };
}

function filterBySearch(
  docs: CorrespondenceDoc[],
  search?: string,
): CorrespondenceDoc[] {
  const q = search?.trim().toLowerCase();
  if (!q) return docs;
  return docs.filter(
    (d) =>
      d.subject.toLowerCase().includes(q) ||
      d.senderName.toLowerCase().includes(q) ||
      d.referenceNumber.toLowerCase().includes(q),
  );
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
  const objectKey = `document-receiver/${newDocId()}/${sanitizeCorrespondenceObjectName(file.name)}`;
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
      referenceNumber = await generateReferenceNumber();
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

    const doc = await createDocument<CorrespondenceRow>(COLLECTION, {
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
      createdByUserId: staff.id,
      updatedAt: now,
    });

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

  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const { where } = buildCorrespondenceFilters(params);
  const rows = await listAllDocuments<CorrespondenceRow>(COLLECTION, {
    where,
    orderBy: [{ field: "receivedAt", direction: "desc" }],
  });

  const filtered = filterBySearch(rows.map((d) => mapRow(d)), params.search);
  const documents = filtered.slice(offset, offset + limit);

  return parseStringify({ documents, total: filtered.length });
}

export async function getCorrespondenceById(id: string) {
  await requireStaffUser();
  const doc = await getDocument<CorrespondenceRow>(COLLECTION, id);
  return parseStringify(
    mapRow(doc),
  ) as CorrespondenceDoc;
}

export async function updateCorrespondence(id: string, formData: FormData) {
  try {
    await requireStaffUser();

    const existing = await getDocument<CorrespondenceRow>(COLLECTION, id);
    const prev = mapRow(existing);

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

    await updateDocument(COLLECTION, id, {
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
    });

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
    const now = new Date().toISOString();
    await updateDocument(COLLECTION, id, {
      status: "archived",
      updatedAt: now,
    });
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to archive";
    return { ok: false as const, error: msg };
  }
}

/** Removes the record and any attachment object in R2. */
export async function deleteCorrespondence(id: string) {
  try {
    await requireStaffUser();

    let existing: CorrespondenceRow;
    try {
      existing = await getDocument<CorrespondenceRow>(COLLECTION, id);
    } catch {
      return { ok: false as const, error: "Record not found" };
    }

    const prev = mapRow(existing);
    await deleteAttachment(prev.storageFileId);

    await deleteDocument(COLLECTION, id);

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

  const { where } = buildCorrespondenceFilters(params);
  const rows = await listAllDocuments<CorrespondenceRow>(COLLECTION, {
    where,
    orderBy: [{ field: "receivedAt", direction: "desc" }],
  });

  const filtered = filterBySearch(rows.map((d) => mapRow(d)), params.search);
  const limited = filtered.slice(0, 5000);

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
    ...limited.map((r) =>
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
  const profile = await getAuthProfile();
  if (!profile) return null;

  const now = new Date().toISOString();

  const pendingDocs = await listAllDocuments<CorrespondenceRow>(COLLECTION, {
    where: [["status", "==", "pending"]],
  });

  const overdueDocs = await listAllDocuments<CorrespondenceRow>(COLLECTION, {
    where: [
      ["status", "==", "pending"],
      ["dueAt", "<", now],
    ],
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

  const answeredWeekDocs = await listAllDocuments<CorrespondenceRow>(COLLECTION, {
    where: [
      ["status", "==", "answered"],
      ["answeredAt", ">=", weekStart],
      ["answeredAt", "<=", weekEnd],
    ],
  });

  return parseStringify({
    pending: pendingDocs.length,
    overdue: overdueDocs.length,
    answeredThisWeek: answeredWeekDocs.length,
  });
}
