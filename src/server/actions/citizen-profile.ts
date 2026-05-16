"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as argon2 from "argon2";
import { TOTP } from "otpauth";
import { randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { redirect } from "next/navigation";

async function requireCustomerSession() {
  const session = await auth();
  if (!session?.user || session.user.userType !== "customer") {
    redirect("/");
  }
  return session;
}

const passwordSchema = z
  .string()
  .min(10, "Mind. 10 Zeichen")
  .regex(/[A-Z]/, "Mind. ein Großbuchstabe")
  .regex(/[0-9]/, "Mind. eine Ziffer")
  .regex(/[^A-Za-z0-9]/, "Mind. ein Sonderzeichen");

// ── Passwort ändern ────────────────────────────────────────────────────────────

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changeCustomerPassword(
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await requireCustomerSession();
  const customerId = session.user.id!;

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Alle Felder sind Pflichtfelder" };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "Passwörter stimmen nicht überein" };
  }

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültiges Passwort" };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { passwordHash: true },
  });

  if (!customer?.passwordHash) return { ok: false, error: "Kein Account vorhanden" };

  const valid = await argon2.verify(customer.passwordHash, currentPassword);
  if (!valid) return { ok: false, error: "Aktuelles Passwort ist falsch" };

  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash: newHash },
  });

  logger.info({ customerId }, "Citizen changed their password");
  return { ok: true };
}

// ── TOTP ───────────────────────────────────────────────────────────────────────

export type TotpSecretResult =
  | { ok: true; secret: string; otpauthUrl: string }
  | { ok: false; error: string };

export async function generateCitizenTotpSecret(): Promise<TotpSecretResult> {
  const session = await requireCustomerSession();
  const email = session.user.email!;

  const secret = randomBytes(20)
    .toString("base64")
    .replace(/[^A-Z2-7]/gi, "A")
    .slice(0, 32)
    .toUpperCase();

  const totp = new TOTP({
    issuer: "Trustello",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  return { ok: true, secret, otpauthUrl: totp.toString() };
}

export type TotpActionResult = { ok: true } | { ok: false; error: string };

export async function enableCitizenTotp(
  secret: string,
  code: string,
  password: string,
): Promise<TotpActionResult> {
  const session = await requireCustomerSession();
  const customerId = session.user.id!;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { passwordHash: true },
  });
  if (!customer?.passwordHash) return { ok: false, error: "Kein Account vorhanden" };

  const pwValid = await argon2.verify(customer.passwordHash, password);
  if (!pwValid) return { ok: false, error: "Passwort ist falsch" };

  const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return { ok: false, error: "Ungültiger Code — bitte erneut versuchen" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { totpSecret: secret, totpEnabled: true },
  });

  logger.info({ customerId }, "Citizen enabled TOTP");
  return { ok: true };
}

export async function disableCitizenTotp(
  code: string,
  password: string,
): Promise<TotpActionResult> {
  const session = await requireCustomerSession();
  const customerId = session.user.id!;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { passwordHash: true, totpSecret: true, totpEnabled: true },
  });
  if (!customer?.passwordHash) return { ok: false, error: "Kein Account vorhanden" };

  const pwValid = await argon2.verify(customer.passwordHash, password);
  if (!pwValid) return { ok: false, error: "Passwort ist falsch" };

  if (!customer.totpEnabled || !customer.totpSecret) {
    return { ok: false, error: "2FA ist nicht aktiviert" };
  }

  const totp = new TOTP({ secret: customer.totpSecret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return { ok: false, error: "Ungültiger Code — bitte erneut versuchen" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { totpSecret: null, totpEnabled: false },
  });

  logger.info({ customerId }, "Citizen disabled TOTP");
  return { ok: true };
}
