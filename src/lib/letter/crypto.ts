/**
 * Shared crypto helpers for letter-related sensitive data (API keys etc.)
 * Uses AES-256-GCM via MASTER_KEY (same pattern as sipgate.ts).
 */

import { encrypt, decrypt } from "@/lib/crypto/envelope";

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key) throw new Error("MASTER_KEY not set");
  return Buffer.from(key, "base64");
}

function toUint8Array(source: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(source.length);
  new Uint8Array(ab).set(source);
  return new Uint8Array(ab);
}

export function encryptToken(token: string): {
  tokenEnc: Uint8Array<ArrayBuffer>;
  tokenIv: Uint8Array<ArrayBuffer>;
  tokenTag: Uint8Array<ArrayBuffer>;
} {
  const { ciphertext, iv, authTag } = encrypt(Buffer.from(token, "utf-8"), getMasterKey());
  return {
    tokenEnc: toUint8Array(Buffer.from(ciphertext)),
    tokenIv: toUint8Array(Buffer.from(iv)),
    tokenTag: toUint8Array(Buffer.from(authTag)),
  };
}

export function decryptToken(config: {
  tokenEnc: Uint8Array | Buffer;
  tokenIv: Uint8Array | Buffer;
  tokenTag: Uint8Array | Buffer;
}): string | null {
  try {
    return decrypt(
      {
        ciphertext: Buffer.from(config.tokenEnc),
        iv: Buffer.from(config.tokenIv),
        authTag: Buffer.from(config.tokenTag),
      },
      getMasterKey(),
    ).toString("utf-8");
  } catch {
    return null;
  }
}
