export type EtimeConfig = {
  enabled: boolean;
  baseUrl: string;
  company: string;
  username: string;
  password: string;
  pollTodayMs: number;
  pollHistoryMs: number;
  maxRetryMs: number;
  errors: string[];
};

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getEtimeConfig(): EtimeConfig {
  const enabled = ["1", "true", "yes"].includes(
    String(process.env.ETIME_ENABLED ?? "").toLowerCase(),
  );
  const baseUrl = process.env.ETIME_BASE_URL?.trim() ?? "";
  const company = process.env.ETIME_COMPANY?.trim() ?? "";
  const username = process.env.ETIME_USERNAME?.trim() ?? "";
  const password = process.env.ETIME_PASSWORD?.trim() ?? "";
  const errors: string[] = [];

  if (enabled) {
    if (!baseUrl) errors.push("ETIME_BASE_URL is required when ETIME_ENABLED=1.");
    if (!company) errors.push("ETIME_COMPANY is required when ETIME_ENABLED=1.");
    if (!username) errors.push("ETIME_USERNAME is required when ETIME_ENABLED=1.");
    if (!password) errors.push("ETIME_PASSWORD is required when ETIME_ENABLED=1.");
  }

  return {
    enabled,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    company,
    username,
    password,
    pollTodayMs: intFromEnv("ETIME_POLL_TODAY_MS", 5 * 60 * 1000),
    pollHistoryMs: intFromEnv("ETIME_POLL_HISTORY_MS", 60 * 60 * 1000),
    maxRetryMs: intFromEnv("ETIME_MAX_RETRY_MS", 15 * 60 * 1000),
    errors,
  };
}

export function getRequiredEtimeConfig(): EtimeConfig {
  const config = getEtimeConfig();
  if (!config.enabled) {
    throw new Error("eTime integration is disabled. Set ETIME_ENABLED=1.");
  }
  if (config.errors.length > 0) {
    throw new Error(config.errors.join(" "));
  }
  return config;
}

export function publicEtimeConfig(config = getEtimeConfig()) {
  return {
    enabled: config.enabled,
    configured: config.enabled && config.errors.length === 0,
    baseUrl: config.baseUrl,
    pollTodayMs: config.pollTodayMs,
    pollHistoryMs: config.pollHistoryMs,
    errors: config.errors,
  };
}
