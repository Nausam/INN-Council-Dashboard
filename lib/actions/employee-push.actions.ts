"use server";

import { createHash } from "node:crypto";
import webpush, { WebPushError } from "web-push";

import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { requireAdmin } from "@/lib/auth/require-admin";
import { leaveReminderMessage } from "@/lib/employees/leave-reminder";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";

/**
 * Phones that turned on notifications in Employee Profile. One document per
 * phone (keyed by its push address), so a shared phone belongs to whoever
 * signed in last. Only read when HR sends a reminder.
 */
export type LeaveReminderStatus = {
  /** False until the push keys are set on the server. */
  configured: boolean;
  devices: number;
};

export type LeaveReminderResult = {
  sent: number;
  /** Phones that had turned notifications off; they are forgotten. */
  removed: number;
};

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

function subscriptionDocId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 40);
}

function parseSubscription(value: unknown): StoredSubscription | null {
  if (!value || typeof value !== "object") return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 1000 || !endpoint.startsWith("https://")) return null;
  if (typeof keys?.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

function subscriptions() {
  return getFirestoreDb().collection(COLLECTIONS.employeePushSubscriptions);
}

/** Saves this phone for the signed-in employee's notifications. */
export async function saveEmployeePushSubscription(employeeId: string, subscription: unknown): Promise<void> {
  if (getEmployeeProfileSessionId() !== employeeId) throw new Error("Sign in to Employee Profile first");
  const parsed = parseSubscription(subscription);
  if (!parsed) throw new Error("This phone sent an invalid notification address");
  await subscriptions().doc(subscriptionDocId(parsed.endpoint)).set({
    employeeId,
    ...parsed,
    updatedAt: new Date().toISOString(),
  });
}

/** Forgets a phone, on Log out. Knowing its push address is the proof. */
export async function removeEmployeePushSubscription(endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return;
  await subscriptions().doc(subscriptionDocId(endpoint)).delete();
}

/** How many phones would get a reminder, for HR's dialog. */
export async function getLeaveReminderStatus(employeeId: string): Promise<LeaveReminderStatus> {
  await requireAdmin();
  if (!pushConfigured()) return { configured: false, devices: 0 };
  const snapshot = await subscriptions().where("employeeId", "==", employeeId).select().get();
  return { configured: true, devices: snapshot.size };
}

/** Asks the employee, on their phone, to submit a leave form for `date`. */
export async function sendLeaveFormReminder(employeeId: string, date: string): Promise<LeaveReminderResult> {
  const admin = await requireAdmin();
  if (!pushConfigured()) throw new Error("Notifications are not set up on the server");
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error("Choose the day of the leave");
  }

  const snapshot = await subscriptions().where("employeeId", "==", employeeId).get();
  if (snapshot.empty) return { sent: 0, removed: 0 };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const payload = JSON.stringify({
    ...leaveReminderMessage(date),
    url: `/employees/details/${encodeURIComponent(employeeId)}?tab=requests`,
    // A second reminder for the same day replaces the first on the phone.
    tag: `leave-form-${date}`,
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    snapshot.docs.map(async (doc) => {
      const subscription = parseSubscription(doc.data());
      if (!subscription) {
        await doc.ref.delete();
        removed += 1;
        return;
      }
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 3 * 24 * 60 * 60, urgency: "normal" });
        sent += 1;
      } catch (error) {
        // 404/410: the phone turned notifications off or the app was removed.
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          await doc.ref.delete();
          removed += 1;
          return;
        }
        console.error("Leave reminder push failed", error);
      }
    }),
  );

  await getFirestoreDb().collection(COLLECTIONS.auditLogs).add({
    actorUserId: admin.id,
    action: "leave_form_reminder",
    entityType: "employee",
    entityId: employeeId,
    metaJson: JSON.stringify({ date, sent, removed }),
    createdAt: new Date().toISOString(),
  });

  return { sent, removed };
}
