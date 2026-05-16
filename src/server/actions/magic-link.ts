"use server";

import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail/send";
import { magicLinkTemplate } from "@/lib/mail/templates/magic-link";
import { logger } from "@/lib/logger";
import { randomBytes } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type RequestMagicLinkResult = { ok: true } | { ok: false; error: string };

export async function requestMagicLink(
  messageId: string,
  email: string,
): Promise<RequestMagicLinkResult> {
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Ungültige E-Mail-Adresse" };
  }

  // Rate-Limit: max. 3 Anfragen pro Nachricht + IP pro Stunde
  const reqHeaders = await headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    "unknown";

  const allowed = await checkRateLimit(`magic-link:${messageId}:${ip}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    logger.warn({ messageId, ip }, "Magic link rate limit exceeded");
    // Silent success — kein Hinweis ob E-Mail-Adresse existiert oder nicht
    return { ok: true };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      deletedAt: true,
      expiresAt: true,
      recipient: { select: { email: true } },
    },
  });

  if (!message || message.deletedAt) {
    return { ok: false, error: "Nachricht nicht gefunden" };
  }

  if (message.expiresAt < new Date()) {
    return { ok: false, error: "Diese Nachricht ist abgelaufen" };
  }

  // Only allow the actual recipient to request a link
  if (message.recipient.email.toLowerCase() !== email.toLowerCase()) {
    // Don't reveal that the email doesn't match — prevents enumeration
    logger.warn({ messageId, email }, "Magic link requested for wrong email");
    return { ok: true }; // Silent success to prevent email enumeration
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 h

  // Unbenutzte alte Token für dieselbe Nachricht invalidieren (Rotation)
  await prisma.magicLinkToken.updateMany({
    where: { messageId, usedAt: null },
    data: { expiresAt: new Date() }, // sofort ablaufen lassen
  });

  await prisma.magicLinkToken.create({
    data: { token, messageId, recipientEmail: email.toLowerCase(), expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/api/auth/magic-link?token=${token}`;

  try {
    await sendMail({
      to: email,
      subject: "Ihr sicherer Zugangslink",
      html: magicLinkTemplate(link),
    });
  } catch (err) {
    logger.error({ messageId, err }, "Failed to send magic link email");
    return { ok: false, error: "E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut." };
  }

  logger.info({ messageId, email }, "Magic link sent");
  return { ok: true };
}
