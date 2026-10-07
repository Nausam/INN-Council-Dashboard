"use server";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
  clearPendingEmployeeProfileId,
  clearEmployeeProfileIdentity,
  clearEmployeeProfileSession,
  getEmployeeProfileIdentityId,
  getPendingEmployeeProfileId,
  setEmployeeProfileSession,
  setEmployeeProfileIdentity,
  setPendingEmployeeProfileId,
} from "@/lib/auth/employee-profile-session";
import { COLLECTIONS, getFirestoreDb } from "@/lib/firebase/admin";
import { fetchAllEmployees } from "@/lib/firebase/hr";

const PIN_PATTERN = /^\d{4}$/;
const MAX_ATTEMPTS_BEFORE_LOCK = 5;
const INITIAL_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

type EmployeePinRecord = {
  pinSalt: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: number;
  createdAt: number;
  updatedAt: number;
};

function normalizeIdentifier(value: string): string {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

function pinHash(pin: string, salt: string): string {
  // The server secret acts as a pepper. A leaked Firestore document alone cannot
  // be used to brute force the 10,000 possible PINs offline.
  const secret = process.env.EMPLOYEE_PROFILE_SESSION_SECRET || process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Employee Profile sign-in is not configured.");
  return scryptSync(`${pin}\0${secret}`, Buffer.from(salt, "hex"), 64).toString("hex");
}

function matchesPin(pin: string, record: EmployeePinRecord): boolean {
  if (!/^[a-f0-9]{32}$/.test(record.pinSalt) || !/^[a-f0-9]{128}$/.test(record.pinHash)) {
    throw new Error("PIN sign-in is unavailable. Contact your administrator.");
  }
  const expected = Buffer.from(record.pinHash, "hex");
  const received = Buffer.from(pinHash(pin, record.pinSalt), "hex");
  return timingSafeEqual(expected, received);
}

function pendingEmployeeId(): string {
  const employeeId = getPendingEmployeeProfileId();
  if (!employeeId) throw new Error("This sign-in has expired. Enter your ID or record card number again.");
  return employeeId;
}

export async function currentEmployeeProfileIdentity(): Promise<string | null> {
  return getEmployeeProfileIdentityId();
}

/**
 * No longer locks anything: employees stay signed in until Log out. Kept so
 * installed apps still running the previous build, which call this when they
 * come back to the foreground, don't crash on a missing server action.
 */
export async function lockEmployeeProfile(): Promise<void> {}

export async function forgetEmployeeProfileIdentity(): Promise<void> {
  clearEmployeeProfileSession();
  clearPendingEmployeeProfileId();
  clearEmployeeProfileIdentity();
}

export async function beginEmployeeProfileSignIn(
  identifier: string,
): Promise<{ requiresSetup: boolean }> {
  const lookup = normalizeIdentifier(String(identifier ?? "").trim());
  if (!/^[a-z0-9/]{1,64}$/.test(lookup)) {
    throw new Error("Enter a valid ID or record card number.");
  }

  const employees = await fetchAllEmployees();
  const matches = employees.filter((row) => {
    const fields = row as typeof row & Record<string, unknown>;
    return [
      row.recordCardNumber,
      fields.idCard,
      fields.idCardNumber,
      fields.nationalId,
      fields.nationalIdCard,
      fields.identityCardNumber,
    ].some((value) => typeof value === "string" && normalizeIdentifier(value) === lookup);
  });
  if (matches.length === 0) throw new Error("No matching employee found.");
  if (matches.length > 1) throw new Error("More than one employee has this number. Contact your administrator.");

  const employeeId = matches[0].$id;
  const pinDoc = await getFirestoreDb()
    .collection(COLLECTIONS.employeeProfileAuth)
    .doc(employeeId)
    .get();
  setPendingEmployeeProfileId(employeeId);
  return { requiresSetup: !pinDoc.exists };
}

export async function completeEmployeeProfilePinSetup(
  pin: string,
  confirmation: string,
): Promise<string> {
  const employeeId = pendingEmployeeId();
  if (!PIN_PATTERN.test(pin)) throw new Error("Enter a four-digit PIN.");
  if (pin !== confirmation) throw new Error("The PINs do not match.");

  const now = Date.now();
  const salt = randomBytes(16).toString("hex");
  const record: EmployeePinRecord = {
    pinSalt: salt,
    pinHash: pinHash(pin, salt),
    failedAttempts: 0,
    lockedUntil: 0,
    createdAt: now,
    updatedAt: now,
  };
  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.employeeProfileAuth).doc(employeeId);
  const created = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return false;
    transaction.create(ref, record);
    return true;
  });
  if (!created) throw new Error("A PIN has already been set for this employee. Sign in with that PIN.");

  clearPendingEmployeeProfileId();
  setEmployeeProfileIdentity(employeeId);
  setEmployeeProfileSession(employeeId);
  return employeeId;
}

export async function signInEmployeeProfileWithPin(pin: string): Promise<string> {
  const employeeId = getPendingEmployeeProfileId() || getEmployeeProfileIdentityId();
  if (!employeeId) throw new Error("Enter your ID or record card number again.");
  if (!PIN_PATTERN.test(pin)) throw new Error("Enter your four-digit PIN.");

  const db = getFirestoreDb();
  const ref = db.collection(COLLECTIONS.employeeProfileAuth).doc(employeeId);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return "setup-required" as const;
    const record = snapshot.data() as EmployeePinRecord;
    const now = Date.now();
    if (Number(record.lockedUntil) > now) return "locked" as const;

    if (!matchesPin(pin, record)) {
      const failures = (Number(record.failedAttempts) || 0) + 1;
      const lockLevel = Math.floor((failures - MAX_ATTEMPTS_BEFORE_LOCK) / MAX_ATTEMPTS_BEFORE_LOCK);
      const lockDuration = failures >= MAX_ATTEMPTS_BEFORE_LOCK
        ? Math.min(INITIAL_LOCK_MS * 2 ** Math.max(0, lockLevel), MAX_LOCK_MS)
        : 0;
      transaction.update(ref, {
        failedAttempts: failures,
        lockedUntil: lockDuration ? now + lockDuration : 0,
        updatedAt: now,
      });
      return lockDuration ? "locked" as const : "incorrect" as const;
    }

    transaction.update(ref, { failedAttempts: 0, lockedUntil: 0, updatedAt: now });
    return "success" as const;
  });

  if (result === "setup-required") throw new Error("No PIN has been set. Enter your number again to set one.");
  if (result === "locked") throw new Error("Too many incorrect PIN attempts. Try again later.");
  if (result === "incorrect") throw new Error("Incorrect PIN. Try again.");

  clearPendingEmployeeProfileId();
  setEmployeeProfileIdentity(employeeId);
  setEmployeeProfileSession(employeeId);
  return employeeId;
}
