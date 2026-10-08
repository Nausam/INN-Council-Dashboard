import { EMPLOYEE_PROFILE_HOME } from "@/lib/employee-profile-pwa";

/**
 * The installed app keeps one copy of the signed-in employee's profile page
 * on the phone, so it opens instantly and then refreshes. public/sw.js serves
 * it and uses the same names; Log out deletes it.
 */
const PROFILE_CACHE = "employee-profile-pages-v1";
const PROFILE_OWNER_KEY = "/__employee-profile/owner";

function deviceCacheAvailable(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "caches" in window && "serviceWorker" in navigator;
}

function isCacheablePage(response: Response): boolean {
  return response.ok && !response.redirected && (response.headers.get("content-type") ?? "").includes("text/html");
}

/** Saves this employee's profile for the next launch, replacing anyone else's. */
export async function rememberEmployeeProfile(employeeId: string): Promise<void> {
  if (!deviceCacheAvailable()) return;
  try {
    const cache = await caches.open(PROFILE_CACHE);
    const owner = await cache.match(PROFILE_OWNER_KEY).then((response) => response?.json()).catch(() => null);
    if (owner?.employeeId !== employeeId) {
      await Promise.all((await cache.keys()).map((request) => cache.delete(request)));
      await cache.put(
        PROFILE_OWNER_KEY,
        new Response(JSON.stringify({ employeeId }), { headers: { "content-type": "application/json" } }),
      );
    }
    // The service worker keeps the copy fresh on each launch; this saves the first one.
    const path = `${EMPLOYEE_PROFILE_HOME}/${employeeId}`;
    if (!(await cache.match(path))) {
      const response = await fetch(path, { credentials: "same-origin" });
      if (isCacheablePage(response)) await cache.put(path, response);
    }
  } catch {
    // Without storage the app still works; it just loads from the server.
  }
}

/** Removes the saved profile and photo from this phone. */
export async function forgetEmployeeProfileDevice(): Promise<void> {
  if (!deviceCacheAvailable()) return;
  try {
    await caches.delete(PROFILE_CACHE);
  } catch {
    // Nothing saved, or storage is unavailable.
  }
}

/** Whether the service worker just opened this page from the saved copy. */
export function wasServedFromDeviceCache(): Promise<boolean> {
  const controller = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (!controller) return Promise.resolve(false);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(false), 1500);
    channel.port1.onmessage = (event: MessageEvent<{ servedFromCache?: boolean }>) => {
      window.clearTimeout(timer);
      resolve(event.data?.servedFromCache === true);
    };
    controller.postMessage(
      { type: "employee-profile:served-from-cache", path: window.location.pathname },
      [channel.port2],
    );
  });
}
