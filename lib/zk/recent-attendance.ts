import type { Socket } from "node:net";

import { COMMANDS, MAX_CHUNK, REQUEST_DATA } from "node-zklib/constants";
import {
  checkNotEventTCP,
  createTCPHeader,
  decodeRecordData40,
  decodeTCPHeader,
} from "node-zklib/utils";

import type { ZkAttendanceRecord, ZkInfo } from "node-zklib";

type ZkTcpConnection = {
  replyId: number;
  sessionId: number;
  socket: Socket | null;
  freeData: () => Promise<unknown>;
  getInfo: () => Promise<ZkInfo>;
  sendChunkRequest: (start: number, size: number) => void;
};

export type RecentZkAttendanceRead = {
  info: ZkInfo;
  totalSize: number;
  maxRecords: number;
  recordsRead: number;
  records: ZkAttendanceRecord[];
};

function requireSocket(tcp: ZkTcpConnection): Socket {
  if (!tcp.socket) throw new Error("ZK TCP socket is not connected.");
  return tcp.socket;
}

function oncePacket(
  tcp: ZkTcpConnection,
  message: Buffer,
  timeoutMs: number,
): Promise<Buffer> {
  const socket = requireSocket(tcp);

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    let buffer = Buffer.alloc(0);

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onData = (data: Buffer) => {
      if (checkNotEventTCP(data)) return;
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length >= 16) {
        const packetLength = buffer.readUIntLE(4, 2);
        const totalPacketLength = 8 + packetLength;
        if (buffer.length < totalPacketLength) return;

        const packet = buffer.subarray(0, totalPacketLength);
        cleanup();
        resolve(packet);
        return;
      }
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.write(message, (error) => {
      if (error) {
        onError(error);
        return;
      }
      timer = setTimeout(
        () => onError(new Error("Timed out waiting for ZK data packet.")),
        timeoutMs,
      );
    });
  });
}

function readChunk(
  tcp: ZkTcpConnection,
  start: number,
  size: number,
  timeoutMs: number,
): Promise<Buffer> {
  const socket = requireSocket(tcp);

  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined;
    let raw = Buffer.alloc(0);
    let payload = Buffer.alloc(0);

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("error", fail);
      socket.removeListener("close", onClose);
    };

    const fail = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () =>
          fail(
            new Error(
              `Timed out reading ZK chunk start=${start} size=${size} received=${payload.length}.`,
            ),
          ),
        timeoutMs,
      );
    };

    const onClose = () => fail(new Error("ZK socket closed while reading data."));

    const onData = (data: Buffer) => {
      if (checkNotEventTCP(data)) return;
      raw = Buffer.concat([raw, data]);
      resetTimer();

      while (raw.length >= 16) {
        const packetLength = raw.readUIntLE(4, 2);
        const totalPacketLength = 8 + packetLength;
        if (raw.length < totalPacketLength) break;

        const packet = raw.subarray(0, totalPacketLength);
        raw = raw.subarray(totalPacketLength);
        const header = decodeTCPHeader(packet.subarray(0, 16));

        if (
          header.commandId !== COMMANDS.CMD_DATA &&
          header.commandId !== COMMANDS.CMD_ACK_OK
        ) {
          continue;
        }

        payload = Buffer.concat([payload, packet.subarray(16, totalPacketLength)]);
        if (payload.length >= size) {
          cleanup();
          resolve(payload.subarray(0, size));
          return;
        }
      }
    };

    socket.on("data", onData);
    socket.once("error", fail);
    socket.once("close", onClose);
    resetTimer();
    tcp.sendChunkRequest(start, size);
  });
}

async function prepareAttendanceRead(
  tcp: ZkTcpConnection,
  timeoutMs: number,
): Promise<number> {
  tcp.replyId += 1;
  const message = createTCPHeader(
    COMMANDS.CMD_DATA_WRRQ,
    tcp.sessionId,
    tcp.replyId,
    REQUEST_DATA.GET_ATTENDANCE_LOGS,
  );
  const packet = await oncePacket(tcp, message, timeoutMs);
  const header = decodeTCPHeader(packet.subarray(0, 16));

  if (header.commandId === COMMANDS.CMD_DATA) {
    return packet.length - 16;
  }

  if (
    header.commandId === COMMANDS.CMD_ACK_OK ||
    header.commandId === COMMANDS.CMD_PREPARE_DATA
  ) {
    return packet.subarray(16).readUIntLE(1, 4);
  }

  throw new Error(`Unexpected ZK prepare command: ${header.commandId}.`);
}

export async function readRecentAttendanceRecordsFromTcp(
  tcp: ZkTcpConnection,
  limit: number,
  timeoutMs: number,
): Promise<RecentZkAttendanceRead> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const info = await tcp.getInfo();

  await tcp.freeData().catch(() => undefined);
  const totalSize = await prepareAttendanceRead(tcp, timeoutMs);
  const maxRecords = Math.floor(Math.max(0, totalSize - 4) / 40);
  const recordsRead = Math.min(safeLimit, maxRecords);
  const start = 4 + (maxRecords - recordsRead) * 40;
  const size = recordsRead * 40;
  const buffers: Buffer[] = [];

  for (let offset = 0; offset < size; offset += MAX_CHUNK) {
    const chunkSize = Math.min(MAX_CHUNK, size - offset);
    buffers.push(await readChunk(tcp, start + offset, chunkSize, timeoutMs));
  }

  const data = Buffer.concat(buffers);
  const records: ZkAttendanceRecord[] = [];
  for (let offset = 0; offset + 40 <= data.length; offset += 40) {
    const record = decodeRecordData40(data.subarray(offset, offset + 40));
    if (record.deviceUserId) records.push(record);
  }

  await tcp.freeData().catch(() => undefined);

  return {
    info,
    totalSize,
    maxRecords,
    recordsRead,
    records,
  };
}
