import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiAuthError, requireScope } from "./api-auth";

// validateApiKey macht DB-Zugriffe – testen wir nur die reinen Hilfsfunktionen

describe("ApiAuthError", () => {
  it("hat korrekte Felder", () => {
    const err = new ApiAuthError(401, "Ungültig");
    expect(err.httpStatus).toBe(401);
    expect(err.message).toBe("Ungültig");
    expect(err).toBeInstanceOf(Error);
  });

  it("kann mit 403 instanziert werden", () => {
    const err = new ApiAuthError(403, "Kein Zugriff");
    expect(err.httpStatus).toBe(403);
  });
});

describe("requireScope", () => {
  const auth = { tenantId: "t1", scopes: ["customers:read", "messages:read"] };

  it("wirft nicht wenn Scope vorhanden", () => {
    expect(() => requireScope(auth, "customers:read")).not.toThrow();
  });

  it("wirft ApiAuthError wenn Scope fehlt", () => {
    expect(() => requireScope(auth, "customers:write")).toThrow(ApiAuthError);
  });

  it("wirft 403 bei fehlendem Scope", () => {
    try {
      requireScope(auth, "messages:write");
    } catch (e) {
      expect((e as ApiAuthError).httpStatus).toBe(403);
    }
  });

  it("erlaubt mehrere Scopes", () => {
    expect(() => requireScope(auth, "customers:read")).not.toThrow();
    expect(() => requireScope(auth, "messages:read")).not.toThrow();
  });
});
