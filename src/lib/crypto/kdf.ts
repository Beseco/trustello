import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

const SALT_LEN = 32;
const KEY_LEN = 32;

// OWASP 2023 Empfehlung: 600.000 Iterationen mit SHA-256
// Identisch mit PBKDF2_ITERATIONS in src/lib/crypto/client-vault.ts — beide Seiten
// müssen exakt dieselben Parameter verwenden.
export const PBKDF2_ITERATIONS = 600_000;
export const PBKDF2_DIGEST = "sha256";

export async function deriveKeyFromPassword(password: string, salt: Buffer): Promise<Buffer> {
  return pbkdf2Async(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LEN,
    PBKDF2_DIGEST,
  ) as Promise<Buffer>;
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LEN);
}
