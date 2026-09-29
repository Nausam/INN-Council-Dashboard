import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionAuthProfile } from "@/lib/auth/session-profile";
import { EMPLOYEE_PROFILE_HOME } from "@/lib/employee-profile-pwa";

const COOKIE_NAME = "employee_profile_session";
const PENDING_COOKIE_NAME = "employee_profile_pending";
const IDENTITY_COOKIE_NAME = "employee_profile_identity";
const SESSION_AGE_SECONDS = 30 * 24 * 60 * 60;
const PENDING_AGE_SECONDS = 10 * 60;
const IDENTITY_AGE_SECONDS = 365 * 24 * 60 * 60;
const EMPLOYEE_ID_PATTERN = /^[\w-]{1,128}$/;

function signingKey(): string {
  const key = process.env.EMPLOYEE_PROFILE_SESSION_SECRET || process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("Employee Profile session secret is not configured");
  return key;
}

function signature(purpose: "session" | "pending" | "identity", employeeId: string, expiresAt: number): string {
  return createHmac("sha256", signingKey())
    .update(`employee-profile:${purpose}:v1:${employeeId}:${expiresAt}`)
    .digest("hex");
}

function readSignedCookie(name: string, purpose: "session" | "pending" | "identity"): string | null {
  const value = cookies().get(name)?.value;
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [employeeId, expires, signed] = parts;
  if (!EMPLOYEE_ID_PATTERN.test(employeeId) || !/^\d+$/.test(expires) || !/^[a-f0-9]{64}$/.test(signed)) {
    return null;
  }
  const expiresAt = Number(expires);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const expected = Buffer.from(signature(purpose, employeeId, expiresAt), "hex");
  const received = Buffer.from(signed, "hex");
  return timingSafeEqual(expected, received) ? employeeId : null;
}

function setSignedCookie(
  name: string,
  purpose: "session" | "pending" | "identity",
  employeeId: string,
  ageSeconds: number,
): void {
  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) throw new Error("Invalid employee");
  const expiresAt = Date.now() + ageSeconds * 1000;
  cookies().set(name, `${employeeId}.${expiresAt}.${signature(purpose, employeeId, expiresAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ageSeconds,
  });
}

export function getEmployeeProfileSessionId(): string | null {
  return readSignedCookie(COOKIE_NAME, "session");
}

export function setEmployeeProfileSession(employeeId: string): void {
  setSignedCookie(COOKIE_NAME, "session", employeeId, SESSION_AGE_SECONDS);
}

export function clearEmployeeProfileSession(): void {
  cookies().delete(COOKIE_NAME);
}

export function getEmployeeProfileIdentityId(): string | null {
  return readSignedCookie(IDENTITY_COOKIE_NAME, "identity");
}

export function setEmployeeProfileIdentity(employeeId: string): void {
  setSignedCookie(IDENTITY_COOKIE_NAME, "identity", employeeId, IDENTITY_AGE_SECONDS);
}

export function clearEmployeeProfileIdentity(): void {
  cookies().delete(IDENTITY_COOKIE_NAME);
}

export function getPendingEmployeeProfileId(): string | null {
  return readSignedCookie(PENDING_COOKIE_NAME, "pending");
}

export function setPendingEmployeeProfileId(employeeId: string): void {
  setSignedCookie(PENDING_COOKIE_NAME, "pending", employeeId, PENDING_AGE_SECONDS);
}

export function clearPendingEmployeeProfileId(): void {
  cookies().delete(PENDING_COOKIE_NAME);
}

export async function hasEmployeeProfileAccess(employeeId: string): Promise<boolean> {
  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) return false;
  if (getEmployeeProfileSessionId() === employeeId) return true;
  return Boolean(await getSessionAuthProfile());
}

export async function requireEmployeeProfileAccess(employeeId: string): Promise<void> {
  if (!(await hasEmployeeProfileAccess(employeeId))) redirect(EMPLOYEE_PROFILE_HOME);
}
