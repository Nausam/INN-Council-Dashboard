import ZKLib, {
  type ZkAttendanceRecord,
  type ZkInfo,
  type ZkUserRecord,
} from "node-zklib";

import type { ZkConfig } from "@/lib/zk/config";
import { readRecentAttendanceRecordsFromTcp } from "@/lib/zk/recent-attendance";

function normalizeList<T>(value: { data?: T[] } | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value?.data && Array.isArray(value.data)) return value.data;
  return [];
}

export class ZkDeviceClient {
  private readonly instance: ZKLib;
  private connected = false;

  constructor(private readonly config: ZkConfig) {
    this.instance = new ZKLib(
      config.ip,
      config.port,
      config.timeoutMs,
      config.inport,
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.instance.createSocket();
    await this.instance.enableDevice();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.instance.disconnect();
    } finally {
      this.connected = false;
    }
  }

  async getInfo(): Promise<ZkInfo> {
    await this.connect();
    return this.instance.getInfo();
  }

  async getUsers(): Promise<ZkUserRecord[]> {
    await this.connect();
    return normalizeList<ZkUserRecord>(await this.instance.getUsers());
  }

  async getAttendances(
    onProgress?: (received: number, total: number) => void,
  ): Promise<ZkAttendanceRecord[]> {
    await this.connect();
    const result = await this.instance.getAttendances(onProgress);
    if (!Array.isArray(result) && result?.err) {
      throw result.err;
    }
    return normalizeList<ZkAttendanceRecord>(result);
  }

  async getRecentAttendances(limit: number): Promise<ZkAttendanceRecord[]> {
    await this.connect();
    const tcp = (this.instance as unknown as { zklibTcp?: unknown }).zklibTcp;
    if (!tcp) {
      throw new Error("Recent ZK reads require a TCP device connection.");
    }

    const result = await readRecentAttendanceRecordsFromTcp(
      tcp as Parameters<typeof readRecentAttendanceRecordsFromTcp>[0],
      limit,
      this.config.timeoutMs,
    );
    return result.records;
  }
}

export async function withZkClient<T>(
  config: ZkConfig,
  fn: (client: ZkDeviceClient) => Promise<T>,
): Promise<T> {
  const client = new ZkDeviceClient(config);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}
