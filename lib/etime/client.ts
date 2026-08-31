import { getEtimeConfig, getRequiredEtimeConfig } from "@/lib/etime/config";
import {
  parseEtimeHtmlSnapshot,
  parseEtimeTimestamp,
} from "@/lib/etime/parser";

export type EtimeSession = {
  cookieHeader: string;
  csrfToken: string | null;
};

export type EtimeFetchResult = {
  html: string;
  url: string;
};

function mergeCookieHeader(setCookie: string[] | null, existing?: string): string {
  const jar = new Map<string, string>();

  if (existing) {
    for (const part of existing.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name && rest.length) jar.set(name, rest.join("="));
    }
  }

  for (const cookie of setCookie ?? []) {
    const segment = cookie.split(";")[0]?.trim();
    if (!segment) continue;
    const [name, ...rest] = segment.split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function extractCsrfToken(html: string): string | null {
  const match =
    html.match(
      /name=["']__RequestVerificationToken["']\s+type=["']hidden["']\s+value=["']([^"']+)["']/i,
    ) ??
    html.match(
      /name=["']__RequestVerificationToken["']\s+value=["']([^"']+)["']/i,
    );
  return match?.[1]?.trim() ?? null;
}

function isLoginPage(html: string, finalUrl: string): boolean {
  const lower = html.toLowerCase();
  const url = finalUrl.toLowerCase();
  if (url.includes("/dashboard") || url.includes("/rowdata")) return false;
  if (url.includes("/login/logout") || /\/login\/?(\?|$)/.test(url)) {
    return true;
  }
  return (
    lower.includes("login to continue") ||
    lower.includes('name="loginmodel.password"') ||
    lower.includes('id="loginform"')
  );
}

function resolveUrl(baseUrl: string, location: string | null): string | null {
  if (!location) return null;
  try {
    return new URL(location, baseUrl).toString();
  } catch {
    return null;
  }
}

function toDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export class EtimeClient {
  private cookieHeader = "";
  private csrfToken: string | null = null;

  constructor(private readonly config = getRequiredEtimeConfig()) {}

  static fromEnv(): EtimeClient {
    return new EtimeClient(getRequiredEtimeConfig());
  }

  getSession(): EtimeSession {
    return { cookieHeader: this.cookieHeader, csrfToken: this.csrfToken };
  }

  private async fetchWithCookies(
    url: string,
    init: RequestInit = {},
  ): Promise<{ response: Response; html: string }> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", "hr-dashboard-attendance-sync/1.0");
    if (this.cookieHeader) headers.set("Cookie", this.cookieHeader);

    const response = await fetch(url, {
      ...init,
      headers,
      redirect: "manual",
    });

    this.cookieHeader = mergeCookieHeader(
      response.headers.getSetCookie?.() ?? null,
      this.cookieHeader,
    );

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = resolveUrl(this.config.baseUrl, response.headers.get("location"));
      if (next) {
        await response.arrayBuffer().catch(() => undefined);
        return this.fetchWithCookies(next, {
          method: "GET",
          headers: {
            Referer: url,
          },
        });
      }
    }

    const html = await response.text();
    return { response, html };
  }

  async login(): Promise<void> {
    const landingUrl = `${this.config.baseUrl}/Login/Logout`;
    const landing = await this.fetchWithCookies(landingUrl);
    this.csrfToken = extractCsrfToken(landing.html);

    if (!this.csrfToken) {
      throw new Error("eTime login page missing verification token.");
    }

    const body = new URLSearchParams({
      "loginModel.corporateId": this.config.company,
      "loginModel.userName": this.config.username,
      "loginModel.password": this.config.password,
      pageTital: "Login Page",
      __RequestVerificationToken: this.csrfToken,
    });

    const loginUrl = `${this.config.baseUrl}/Login/loginCheck`;
    const { response, html } = await this.fetchWithCookies(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: landingUrl,
        Origin: this.config.baseUrl,
      },
      body,
    });

    if (isLoginPage(html, response.url) || !this.cookieHeader.includes("access_token")) {
      throw new Error("eTime login failed.");
    }

    this.csrfToken = extractCsrfToken(html) ?? this.csrfToken;
  }

  async ensureAuthenticated(): Promise<void> {
    if (!this.cookieHeader.includes("access_token")) {
      await this.login();
      return;
    }

    const { response, html } = await this.fetchWithCookies(
      `${this.config.baseUrl}/Dashboard/Details`,
    );
    if (isLoginPage(html, response.url)) {
      await this.login();
    } else {
      this.csrfToken = extractCsrfToken(html) ?? this.csrfToken;
    }
  }

  async fetchRawDataHtml(date: string): Promise<EtimeFetchResult> {
    await this.ensureAuthenticated();

    const page = await this.fetchWithCookies(`${this.config.baseUrl}/RowData/Details`);
    if (isLoginPage(page.html, page.response.url)) {
      await this.login();
      return this.fetchRawDataHtml(date);
    }

    const action =
      page.html.match(
        /<form[^>]*action=["']([^"']*RowData\/Details[^"']*)["']/i,
      )?.[1] ?? "/RowData/Details";
    const token = extractCsrfToken(page.html);
    if (!token) {
      throw new Error("eTime RowData page missing verification token.");
    }

    const body = new URLSearchParams({
      compId: "0",
      deptId: "0",
      empCodeId: "0",
      SelectPunchId: "0",
      Selectignore: "0",
      fromDate: toDdMmYyyy(date),
      toDate: toDdMmYyyy(date),
      __RequestVerificationToken: token,
    });

    const actionUrl = action.startsWith("http")
      ? action
      : `${this.config.baseUrl}${action}`;

    const filtered = await this.fetchWithCookies(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${this.config.baseUrl}/RowData/Details`,
        Origin: this.config.baseUrl,
      },
      body,
    });

    return { html: filtered.html, url: filtered.response.url };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!getEtimeConfig().enabled) {
      return { ok: false, message: "eTime integration is disabled." };
    }
    await this.login();
    return { ok: true, message: "eTime / TeamOffice login succeeded." };
  }

  async fetchSnapshot(date: string) {
    const { html } = await this.fetchRawDataHtml(date);
    return parseEtimeHtmlSnapshot(html, date);
  }

  async fetchSnapshotWithTimestamps(date: string) {
    const snapshot = await this.fetchSnapshot(date);
    return {
      ...snapshot,
      rows: snapshot.rows.map((row) => ({
        ...row,
        timestampUtc: parseEtimeTimestamp(row.timestampText, date),
      })),
    };
  }
}
