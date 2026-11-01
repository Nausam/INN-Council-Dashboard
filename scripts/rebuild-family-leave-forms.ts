import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

/**
 * Rebuilds the stored Word form of every Salaam and Family leave request that
 * has a supervisor, from the request as it is now, so older forms pick up
 * changes to how forms are built or newly added signatures. Forms
 * without a supervisor are left alone. Dry run by default; pass --apply to
 * write. Run with: npx tsx --conditions=react-server <this file>
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const { COLLECTIONS, getFirestoreDb } = await import("../lib/firebase/admin");
  const { renderFamilyLeaveForm } = await import("../lib/leave/family-leave-form");
  const { employeeSignaturePath } = await import("../lib/leave/approval-signatures");
  type Summary = import("../lib/actions/family-leave.actions").FamilyLeaveRequestSummary;

  const db = getFirestoreDb();
  const snap = await db.collection(COLLECTIONS.familyLeaveRequests).orderBy("submittedAt", "asc").get();

  let rebuilt = 0;
  let skipped = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    const request = { ...(doc.data() as Omit<Summary, "id">), id: doc.id };
    const head = `${request.requestDate}  ${(request.approvalStatus || "Pending").padEnd(8)}  ${request.employeeName}`;
    if (!request.supervisor) {
      console.log(`SKIP   ${head}  (no supervisor yet)`);
      skipped++;
      continue;
    }

    let document: Buffer;
    try {
      ({ document } = await renderFamilyLeaveForm(db, request, request.supervisor, request.acceptor));
    } catch (error) {
      console.log(`FAIL   ${head}  (${error instanceof Error ? error.message : error})`);
      failed++;
      continue;
    }
    const receiver = request.acceptor
      ? `, received by ${request.acceptor.name}${employeeSignaturePath(request.acceptor.name) ? " (signed)" : " (no signature file)"}`
      : "";
    console.log(`BUILD  ${head}  signed by ${request.supervisor.name}${receiver}`);
    rebuilt++;
    if (!apply) continue;

    try {
      await db.collection(COLLECTIONS.familyLeaveDocuments).doc(doc.id).set({
        dataBase64: document.toString("base64"),
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    } catch (error) {
      console.log(`         FAILED: ${error instanceof Error ? error.message : error}`);
      rebuilt--;
      failed++;
    }
  }

  console.log(`\n${snap.size} forms: ${rebuilt} ${apply ? "rebuilt" : "to rebuild"}, ${skipped} without a supervisor, ${failed} failed.`);
  if (!apply) console.log("Dry run only. Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
