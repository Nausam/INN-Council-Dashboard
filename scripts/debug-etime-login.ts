import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const baseUrl = process.env.ETIME_BASE_URL!.replace(/\/+$/, "");
  const company = process.env.ETIME_COMPANY!;
  const username = process.env.ETIME_USERNAME!;
  const password = process.env.ETIME_PASSWORD!;

  const landingUrl = `${baseUrl}/Login/Logout`;
  const landing = await fetch(landingUrl, {
    headers: { "User-Agent": "hr-dashboard-attendance-sync/1.0" },
    redirect: "follow",
  });
  const landingHtml = await landing.text();
  const setCookies = landing.headers.getSetCookie?.() ?? [];
  console.log("landing status", landing.status, "url", landing.url);
  console.log("set-cookie count", setCookies.length);
  console.log(
    "set-cookie names",
    setCookies.map((c) => c.split("=")[0]),
  );

  const token =
    landingHtml.match(
      /name=["']__RequestVerificationToken["']\s+type=["']hidden["']\s+value=["']([^"']+)["']/i,
    )?.[1] ??
    landingHtml.match(
      /name=["']__RequestVerificationToken["']\s+value=["']([^"']+)["']/i,
    )?.[1];
  console.log("token found", Boolean(token), token?.slice(0, 20));

  const cookieHeader = setCookies
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");

  const body = new URLSearchParams({
    "loginModel.corporateId": company,
    "loginModel.userName": username,
    "loginModel.password": password,
    pageTital: "Login Page",
    __RequestVerificationToken: token ?? "",
  });

  const loginUrl = `${baseUrl}/Login/loginCheck`;
  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: landingUrl,
      Origin: baseUrl,
      Accept: "text/html,application/xhtml+xml",
    },
    body,
    redirect: "manual",
  });

  console.log("login status", response.status);
  console.log("login location", response.headers.get("location"));
  console.log(
    "login set-cookie",
    (response.headers.getSetCookie?.() ?? []).map((c) => c.split("=")[0]),
  );

  const html = await response.text();
  console.log("body len", html.length);
  console.log("body snippet", html.slice(0, 500).replace(/\s+/g, " "));
  console.log(
    "still login page?",
    html.toLowerCase().includes("login to continue") ||
      html.toLowerCase().includes("loginmodel.password"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
