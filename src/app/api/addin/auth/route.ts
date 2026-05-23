import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verify } from "argon2";
import { randomBytes, createHash } from "node:crypto";
import { handleOptions } from "@/lib/cors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ["https://addin.trustello.de", "http://localhost:3001"];
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "",
    "Access-Control-Allow-Credentials": "true",
  };
}

function apiError(status: number, message: string, request: NextRequest) {
  return Response.json({ error: message }, { status, headers: corsHeaders(request) });
}

// POST /api/addin/auth — Login mit E-Mail + Passwort
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Ungültiger JSON-Body.", request);
  }

  const { email, password } = body as { email?: string; password?: string };
  if (!email || !password) {
    return apiError(400, "E-Mail und Passwort erforderlich.", request);
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      tenantId: true,
      passwordHash: true,
      isActive: true,
      firstName: true,
      lastName: true,
      tenant: { select: { name: true, status: true } },
    },
  });

  if (!user || !user.passwordHash || !user.isActive) {
    return apiError(401, "E-Mail oder Passwort falsch.", request);
  }

  if (user.tenant.status !== "ACTIVE" && user.tenant.status !== "TRIAL") {
    return apiError(403, "Ihr Konto ist deaktiviert.", request);
  }

  const valid = await verify(user.passwordHash, password);
  if (!valid) {
    return apiError(401, "E-Mail oder Passwort falsch.", request);
  }

  // Token generieren
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 Tage

  await prisma.addinToken.create({
    data: { userId: user.id, tenantId: user.tenantId, tokenHash, expiresAt },
  });

  logger.info({ userId: user.id, tenantId: user.tenantId }, "Addin login");

  return Response.json(
    {
      token: rawToken,
      expiresAt,
      user: { firstName: user.firstName, lastName: user.lastName },
      tenant: { name: user.tenant.name },
    },
    { headers: corsHeaders(request) },
  );
}

// DELETE /api/addin/auth — Logout (Token ungültig machen)
export async function DELETE(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const rawToken = auth.replace(/^Bearer\s+/i, "");
  if (!rawToken) {
    return apiError(400, "Kein Token.", request);
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.addinToken.deleteMany({ where: { tokenHash } });

  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
