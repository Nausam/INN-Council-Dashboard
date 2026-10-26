"use server";

import { createHash, randomUUID } from "node:crypto";
import webpush, { WebPushError } from "web-push";

import { getEmployeeProfileSessionId } from "@/lib/auth/employee-profile-session";
import { requireAdmin } from "@/lib/auth/require-admin";
import { leaveReminderMessage } from "@/lib/employees/leave-reminder";
import {
  findMissingLeaveForms,
  recentRange,
  type MissingLeaveFormEmployee,
} from "@/lib/employees/leave-reminder-check";
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
  /** Days in the last REMINDER_DAYS still needing a leave form, oldest first. */
  dates: string[];
};

export type LeaveReminderResult = {
  sent: number;
  /** Phones that had turned notifications off; they are forgotten. */
  removed: number;
  /** Why nothing was sent, such as no forms being missing any more. */
  blockedReason?: string;
};

/** How far back the reminder on an employee's profile looks for missing forms. */
const REMINDER_DAYS = 30;

async function employeeMissingDates(employeeId: string): Promise<string[]> {
  const { start, end } = recentRange(REMINDER_DAYS);
  return (await findMissingLeaveForms(start, end, employeeId))[0]?.dates ?? [];
}

type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

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

/** A reminder HR sent, as the employee sees it in Employee Profile. */
export type EmployeeNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  sentAt: string;
};

export type MyNotifications = {
  /** Days in the last REMINDER_DAYS still needing a leave form, oldest first. */
  missing: string[];
  /** HR's reminders, newest first. */
  items: EmployeeNotification[];
  /** Reminders sent since the employee last opened the bell. */
  unread: number;
};

/** How many of HR's reminders each employee keeps. */
const INBOX_LIMIT = 30;

/** One document per employee holding their latest reminders, so the bell costs one read. */
function inbox(employeeId: string) {
  return getFirestoreDb().collection(COLLECTIONS.employeeNotifications).doc(employeeId);
}

function inboxItems(value: unknown): EmployeeNotification[] {
  return Array.isArray(value)
    ? value.filter((item): item is EmployeeNotification =>
        Boolean(item) && typeof item.id === "string" && typeof item.sentAt === "string")
    : [];
}

/** The signed-in employee's missing leave forms and HR's reminders, for the bell in Employee Profile. */
export async function getMyNotifications(employeeId: string): Promise<MyNotifications> {
  if (getEmployeeProfileSessionId() !== employeeId) return { missing: [], items: [], unread: 0 };
  const [missing, snap] = await Promise.all([employeeMissingDates(employeeId), inbox(employeeId).get()]);
  const items = inboxItems(snap.get("items"));
  const readAt = typeof snap.get("readAt") === "string" ? (snap.get("readAt") as string) : "";
  return { missing, items, unread: items.filter((item) => item.sentAt > readAt).length };
}

/** Clears the bell's unread count once the employee has seen their reminders. */
export async function markMyNotificationsRead(employeeId: string): Promise<void> {
  if (getEmployeeProfileSessionId() !== employeeId) return;
  await inbox(employeeId).set({ readAt: new Date().toISOString() }, { merge: true });
}

/** The employee's missing forms and how many phones would get a reminder, for HR's dialog. */
export async function getLeaveReminderStatus(employeeId: string): Promise<LeaveReminderStatus> {
  await requireAdmin();
  const [dates, phones] = await Promise.all([
    employeeMissingDates(employeeId),
    pushConfigured() ? subscriptions().where("employeeId", "==", employeeId).select().get() : null,
  ]);
  return { configured: Boolean(phones), devices: phones?.size ?? 0, dates };
}

function setVapidDetails(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Sends one reminder covering `dates`: saved to the employee's notifications in
 * Employee Profile, and pushed to each phone that has alerts on.
 */
async function deliverLeaveReminder(
  employeeId: string,
  dates: string[],
  phones: FirebaseFirestore.QueryDocumentSnapshot[],
): Promise<{ sent: number; removed: number }> {
  const item: EmployeeNotification = {
    id: randomUUID(),
    ...leaveReminderMessage(dates),
    url: `/employees/details/${encodeURIComponent(employeeId)}?tab=requests`,
    sentAt: new Date().toISOString(),
  };
  const ref = inbox(employeeId);
  await getFirestoreDb().runTransaction(async (tx) => {
    const items = inboxItems((await tx.get(ref)).get("items"));
    tx.set(ref, { employeeId, items: [item, ...items].slice(0, INBOX_LIMIT) }, { merge: true });
  });
  if (!phones.length || !pushConfigured()) return { sent: 0, removed: 0 };

  setVapidDetails();
  const payload = JSON.stringify({
    title: item.title,
    body: item.body,
    url: item.url,
    // A second reminder for the same days replaces the first on the phone.
    tag: `leave-form-${dates.join("_")}`,
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    phones.map(async (doc) => {
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
  return { sent, removed };
}

async function auditReminder(actorUserId: string, employeeId: string, meta: Record<string, unknown>): Promise<void> {
  await getFirestoreDb().collection(COLLECTIONS.auditLogs).add({
    actorUserId,
    action: "leave_form_reminder",
    entityType: "employee",
    entityId: employeeId,
    metaJson: JSON.stringify(meta),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Asks the employee to submit every leave form still missing from the last
 * REMINDER_DAYS, worked out again here. It always reaches their notifications
 * in Employee Profile; `sent` counts the phones it was pushed to as well.
 */
export async function sendLeaveFormReminder(employeeId: string): Promise<LeaveReminderResult> {
  const admin = await requireAdmin();
  const [dates, snapshot] = await Promise.all([
    employeeMissingDates(employeeId),
    pushConfigured() ? subscriptions().where("employeeId", "==", employeeId).get() : null,
  ]);
  // Returned, not thrown: production builds hide thrown messages from the page.
  if (!dates.length) return { sent: 0, removed: 0, blockedReason: "No leave forms are missing any more." };

  const result = await deliverLeaveReminder(employeeId, dates, snapshot?.docs ?? []);
  await auditReminder(admin.id, employeeId, { dates, ...result });
  return result;
}

export type MissingLeaveFormRow = MissingLeaveFormEmployee & {
  /** Has a phone with alerts on; otherwise the reminder only shows in the app. */
  alertsOn: boolean;
};

export type MissingLeaveFormsList = {
  configured: boolean;
  employees: MissingLeaveFormRow[];
  error?: string;
};

/** Phones with alerts on, by employee. The collection is one small doc per phone. */
async function phonesByEmployee(): Promise<Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>> {
  const byEmployee = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  if (!pushConfigured()) return byEmployee;
  for (const doc of (await subscriptions().get()).docs) {
    const employeeId = String(doc.get("employeeId") ?? "");
    byEmployee.set(employeeId, [...(byEmployee.get(employeeId) ?? []), doc]);
  }
  return byEmployee;
}

/** Employees with absent days and no leave form between `start` and `end`. */
export async function listMissingLeaveForms(start: string, end: string): Promise<MissingLeaveFormsList> {
  await requireAdmin();
  try {
    const [missing, phones] = await Promise.all([findMissingLeaveForms(start, end), phonesByEmployee()]);
    return {
      configured: pushConfigured(),
      employees: missing.map((row) => ({ ...row, alertsOn: phones.has(row.employeeId) })),
    };
  } catch (error) {
    return { configured: pushConfigured(), employees: [], error: error instanceof Error ? error.message : "Couldn't load the list." };
  }
}

export type MissingLeaveFormsReminderResult = {
  /** Employees reminded; it's in their notifications in Employee Profile. */
  reminded: string[];
  /** Of those, the ones no phone got it for: they'll only see it in the app. */
  appOnly: string[];
  error?: string;
};

/**
 * Reminds everyone in the range (or just `employeeIds`) about their missing
 * forms, one notification each listing the days. The list is worked out again
 * here, so only days that still need a form are sent.
 */
export async function remindMissingLeaveForms(
  start: string,
  end: string,
  employeeIds: string[] | null,
): Promise<MissingLeaveFormsReminderResult> {
  const admin = await requireAdmin();
  let missing: MissingLeaveFormEmployee[];
  try {
    missing = await findMissingLeaveForms(start, end);
  } catch (error) {
    return { reminded: [], appOnly: [], error: error instanceof Error ? error.message : "Couldn't load the list." };
  }
  const wanted = employeeIds ? new Set(employeeIds) : null;
  const targets = missing.filter((row) => !wanted || wanted.has(row.employeeId));
  const phones = await phonesByEmployee();

  const reminded: string[] = [];
  const appOnly: string[] = [];
  await Promise.all(
    targets.map(async (row) => {
      const result = await deliverLeaveReminder(row.employeeId, row.dates, phones.get(row.employeeId) ?? []);
      reminded.push(row.employeeId);
      if (result.sent === 0) appOnly.push(row.employeeId);
      await auditReminder(admin.id, row.employeeId, { dates: row.dates, ...result });
    }),
  );
  return { reminded, appOnly };
}
