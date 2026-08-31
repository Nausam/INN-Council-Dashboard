import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config({ path: ".env.local", override: true });

function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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
  const action =
    page.html.match(/<form[^>]*action=["']([^"']*RowData\/Details[^"']*)["']/i)?.[1] ??
    "/RowData/Details";
  const token =
    page.html.match(
      /name=["']__RequestVerificationToken["']\s+type=["']hidden["']\s+value=["']([^"']+)["']/i,
    )?.[1] ??
    page.html.match(
      /name=["']__RequestVerificationToken["']\s+value=["']([^"']+)["']/i,
    )?.[1];

  const date = todayMaldivesIso();
  const body = new URLSearchParams({
    compId: "0",
    deptId: "0",
    empCodeId: "0",
    SelectPunchId: "0",
    Selectignore: "0",
    fromDate: toDdMmYyyy(date),
    toDate: toDdMmYyyy(date),
    __RequestVerificationToken: token ?? "",
  });

  const actionUrl = action.startsWith("http")
    ? action
    : `https://etimeoffice.com${action}`;

  const result = await fetchWithCookies(actionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://etimeoffice.com/RowData/Details",
      Origin: "https://etimeoffice.com",
    },
    body,
  });

  fs.writeFileSync("tmp/etime-rowdata-result.html", result.html);
  console.log(
    JSON.stringify({
      status: result.response.status,
      url: result.response.url,
      len: result.html.length,
      hasTable: result.html.includes("employee_master_tbl"),
      rowCount: (result.html.match(/<tr>/gi) ?? []).length,
    }),
  );

  // Print first few data rows roughly
  const tbody = result.html.match(
    /<tbody[^>]*>([\s\S]*?)<\/tbody>/i,
  )?.[1];
  if (tbody) {
    const rows = Array.from(tbody.matchAll(/<tr[\s\S]*?<\/tr>/gi)).slice(0, 8);
    for (const row of rows) {
      const cells = Array.from(row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
        (m) => m[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
      );
      console.log(cells.join(" | "));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
