import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export type ScimAuthResult = {
  tenantId: string;
};

export class ScimAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function validateScimToken(request: NextRequest): Promise<ScimAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ScimAuthError(401, "Unauthorized");
  }

  const rawToken = authHeader.slice(7).trim();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const scimToken = await prisma.scimToken.findFirst({
    where: { tokenHash },
    select: { tenantId: true },
  });

  if (!scimToken) throw new ScimAuthError(401, "Unauthorized");

  // lastUsedAt aktualisieren (fire-and-forget)
  prisma.scimToken
    .update({ where: { tenantId: scimToken.tenantId }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { tenantId: scimToken.tenantId };
}

export function scimError(status: number, detail: string): Response {
  return Response.json(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      detail,
    },
    {
      status,
      headers: { "Content-Type": "application/scim+json" },
    },
  );
}

export function handleScimAuthError(err: unknown): Response {
  if (err instanceof ScimAuthError) {
    return scimError(err.status, err.message);
  }
  return scimError(500, "Internal Server Error");
}
