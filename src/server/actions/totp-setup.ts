"use server";

import { prisma } from "@/lib/db";
import { requireEmployee } from "@/lib/auth-helpers";
import * as argon2 from "argon2";
import { TOTP } from "otpauth";
import { randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";

// Generiert ein neues TOTP-Secret und gibt URI + Secret zurück (noch nicht aktiviert)
export async function generateTotpSecret(): Promise<{
  secret: string;
  otpauthUrl: string;
  issuer: string;
  accountName: string;
}> {
  const session = await requireEmployee();
  const email = session.user.email!;

  const secret = randomBytes(20).toString("base64").replace(/[^A-Z2-7]/gi, "A").slice(0, 32).toUpperCase();

  const totp = new TOTP({
    issuer: "Trustello",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret,
    otpauthUrl: totp.toString(),
    issuer: "Trustello",
    accountName: email,
  };
}

// Aktiviert TOTP nach Bestätigung des ersten Codes
export async function enableTotp(
  secret: string,
  code: string,
  password: string,
): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const userId = session.user.id!;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) return { error: "Benutzer nicht gefunden" };

  // Passwort bestätigen
  const pwValid = await argon2.verify(user.passwordHash, password);
  if (!pwValid) return { error: "Passwort ist falsch" };

  // Code prüfen
  const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) return { error: "Ungültiger Code — bitte erneut versuchen" };

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: secret, totpEnabled: true },
  });

  logger.info({ userId }, "TOTP enabled");
  return {};
}

// Deaktiviert TOTP nach Passwort-Bestätigung
export async function disableTotp(password: string): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const userId = session.user.id!;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) return { error: "Benutzer nicht gefunden" };

  const pwValid = await argon2.verify(user.passwordHash, password);
  if (!pwValid) return { error: "Passwort ist falsch" };

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabled: false },
  });

  logger.info({ userId }, "TOTP disabled");
  return {};
}
