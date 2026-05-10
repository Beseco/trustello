import { describe, it, expect } from "vitest";
import { deriveKeyFromPassword, generateSalt } from "./kdf";
import { encrypt, decrypt, generateKey } from "./envelope";

describe("deriveKeyFromPassword", () => {
  it("produziert 32-Byte-Buffer", async () => {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword("meinPasswort123", salt);
    expect(key).toHaveLength(32);
    expect(Buffer.isBuffer(key)).toBe(true);
  });

  it("gleiche Inputs → gleicher Output (deterministisch)", async () => {
    const salt = generateSalt();
    const password = "TestPasswort!42";
    const key1 = await deriveKeyFromPassword(password, salt);
    const key2 = await deriveKeyFromPassword(password, salt);
    expect(key1.equals(key2)).toBe(true);
  });

  it("verschiedene Salts → verschiedene Keys", async () => {
    const password = "GleichesPasswort";
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = await deriveKeyFromPassword(password, salt1);
    const key2 = await deriveKeyFromPassword(password, salt2);
    expect(key1.equals(key2)).toBe(false);
  });

  it("key aus Passwort entschlüsselt Inhalt korrekt", async () => {
    const password = "BürgerPortalGeheim!";
    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt);

    const plaintext = Buffer.from("Vertrauliche Nachricht für Bürger");
    const payload = encrypt(plaintext, key);

    const recoveryKey = await deriveKeyFromPassword(password, salt);
    const decrypted = decrypt(payload, recoveryKey);
    expect(decrypted.toString()).toBe(plaintext.toString());
  });
});

describe("generateSalt", () => {
  it("produziert 32-Byte-Buffer", () => {
    const salt = generateSalt();
    expect(salt).toHaveLength(32);
    expect(Buffer.isBuffer(salt)).toBe(true);
  });

  it("jeder Aufruf produziert anderen Salt", () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(s1.equals(s2)).toBe(false);
  });
});
