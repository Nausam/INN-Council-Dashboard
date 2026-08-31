import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { EtimeClient } = await import("../lib/etime/client");
  const client = EtimeClient.fromEnv();
  await client.login();
  const session = client.getSession();

  const dash = await fetch("https://etimeoffice.com/Dashboard/Details", {
    headers: {
      Cookie: session.cookieHeader,
      "User-Agent": "hr-dashboard-attendance-sync/1.0",
    },
    redirect: "follow",
  });
  // Re-merge cookies from redirects is hard; use client private path via fetchRaw after login probe
  let html = await dash.text();
  console.log("dash final", dash.url, dash.status, html.length);

  // If redirected with token path, follow manually with cookies
  if (!html || html.length < 500) {
    const { response, } = await (client as any).fetchWithCookies?.(
      "https://etimeoffice.com/Dashboard/Details",
    ) ?? {};
    console.log("alt", response?.url, response?.status);
  }

  // Use authenticated client method by temporarily exposing through login then dashboard
  const probeClient = client as unknown as {
    fetchWithCookies: (
      url: string,
      init?: RequestInit,
    ) => Promise<{ response: Response; html: string }>;
  };

  const details = await probeClient.fetchWithCookies(
    "https://etimeoffice.com/Dashboard/Details",
  );
  html = details.html;
  console.log("details", details.response.url, details.response.status, html.length);

  const hrefs = Array.from(
    html.matchAll(/href=["']([^"']+)["']/gi),
    (m) => m[1]!,
  );
  const interesting = hrefs
    .filter((h) =>
      /raw|punch|attend|report|download|export|log/i.test(h),
    )
    .slice(0, 80);
  console.log("interesting hrefs:\n" + interesting.join("\n"));

  const texts = Array.from(
    html.matchAll(/>([^<]*(?:Raw|Punch|Attendance|Report)[^<]*)</gi),
    (m) => m[1]!.trim(),
  ).filter(Boolean);
  console.log("menu texts:\n" + Array.from(new Set(texts)).slice(0, 40).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
