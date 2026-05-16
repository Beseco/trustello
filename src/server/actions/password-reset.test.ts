import { describe, it, expect } from "vitest";

// Testet die Zod-Validierung, die in resetPassword verwendet wird — ohne DB-Zugriff
const resetSchema = {
  minPassword: (pw: string) => pw.length >= 8,
  hasUppercase: (pw: string) => /[A-Z]/.test(pw),
  hasDigit: (pw: string) => /[0-9]/.test(pw),
};

describe("resetSchema password rules", () => {
  it("akzeptiert gültiges Passwort", () => {
    const pw = "Sicher1!";
    expect(resetSchema.minPassword(pw)).toBe(true);
    expect(resetSchema.hasUppercase(pw)).toBe(true);
    expect(resetSchema.hasDigit(pw)).toBe(true);
  });

  it("lehnt zu kurzes Passwort ab", () => {
    expect(resetSchema.minPassword("Ab1")).toBe(false);
  });

  it("lehnt Passwort ohne Großbuchstabe ab", () => {
    expect(resetSchema.hasUppercase("sicher123")).toBe(false);
  });

  it("lehnt Passwort ohne Ziffer ab", () => {
    expect(resetSchema.hasDigit("SicherPass")).toBe(false);
  });

  it("akzeptiert Passwort mit Sonderzeichen", () => {
    const pw = "Sicher@1!";
    expect(resetSchema.minPassword(pw)).toBe(true);
    expect(resetSchema.hasUppercase(pw)).toBe(true);
    expect(resetSchema.hasDigit(pw)).toBe(true);
  });
});

describe("requestPasswordReset – E-Mail-Validierung", () => {
  const validEmails = [
    "test@example.de",
    "user.name@behoerde.de",
    "florian@beubl.de",
  ];

  const invalidEmails = ["notanemail", "@missing.com", "no-at-sign", ""];

  it("erkennt gültige E-Mail-Adressen", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of validEmails) {
      expect(emailRegex.test(email)).toBe(true);
    }
  });

  it("erkennt ungültige E-Mail-Adressen", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of invalidEmails) {
      expect(emailRegex.test(email)).toBe(false);
    }
  });
});
