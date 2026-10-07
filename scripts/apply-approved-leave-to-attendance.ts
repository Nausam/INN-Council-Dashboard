import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Marks attendance and deducts balances for leave requests that were approved
 * before approvals did this automatically. Dry run by default; pass --apply
 * to write. Run with: npx tsx --conditions=react-server <this file>
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const { findAnnualLeaveEmployee } = await import("../lib/leave/annual-employee");
  const { ATTENDANCE_LEAVE_TYPE, isSalaamFamilyLeaveType } = await import(
    "../lib/leave/salaam-family-types"
  );
  const { applyApprovedLeaveToAttendance, planApprovedLeave } = await import(
    "../lib/leave/approved-leave-attendance"
  );
  const { LEAVE_TOTAL_ALLOWANCE } = await import("../lib/employees/leave-usage");

  type Pending = {
    collection: string;
    requestId: string;
    label: string;
    employeeId: string | null;
    leaveType: string | null;
    startDate: string;
    endDate: string;
  };

  const db = getFirestoreDb();
  const [annualSnap, familySnap] = await Promise.all([
    db.collection(COLLECTIONS.annualLeaveRequests).where("approvalStatus", "==", "Approved").get(),
    db.collection(COLLECTIONS.familyLeaveRequests).where("approvalStatus", "==", "Approved").get(),
  ]);

  const pending: Pending[] = [];
  for (const doc of annualSnap.docs) {
    const request = doc.data();
    if (request.attendanceLeave) continue;
    const employee = await findAnnualLeaveEmployee(request);
    const startDate = String(request.startDate ?? "").slice(0, 10);
    pending.push({
      collection: COLLECTIONS.annualLeaveRequests,
      requestId: doc.id,
      label: `Annual  ${request.fullName ?? "?"}`,
      employeeId: employee?.$id ?? null,
      leaveType: "annualLeave",
      startDate,
      endDate: String(request.endDate || startDate).slice(0, 10),
    });
  }
  for (const doc of familySnap.docs) {
    const request = doc.data();
    if (request.attendanceLeave) continue;
    const startDate = String(request.leaveStartDate || request.requestDate || "").slice(0, 10);
    pending.push({
      collection: COLLECTIONS.familyLeaveRequests,
      requestId: doc.id,
      label: `${request.leaveType === "salaam" ? "Salaam" : "Family"}  ${request.employeeName ?? "?"}`,
      employeeId: request.employeeId || null,
      leaveType: isSalaamFamilyLeaveType(request.leaveType)
        ? ATTENDANCE_LEAVE_TYPE[request.leaveType]
        : null,
      startDate,
      endDate: String(request.leaveEndDate || request.secondDay?.date || startDate).slice(0, 10),
    });
  }
  // Oldest first, so balances run down in the order the leave was taken.
  pending.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const remaining = new Map<string, number>();
  let problems = 0;
  let applied = 0;
  for (const item of pending) {
    const head = `${item.startDate} → ${item.endDate}  ${item.label}`;
    if (!item.employeeId || !item.leaveType) {
      console.log(`SKIP   ${head}  (${!item.employeeId ? "no matching employee" : "unknown leave type"})`);
      problems++;
      continue;
    }

    const input = {
      employeeId: item.employeeId,
      leaveType: item.leaveType,
      startDate: item.startDate,
      endDate: item.endDate,
    };
    const plan = await planApprovedLeave(input);
    const notes: string[] = [];
    const signedIn = plan.datesToMark.filter((date) => {
      const row = plan.rows.get(date) as Record<string, unknown> | undefined;
      return row && ["signInTime", "fathisSignInTime", "mendhuruSignInTime", "asuruSignInTime", "maqribSignInTime", "ishaSignInTime"]
        .some((field) => Boolean(row[field]));
    });
    const otherLeave = plan.datesToMark.filter((date) => plan.rows.get(date)?.leaveType);
    if (signedIn.length) notes.push(`clears sign-in on ${signedIn.join(", ")}`);
    if (otherLeave.length) {
      notes.push(`replaces ${otherLeave.map((date) => `${plan.rows.get(date)?.leaveType} on ${date}`).join(", ")}`);
    }

    const key = `${item.employeeId}:${item.leaveType}`;
    if (!remaining.has(key)) {
      const raw = plan.employee[item.leaveType as keyof typeof plan.employee];
      remaining.set(key, typeof raw === "number" ? raw : 0);
    }
    const before = remaining.get(key)!;
    const tracked = LEAVE_TOTAL_ALLOWANCE[item.leaveType] !== undefined;
    const after = tracked ? before - plan.datesToMark.length : before + plan.datesToMark.length;
    remaining.set(key, after);
    if (plan.dates.length === 0) notes.push("no working days in range");
    if (tracked && after < 0) notes.push(`NOT ENOUGH ${item.leaveType} (has ${before})`);

    const status = plan.datesToMark.length === 0 ? "DONE " : "MARK ";
    console.log(
      `${status}  ${head}  ${item.leaveType}: ${plan.datesToMark.length}/${plan.dates.length} days, balance ${before} → ${after}` +
        (notes.length ? `\n         ! ${notes.join("; ")}` : ""),
    );
    if (notes.some((note) => note.startsWith("NOT ENOUGH") || note.startsWith("no working"))) problems++;

    if (!apply) continue;
    try {
      const attendanceLeave = await applyApprovedLeaveToAttendance(input);
      await db.collection(item.collection).doc(item.requestId).update({ attendanceLeave });
      applied++;
    } catch (error) {
      console.log(`         FAILED: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n${pending.length} approved requests not yet applied, ${problems} with problems.`);
  if (apply) console.log(`Applied ${applied}.`);
  else console.log("Dry run only. Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
