import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encrypt,
  decrypt,
  generateKey,
  getMasterKey,
  wrapKey,
  unwrapKey,
  createTenantKeyMaterial,
  unwrapTenantMasterKey,
  createMessageKeyMaterial,
  unwrapMessageKey,
  type EncryptedPayload,
} from "./envelope";

beforeAll(() => {
  const key = generateKey().toString("base64");
  process.env.MASTER_KEY = key;
});

afterAll(() => {
  delete process.env.MASTER_KEY;
});

describe("encrypt / decrypt", () => {
  it("round-trip mit korrektem Klartext", () => {
    const key = generateKey();
    const plaintext = Buffer.from("Hallo Trustello!");
    const payload = encrypt(plaintext, key);
    const result = decrypt(payload, key);
    expect(result.toString()).toBe("Hallo Trustello!");
  });

  it("decrypt mit falschem Key wirft", () => {
    const key = generateKey();
    const wrongKey = generateKey();
    const payload = encrypt(Buffer.from("Geheim"), key);
    expect(() => decrypt(payload, wrongKey)).toThrow();
  });

  it("decrypt mit manipuliertem authTag wirft", () => {
    const key = generateKey();
    const payload = encrypt(Buffer.from("Geheim"), key);
    const tampered: EncryptedPayload = {
      ...payload,
      authTag: Buffer.alloc(16, 0xff),
    };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it("encrypt mit falsch langer Key wirft", () => {
    expect(() => encrypt(Buffer.from("x"), Buffer.from("zu-kurz"))).toThrow("Key must be 32 bytes");
  });
});

describe("getMasterKey", () => {
  it("wirft wenn MASTER_KEY fehlt", () => {
    const saved = process.env.MASTER_KEY;
    delete process.env.MASTER_KEY;
    expect(() => getMasterKey()).toThrow("MASTER_KEY not set in env");
    process.env.MASTER_KEY = saved;
  });

  it("wirft wenn MASTER_KEY nicht 32 bytes dekodiert", () => {
    process.env.MASTER_KEY = Buffer.from("zu-kurz").toString("base64");
    expect(() => getMasterKey()).toThrow("MASTER_KEY must decode to 32 bytes");
    process.env.MASTER_KEY = generateKey().toString("base64");
  });
});

describe("wrapKey / unwrapKey", () => {
  it("wrap und unwrap ergeben original key", () => {
    const masterKey = generateKey();
    const keyToWrap = generateKey();
    const wrapped = wrapKey(keyToWrap, masterKey);
    const unwrapped = unwrapKey(wrapped, masterKey);
    expect(unwrapped.equals(keyToWrap)).toBe(true);
  });
});

describe("Tenant Master Key", () => {
  it("createTenantKeyMaterial gibt 3 Buffer zurück", () => {
    const material = createTenantKeyMaterial();
    expect(Buffer.isBuffer(material.tenantMasterKey)).toBe(true);
    expect(Buffer.isBuffer(material.tmkIv)).toBe(true);
    expect(Buffer.isBuffer(material.tmkAuthTag)).toBe(true);
  });

  it("unwrapTenantMasterKey gibt 32-Byte-Schlüssel zurück", () => {
    const material = createTenantKeyMaterial();
    const tmk = unwrapTenantMasterKey(material);
    expect(tmk).toHaveLength(32);
  });

  it("zwei verschiedene createTenantKeyMaterial-Aufrufe ergeben verschiedene TMKs", () => {
    const m1 = unwrapTenantMasterKey(createTenantKeyMaterial());
    const m2 = unwrapTenantMasterKey(createTenantKeyMaterial());
    expect(m1.equals(m2)).toBe(false);
  });
});

describe("Message Key", () => {
  it("createMessageKeyMaterial gibt plain + wrapped zurück", () => {
    const tmk = generateKey();
    const { plain, wrapped } = createMessageKeyMaterial(tmk);
    expect(plain).toHaveLength(32);
    expect(Buffer.isBuffer(wrapped.messageKey)).toBe(true);
  });

  it("unwrapMessageKey gibt original plain key zurück", () => {
    const tmk = generateKey();
    const { plain, wrapped } = createMessageKeyMaterial(tmk);
    const unwrapped = unwrapMessageKey(wrapped, tmk);
    expect(unwrapped.equals(plain)).toBe(true);
  });
});

describe("3-Level-Round-trip: MASTER_KEY → TMK → MK → Content", () => {
  it("verschlüsselt und entschlüsselt Inhalt über alle drei Ebenen", () => {
    // Ebene 1: MASTER_KEY → TMK
    const tmkMaterial = createTenantKeyMaterial();
    const tmk = unwrapTenantMasterKey(tmkMaterial);

    // Ebene 2: TMK → MK
    const { plain: messageKey, wrapped: mkMaterial } = createMessageKeyMaterial(tmk);

    // Ebene 3: MK → Content
    const originalContent = Buffer.from("Sehr geehrte Bürger:in, Ihr Antrag wurde bearbeitet.");
    const { ciphertext, iv, authTag } = encrypt(originalContent, messageKey);

    // Vollständige Entschlüsselung
    const recoveredTmk = unwrapTenantMasterKey(tmkMaterial);
    const recoveredMk = unwrapMessageKey(mkMaterial, recoveredTmk);
    const recoveredContent = decrypt({ ciphertext, iv, authTag }, recoveredMk);

    expect(recoveredContent.toString()).toBe(originalContent.toString());
  });
});
