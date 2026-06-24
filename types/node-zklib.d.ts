declare module "node-zklib" {
  export type ZkAttendanceRecord = Record<string, unknown>;

  export type ZkUserRecord = {
    uid?: string | number;
    userId?: string | number;
    name?: string;
    [key: string]: unknown;
  };

  export type ZkInfo = {
    serialnumber?: string;
    logCounts?: number;
    logCapacity?: number;
    userCounts?: number;
    [key: string]: unknown;
  };

  export default class ZKLib {
    constructor(ip: string, port: number, timeout?: number, inport?: number);
    createSocket(
      onError?: (error: unknown) => void,
      onClose?: () => void,
    ): Promise<void>;
    enableDevice(): Promise<void>;
    disconnect(): Promise<void>;
    getInfo(): Promise<ZkInfo>;
    getUsers(): Promise<{ data?: ZkUserRecord[] } | ZkUserRecord[]>;
    getAttendances(
      onProgress?: (received: number, total: number) => void,
    ): Promise<{ data?: ZkAttendanceRecord[]; err?: Error } | ZkAttendanceRecord[]>;
  }
}

declare module "node-zklib/constants" {
  export const COMMANDS: Record<string, number>;
  export const REQUEST_DATA: Record<string, Buffer>;
  export const MAX_CHUNK: number;
}

declare module "node-zklib/utils" {
  export function checkNotEventTCP(data: Buffer): boolean;
  export function createTCPHeader(
    command: number,
    sessionId: number,
    replyId: number,
    data: Buffer | string,
  ): Buffer;
  export function decodeRecordData40(data: Buffer): Record<string, unknown>;
  export function decodeTCPHeader(data: Buffer): {
    commandId: number;
    checkSum: number;
    sessionId: number;
    replyId: number;
    payloadSize: number;
  };
}
