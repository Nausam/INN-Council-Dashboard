export type ZkConfig = {
  enabled: boolean;
  ip: string;
  port: number;
  timeoutMs: number;
  pollMs: number;
  reconnectMs: number;
  timezone: string;
  inport: number;
  errors: string[];
};

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getZkConfig(): ZkConfig {
  const enabled = ["1", "true", "yes"].includes(
    String(process.env.ZK_ENABLED ?? "").toLowerCase(),
  );
  const ip = process.env.ZK_IP?.trim() ?? "";
  const errors: string[] = [];

  if (enabled && !ip) errors.push("ZK_IP is required when ZK_ENABLED=1.");

  return {
    enabled,
    ip,
    port: intFromEnv("ZK_PORT", 4370),
    timeoutMs: intFromEnv("ZK_TIMEOUT_MS", 60000),
    pollMs: intFromEnv("ZK_POLL_MS", 2000),
    reconnectMs: intFromEnv("ZK_RECONNECT_MS", 5000),
    timezone: process.env.ZK_TIMEZONE?.trim() || "Indian/Maldives",
    inport: intFromEnv("ZK_INPORT", 4000),
    errors,
  };
}

export function getRequiredZkConfig(): ZkConfig {
  const config = getZkConfig();
  if (!config.enabled) {
    throw new Error("ZKTeco integration is disabled. Set ZK_ENABLED=1.");
  }
  if (config.errors.length > 0) {
    throw new Error(config.errors.join(" "));
  }
  return config;
}

export function publicZkConfig(config = getZkConfig()) {
  return {
    enabled: config.enabled,
    configured: config.enabled && config.errors.length === 0,
    ip: config.ip,
    port: config.port,
    pollMs: config.pollMs,
    timezone: config.timezone,
    errors: config.errors,
  };
}
