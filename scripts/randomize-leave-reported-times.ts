import dotenv from "dotenv";
import { writeFileSync } from "node:fs";

dotenv.config({ path: ".env.local", override: true });

/**
 * Gives every Salaam and Family leave form a reported time between 08:00 and
 * 08:55 (as new forms now get) and rebuilds its Word form to match. Forms that
 * already have a time in that range are left alone, so it is safe to re-run.
 * Dry run by default; pass --apply to write, which also saves the old times to
 * a backup file. Run with: npx tsx --conditions=react-server <this file>
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const { renderFamilyLeaveForm } = await import("../lib/leave/family-leave-form");
  const { isReportedTimeInRange, randomReportedTime } = await import("../lib/leave/reported-time");
  type Summary = import("../lib/actions/family-leave.actions").FamilyLeaveRequestSummary;

  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.familyLeaveRequests).orderBy("submittedAt", "asc").get();

  const backup: Array<Pick<Summary, "id" | "reportedTime" | "secondDay" | "additionalDetails">> = [];
  let changed = 0;
  let skipped = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    const request = { ...(doc.data() as Omit<Summary, "id">), id: doc.id };
    // Older forms also carry a reported time for their second and later days.
    const stale = [request.reportedTime, request.secondDay?.time, request.additionalDetails?.time]
      .filter((time) => time !== undefined)
      .some((time) => !isReportedTimeInRange(time));
    if (!stale) continue;

    const fix = (time: string) => (isReportedTimeInRange(time) ? time : randomReportedTime());
    const updated: Summary = {
      ...request,
      reportedTime: fix(request.reportedTime),
      ...(request.secondDay ? { secondDay: { ...request.secondDay, time: fix(request.secondDay.time) } } : {}),
      ...(request.additionalDetails
        ? { additionalDetails: { ...request.additionalDetails, time: fix(request.additionalDetails.time) } }
        : {}),
    };
    const head = `${request.requestDate}  ${(request.approvalStatus || "Pending").padEnd(8)}  ${request.employeeName}`;
    const times = [
      `${request.reportedTime} → ${updated.reportedTime}`,
      updated.secondDay ? `day 2 ${request.secondDay?.time} → ${updated.secondDay.time}` : null,
      updated.additionalDetails ? `more days ${request.additionalDetails?.time} → ${updated.additionalDetails.time}` : null,
    ].filter(Boolean).join(", ");

    let document: Buffer;
    try {
      ({ document } = await renderFamilyLeaveForm(db, updated, updated.supervisor, updated.acceptor));
    } catch (error) {
      console.log(`SKIP   ${head}  (${error instanceof Error ? error.message : error})`);
      skipped++;
      continue;
    }
    console.log(`TIME   ${head}  ${times}`);
    changed++;
    if (!apply) continue;

    try {
      const batch = db.batch();
      batch.update(doc.ref, {
        reportedTime: updated.reportedTime,
        ...(updated.secondDay ? { secondDay: updated.secondDay } : {}),
        ...(updated.additionalDetails ? { additionalDetails: updated.additionalDetails } : {}),
      });
      batch.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(doc.id), {
        dataBase64: document.toString("base64"),
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      await batch.commit();
      backup.push({
        id: doc.id,
        reportedTime: request.reportedTime,
        ...(request.secondDay ? { secondDay: request.secondDay } : {}),
        ...(request.additionalDetails ? { additionalDetails: request.additionalDetails } : {}),
      });
    } catch (error) {
      console.log(`         FAILED: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log(`\n${snap.size} forms, ${changed} to change, ${skipped} skipped.`);
  if (apply) {
    const file = `leave-reported-times-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`Changed ${changed - failed}, ${failed} failed. Old times saved to ${file}.`);
  } else {
    console.log("Dry run only. Re-run with --apply to write these changes.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
