import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export type ApiAuthResult = {
  tenantId: string;
  scopes: string[];
};

export class ApiAuthError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

export async function validateApiKey(request: NextRequest): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiAuthError(401, "Kein Bearer-Token angegeben.");
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("tk_")) {
    throw new ApiAuthError(401, "Ungültiges Token-Format.");
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, tenantId: true, scopes: true, expiresAt: true },
  });

  if (!apiKey) throw new ApiAuthError(401, "Ungültiger API-Key.");
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new ApiAuthError(401, "API-Key ist abgelaufen.");
  }

  // lastUsedAt aktualisieren (fire-and-forget, kein await)
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { tenantId: apiKey.tenantId, scopes: apiKey.scopes };
}

export function requireScope(auth: ApiAuthResult, scope: string): void {
  if (!auth.scopes.includes(scope)) {
    throw new ApiAuthError(403, `Fehlende Berechtigung: "${scope}".`);
  }
}

export function apiError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export function handleApiAuthError(err: unknown): Response {
  if (err instanceof ApiAuthError) {
    return apiError(err.httpStatus, err.message);
  }
  return apiError(500, "Interner Serverfehler.");
}
