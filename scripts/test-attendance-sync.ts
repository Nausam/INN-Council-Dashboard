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
  console.log("attendance-sync tests passed");
}

run();
