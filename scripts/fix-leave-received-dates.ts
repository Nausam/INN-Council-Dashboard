import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Sets the "received" date and time on every Salaam and Family leave form that
 * has a receiving employee: the first working day after the leave ends, at a
 * random time from 08:00 to 08:50 (as forms now get when one is assigned), and
 * rebuilds the Word form to match. A time already in that range is kept, so it
 * is safe to re-run. Dry run by default; pass --apply to write.
 * Run with: npx tsx --conditions=react-server <this file>
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const { formReceivedDate, renderFamilyLeaveForm } = await import("../lib/leave/family-leave-form");
  const { isReceivedTimeInRange, randomReceivedTime } = await import("../lib/leave/reported-time");
  type Summary = import("../lib/actions/family-leave.actions").FamilyLeaveRequestSummary;

  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.familyLeaveRequests).orderBy("submittedAt", "asc").get();

  let changed = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    const request = { ...(doc.data() as Omit<Summary, "id">), id: doc.id };
    if (!request.acceptor) continue;
    const acceptor = {
      ...request.acceptor,
      acceptedDate: await formReceivedDate(request),
      acceptedTime: isReceivedTimeInRange(request.acceptor.acceptedTime)
        ? request.acceptor.acceptedTime
        : randomReceivedTime(),
    };
    const head = `${request.leaveEndDate || request.requestDate}  ${request.employeeName}`;
    const change = `${request.acceptor.acceptedDate} ${request.acceptor.acceptedTime} → ${acceptor.acceptedDate} ${acceptor.acceptedTime}`;
    const note = `received by ${request.acceptor.name} (${request.acceptor.designationDv})`;

    let document: Buffer;
    try {
      ({ document } = await renderFamilyLeaveForm(db, request, request.supervisor, acceptor));
    } catch (error) {
      console.log(`FAIL   ${head}  (${error instanceof Error ? error.message : error})`);
      failed++;
      continue;
    }
    console.log(`DATE   ${head}  ${change}  ${note}`);
    changed++;
    if (!apply) continue;

    try {
      const batch = db.batch();
      batch.update(doc.ref, { acceptor });
      batch.set(db.collection(COLLECTIONS.familyLeaveDocuments).doc(doc.id), {
        dataBase64: document.toString("base64"),
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      await batch.commit();
    } catch (error) {
      console.log(`         FAILED: ${error instanceof Error ? error.message : error}`);
      changed--;
      failed++;
    }
  }

  console.log(`\n${snap.size} forms: ${changed} ${apply ? "updated" : "to update"}, ${failed} failed.`);
  if (!apply) console.log("Dry run only. Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
