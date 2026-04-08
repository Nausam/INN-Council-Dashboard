/**
 * Document receiver registry — Appwrite collection (main HR database).
 * Enum keys (`letter`, `mail`, …) are stored in DB; use CHANNEL_LABELS in the UI.
 *
 * Attachments: Cloudflare R2 (`storageFileId` = object key, often `document-receiver/...`).
 */

export const CORRESPONDENCE_CHANNELS = [
  "letter",
  "mail",
  "email",
  "courier",
  "other",
] as const;

export const CORRESPONDENCE_STATUSES = [
  "pending",
  "answered",
  "no_response_required",
  "archived",
] as const;

export type CorrespondenceChannel = (typeof CORRESPONDENCE_CHANNELS)[number];
export type CorrespondenceStatus = (typeof CORRESPONDENCE_STATUSES)[number];

/** Appwrite enum values are fixed; labels match “document receiver” wording in the UI. */
export const CHANNEL_LABELS: Record<CorrespondenceChannel, string> = {
  letter: "In person / physical handover",
  mail: "Email",
  email: "gems",
  courier: "Courier / delivery",
  other: "Other",
};

/** Matches Appwrite string attribute sizes in `scripts/create-correspondence-collection.ts`. */
export const CORRESPONDENCE_FIELD_LIMITS = {
  referenceNumber: 64,
  subject: 384,
  senderName: 128,
  senderOrganization: 256,
  notes: 4096,
} as const;

export const STATUS_LABELS: Record<CorrespondenceStatus, string> = {
  pending: "Pending",
  answered: "Answered",
  no_response_required: "No response required",
  archived: "Archived",
};

export type CorrespondenceDoc = {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  referenceNumber: string;
  channel: CorrespondenceChannel;
  subject: string;
  senderName: string;
  senderOrganization?: string | null;
  receivedAt: string;
  dueAt?: string | null;
  status: CorrespondenceStatus;
  answeredAt?: string | null;
  /** Combined summary + internal notes (keeps attribute count low for Appwrite limits). */
  notes?: string | null;
  assignedToUserId?: string | null;
  /** Cloudflare R2 object key, e.g. document-receiver/{uniqueId}/scan.pdf */
  storageFileId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  createdByUserId: string;
  updatedAt: string;
};
