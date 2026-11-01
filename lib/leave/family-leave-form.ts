import "server-only";

import { readFile } from "node:fs/promises";

import type {
  AssignedLeaveAcceptor,
  AssignedLeaveSupervisor,
  FamilyLeaveRequestSummary,
} from "@/lib/actions/family-leave.actions";
import { COLLECTIONS, type getFirestoreDb } from "@/lib/firebase/admin";
import { fetchHolidayDatesBetween } from "@/lib/firebase/hr";
import { fillSalaamFamilyLeaveTemplate } from "@/lib/forms/salaam-family-leave";
import { employeeSignaturePath, leaveSupervisorSignaturePath } from "@/lib/leave/approval-signatures";
import { displayLeaveDate, nextWorkingDayAfter, templateDaysForRange } from "@/lib/leave/date-range";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import { isSalaamFamilyLeaveType } from "@/lib/leave/salaam-family-types";

/**
 * Builds the Word form for a Salaam or Family leave request with whoever is
 * assigned to it, signed by the supervisor once one is chosen and by the
 * receiving employee when their signature is on file. Kept out of the server
 * actions file so it can't be called from the browser.
 */
export async function renderFamilyLeaveForm(
  db: ReturnType<typeof getFirestoreDb>,
  request: FamilyLeaveRequestSummary,
  supervisor: AssignedLeaveSupervisor | undefined,
  acceptor: AssignedLeaveAcceptor | undefined,
) {
  if (!isSalaamFamilyLeaveType(request.leaveType)) {
    throw new Error("Leave type is missing from this form");
  }
  const requesterSnap = /^[\w-]{1,128}$/.test(request.employeeId ?? "")
    ? await db.collection(COLLECTIONS.employees).doc(request.employeeId).get()
    : null;
  const requester = requesterSnap?.data() ?? {};
  const employeeNameDv = String(request.employeeNameDv || requester.nameDv || "").trim();
  const addressDv = String(request.addressDv || requester.addressDv || "").trim();
  const designationDv = String(request.designationDv || requester.designationDv || "").trim();
  if (
    !isDhivehiText(employeeNameDv, 100) ||
    !isDhivehiText(addressDv, 150) ||
    !isDhivehiText(designationDv, 100)
  ) {
    throw new Error("Complete the employee's Dhivehi details before assigning the form");
  }
  const dateParts = request.requestDate.split("-");
  if (dateParts.length !== 3) throw new Error("Leave form date is invalid");
  const templateDays = request.leaveStartDate && request.leaveEndDate
    ? templateDaysForRange(request.leaveStartDate, request.leaveEndDate, request.reportedTime, request.reason)
    : null;
  const signaturePath = supervisor ? leaveSupervisorSignaturePath(supervisor.employeeId) : null;
  if (supervisor && !signaturePath) throw new Error(`No signature on file for ${supervisor.name}`);
  const signaturePng = signaturePath ? new Uint8Array(await readFile(signaturePath)) : undefined;
  const receiverSignaturePath = acceptor ? employeeSignaturePath(acceptor.name) : null;
  const receiverSignaturePng = receiverSignaturePath ? new Uint8Array(await readFile(receiverSignaturePath)) : undefined;
  const document = await fillSalaamFamilyLeaveTemplate({
    leaveType: request.leaveType,
    date: templateDays ? templateDays.date : `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`,
    time: request.reportedTime,
    reason: request.reason,
    secondDay: templateDays ? templateDays.secondDay : (request.secondDay
      ? { ...request.secondDay, date: displayLeaveDate(request.secondDay.date) }
      : undefined),
    additionalDetails: templateDays ? templateDays.additionalDetails : (request.additionalDetails
      ? { ...request.additionalDetails, date: displayLeaveDate(request.additionalDetails.date) }
      : undefined),
    employeeNameDv,
    addressDv,
    designationDv,
    supervisor: supervisor && { ...supervisor, signaturePng },
    acceptor: acceptor && { ...acceptor, signaturePng: receiverSignaturePng },
  });
  return { document, employeeNameDv, addressDv, designationDv };
}

/**
 * The date the office receives the form, as printed on it: the first working
 * day after the leave ends, when the employee is back at work.
 */
export async function formReceivedDate(request: FamilyLeaveRequestSummary): Promise<string> {
  // Forms from before the date-range picker end on their second day, if any.
  const endDate = String(
    request.leaveEndDate || request.secondDay?.date || request.leaveStartDate || request.requestDate,
  ).slice(0, 10);
  const lookAhead = new Date(`${endDate}T00:00:00Z`);
  lookAhead.setUTCDate(lookAhead.getUTCDate() + 31);
  const holidays = new Set(await fetchHolidayDatesBetween(endDate, lookAhead.toISOString().slice(0, 10)));
  return displayLeaveDate(nextWorkingDayAfter(endDate, holidays));
}
