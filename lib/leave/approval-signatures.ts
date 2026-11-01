import { existsSync } from "node:fs";
import path from "node:path";
import { LEAVE_SUPERVISORS } from "@/lib/leave/supervisors";

const SIGNATURES_DIR = path.join(process.cwd(), "assets", "signatures");

const FILES: Record<(typeof LEAVE_SUPERVISORS)[number]["key"], string> = {
  imran: "imran-shareef.png",
  shazuly: "aminath-shazuly.png",
  haleem: "ibrahim-haleem.png",
  areef: "hussain-areef.png",
};

/** The signature image of a leave supervisor, by their employee id. */
export function leaveSupervisorSignaturePath(employeeId: string): string | null {
  const supervisor = LEAVE_SUPERVISORS.find((item) => item.employeeId === employeeId);
  return supervisor ? path.join(SIGNATURES_DIR, FILES[supervisor.key]) : null;
}

export const annualApproverSignaturePath = leaveSupervisorSignaturePath;

/**
 * Any employee's signature, saved as `assets/signatures/<name>.png` with their
 * English name in lower case and hyphens (Hussain Nausam → hussain-nausam.png).
 * Null when no file has been added for them.
 */
export function employeeSignaturePath(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return null;
  const file = path.join(SIGNATURES_DIR, `${slug}.png`);
  return existsSync(file) ? file : null;
}
