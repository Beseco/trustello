import { createConnection } from "node:net";

export type ScanResult = {
  clean: boolean;
  result: string;
};

const CLAMAV_HOST = process.env.CLAMAV_HOST ?? "localhost";
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT ?? 3310);
const SCAN_TIMEOUT_MS = 30_000;

/**
 * Scans a buffer for viruses using ClamAV INSTREAM protocol.
 * Returns {clean: true} if no threat found, {clean: false, result: "..."} otherwise.
 */
export function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: CLAMAV_HOST, port: CLAMAV_PORT });
    const chunks: Buffer[] = [];
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      reject(new Error("ClamAV scan timeout"));
    }, SCAN_TIMEOUT_MS);

    socket.on("connect", () => {
      // INSTREAM: send "zINSTREAM\0", then chunks of <4-byte-big-endian-len><data>, then <4 zero bytes>
      const cmd = Buffer.from("zINSTREAM\0");
      socket.write(cmd);

      const CHUNK_SIZE = 2048;
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
        const sizeHeader = Buffer.allocUnsafe(4);
        sizeHeader.writeUInt32BE(chunk.length, 0);
        socket.write(sizeHeader);
        socket.write(chunk);
      }

      // Terminate stream
      const end = Buffer.alloc(4, 0);
      socket.write(end);
    });

    socket.on("data", (chunk) => chunks.push(chunk));

    socket.on("end", () => {
      clearTimeout(timeout);
      if (timedOut) return;

      // ClamAV terminiert die Antwort mit \0 — trim() entfernt keine Null-Bytes
      const response = Buffer.concat(chunks).toString("utf-8").replace(/\0/g, "").trim();
      // Response format: "stream: OK" or "stream: <threat> FOUND"
      if (response.endsWith("OK")) {
        resolve({ clean: true, result: "OK" });
      } else {
        const match = response.match(/stream: (.+?) FOUND/);
        resolve({ clean: false, result: match?.[1] ?? response });
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      if (!timedOut) reject(err);
    });
  });
}
