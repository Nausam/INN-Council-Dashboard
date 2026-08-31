import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { EtimeClient } = await import("../lib/etime/client");
  const { todayMaldivesIso } = await import("../lib/attendance-sync/time");
  const client = EtimeClient.fromEnv();
  await client.login();
  console.log("login ok, cookies present");

  const date = todayMaldivesIso();
  const paths = [
    `/Reports/RawData`,
    `/Reports/RawPunch`,
    `/Attendance/RawData`,
    `/Attendance/RawPunchData`,
    `/HR/RawData`,
    `/Employee/RawData`,
    `/Reports/AttendanceRawData`,
    `/Dashboard/Details`,
  ];

  for (const path of paths) {
    const url = `https://etimeoffice.com${path}`;
    const session = client.getSession();
    const res = await fetch(url, {
      headers: {
        Cookie: session.cookieHeader,
        "User-Agent": "hr-dashboard-attendance-sync/1.0",
      },
      redirect: "manual",
    });
    const loc = res.headers.get("location");
    const html = res.status >= 300 && res.status < 400 ? "" : await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    console.log(
      JSON.stringify({
        path,
        status: res.status,
        location: loc,
        title,
        hasTable: html.includes("<table"),
        len: html.length,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
