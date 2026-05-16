/**
 * SMTP-Resolver: Sucht die passende Konfiguration für einen gegebenen Kontext.
 *
 * Priorität:
 *   1. Tenant-eigene SMTP-Konfiguration (falls vorhanden)
 *   2. Reseller-zentrale SMTP-Konfiguration (falls vorhanden)
 *   3. Umgebungsvariablen (SMTP_HOST, SMTP_PORT, SMTP_FROM)
 */

import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto/envelope";
import { logger } from "@/lib/logger";
import type { SmtpConfig } from "@prisma/client";

// ── Passwort-Verschlüsselung mit MASTER_KEY ────────────────────────────────────

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key) throw new Error("MASTER_KEY not set");
  return Buffer.from(key, "base64");
}

export function encryptSmtpPassword(password: string): {
  passwordEnc: Buffer;
  passwordIv: Buffer;
  passwordTag: Buffer;
} {
  const { ciphertext, iv, authTag } = encrypt(Buffer.from(password, "utf-8"), getMasterKey());
  return {
    passwordEnc: Buffer.from(ciphertext),
    passwordIv: Buffer.from(iv),
    passwordTag: Buffer.from(authTag),
  };
}

export function decryptSmtpPassword(
  config: Pick<SmtpConfig, "passwordEnc" | "passwordIv" | "passwordTag">,
): string | null {
  if (!config.passwordEnc || !config.passwordIv || !config.passwordTag) return null;
  try {
    return decrypt(
      {
        ciphertext: Buffer.from(config.passwordEnc),
        iv: Buffer.from(config.passwordIv),
        authTag: Buffer.from(config.passwordTag),
      },
      getMasterKey(),
    ).toString("utf-8");
  } catch {
    logger.error("Failed to decrypt SMTP password");
    return null;
  }
}

// ── Transporter-Factory ────────────────────────────────────────────────────────

type TransporterResult = {
  transporter: Transporter;
  from: string;
  source: "tenant" | "reseller" | "env";
};

function buildTransporter(config: SmtpConfig, source: "tenant" | "reseller"): TransporterResult {
  const password = decryptSmtpPassword(config);

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: password ?? undefined } : undefined,
  });

  const from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;

  return { transporter, from, source };
}

function buildEnvTransporter(): TransporterResult {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    ignoreTLS: !user,
  });
  const from = process.env.SMTP_FROM ?? "noreply@trustello.local";
  return { transporter, from, source: "env" };
}

// ── Haupt-Lookup ───────────────────────────────────────────────────────────────

export async function resolveSmtpTransporter(
  tenantId?: string,
  resellerId?: string,
): Promise<TransporterResult> {
  // Direkt per resellerId (z.B. Reseller-Passwort-Reset, kein Tenant-Kontext)
  if (!tenantId && resellerId) {
    const resellerConfig = await prisma.smtpConfig.findUnique({ where: { resellerId } });
    if (resellerConfig) return buildTransporter(resellerConfig, "reseller");
    return buildEnvTransporter();
  }

  if (!tenantId) return buildEnvTransporter();

  // 1. Tenant-eigene SMTP-Konfiguration
  const tenantConfig = await prisma.smtpConfig.findUnique({ where: { tenantId } });
  if (tenantConfig) return buildTransporter(tenantConfig, "tenant");

  // 2. Reseller-SMTP (über Tenant-Lookup)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { resellerId: true },
  });
  if (tenant?.resellerId) {
    const resellerConfig = await prisma.smtpConfig.findUnique({
      where: { resellerId: tenant.resellerId },
    });
    if (resellerConfig) return buildTransporter(resellerConfig, "reseller");
  }

  // 3. Env-Fallback
  return buildEnvTransporter();
}
