import {
  removeEmployeePushSubscription,
  saveEmployeePushSubscription,
} from "@/lib/actions/employee-push.actions";

/**
 * Phone notifications for Employee Profile (HR's leave form reminders).
 * public/sw.js shows them; the server only learns this phone's push address
 * once the employee turns them on.
 */
const SYNCED_KEY = "employee-push-synced";

export function employeePushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

function applicationServerKey(): Uint8Array<ArrayBuffer> {
  const base64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  // getRegistration, not ready: ready never settles if the worker failed to register.
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

function readSynced(): string | null {
  try {
    return window.localStorage.getItem(SYNCED_KEY);
  } catch {
    return null;
  }
}

function writeSynced(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(SYNCED_KEY, value);
    else window.localStorage.removeItem(SYNCED_KEY);
  } catch {
    // Without storage the phone is just saved again next time.
  }
}

async function save(employeeId: string, subscription: PushSubscription): Promise<void> {
  const marker = `${employeeId} ${subscription.endpoint}`;
  if (readSynced() === marker) return;
  await saveEmployeePushSubscription(employeeId, subscription.toJSON());
  writeSynced(marker);
}

/** Whether this phone already gets notifications (for anyone). */
export async function employeePushEnabled(): Promise<boolean> {
  if (!employeePushSupported() || Notification.permission !== "granted") return false;
  return Boolean(await currentSubscription());
}

/**
 * Asks permission and saves this phone for `employeeId`. Must run from a tap:
 * phones only show the permission prompt then.
 */
export async function enableEmployeePush(employeeId: string): Promise<NotificationPermission> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(),
    }));
  await save(employeeId, subscription);
  return permission;
}

/**
 * Re-saves the phone when its push address changed or someone else signed in
 * on it. Costs nothing on an unchanged phone.
 */
export async function syncEmployeePush(employeeId: string): Promise<void> {
  if (!employeePushSupported() || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await save(employeeId, subscription);
}

/** On Log out: this phone stops getting the employee's notifications. */
export async function disableEmployeePush(): Promise<void> {
  if (!employeePushSupported()) return;
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    await removeEmployeePushSubscription(endpoint);
  } catch {
    // Unsubscribed phones are dropped the next time HR sends anyway.
  } finally {
    writeSynced(null);
  }
}
