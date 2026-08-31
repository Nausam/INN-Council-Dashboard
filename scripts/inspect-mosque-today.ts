import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { fetchMosqueAttendanceForDate, fetchAllEmployees } = await import(
    "../lib/firebase/hr"
  );
  const { todayMaldivesIso } = await import("../lib/attendance-sync/time");
  const { listEligiblePunchesForEmployeeDate } = await import(
    "../lib/attendance-sync/punch-store"
  );
  const { resolveEmployeeSyncConfig } = await import(
    "../lib/attendance-sync/employee-sync"
  );

  const date = todayMaldivesIso();
  const [rows, employees] = await Promise.all([
    fetchMosqueAttendanceForDate(date),
    fetchAllEmployees(),
  ]);
  const byId = new Map(employees.map((e) => [e.$id, e]));

  console.log("date", date, "rows", rows.length);

  for (const row of rows) {
    const employee = byId.get(row.employeeId);
    const config = employee ? resolveEmployeeSyncConfig(employee) : null;
    const punches = employee
      ? await listEligiblePunchesForEmployeeDate(employee.$id, date, {
          zkUserId:
            employee.deviceUserId ?? config?.zkteco?.userId ?? null,
          etimeCode: config?.etime?.employeeCode ?? null,
        })
      : [];

    console.log(
      JSON.stringify(
        {
          name: employee?.name,
          fajr: row.fathisSignInTime,
          dhuhr: row.mendhuruSignInTime,
          asr: row.asuruSignInTime,
          maghrib: row.maqribSignInTime,
          isha: row.ishaSignInTime,
          leave: row.leaveType,
          punches: punches.map((p) => ({
            source: p.source,
            localTime: p.localTime,
            ts: p.timestampUtc,
          })),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
