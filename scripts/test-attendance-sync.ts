import dotenv from "dotenv";
import assert from "node:assert/strict";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import {
  calculateMinutesLate,
  classifyPunchMinute,
  selectEarliestPunchForPrayer,
} from "../lib/attendance-sync/prayer-classifier";
import { utcToMaldivesParts, mosqueRecoveryStartDate, enumerateIsoDates } from "../lib/attendance-sync/time";
import { parseEtimeHtmlSnapshot } from "../lib/etime/parser";
import { buildSourceEmployeeMaps, listCouncilEmployees } from "../lib/attendance-sync/employee-sync";
import { canAutomateCouncilRow, isCouncilPunchFromEnabledSource, selectCouncilFirstPunch } from "../lib/attendance-sync/council";
import type { EmployeeDoc } from "../lib/firebase/types";
import type { AttendancePunchDoc } from "../lib/attendance-sync/types";
import { coercePunchTimestampUtc } from "../lib/attendance-sync/punch-store";

function testMaldivesConversion() {
  const parts = utcToMaldivesParts("2026-06-15T18:30:00.000Z");
  assert.equal(parts.localDate, "2026-06-15");
  assert.equal(parts.localTime, "23:30");
}

function testPrayerClassification() {
  const times = {
    fathisTime: "04:30",
    mendhuruTime: "12:05",
    asuruTime: "15:30",
    maqribTime: "18:20",
    ishaTime: "19:45",
  };

  assert.equal(classifyPunchMinute(4 * 60 + 20, times), "fathisSignInTime");
  assert.equal(classifyPunchMinute(12 * 60 + 10, times), "mendhuruSignInTime");
  assert.equal(classifyPunchMinute(23 * 60, times, "19:40"), null);
}

function testLateness() {
  assert.equal(calculateMinutesLate("12:00", 12 * 60 + 6, "Imam"), 11);
  assert.equal(calculateMinutesLate("12:00", 11 * 60 + 55, "Imam"), 0);
  assert.equal(calculateMinutesLate("12:00", 12 * 60 + 20, "Council Assistant"), 35);
}

function testEarliestPunchSelection() {
  const selected = selectEarliestPunchForPrayer([
    {
      punchLogId: "b",
      source: "etime",
      timestampUtc: "2026-06-15T06:05:00.000Z",
      localMinutes: 11 * 60 + 5,
    },
    {
      punchLogId: "a",
      source: "zkteco",
      timestampUtc: "2026-06-15T06:05:00.000Z",
      localMinutes: 11 * 60 + 5,
    },
  ]);
  assert.equal(selected?.punchLogId, "a");
}

function testEtimeParser() {
  const html = `
    <table id="employee_master_tbl">
      <thead><tr>
        <th></th><th>EmpCode</th><th>MachineId</th><th>PunchUseStatus</th>
        <th>Punch Date</th><th>Manual Punch</th><th>Record</th><th>Punch Ignore</th>
      </tr></thead>
      <tbody>
        <tr><td></td><td>4</td><td>1</td><td>U</td><td>2026061511050015/06/2026 11:05</td><td></td><td>101</td><td></td></tr>
        <tr><td></td><td>3</td><td>1</td><td>I</td><td>2026061511100015/06/2026 11:10</td><td></td><td>102</td><td>Ignore</td></tr>
      </tbody>
    </table>
  `;
  const snapshot = parseEtimeHtmlSnapshot(html, "2026-06-15");
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.rows.length, 2);
  assert.equal(snapshot.rows[0]?.employeeCode, "4");
  assert.equal(snapshot.rows[0]?.timestampText, "15/06/2026 11:05");
  assert.equal(snapshot.rows[1]?.ignored, true);
}

function testCouncilMachineAttendance() {
  const date = "2026-09-27";
  const makeEmployee = (id: string, section: string, deviceUserId?: string): EmployeeDoc =>
    ({ $id: id, name: id, section, deviceUserId });
  const employees = [
    makeEmployee("office", "Administration", "42"),
    makeEmployee("unmapped", "Finance"),
    makeEmployee("mosque", "Mosque", "18"),
  ];
  assert.deepEqual(listCouncilEmployees(employees).map((e) => e.$id), ["office", "unmapped"]);
  const maps = buildSourceEmployeeMaps(employees, date);
  assert.equal(maps.zkByUserId.get("42")?.employee.$id, "office");
  assert.equal(maps.zkByUserId.has("18"), false);
  const duplicate = buildSourceEmployeeMaps([...employees, makeEmployee("other", "Finance", "42")], date);
  assert.deepEqual(duplicate.duplicateZkIds, ["42"]);
  assert.equal(duplicate.zkByUserId.has("42"), false);

  const makePunch = (id: string, source: "zkteco" | "etime", timestampUtc: string) =>
    ({ $id: id, source, timestampUtc, eligible: true, voidedAt: null } as AttendancePunchDoc & { $id: string });
  const punches = [
    makePunch("late", "zkteco", "2026-09-27T03:20:00.000Z"),
    makePunch("etime", "etime", "2026-09-27T02:05:00.000Z"),
    makePunch("zk", "zkteco", "2026-09-27T02:05:00.000Z"),
    makePunch("outside", "zkteco", "2026-09-27T04:00:00.000Z"),
  ];
  assert.equal(selectCouncilFirstPunch(date, punches)?.$id, "zk");
  assert.equal(selectCouncilFirstPunch(date, [punches[1]!])?.$id, "etime");
  assert.equal(selectCouncilFirstPunch(date, [punches[3]!]), null);
  assert.equal(isCouncilPunchFromEnabledSource(
    { ...punches[2]!, sourceEmployeeId: "42" },
    maps.byEmployeeId.get("office")!,
  ), true);
  assert.equal(isCouncilPunchFromEnabledSource(
    { ...punches[1]!, sourceEmployeeId: "42" },
    maps.byEmployeeId.get("office")!,
  ), false);
  assert.equal(canAutomateCouncilRow({ signInTime: null, leaveType: null }), true);
  assert.equal(canAutomateCouncilRow({ signInTime: punches[1]!.timestampUtc, leaveType: null }), false);
  assert.equal(canAutomateCouncilRow({ signInTime: null, leaveType: "annualLeave" }), false);
  assert.equal(canAutomateCouncilRow({ signInTime: null, leaveType: null,
    automation: { version: 1, lastReconciledAt: null, manualOverride: true, punchRef: null } }), false);
}

function testStoredPunchTimestamps() {
  const iso = "2026-09-27T02:05:00.000Z";
  assert.equal(coercePunchTimestampUtc(iso), iso);
  assert.equal(coercePunchTimestampUtc(new Date(iso)), iso);
  assert.equal(coercePunchTimestampUtc({ toDate: () => new Date(iso) }), iso);
  assert.equal(coercePunchTimestampUtc({ invalid: true }), null);
}

function run() {
  assert.equal(mosqueRecoveryStartDate("2026-09-21"), "2026-08-01");
  assert.equal(mosqueRecoveryStartDate("2027-01-01"), "2026-12-01");
  assert.equal(mosqueRecoveryStartDate("2028-03-01"), "2028-02-01");
  assert.equal(enumerateIsoDates(mosqueRecoveryStartDate("2026-09-21"), "2026-09-21").length, 52);
  testMaldivesConversion();
  testPrayerClassification();
  testLateness();
  testEarliestPunchSelection();
  testEtimeParser();
  testCouncilMachineAttendance();
  testStoredPunchTimestamps();
  console.log("attendance-sync tests passed");
}

run();
