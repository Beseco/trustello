import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm" as const;
const KEY_LEN = 32;
const IV_LEN = 12;

export type EncryptedPayload = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function encrypt(plaintext: Buffer, key: Buffer): EncryptedPayload {
  if (key.length !== KEY_LEN) throw new Error("Key must be 32 bytes");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, payload.iv);
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
}

export function generateKey(): Buffer {
  return randomBytes(KEY_LEN);
}

export function getMasterKey(): Buffer {
  const b64 = process.env.MASTER_KEY;
  if (!b64) throw new Error("MASTER_KEY not set in env");
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_LEN) throw new Error("MASTER_KEY must decode to 32 bytes");
  return key;
}

export function wrapKey(keyToWrap: Buffer, wrappingKey: Buffer): EncryptedPayload {
  return encrypt(keyToWrap, wrappingKey);
}

export function unwrapKey(wrapped: EncryptedPayload, wrappingKey: Buffer): Buffer {
  return decrypt(wrapped, wrappingKey);
}

// ===== Tenant Key Material =====

export type TenantKeyMaterial = {
  tenantMasterKey: Buffer;
  tmkIv: Buffer;
  tmkAuthTag: Buffer;
};

export function createTenantKeyMaterial(): TenantKeyMaterial {
  const tmkPlain = generateKey();
  const wrapped = wrapKey(tmkPlain, getMasterKey());
  return {
    tenantMasterKey: wrapped.ciphertext,
    tmkIv: wrapped.iv,
    tmkAuthTag: wrapped.authTag,
  };
}

export function unwrapTenantMasterKey(material: TenantKeyMaterial): Buffer {
  return unwrapKey(
    { ciphertext: material.tenantMasterKey, iv: material.tmkIv, authTag: material.tmkAuthTag },
    getMasterKey(),
  );
}

// ===== Message Key Material =====

export type MessageKeyMaterial = {
  messageKey: Buffer;
  messageKeyIv: Buffer;
  messageKeyAuthTag: Buffer;
};

export function createMessageKeyMaterial(tmk: Buffer): {
  plain: Buffer;
  wrapped: MessageKeyMaterial;
} {
  const plain = generateKey();
  const wrapped = wrapKey(plain, tmk);
  return {
    plain,
    wrapped: {
      messageKey: wrapped.ciphertext,
      messageKeyIv: wrapped.iv,
      messageKeyAuthTag: wrapped.authTag,
    },
  };
}

export function unwrapMessageKey(material: MessageKeyMaterial, tmk: Buffer): Buffer {
  return unwrapKey(
    { ciphertext: material.messageKey, iv: material.messageKeyIv, authTag: material.messageKeyAuthTag },
    tmk,
  );
}
