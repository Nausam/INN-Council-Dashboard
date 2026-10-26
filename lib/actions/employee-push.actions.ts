"use server";

import { createHash } from "node:crypto";
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

/** Sends one reminder covering `dates` to each of the employee's phones. */
async function pushLeaveReminder(
  employeeId: string,
  dates: string[],
  phones: FirebaseFirestore.QueryDocumentSnapshot[],
): Promise<{ sent: number; removed: number }> {
  const payload = JSON.stringify({
    ...leaveReminderMessage(dates),
    url: `/employees/details/${encodeURIComponent(employeeId)}?tab=requests`,
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
 * Asks the employee, on their phone, to submit every leave form still missing
 * from the last REMINDER_DAYS, worked out again here.
 */
export async function sendLeaveFormReminder(employeeId: string): Promise<LeaveReminderResult> {
  const admin = await requireAdmin();
  // Returned, not thrown: production builds hide thrown messages from the page.
  if (!pushConfigured()) return { sent: 0, removed: 0, blockedReason: "Notifications aren't set up on the server yet." };
  const [dates, snapshot] = await Promise.all([
    employeeMissingDates(employeeId),
    subscriptions().where("employeeId", "==", employeeId).get(),
  ]);
  if (!dates.length) return { sent: 0, removed: 0, blockedReason: "No leave forms are missing any more." };
  if (snapshot.empty) return { sent: 0, removed: 0 };

  setVapidDetails();
  const result = await pushLeaveReminder(employeeId, dates, snapshot.docs);
  await auditReminder(admin.id, employeeId, { dates, ...result });
  return result;
}

export type MissingLeaveFormRow = MissingLeaveFormEmployee & {
  /** Has a phone with alerts on; otherwise HR asks them in person. */
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
  /** Employees whose phones got the reminder. */
  reminded: string[];
  /** Employees with missing forms but no phone to reach; HR asks them in person. */
  unreachable: string[];
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
  if (!pushConfigured()) return { reminded: [], unreachable: [], error: "Notifications aren't set up on the server yet." };
  let missing: MissingLeaveFormEmployee[];
  try {
    missing = await findMissingLeaveForms(start, end);
  } catch (error) {
    return { reminded: [], unreachable: [], error: error instanceof Error ? error.message : "Couldn't load the list." };
  }
  const wanted = employeeIds ? new Set(employeeIds) : null;
  const targets = missing.filter((row) => !wanted || wanted.has(row.employeeId));
  const phones = await phonesByEmployee();

  setVapidDetails();
  const reminded: string[] = [];
  const unreachable: string[] = [];
  await Promise.all(
    targets.map(async (row) => {
      const employeePhones = phones.get(row.employeeId) ?? [];
      const result = employeePhones.length
        ? await pushLeaveReminder(row.employeeId, row.dates, employeePhones)
        : { sent: 0, removed: 0 };
      if (result.sent > 0) {
        reminded.push(row.employeeId);
        await auditReminder(admin.id, row.employeeId, { dates: row.dates, ...result });
      } else {
        unreachable.push(row.employeeId);
      }
    }),
  );
  return { reminded, unreachable };
}
