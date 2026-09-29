import path from "node:path";
import { LEAVE_SUPERVISORS } from "@/lib/leave/supervisors";

const FILES: Record<(typeof LEAVE_SUPERVISORS)[number]["key"], string> = {
  imran: "imran-shareef.png",
  shazuly: "aminath-shazuly.png",
  haleem: "ibrahim-haleem.png",
  areef: "hussain-areef.png",
};

export function annualApproverSignaturePath(employeeId: string): string | null {
  const supervisor = LEAVE_SUPERVISORS.find((item) => item.employeeId === employeeId);
  return supervisor ? path.join(process.cwd(), "assets", "signatures", FILES[supervisor.key]) : null;
}
