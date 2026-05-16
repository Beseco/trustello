"use server";

import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail/send";
import { passwordResetTemplate } from "@/lib/mail/templates/password-reset";
import { logger } from "@/lib/logger";
import argon2 from "argon2";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 Stunde

export async function requestPasswordReset(
  email: string,
  type: "employee" | "reseller" = "employee",
): Promise<{ ok: boolean }> {
  const parsed = z.string().email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return { ok: true }; // Kein Hinweis auf Existenz

  const addr = parsed.data;

  // Mitarbeiter zuerst prüfen
  const user = await prisma.user.findFirst({
    where: { email: addr, isActive: true },
    select: { id: true },
  });

  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;
    await sendMail({ to: addr, subject: "Passwort zurücksetzen – Trustello", html: passwordResetTemplate({ resetUrl }) });
    logger.info({ userId: user.id }, "Employee password reset requested");
    return { ok: true };
  }

  // Reseller-Admin prüfen
  const resellerAdmin = await prisma.resellerAdmin.findUnique({
    where: { email: addr },
    select: { id: true, resellerId: true },
  });

  if (resellerAdmin) {
    await prisma.passwordResetToken.deleteMany({ where: { resellerAdminId: resellerAdmin.id, usedAt: null } });
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: { resellerAdminId: resellerAdmin.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
    const resetUrl = `${APP_URL}/reseller/passwort-reset?token=${rawToken}`;
    await sendMail(
      { to: addr, subject: "Passwort zurücksetzen – Trustello Reseller", html: passwordResetTemplate({ resetUrl }) },
      undefined,
      resellerAdmin.resellerId,
    );
    logger.info({ resellerAdminId: resellerAdmin.id }, "Reseller admin password reset requested");
  }

  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Mindestens 8 Zeichen")
    .regex(/[A-Z]/, "Mindestens ein Großbuchstabe")
    .regex(/[0-9]/, "Mindestens eine Zahl"),
});

export async function resetPassword(data: {
  token: string;
  password: string;
}): Promise<{ error?: string }> {
  const parsed = resetSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, isActive: true } },
      resellerAdmin: { select: { id: true } },
    },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Der Link ist ungültig oder abgelaufen." };
  }

  const passwordHash = await argon2.hash(parsed.data.password);

  if (record.user) {
    if (!record.user.isActive) return { error: "Dieses Konto ist deaktiviert." };
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.user.id }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    logger.info({ userId: record.user.id }, "Employee password reset completed");
  } else if (record.resellerAdmin) {
    await prisma.$transaction([
      prisma.resellerAdmin.update({ where: { id: record.resellerAdmin.id }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    logger.info({ resellerAdminId: record.resellerAdmin.id }, "Reseller admin password reset completed");
  } else {
    return { error: "Ungültiger Token." };
  }

  return {};
}

export async function validateResetToken(
  token: string,
): Promise<{ valid: boolean }> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { usedAt: true, expiresAt: true },
  });
  const valid = !!record && !record.usedAt && record.expiresAt > new Date();
  return { valid };
}
