import { scrypt, randomBytes } from "node:crypto";

const SALT_LEN = 32;
const KEY_LEN = 32;
// 128 * N * r * 2 bytes headroom above the theoretical minimum
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 128 * 32768 * 8 * 2 };

export function deriveKeyFromPassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LEN);
}
