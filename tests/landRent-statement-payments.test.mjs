import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const testRequire = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Exercise the real actions and hook against an isolated repository, without
// connecting to Firestore or modifying any real lease/payment records.
function loadTypeScript(relativePath, imports = {}) {
  const filename = path.resolve(testDirectory, "..", relativePath);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const compiledModule = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    if (name.startsWith("@/")) {
      const relative = name.slice(2);
      const extension = fs.existsSync(path.resolve(testDirectory, "..", `${relative}.ts`)) ? ".ts" : ".tsx";
      return loadTypeScript(`${relative}${extension}`, imports);
    }
    return testRequire(name);
  };
  vm.runInThisContext(`(function(require, module, exports) {${code}\n})`, { filename })(
    localRequire, compiledModule, compiledModule.exports,
  );
  return compiledModule.exports;
}

function fixture({ requireAdmin = async () => ({}) } = {}) {
  const COLLECTIONS = Object.fromEntries(
    ["landLeases", "landParcels", "landTenants", "landStatements", "landPayments"].map((key) => [key, key]),
  );
  const store = Object.fromEntries(Object.keys(COLLECTIONS).map((key) => [key, new Map()]));
  store.landLeases.set("lease", {
    $id: "lease", parcelId: "parcel", tenantId: "tenant", agreementNumber: "TEST/1",
    startDate: "2025-01-01", endDate: "2030-12-31", rateLariPerSqft: 1, paymentDueDay: 10,
  });
  store.landParcels.set("parcel", { $id: "parcel", name: "Test land", sizeSqft: 1000 });
  store.landTenants.set("tenant", { $id: "tenant", fullName: "Test tenant" });
  let id = 0;
  let failPayment = false;
  let failDelete = false;
  const repository = {
    getDocument: async (collection, key) => {
      const doc = store[collection].get(key);
      if (!doc) throw new Error("Document not found");
      return { ...doc };
    },
    listAllDocuments: async (collection, options = {}) => {
      let docs = [...store[collection].values()];
      for (const [field, op, value] of options.where ?? []) {
        assert.equal(op, "==");
        docs = docs.filter((doc) => doc[field] === value);
      }
      return docs.map((doc) => ({ ...doc }));
    },
    createDocument: async (collection, data) => {
      if (collection === "landPayments" && failPayment) throw new Error("Payment save failed");
      const doc = { ...data, $id: `doc-${++id}`, $createdAt: new Date().toISOString() };
      store[collection].set(doc.$id, doc);
      return { ...doc };
    },
    newDocId: () => `fine-${++id}`,
    appendDocumentArrayItem: async (collection, key, field, item) => {
      const doc = store[collection].get(key);
      if (!doc) throw new Error("Document not found");
      doc[field] = [...(doc[field] ?? []), { ...item }];
    },
    updateDocument: async (collection, key, data) => {
      Object.assign(store[collection].get(key), data);
    },
    deleteDocumentsAtomically: async (documents) => {
      if (failDelete) throw new Error("Statement deletion failed");
      for (const { collectionPath, id } of documents) store[collectionPath].delete(id);
    },
  };
  const actions = loadTypeScript("lib/landrent/landRent.actions.ts", {
    "@/lib/firebase/admin": { COLLECTIONS },
    "@/lib/firebase/repository": repository,
    "@/lib/auth/require-admin": { requireAdmin },
  });
  return { actions, store, failPayment: (value) => { failPayment = value; }, failDelete: (value) => { failDelete = value; } };
}

function hookHarness(actions) {
  const states = [];
  let cursor = 0;
  const react = {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef: (initial) => react.useState({ current: initial })[0],
    useMemo: (fn) => fn(),
    useEffect: () => {},
  };
  const { useLandRentStatementPage } = loadTypeScript("components/landRent/Statement/useLandRentStatementPage.ts", {
    react,
    "next/navigation": { useSearchParams: () => new URLSearchParams("monthKey=2025-03") },
    "@/hooks/queries": { useQueryInvalidation: () => ({ invalidateLandRent: () => {} }) },
    "@/lib/landrent/landRent.actions": actions,
  });
  return () => {
    cursor = 0;
    return useLandRentStatementPage({ leaseId: "lease", options: [], statements: [] });
  };
}

test("created rent and fine-only statements accept multiple manual fines and collect the revised total", async () => {
  for (const kind of ["RENT", "FINE_ONLY"]) {
    const { actions, store } = fixture();
    const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03", kind, fineAmount: 100 });
    const original = await actions.getLandStatementDetails({ statementId: statement.$id });
    const initialSnapshot = store.landStatements.get(statement.$id).snapshot_totalRentPaymentMonthly;
    await Promise.all([
      actions.addLandStatementManualFine({ statementId: statement.$id, leaseId: "lease", amount: 12.34, description: "First added fine" }),
      actions.addLandStatementManualFine({ statementId: statement.$id, leaseId: "lease", amount: 23.45, description: "Second added fine" }),
    ]);
    const revised = await actions.getLandStatementDetails({ statementId: statement.$id });
    assert.equal(revised.manualFines.length, 2);
    assert.notEqual(revised.manualFines[0].id, revised.manualFines[1].id);
    assert.equal(revised.manualFineTotal, 35.79);
    assert.equal(revised.totalRentPaymentMonthly, Number((original.totalRentPaymentMonthly + 35.79).toFixed(2)));
    assert.equal(revised.balanceRemaining, revised.totalRentPaymentMonthly);
    assert.equal(store.landStatements.get(statement.$id).snapshot_totalRentPaymentMonthly, initialSnapshot);
    assert.equal((await actions.fetchLandRentOverview({ monthKey: "2025-03" }))[0].openingOutstandingTotal, revised.balanceRemaining);
    await actions.createLandRentPayment({ statementId: statement.$id, amount: original.balanceRemaining, paidAt: "2025-03-30T12:00:00Z" });
    assert.equal(store.landStatements.get(statement.$id).status, "OPEN");
    assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).balanceRemaining, 35.79);
    await actions.createLandRentPayment({ statementId: statement.$id, amount: 35.79, paidAt: "2025-03-30T13:00:00Z" });
    assert.equal(store.landStatements.get(statement.$id).status, "PAID");
    assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).balanceRemaining, 0);
  }
});

test("added manual fines survive recalculation and lease edits and stay on their selected statement", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 8, 30, 12) });
  const { actions, store } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09" });
  await actions.addLandStatementManualFine({ statementId: statement.$id, leaseId: "lease", amount: 123.45, description: "Separate fixed fine" });
  const saved = structuredClone(store.landStatements.get(statement.$id).manualFines);
  t.mock.timers.setTime(Date.UTC(2026, 9, 1, 12));
  await actions.recalculateLandStatementFines({ statementId: statement.$id });
  await actions.updateLandRentLease({
    leaseId: "lease", landName: "Updated land", renterName: "Updated tenant", agreementNumber: "TEST/2",
    rentStartDate: "2025-01-01", rentEndDate: "2030-12-31", letGoDate: null, lastPaymentDate: null,
    sizeSqft: 2000, rate: 2, paymentDueDay: 10, finePerDay: 0,
  });
  assert.deepEqual(store.landStatements.get(statement.$id).manualFines, saved);
  const revised = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(revised.manualFineTotal, 123.45);
  assert.equal(revised.totalRentPaymentMonthly, Number((store.landStatements.get(statement.$id).snapshot_totalRentPaymentMonthly + revised.fixedAdjustmentTotal + revised.generatedAdjustmentTotal + 123.45).toFixed(2)));
  assert.equal((await actions.previewLandRentStatement({ leaseId: "lease", monthKey: "2026-10" })).manualFineTotal, 0);
  store.landLeases.set("other", { ...store.landLeases.get("lease"), $id: "other" });
  const other = await actions.createLandStatement({ leaseId: "other", monthKey: "2026-10" });
  assert.equal((await actions.getLandStatementDetails({ statementId: other.$id })).manualFineTotal, 0);
});

test("a fine added after rent settlement leaves the rent paid-through month intact and remains collectible", async () => {
  const { actions, store } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03" });
  const original = await actions.getLandStatementDetails({ statementId: statement.$id });
  await actions.createLandRentPayment({ statementId: statement.$id, amount: original.balanceRemaining, paidAt: "2025-03-30T12:00:00Z" });
  await actions.addLandStatementManualFine({ statementId: statement.$id, leaseId: "lease", amount: 125, description: "Fine added after settlement" });
  assert.equal(store.landStatements.get(statement.$id).status, "PAID");
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).balanceRemaining, 125);
  assert.equal((await actions.fetchLandRentOverview({ monthKey: "2025-03" }))[0].openingOutstandingTotal, 125);
  const next = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-04" });
  const nextDetails = await actions.getLandStatementDetails({ statementId: next.$id });
  assert.equal(nextDetails.unpaidMonths, 1);
  assert.equal(nextDetails.manualFineTotal, 0);
  assert.equal((await actions.fetchLandRentOverview({ monthKey: "2025-04" }))[0].openingOutstandingTotal, Number((nextDetails.balanceRemaining + 125).toFixed(2)));
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 125, paidAt: "2025-04-01T12:00:00Z" });
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).balanceRemaining, 0);
  assert.equal((await actions.fetchLandRentOverview({ monthKey: "2025-04" }))[0].openingOutstandingTotal, nextDetails.balanceRemaining);
});

test("manual fine entry requires administrator access, a matching statement, and valid charge details", async () => {
  const denied = fixture({ requireAdmin: async () => { throw new Error("Forbidden"); } });
  const own = await denied.actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03" });
  await assert.rejects(denied.actions.addLandStatementManualFine({ statementId: own.$id, leaseId: "lease", amount: 10, description: "Fine" }), /Forbidden/);
  assert.equal(denied.store.landStatements.get(own.$id).manualFines, undefined);
  const { actions, store } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03" });
  const charge = { statementId: statement.$id, leaseId: "lease", amount: 10, description: "Fine" };
  for (const amount of [0, -1, NaN, Infinity, 0.001, Number.MAX_VALUE]) {
    await assert.rejects(actions.addLandStatementManualFine({ ...charge, amount }), /valid fine amount/);
  }
  for (const description of ["", "   ", "x".repeat(1001)]) {
    await assert.rejects(actions.addLandStatementManualFine({ ...charge, description }), /fine description/);
  }
  await assert.rejects(actions.addLandStatementManualFine({ ...charge, leaseId: "other" }), /does not belong/);
  await assert.rejects(actions.addLandStatementManualFine({ ...charge, statementId: "missing" }), /Document not found/);
  assert.equal(store.landStatements.get(statement.$id).manualFines, undefined);
});

test("the invoice shows newly added fines as separate rows with an accurate total on either statement kind", async () => {
  const { default: StatementsList } = loadTypeScript("components/landRent/Statement/StatementsList.tsx", {
    "next/image": ({ src, alt }) => React.createElement("img", { src, alt }),
    "@/components/landRent/Statement/PaymentEditDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/ManualFineButton": { default: () => React.createElement("button", {}, "Add manual fine"), __esModule: true },
    "@/components/landRent/Statement/StatementDeleteDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/landRentPdf.utils": { downloadElementAsPdf: async () => {} },
  });
  for (const kind of ["RENT", "FINE_ONLY"]) {
    const { actions } = fixture();
    const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03", kind, fineAmount: 100, fineDescription: "Initial fine" });
    const before = await actions.getLandStatementDetails({ statementId: statement.$id });
    await actions.addLandStatementManualFine({ statementId: statement.$id, leaseId: "lease", amount: 123.45, description: "Additional fine description" });
    const details = await actions.getLandStatementDetails({ statementId: statement.$id });
    const html = renderToStaticMarkup(React.createElement(StatementsList, { statements: [details], latestInvoiceRef: { current: null }, onCollectRemaining() {}, onPaymentUpdated: async () => {} }));
    assert.match(html, /Add manual fine/);
    const chargeTable = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/)[1];
    const chargeRows = chargeTable.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)[1];
    const rows = [...chargeRows.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => row[1]);
    assert.match(rows.at(-1), /123\.45/);
    assert.match(rows.at(-1), /Additional fine description/);
    assert.match(rows.at(-1), /colSpan="7"/i);
    assert.match(rows[kind === "FINE_ONLY" ? 1 : 0], new RegExp(before.totalRentPaymentMonthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(chargeTable.match(/<tfoot\b[^>]*>([\s\S]*?)<\/tfoot>/)[1], new RegExp(details.totalRentPaymentMonthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("refreshing after adding a fine updates the selected statement and collection balance", async () => {
  const { actions } = fixture();
  const render = hookHarness(actions);
  await render().createStatement();
  const statement = render().previewSource.statement;
  const originalTotal = render().previewSource.totalRentPaymentMonthly;
  await actions.addLandStatementManualFine({ statementId: statement.$id, leaseId: "lease", amount: 125, description: "New fine" });
  await render().refreshAfterPaymentEdit();
  assert.equal(render().previewSource.manualFineTotal, 125);
  assert.equal(render().previewSource.totalRentPaymentMonthly, originalTotal + 125);
  assert.equal(render().paymentStatement.balanceRemaining, originalTotal + 125);
  assert.equal(render().statements[0].manualFines[0].description, "New fine");
});

test("manual fine persistence uses an atomic Firestore array append", async () => {
  const updates = [];
  const { appendDocumentArrayItem } = loadTypeScript("lib/firebase/repository.ts", {
    "firebase-admin/firestore": { FieldValue: { arrayUnion: (item) => ({ operation: "arrayUnion", item }) } },
    "./admin": { getFirestoreDb: () => ({ collection: (collection) => ({ doc: (id) => ({ update: async (data) => updates.push({ collection, id, data }) }) }) }) },
    "./adapters": { withTimestamps: (data) => ({ ...data, updatedAt: "now" }) }, "./query": {}, "@/lib/files": {},
  });
  const fine = { id: "fine-1", amount: 100, description: "Fine" };
  await appendDocumentArrayItem("statements", "s1", "manualFines", fine);
  assert.deepEqual(updates, [{ collection: "statements", id: "s1", data: { manualFines: { operation: "arrayUnion", item: fine }, updatedAt: "now" } }]);
});

test("the manual fine form keeps failed input for retry and refreshes the statement after a successful save", async () => {
  const states = [];
  let cursor = 0;
  let failSave = true;
  let refreshed = 0;
  const saved = [];
  const { default: ManualFineButton } = loadTypeScript("components/landRent/Statement/ManualFineButton.tsx", {
    react: { useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = next; }];
    } },
    "@/lib/landrent/landRent.actions": { addLandStatementManualFine: async (input) => {
      if (failSave) throw new Error("Fine save failed");
      saved.push(input);
    } },
    "@/components/ui/dialog": { Dialog: "dialog", DialogContent: "section", DialogHeader: "header", DialogTitle: "h2", DialogDescription: "p" },
  });
  const statement = { statementId: "s1", leaseId: "lease", monthKey: "2026-10" };
  const render = () => { cursor = 0; return ManualFineButton({ statement, onSaved: async () => { refreshed += 1; } }); };
  const find = (node, predicate) => {
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props.children)) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return null;
  };
  const element = (type) => find(render(), (node) => node.type === type);
  element("button").props.onClick();
  element("input").props.onChange({ target: { value: "123.45" } });
  element("textarea").props.onChange({ target: { value: "ޖޫރިމަނާ" } });
  await element("form").props.onSubmit({ preventDefault() {} });
  assert.equal(element("dialog").props.open, true);
  assert.equal(element("input").props.value, "123.45");
  assert.equal(element("textarea").props.value, "ޖޫރިމަނާ");
  assert.equal(find(render(), (node) => node.props.role === "alert").props.children, "Fine save failed");
  assert.equal(refreshed, 0);
  failSave = false;
  await element("form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(saved, [{ ...statement, amount: 123.45, description: "ޖޫރިމަނާ" }]);
  assert.equal(refreshed, 1);
  assert.equal(element("dialog").props.open, false);
  assert.equal(element("input").props.value, "");
});

test("a created fine statement can be deleted and recreated with another fine", async () => {
  const { actions, store } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10", kind: "FINE_ONLY", fineAmount: 100 });
  const result = await actions.deleteLandRentStatement({ statementId: statement.$id, leaseId: "lease" });
  assert.equal(result.deletedPayments, 0);
  assert.equal(store.landStatements.has(statement.$id), false);
  assert.equal(store.landLeases.has("lease"), true);
  assert.equal(store.landTenants.has("tenant"), true);
  assert.equal(store.landParcels.has("parcel"), true);
  const replacement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10", kind: "FINE_ONLY", fineAmount: 150 });
  assert.equal((await actions.getLandStatementDetails({ statementId: replacement.$id })).totalRentPaymentMonthly, 150);
});

test("deleting a paid statement deletes only its linked payments and removes its paid-through baseline", async () => {
  const { actions, store } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03" });
  const due = await actions.getLandStatementDetails({ statementId: statement.$id });
  await actions.createLandRentPayment({ statementId: statement.$id, amount: due.balanceRemaining, paidAt: "2025-03-30T12:00:00Z" });
  assert.equal(store.landStatements.get(statement.$id).status, "PAID");
  const other = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-04" });
  const otherPayment = await actions.createLandRentPayment({ statementId: other.$id, amount: 10, paidAt: "2025-04-20T12:00:00Z" });
  await actions.deleteLandRentStatement({ statementId: statement.$id, leaseId: "lease" });
  assert.equal(store.landStatements.has(statement.$id), false);
  assert.equal(store.landPayments.size, 1);
  assert.equal(store.landPayments.has(otherPayment.$id), true);
  assert.equal(store.landStatements.has(other.$id), true);
  assert.equal((await actions.previewLandRentStatement({ leaseId: "lease", monthKey: "2025-04" })).unpaidMonths, 4);
});

test("failed deletion leaves both the statement and its payments available for retry", async () => {
  const { actions, store, failDelete } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10", kind: "FINE_ONLY", fineAmount: 100 });
  const payment = await actions.createLandRentPayment({ statementId: statement.$id, amount: 10, paidAt: "2026-10-01T12:00:00Z" });
  failDelete(true);
  await assert.rejects(actions.deleteLandRentStatement({ statementId: statement.$id, leaseId: "lease" }), /Statement deletion failed/);
  assert.equal(store.landStatements.has(statement.$id), true);
  assert.equal(store.landPayments.has(payment.$id), true);
  failDelete(false);
  await actions.deleteLandRentStatement({ statementId: statement.$id, leaseId: "lease" });
  assert.equal(store.landStatements.has(statement.$id), false);
  assert.equal(store.landPayments.has(payment.$id), false);
});

test("statement deletion requires an administrator and a matching lease", async () => {
  const denied = fixture({ requireAdmin: async () => { throw new Error("Forbidden"); } });
  const statement = await denied.actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10", kind: "FINE_ONLY", fineAmount: 100 });
  await assert.rejects(denied.actions.deleteLandRentStatement({ statementId: statement.$id, leaseId: "lease" }), /Forbidden/);
  assert.equal(denied.store.landStatements.has(statement.$id), true);
  const { actions, store } = fixture();
  const own = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10", kind: "FINE_ONLY", fineAmount: 100 });
  await assert.rejects(actions.deleteLandRentStatement({ statementId: own.$id, leaseId: "other-lease" }), /does not belong/);
  await assert.rejects(actions.deleteLandRentStatement({ statementId: "", leaseId: "lease" }), /required/);
  assert.equal(store.landStatements.has(own.$id), true);
});

test("deleting the selected statement refreshes the page and allows creating a replacement", async () => {
  const { actions } = fixture();
  const render = hookHarness(actions);
  render().fineStatement.setEnabled(true);
  render().fineStatement.setAmount("100");
  await render().createStatement();
  const statement = render().previewSource.statement;
  render().selectStatementForPayment(statement.$id);
  await actions.deleteLandRentStatement({ statementId: statement.$id, leaseId: "lease" });
  await render().refreshAfterStatementDelete(statement.$id);
  assert.equal(render().statements.length, 0);
  assert.equal(render().paymentStatement, null);
  assert.equal(render().monthPickerDisabled, false);
  assert.equal(render().canCreateStatement, true);
});

test("statement and payment deletes are submitted together in a single Firestore commit", async () => {
  const deleted = [];
  let commits = 0;
  let rejectCommit = false;
  const db = {
    collection: (collectionPath) => ({ doc: (id) => ({ collectionPath, id }) }),
    batch: () => {
      const staged = [];
      return {
        delete: (reference) => staged.push(reference),
        commit: async () => {
          commits += 1;
          if (rejectCommit) throw new Error("Commit rejected");
          deleted.push(...staged);
        },
      };
    },
  };
  const { deleteDocumentsAtomically } = loadTypeScript("lib/firebase/repository.ts", {
    "./admin": { getFirestoreDb: () => db }, "./adapters": {}, "./query": {}, "@/lib/files": {},
  });
  const docs = [{ collectionPath: "payments", id: "p1" }, { collectionPath: "statements", id: "s1" }];
  await deleteDocumentsAtomically(docs);
  assert.deepEqual(deleted, docs);
  assert.equal(commits, 1);
  rejectCommit = true;
  await assert.rejects(deleteDocumentsAtomically([{ collectionPath: "statements", id: "s2" }]), /Commit rejected/);
  assert.deepEqual(deleted, docs);
  await assert.rejects(deleteDocumentsAtomically(Array.from({ length: 501 }, () => docs[0])), /too many/);
  assert.equal(commits, 2);
});

test("a lease until work finishes can be created without an end date and billed at the normal rate", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2025, 2, 20, 12) });
  const { actions, store } = fixture();
  const created = await actions.createLandRentHolder({
    landName: "Work land", renterName: "Work tenant", agreementNumber: "WORK/1",
    rentStartDate: "2025-01-01", rentEndDate: null, doubleRateAfterEnd: true, letGoDate: null,
    sizeSqft: 1000, rate: 1, monthlyRent: 1000, paymentDueDay: 10, finePerDay: 8.33,
    lastPaymentDate: null, openingFineDays: 0, openingFineMonths: 0,
    openingTotalFine: 0, openingOutstandingFees: 0, openingOutstandingTotal: 0,
  });
  const leaseId = created.lease.$id;
  assert.equal(store.landLeases.get(leaseId).endDate, null);
  assert.equal(store.landLeases.get(leaseId).doubleRateAfterEnd, false);
  const preview = await actions.previewLandRentStatement({ leaseId, monthKey: "2025-03", capToEndDate: true });
  assert.equal(preview.outstandingFees, 3000);
  assert.equal(preview.rentDuration.endDate, null);
  const statement = await actions.createLandStatement({ leaseId, monthKey: "2025-03" });
  const details = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(details.outstandingFees, 3000);
  assert.equal(details.rentDuration.endDate, null);
  assert.equal(store.landStatements.get(statement.$id).endDate, null);
  const overview = await actions.fetchLandRentOverview({ monthKey: "2025-03" });
  assert.equal(overview.find((row) => row.leaseId === leaseId).endDate, null);
  const { default: StatementsList } = loadTypeScript("components/landRent/Statement/StatementsList.tsx", {
    "next/image": ({ src, alt }) => React.createElement("img", { src, alt }),
    "@/components/landRent/Statement/PaymentEditDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/ManualFineButton": { default: () => React.createElement("button", {}, "Add manual fine"), __esModule: true },
    "@/components/landRent/Statement/StatementDeleteDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/landRentPdf.utils": { downloadElementAsPdf: async () => {} },
  });
  const html = renderToStaticMarkup(React.createElement(StatementsList, {
    statements: [details], latestInvoiceRef: { current: null }, onCollectRemaining() {}, onPaymentUpdated: async () => {},
    onStatementDeleted: async () => {},
  }));
  assert.match(html, /Delete statement/);
  assert.match(html, /މަސައްކަތް ނިމެންދެން/);
});

test("a dated lease can be made open-ended, restored to a fixed date, and stopped on work completion", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2025, 2, 20, 12) });
  const { actions, store } = fixture();
  Object.assign(store.landLeases.get("lease"), { endDate: "2025-01-31", doubleRateAfterEnd: true });
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03" });
  const edit = {
    leaseId: "lease", landName: "Test land", renterName: "Test tenant", agreementNumber: "TEST/1",
    rentStartDate: "2025-01-01", rentEndDate: null, doubleRateAfterEnd: true, letGoDate: null,
    lastPaymentDate: null, sizeSqft: 1000, rate: 1, paymentDueDay: 10, finePerDay: 8.33,
  };
  await actions.updateLandRentLease(edit);
  assert.equal(store.landLeases.get("lease").endDate, null);
  assert.equal(store.landLeases.get("lease").doubleRateAfterEnd, false);
  const ongoing = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(ongoing.outstandingFees, 3000);
  await actions.recalculateAllLandRentLeases();
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).outstandingFees, 3000);
  await actions.updateLandRentLease({ ...edit, rentEndDate: "2025-01-31" });
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).outstandingFees, 5000);
  await actions.updateLandRentLease({ ...edit, letGoDate: "2025-03-11" });
  const completed = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(completed.outstandingFees, 2322.58);
  const fineAtCompletion = completed.fineAmount;
  t.mock.timers.setTime(Date.UTC(2025, 3, 20, 12));
  await actions.recalculateLandStatementFines({ statementId: statement.$id });
  const later = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(later.outstandingFees, completed.outstandingFees);
  assert.equal(later.fineAmount, fineAtCompletion);
  await assert.rejects(actions.updateLandRentLease({ ...edit, rentEndDate: "invalid-date" }), /Invalid rent end date/);
  assert.equal(store.landLeases.get("lease").endDate, null);
});

test("new leases save an explicit opt-in for doubling, defaulting to unticked", async () => {
  const { actions, store } = fixture();
  const input = {
    landName: "Another land", renterName: "Another tenant", agreementNumber: "TEST/2",
    rentStartDate: "2025-01-01", rentEndDate: "2025-01-31", letGoDate: null,
    sizeSqft: 1000, rate: 1, monthlyRent: 1000, paymentDueDay: 10, finePerDay: 8.33,
    lastPaymentDate: null, openingFineDays: 0, openingFineMonths: 0,
    openingTotalFine: 0, openingOutstandingFees: 0, openingOutstandingTotal: 0,
  };
  for (const doubleRateAfterEnd of [undefined, false, true]) {
    const created = await actions.createLandRentHolder({ ...input, doubleRateAfterEnd });
    assert.equal(store.landLeases.get(created.lease.$id).doubleRateAfterEnd, doubleRateAfterEnd === true);
    const overview = await actions.fetchLandRentOverview({ monthKey: "2025-03" });
    assert.equal(overview.find((row) => row.leaseId === created.lease.$id).doubleRateAfterEnd, doubleRateAfterEnd === true);
  }
});

test("editing the doubling checkbox recalculates rent and both fine methods, and recalculation retains the choice", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2025, 8, 20, 12) });
  const { actions, store } = fixture();
  const lease = store.landLeases.get("lease");
  lease.endDate = "2025-01-31";
  lease.lastPaymentDate = "2025-01-31";
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-09" });
  const normal = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(normal.outstandingFees, 8000);
  const edit = {
    leaseId: "lease", landName: "Test land", renterName: "Test tenant", agreementNumber: "TEST/1",
    rentStartDate: "2025-01-01", rentEndDate: "2025-01-31", letGoDate: null,
    lastPaymentDate: "2025-01-31", sizeSqft: 1000, rate: 1, paymentDueDay: 10, finePerDay: 8.33,
  };
  await actions.updateLandRentLease({ ...edit, doubleRateAfterEnd: true });
  const doubled = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(lease.doubleRateAfterEnd, true);
  assert.equal(doubled.outstandingFees, 16000);
  assert.ok(Math.abs(doubled.fineAmount - normal.fineAmount * 2) <= 0.01);
  assert.ok(Math.abs(doubled.generatedAdjustmentRows[0].fineAmount - normal.generatedAdjustmentRows[0].fineAmount * 2) <= 0.02);
  assert.equal(store.landStatements.get(statement.$id).doubleRateAfterEnd, true);
  await actions.recalculateAllLandRentLeases();
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).totalRentPaymentMonthly, doubled.totalRentPaymentMonthly);
  await actions.updateLandRentLease({ ...edit, doubleRateAfterEnd: false });
  const restored = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(lease.doubleRateAfterEnd, false);
  assert.equal(restored.totalRentPaymentMonthly, normal.totalRentPaymentMonthly);
  assert.equal(store.landStatements.get(statement.$id).doubleRateAfterEnd, false);
  await actions.recalculateLandStatementFines({ statementId: statement.$id });
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).totalRentPaymentMonthly, normal.totalRentPaymentMonthly);
});

test("backfilling an older statement uses the lease choice without adding another legacy fine correction", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2025, 8, 20, 12) });
  const { actions, store } = fixture();
  Object.assign(store.landLeases.get("lease"), {
    startDate: "2024-01-01", endDate: "2024-06-30", doubleRateAfterEnd: false,
    lastPaymentDate: "2024-06-30",
  });
  const preview = await actions.previewLandRentStatement({ leaseId: "lease", monthKey: "2025-09" });
  store.landStatements.set("old", {
    $id: "old", leaseId: "lease", monthKey: "2025-09", status: "OPEN", createdAt: "2025-09-01",
  });
  const details = await actions.getLandStatementDetails({ statementId: "old" });
  assert.equal(details.totalRentPaymentMonthly, preview.totalRentPaymentMonthly);
  assert.equal(details.fineAmount, preview.fineAmount);
  assert.ok(details.rateBreakdown.filter((row) => row.total > 0).every((row) => row.multiplier === 1));
  assert.equal(details.rateBreakdown.find((row) => row.multiplier === 2)?.total ?? 0, 0);
  assert.equal(store.landStatements.get("old").doubleRateAfterEnd, false);
});

test("a lease with no payment history can create a statement and display manual payments", async () => {
  const { actions } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2025-03" });
  const unpaid = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(unpaid.payments.length, 0);
  assert.equal(unpaid.paymentsTotal, 0);
  assert.ok(unpaid.balanceRemaining > 100);

  await actions.createLandRentPayment({ statementId: statement.$id, amount: 100, paidAt: "2025-03-20T10:00:00Z", note: "Manual receipt" });
  const paid = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(paid.payments[0].amount, 100);
  assert.equal(paid.payments[0].note, "Manual receipt");
  assert.equal(paid.paymentsTotal, 100);
  assert.equal(paid.totalRentPaymentMonthly, unpaid.totalRentPaymentMonthly);
  assert.equal(paid.balanceRemaining, Math.round((unpaid.balanceRemaining - 100) * 100) / 100);
});

test("saving the first manual payment creates a statement and refreshes invoice data", async () => {
  const { actions, store } = fixture();
  const render = hookHarness(actions);
  render().setPayAmount("125.50");
  render().setPayNote("Historical payment");
  render().setPayAtLocal("2025-03-20T15:00");
  await render().submitPayment({ preventDefault() {} });
  const result = render();
  assert.equal(result.paymentError, null);
  assert.equal(result.paymentOk, "Payment saved.");
  assert.equal(store.landStatements.size, 1);
  assert.equal(result.statements[0].payments[0].amount, 125.5);
  assert.equal(result.statements[0].payments[0].note, "Historical payment");
});

test("invalid manual amounts do not create an empty statement", async () => {
  const { actions, store } = fixture();
  const render = hookHarness(actions);
  render().setPayAmount("0");
  await render().submitPayment({ preventDefault() {} });
  assert.match(render().paymentError, /valid amount/);
  assert.equal(store.landStatements.size, 0);
  assert.equal(store.landPayments.size, 0);
});

test("failed payment saves retain the form and retry against the created statement", async () => {
  const { actions, store, failPayment } = fixture();
  const render = hookHarness(actions);
  render().setPayAmount("100");
  failPayment(true);
  await render().submitPayment({ preventDefault() {} });
  assert.equal(render().paymentError, "Payment save failed");
  assert.equal(render().payAmount, "100");
  assert.ok(render().paymentStatement);
  assert.equal(store.landStatements.size, 1);
  failPayment(false);
  await render().submitPayment({ preventDefault() {} });
  assert.equal(render().paymentError, null);
  assert.equal(store.landStatements.size, 1);
  assert.equal(store.landPayments.size, 1);
});

test("statement-only creation works without entering a payment and surfaces creation errors", async () => {
  const { actions, store } = fixture();
  const render = hookHarness(actions);
  await render().createStatement();
  assert.equal(store.landStatements.size, 1);
  assert.equal(store.landPayments.size, 0);
  assert.equal(render().paymentOk, "Statement created.");
  await render().createStatement();
  assert.match(render().paymentError, /already an OPEN statement/);
});

test("paid-through rent does not block a fine-only statement for the same month", async () => {
  const { actions, store } = fixture();
  store.landLeases.get("lease").lastPaymentDate = "2026-09-10";
  store.landLeases.get("lease").fixedAdjustmentRowsJson = JSON.stringify([
    { total: 500, rentAmount: 500, fineAmount: 0, unpaidMonths: 1, periodLabel: "Existing rent adjustment" },
  ]);
  await assert.rejects(actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09" }), /2026-10 or later/);
  const statement = await actions.createLandStatement({
    leaseId: "lease", monthKey: "2026-09", kind: "FINE_ONLY", fineAmount: 1250.75, fineDescription: "Remaining late fine",
  });
  const fine = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(fine.outstandingFees, 0);
  assert.equal(fine.unpaidMonths, 0);
  assert.equal(fine.fineAmount, 1250.75);
  assert.equal(fine.totalRentPaymentMonthly, 1250.75);
  assert.equal(fine.balanceRemaining, 1250.75);
  assert.equal(fine.fixedAdjustmentTotal, 0);
  assert.equal(fine.generatedAdjustmentTotal, 0);
  assert.equal(fine.rateBreakdown.length, 0);
  assert.equal(fine.statement.fineDescription, "Remaining late fine");
  const overview = await actions.fetchLandRentOverview({ monthKey: "2026-09" });
  assert.equal(overview[0].openingOutstandingTotal, 1250.75);

  await actions.recalculateLandStatementFines({ statementId: statement.$id });
  assert.equal((await actions.getLandStatementDetails({ statementId: statement.$id })).totalRentPaymentMonthly, 1250.75);
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 250, paidAt: "2026-09-30T10:00:00Z" });
  const partial = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(partial.paymentsTotal, 250);
  assert.equal(partial.balanceRemaining, 1000.75);
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 1000.75, paidAt: "2026-09-30T11:00:00Z" });
  assert.equal(store.landStatements.get(statement.$id).status, "PAID");
  assert.equal(store.landLeases.get("lease").lastPaymentDate, "2026-09-10");
});

test("paying a fine-only statement does not advance the paid-through rent month", async () => {
  const { actions, store } = fixture();
  store.landLeases.get("lease").lastPaymentDate = "2026-09-10";
  const fine = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-12", kind: "FINE_ONLY", fineAmount: 100 });
  await actions.createLandRentPayment({ statementId: fine.$id, amount: 100, paidAt: "2026-09-30T10:00:00Z" });
  const rent = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10" });
  const details = await actions.getLandStatementDetails({ statementId: rent.$id });
  assert.equal(details.unpaidMonths, 1);
  assert.equal(details.outstandingFees, 1000);
});

test("fine-only statements reject invalid amounts before storing anything", async () => {
  const { actions, store } = fixture();
  for (const fineAmount of [0, -10, NaN, Infinity, 0.001]) {
    await assert.rejects(actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09", kind: "FINE_ONLY", fineAmount }), /fine amount greater than 0/);
  }
  assert.equal(store.landStatements.size, 0);
});

test("the fine-only form can create a statement in an already-paid rent month", async () => {
  const { actions, store } = fixture();
  store.landLeases.get("lease").lastPaymentDate = "2025-03-10";
  const render = hookHarness(actions);
  render().fineStatement.setEnabled(true);
  render().fineStatement.setAmount("890.50");
  render().fineStatement.setDescription("Fine remaining after rent settlement");
  await render().createStatement();
  assert.equal(render().paymentError, null);
  assert.equal(render().previewSource.statement.kind, "FINE_ONLY");
  assert.equal(render().previewSource.totalRentPaymentMonthly, 890.5);
  assert.equal(store.landPayments.size, 0);
});

test("editing a lease preserves its manually entered fine", async () => {
  const { actions } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09", kind: "FINE_ONLY", fineAmount: 789.5 });
  await actions.updateLandRentLease({
    leaseId: "lease", landName: "Updated land", renterName: "Updated tenant", agreementNumber: "TEST/2",
    rentStartDate: "2025-01-01", rentEndDate: "2030-12-31", letGoDate: null, lastPaymentDate: "2026-09-10",
    sizeSqft: 2000, rate: 2, paymentDueDay: 10, finePerDay: 0,
  });
  const fine = await actions.getLandStatementDetails({ statementId: statement.$id });
  assert.equal(fine.landName, "Updated land");
  assert.equal(fine.totalRentPaymentMonthly, 789.5);
  assert.equal(fine.outstandingFees, 0);
});

test("the invoice renders the manual fine, description and collected payment amount", async () => {
  const { actions } = fixture();
  const statement = await actions.createLandStatement({
    leaseId: "lease", monthKey: "2026-09", kind: "FINE_ONLY", fineAmount: 789.5, fineDescription: "Remaining fine after rent settlement",
  });
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 123.45, paidAt: "2026-09-30T10:00:00Z" });
  const details = await actions.getLandStatementDetails({ statementId: statement.$id });
  const { default: StatementsList } = loadTypeScript("components/landRent/Statement/StatementsList.tsx", {
    "next/image": ({ src, alt }) => React.createElement("img", { src, alt }),
    "@/components/landRent/Statement/PaymentEditDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/ManualFineButton": { default: () => React.createElement("button", {}, "Add manual fine"), __esModule: true },
    "@/components/landRent/Statement/StatementDeleteDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/landRentPdf.utils": { downloadElementAsPdf: async () => {} },
  });
  const html = renderToStaticMarkup(React.createElement(StatementsList, {
    statements: [details], latestInvoiceRef: { current: null }, onCollectRemaining() {}, onPaymentUpdated: async () => {},
  }));
  assert.match(html, /Fine statement:/);
  assert.match(html, /Remaining fine after rent settlement/);
  assert.match(html, /789\.50/);
  assert.match(html, /123\.45/);
  assert.match(html, /666\.05/);
  const chargeTable = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/)[1];
  const chargeRows = chargeTable.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((chargeRows.match(/<tr\b/g) ?? []).length, 2);
  assert.equal((chargeRows.match(/<td\b/g) ?? []).length, 10);
  const detailCells = [...chargeRows.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)]
    .slice(0, 8)
    .map((cell) => cell[1].replace(/<[^>]+>/g, "").trim());
  assert.equal(detailCells[0], "0.00");
  assert.equal(detailCells[3], "0.00");
  assert.equal(detailCells[1], "0.00");
  assert.equal(detailCells[2], "0");
  assert.equal(detailCells[4], "0");
  assert.equal(detailCells[6], "1");
  assert.equal(detailCells[7], "1000");
  assert.match(chargeRows, /colSpan="7"/i);
  assert.match(chargeRows, /Remaining fine after rent settlement/);
  assert.equal((chargeRows.match(/789\.50/g) ?? []).length, 1);
  assert.match(chargeTable, /<tfoot\b[\s\S]*789\.50[\s\S]*<\/tfoot>/);
});

test("statement payment dates and saved fine-period ranges use Dhivehi month names", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 1, 12) });
  const { actions, store } = fixture();
  Object.assign(store.landLeases.get("lease"), { startDate: "2020-01-01", lastPaymentDate: "2024-09-01" });
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-10" });
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 137, paidAt: "2024-11-01T00:00:00Z" });
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 47.5, paidAt: "2020-01-01T00:00:00Z" });
  const savedLabel = store.landStatements.get(statement.$id).snapshot_generatedAdjustmentRowsJson;
  assert.match(savedLabel, /2025-08–2026-10/);
  const details = await actions.getLandStatementDetails({ statementId: statement.$id });
  const { default: StatementsList } = loadTypeScript("components/landRent/Statement/StatementsList.tsx", {
    "next/image": ({ src, alt }) => React.createElement("img", { src, alt }),
    "@/components/landRent/Statement/PaymentEditDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/ManualFineButton": { default: () => React.createElement("button", {}, "Add manual fine"), __esModule: true },
    "@/components/landRent/Statement/StatementDeleteDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/landRentPdf.utils": { downloadElementAsPdf: async () => {} },
  });
  const html = renderToStaticMarkup(React.createElement(StatementsList, {
    statements: [details], latestInvoiceRef: { current: null }, onCollectRemaining() {}, onPaymentUpdated: async () => {},
  }));
  assert.match(html, /1 ނޮވެމްބަރ 2024/);
  assert.match(html, /1 ޖެނުއަރީ 2020/);
  assert.match(html, /އޯގަސްޓް 2025 – އޮކްޓޯބަރު 2026/);
  assert.doesNotMatch(html, /2024-11-01|2020-01-01|2025-08–2026-10/);
  assert.match(html, /137\.00/);
  assert.match(html, /47\.50/);
  assert.equal(store.landStatements.get(statement.$id).snapshot_generatedAdjustmentRowsJson, savedLabel);
});

test("the statement note uses the saved recalculation date instead of its creation date", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 8, 30, 12) });
  const { actions, store } = fixture();
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09" });
  const { default: StatementsList } = loadTypeScript("components/landRent/Statement/StatementsList.tsx", {
    "next/image": ({ src, alt }) => React.createElement("img", { src, alt }),
    "@/components/landRent/Statement/PaymentEditDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/ManualFineButton": { default: () => React.createElement("button", {}, "Add manual fine"), __esModule: true },
    "@/components/landRent/Statement/StatementDeleteDialog": { default: () => null, __esModule: true },
    "@/components/landRent/Statement/landRentPdf.utils": { downloadElementAsPdf: async () => {} },
  });
  const { fmtDateDhivehi } = loadTypeScript("components/landRent/Statement/landRentStatement.utils.ts");
  const noteFor = async () => {
    const details = await actions.getLandStatementDetails({ statementId: statement.$id });
    const html = renderToStaticMarkup(React.createElement(StatementsList, {
      statements: [details], latestInvoiceRef: { current: null }, onCollectRemaining() {}, onPaymentUpdated: async () => {},
    }));
    return html.match(/ނޯޓް: ([^<]+)/)[1];
  };
  assert.equal(await noteFor(), `ކުލީގެ ތަފްސީލް ހެދިފައިވަނީ ${fmtDateDhivehi(statement.createdAt)} ވަނަ ދުވަހުގެ ނިޔަލަށެވެ.`);
  t.mock.timers.setTime(Date.UTC(2026, 9, 1, 12));
  await actions.recalculateLandStatementFines({ statementId: statement.$id });
  assert.equal(store.landStatements.get(statement.$id).recalculatedAt, "2026-10-01T12:00:00.000Z");
  assert.equal(store.landStatements.get(statement.$id).createdAt, statement.createdAt);
  const recalculatedNote = await noteFor();
  assert.equal(recalculatedNote, `ކުލީގެ ތަފްސީލް ހެދިފައިވަނީ ${fmtDateDhivehi("2026-10-01T12:00:00.000Z")} ވަނަ ދުވަހުގެ ނިޔަލަށެވެ.`);
  t.mock.timers.setTime(Date.UTC(2026, 9, 2, 12));
  await actions.createLandRentPayment({ statementId: statement.$id, amount: 100, paidAt: new Date().toISOString() });
  assert.equal(await noteFor(), recalculatedNote);
});

test("batch recalculation updates every open rent statement and preserves paid and manual fine statements", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 8, 30, 12) });
  const { actions, store } = fixture();
  for (const leaseId of ["second", "paid", "fine", "no-statement"]) {
    store.landLeases.set(leaseId, { ...store.landLeases.get("lease"), $id: leaseId });
  }
  const first = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09" });
  const second = await actions.createLandStatement({ leaseId: "second", monthKey: "2026-09" });
  const paid = await actions.createLandStatement({ leaseId: "paid", monthKey: "2026-09" });
  store.landStatements.get(paid.$id).status = "PAID";
  const fine = await actions.createLandStatement({ leaseId: "fine", monthKey: "2026-09", kind: "FINE_ONLY", fineAmount: 555 });
  const savedPaid = { ...store.landStatements.get(paid.$id) };
  const savedFine = { ...store.landStatements.get(fine.$id) };
  const previousFine = (await actions.getLandStatementDetails({ statementId: first.$id })).generatedAdjustmentTotal;

  t.mock.timers.setTime(Date.UTC(2026, 9, 1, 12));
  const result = await actions.recalculateAllLandRentLeases();
  assert.equal(result.totalLeases, 5);
  assert.equal(result.updatedStatements, 2);
  assert.deepEqual(result.failures, []);
  assert.equal(store.landStatements.size, 4);
  for (const statement of [first, second]) {
    assert.equal(store.landStatements.get(statement.$id).recalculatedAt, "2026-10-01T12:00:00.000Z");
    assert.ok((await actions.getLandStatementDetails({ statementId: statement.$id })).generatedAdjustmentTotal > previousFine);
  }
  assert.deepEqual(store.landStatements.get(paid.$id), savedPaid);
  assert.deepEqual(store.landStatements.get(fine.$id), savedFine);
});

test("batch recalculation reports a failed lease and still updates the other leases", async () => {
  const { actions, store } = fixture();
  store.landLeases.set("broken", { ...store.landLeases.get("lease"), $id: "broken" });
  const valid = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09" });
  const broken = await actions.createLandStatement({ leaseId: "broken", monthKey: "2026-09" });
  store.landLeases.get("broken").parcelId = "missing-parcel";
  const result = await actions.recalculateAllLandRentLeases();
  assert.equal(result.updatedStatements, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].leaseId, "broken");
  assert.equal(result.failures[0].statementId, broken.$id);
  assert.match(result.failures[0].message, /Document not found/);
  assert.ok(store.landStatements.get(valid.$id).recalculatedAt);
  assert.equal(store.landStatements.get(broken.$id).recalculatedAt, undefined);
});

test("batch recalculation requires administrator access", async () => {
  const { actions, store } = fixture({ requireAdmin: async () => { throw new Error("Forbidden"); } });
  const statement = await actions.createLandStatement({ leaseId: "lease", monthKey: "2026-09" });
  await assert.rejects(actions.recalculateAllLandRentLeases(), /Forbidden/);
  assert.equal(store.landStatements.get(statement.$id).recalculatedAt, undefined);
});
