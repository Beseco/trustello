"use server";

import { prisma } from "@/lib/db";
import { requireCitizenAccount } from "@/lib/auth-helpers";
import { sendMail } from "@/lib/mail/send";
import { logger } from "@/lib/logger";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const PASSWORD_MIN = 10;
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Mindestens ${PASSWORD_MIN} Zeichen`)
  .regex(/[A-Z]/, "Mindestens ein Großbuchstabe")
  .regex(/[0-9]/, "Mindestens eine Ziffer")
  .regex(/[^A-Za-z0-9]/, "Mindestens ein Sonderzeichen");

// ── Registrierung via Invite-Token ─────────────────────────────────────────────

export type RegisterCitizenResult = { ok: true } | { ok: false; error: string };

export async function registerCitizenAccount(formData: FormData): Promise<RegisterCitizenResult> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) return { ok: false, error: "Kein Einladungstoken" };
  if (password !== confirmPassword) return { ok: false, error: "Passwörter stimmen nicht überein" };

  const pwResult = passwordSchema.safeParse(password);
  if (!pwResult.success) return { ok: false, error: pwResult.error.issues[0]?.message ?? "Ungültiges Passwort" };

  const invite = await prisma.citizenInviteToken.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { ok: false, error: "Dieser Einladungslink ist ungültig oder abgelaufen." };
  }

  const customer = await prisma.customer.findUnique({ where: { id: invite.customerId } });
  if (!customer) return { ok: false, error: "Kundendatensatz nicht gefunden." };

  // Prüfe ob CitizenAccount für diese E-Mail bereits existiert
  let citizenAccount = await prisma.citizenAccount.findUnique({ where: { email: invite.email.toLowerCase() } });

  if (!citizenAccount) {
    const passwordHash = await argon2.hash(password);
    citizenAccount = await prisma.citizenAccount.create({
      data: {
        email: invite.email.toLowerCase(),
        firstName: customer.firstName,
        lastName: customer.lastName,
        passwordHash,
      },
    });
    logger.info({ citizenAccountId: citizenAccount.id, email: invite.email }, "CitizenAccount created");
  } else {
    // Account existiert bereits — Passwort aktualisieren falls kein Hash gesetzt
    if (!citizenAccount.passwordHash) {
      const passwordHash = await argon2.hash(password);
      citizenAccount = await prisma.citizenAccount.update({
        where: { id: citizenAccount.id },
        data: { passwordHash },
      });
    }
  }

  // Customer mit CitizenAccount verknüpfen
  await prisma.customer.update({
    where: { id: customer.id },
    data: { citizenAccountId: citizenAccount.id },
  });

  // Alle offenen Customer-Datensätze mit gleicher E-Mail verknüpfen
  await prisma.customer.updateMany({
    where: {
      email: { equals: invite.email, mode: "insensitive" },
      citizenAccountId: null,
    },
    data: { citizenAccountId: citizenAccount.id },
  });

  // Token als benutzt markieren
  await prisma.citizenInviteToken.update({
    where: { id: invite.id },
    data: { usedAt: new Date(), citizenAccountId: citizenAccount.id },
  });

  return { ok: true };
}

// ── Passwort ändern ────────────────────────────────────────────────────────────

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changeCitizenPassword(formData: FormData): Promise<ChangePasswordResult> {
  const { citizenAccountId } = await requireCitizenAccount();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) return { ok: false, error: "Neue Passwörter stimmen nicht überein" };

  const pwResult = passwordSchema.safeParse(newPassword);
  if (!pwResult.success) return { ok: false, error: pwResult.error.issues[0]?.message ?? "Ungültiges Passwort" };

  const ca = await prisma.citizenAccount.findUnique({ where: { id: citizenAccountId } });
  if (!ca?.passwordHash) return { ok: false, error: "Kein Passwort gesetzt" };

  const valid = await argon2.verify(ca.passwordHash, currentPassword);
  if (!valid) return { ok: false, error: "Aktuelles Passwort ist falsch" };

  const passwordHash = await argon2.hash(newPassword);
  await prisma.citizenAccount.update({ where: { id: citizenAccountId }, data: { passwordHash } });

  logger.info({ citizenAccountId }, "CitizenAccount password changed");
  return { ok: true };
}

// ── TOTP ──────────────────────────────────────────────────────────────────────

export async function generateCitizenTotpSecret(): Promise<{ ok: true; secret: string; otpauthUrl: string } | { ok: false; error: string }> {
  const { citizenAccountId, email } = await requireCitizenAccount();
  void citizenAccountId;

  const { TOTP, Secret } = await import("otpauth");
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: "Trustello",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  return { ok: true, secret: secret.base32, otpauthUrl: totp.toString() };
}

export async function enableCitizenTotp(
  secret: string,
  code: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { citizenAccountId } = await requireCitizenAccount();
  const ca = await prisma.citizenAccount.findUnique({ where: { id: citizenAccountId } });
  if (!ca?.passwordHash) return { ok: false, error: "Passwort nicht gesetzt" };

  const valid = await argon2.verify(ca.passwordHash, password);
  if (!valid) return { ok: false, error: "Falsches Passwort" };

  const { TOTP } = await import("otpauth");
  const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return { ok: false, error: "Ungültiger Code" };

  await prisma.citizenAccount.update({
    where: { id: citizenAccountId },
    data: { totpSecret: secret, totpEnabled: true },
  });

  return { ok: true };
}

export async function disableCitizenTotp(
  code: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { citizenAccountId } = await requireCitizenAccount();
  const ca = await prisma.citizenAccount.findUnique({ where: { id: citizenAccountId } });
  if (!ca?.passwordHash || !ca.totpEnabled) return { ok: false, error: "2FA nicht aktiv" };

  const valid = await argon2.verify(ca.passwordHash, password);
  if (!valid) return { ok: false, error: "Falsches Passwort" };

  const { TOTP } = await import("otpauth");
  const totp = new TOTP({ secret: ca.totpSecret ?? "", algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return { ok: false, error: "Ungültiger Code" };

  await prisma.citizenAccount.update({
    where: { id: citizenAccountId },
    data: { totpSecret: null, totpEnabled: false },
  });

  return { ok: true };
}

// ── Passwort-Reset ─────────────────────────────────────────────────────────────

export async function requestCitizenPasswordReset(email: string): Promise<void> {
  const ca = await prisma.citizenAccount.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!ca) return; // Silent — kein Enumeration-Leak

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 Stunden

  // Alte Token invalidieren
  await prisma.citizenPasswordResetToken.updateMany({
    where: { citizenAccountId: ca.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.citizenPasswordResetToken.create({
    data: { token, citizenAccountId: ca.id, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/postfach/passwort-reset?token=${token}`;

  await sendMail({
    to: ca.email,
    subject: "Passwort zurücksetzen — Ihr Bürger-Postfach",
    html: passwordResetTemplate({ name: `${ca.firstName} ${ca.lastName}`, resetUrl }),
  }).catch((err) => logger.warn({ err }, "Failed to send citizen password reset email"));
}

export async function resetCitizenPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pwResult = passwordSchema.safeParse(newPassword);
  if (!pwResult.success) return { ok: false, error: pwResult.error.issues[0]?.message ?? "Ungültiges Passwort" };

  const record = await prisma.citizenPasswordResetToken.findUnique({ where: { token } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "Dieser Link ist abgelaufen oder bereits verwendet." };
  }

  const passwordHash = await argon2.hash(newPassword);
  await prisma.citizenAccount.update({
    where: { id: record.citizenAccountId },
    data: { passwordHash },
  });
  await prisma.citizenPasswordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  logger.info({ citizenAccountId: record.citizenAccountId }, "CitizenAccount password reset");
  return { ok: true };
}

// ── Nachrichten laden ──────────────────────────────────────────────────────────

export async function getCitizenMessages() {
  const { citizenAccountId } = await requireCitizenAccount();

  const customers = await prisma.customer.findMany({
    where: { citizenAccountId },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length === 0) return [];

  return prisma.message.findMany({
    where: { recipientId: { in: customerIds }, deletedAt: null },
    orderBy: { sentAt: "desc" },
    include: {
      tenant: { select: { name: true } },
      sender: { select: { firstName: true, lastName: true } },
      ou: { select: { name: true } },
    },
  });
}

// ── Hilfsfunktion: Passwort-Reset-Template ────────────────────────────────────

function passwordResetTemplate({ name, resetUrl }: { name: string; resetUrl: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#111827;">Passwort zurücksetzen</h2>
  <p>Guten Tag ${name},</p>
  <p>Sie haben eine Passwortrücksetzung für Ihr Bürger-Postfach angefordert.</p>
  <p>
    <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      Neues Passwort setzen
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px;">
    Der Link ist 2 Stunden gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
  </p>
  <p style="color:#9ca3af;font-size:12px;">
    Falls der Button nicht funktioniert: <a href="${resetUrl}" style="color:#6b7280;">${resetUrl}</a>
  </p>
</body></html>`;
}
