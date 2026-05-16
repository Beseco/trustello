import { describe, it, expect } from "vitest";
import { meetsMinTrust } from "./trust";

describe("meetsMinTrust", () => {
  it("NONE meets NONE", () => {
    expect(meetsMinTrust("NONE", "NONE")).toBe(true);
  });

  it("EMAIL meets NONE", () => {
    expect(meetsMinTrust("EMAIL", "NONE")).toBe(true);
  });

  it("EMAIL meets EMAIL", () => {
    expect(meetsMinTrust("EMAIL", "EMAIL")).toBe(true);
  });

  it("NONE does not meet EMAIL", () => {
    expect(meetsMinTrust("NONE", "EMAIL")).toBe(false);
  });

  it("SMS meets EMAIL", () => {
    expect(meetsMinTrust("SMS", "EMAIL")).toBe(true);
  });

  it("EMAIL does not meet SMS", () => {
    expect(meetsMinTrust("EMAIL", "SMS")).toBe(false);
  });

  it("EID meets all levels", () => {
    const levels = ["NONE", "EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"] as const;
    for (const level of levels) {
      expect(meetsMinTrust("EID", level)).toBe(true);
    }
  });

  it("NONE does not meet any level except NONE", () => {
    const levels = ["EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"] as const;
    for (const level of levels) {
      expect(meetsMinTrust("NONE", level)).toBe(false);
    }
  });

  it("BAYERN_ID_H meets BAYERN_ID_S but not EID", () => {
    expect(meetsMinTrust("BAYERN_ID_H", "BAYERN_ID_S")).toBe(true);
    expect(meetsMinTrust("BAYERN_ID_H", "EID")).toBe(false);
  });
});
