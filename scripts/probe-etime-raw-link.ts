import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { EtimeClient } = await import("../lib/etime/client");
  const client = EtimeClient.fromEnv();
  await client.login();
  const { html } = await (
    client as unknown as {
      fetchWithCookies: (url: string) => Promise<{ html: string; response: Response }>;
    }
  ).fetchWithCookies("https://etimeoffice.com/Dashboard/Details");

  const idx = html.toLowerCase().indexOf("raw data");
  console.log("snippet around Raw Data:\n", html.slice(Math.max(0, idx - 400), idx + 600));

  const candidates = [
    "/OtherReport/Details",
    "/TopReports/Details",
    "/RawData/Details",
    "/RawDataEditor/Details",
    "/RawData/Editor",
    "/AttendanceRawData/Details",
    "/EmployeeRawData/Details",
    "/DownloadRawData/Details",
    "/InOutRawData/Details",
    "/PunchRawData/Details",
  ];

  for (const path of candidates) {
    const result = await (
      client as unknown as {
        fetchWithCookies: (url: string) => Promise<{ html: string; response: Response }>;
      }
    ).fetchWithCookies(`https://etimeoffice.com${path}`);
    const title = result.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    console.log(
      JSON.stringify({
        path,
        status: result.response.status,
        url: result.response.url,
        title,
        hasTable: result.html.includes("<table"),
        hasDate: /date|from|to/i.test(result.html.slice(0, 5000)),
        len: result.html.length,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
