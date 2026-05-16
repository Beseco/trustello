import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "ml_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 h

function signPayload(payload: string): string {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function buildCookieValue(messageId: string, email: string): string {
  const payload = `${messageId}:${email}`;
  const sig = signPayload(payload);
  return `${payload}:${sig}`;
}

export function verifyCookieValue(
  value: string,
): { messageId: string; email: string } | null {
  const lastColon = value.lastIndexOf(":");
  if (lastColon < 0) return null;
  const payload = value.slice(0, lastColon);
  const sig = value.slice(lastColon + 1);
  const expected = signPayload(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  const [messageId, email] = payload.split(":");
  if (!messageId || !email) return null;
  return { messageId, email };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const record = await prisma.magicLinkToken.findUnique({ where: { token } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    logger.warn({ token: token.slice(0, 8) }, "Invalid or expired magic link");
    const url = new URL(`/m/${record?.messageId ?? ""}`, request.url);
    url.searchParams.set("error", "link-expired");
    return NextResponse.redirect(url);
  }

  // Mark token as used
  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  logger.info({ messageId: record.messageId }, "Magic link used");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, buildCookieValue(record.messageId, record.recipientEmail), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: `/m/${record.messageId}`,
  });

  return NextResponse.redirect(new URL(`/m/${record.messageId}`, request.url));
}
