import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { EtimeClient } = await import("../lib/etime/client");
  const { todayMaldivesIso } = await import("../lib/attendance-sync/time");
  const client = EtimeClient.fromEnv();
  await client.login();

  const fetchWithCookies = (
    client as unknown as {
      fetchWithCookies: (
        url: string,
        init?: RequestInit,
      ) => Promise<{ html: string; response: Response }>;
    }
  ).fetchWithCookies.bind(client);

  const page = await fetchWithCookies("https://etimeoffice.com/RowData/Details");
  console.log("page", page.response.status, page.response.url, page.html.length);
  fs.writeFileSync("tmp/etime-rowdata.html", page.html);

  const forms = Array.from(page.html.matchAll(/<form[\s\S]*?<\/form>/gi)).map((m) =>
    m[0].slice(0, 1500),
  );
  console.log("forms count", forms.length);
  console.log(forms[0]?.slice(0, 2000));

  const inputs = Array.from(page.html.matchAll(/<(?:input|select|button)[^>]*>/gi))
    .map((m) => m[0])
    .filter((x) => /date|from|to|search|submit|emp|dept|download|export|ajax/i.test(x))
    .slice(0, 60);
  console.log("inputs:\n" + inputs.join("\n"));

  const ajaxUrls = Array.from(
    page.html.matchAll(/url\s*:\s*["']([^"']+)["']/gi),
  ).map((m) => m[1]!);
  console.log("ajax urls:\n" + Array.from(new Set(ajaxUrls)).join("\n"));

  const date = todayMaldivesIso();
  // Try common TeamOffice RowData endpoints
  const tries = [
    {
      url: "https://etimeoffice.com/RowData/GetData",
      method: "POST",
      body: new URLSearchParams({
        fromDate: date,
        toDate: date,
        FromDate: date,
        ToDate: date,
        date,
      }),
    },
    {
      url: "https://etimeoffice.com/RowData/Details",
      method: "POST",
      body: new URLSearchParams({
        fromDate: date,
        toDate: date,
        FromDate: date,
        ToDate: date,
      }),
    },
  ];

  for (const tryReq of tries) {
    const result = await fetchWithCookies(tryReq.url, {
      method: tryReq.method,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tryReq.body,
    });
    console.log(
      JSON.stringify({
        url: tryReq.url,
        status: result.response.status,
        final: result.response.url,
        len: result.html.length,
        hasTable: result.html.includes("<table"),
        snippet: result.html.slice(0, 200).replace(/\s+/g, " "),
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
