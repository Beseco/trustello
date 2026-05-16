"use server";

import { prisma } from "@/lib/db";
import { requireReseller } from "@/lib/auth-helpers";
import * as argon2 from "argon2";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { TOTP } from "otpauth";
import { randomBytes } from "node:crypto";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
    newPassword: z
      .string()
      .min(10, "Mind. 10 Zeichen")
      .regex(/[A-Z]/, "Mind. ein Großbuchstabe")
      .regex(/[0-9]/, "Mind. eine Ziffer")
      .regex(/[^A-Za-z0-9]/, "Mind. ein Sonderzeichen"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export type ChangePasswordResult = { error?: string; fieldErrors?: Record<string, string> };

export async function changeResellerPassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const session = await requireReseller();
  const adminId = session.user.id!;

  const parsed = changePasswordSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0]?.toString() ?? "form"] = issue.message;
    }
    return { fieldErrors };
  }

  const admin = await prisma.resellerAdmin.findUnique({ where: { id: adminId } });
  if (!admin) return { error: "Konto nicht gefunden" };

  const currentValid = await argon2.verify(admin.passwordHash, parsed.data.currentPassword);
  if (!currentValid) return { fieldErrors: { currentPassword: "Aktuelles Passwort ist falsch" } };

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { fieldErrors: { newPassword: "Neues Passwort muss sich vom aktuellen unterscheiden" } };
  }

  const newHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
  await prisma.resellerAdmin.update({ where: { id: adminId }, data: { passwordHash: newHash } });

  logger.info({ adminId }, "Reseller admin password changed");
  return {};
}

export async function generateResellerTotpSecret(): Promise<{
  secret: string;
  otpauthUrl: string;
}> {
  const session = await requireReseller();
  const email = session.user.email!;

  const secret = randomBytes(20)
    .toString("base64")
    .replace(/[^A-Z2-7]/gi, "A")
    .slice(0, 32)
    .toUpperCase();

  const totp = new TOTP({ issuer: "Trustello", label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
  return { secret, otpauthUrl: totp.toString() };
}

export async function enableResellerTotp(
  secret: string,
  code: string,
  password: string,
): Promise<{ error?: string }> {
  const session = await requireReseller();
  const adminId = session.user.id!;

  const admin = await prisma.resellerAdmin.findUnique({ where: { id: adminId } });
  if (!admin) return { error: "Konto nicht gefunden" };

  const pwValid = await argon2.verify(admin.passwordHash, password);
  if (!pwValid) return { error: "Passwort ist falsch" };

  const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return { error: "Ungültiger Code — bitte erneut versuchen" };

  await prisma.resellerAdmin.update({ where: { id: adminId }, data: { totpSecret: secret, totpEnabled: true } });
  logger.info({ adminId }, "Reseller TOTP enabled");
  return {};
}

export async function disableResellerTotp(password: string): Promise<{ error?: string }> {
  const session = await requireReseller();
  const adminId = session.user.id!;

  const admin = await prisma.resellerAdmin.findUnique({ where: { id: adminId } });
  if (!admin) return { error: "Konto nicht gefunden" };

  const pwValid = await argon2.verify(admin.passwordHash, password);
  if (!pwValid) return { error: "Passwort ist falsch" };

  await prisma.resellerAdmin.update({ where: { id: adminId }, data: { totpSecret: null, totpEnabled: false } });
  logger.info({ adminId }, "Reseller TOTP disabled");
  return {};
}
