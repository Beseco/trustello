"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { requireReseller } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { encryptSmtpPassword } from "@/lib/mail/smtp";
import { logger } from "@/lib/logger";
import { z } from "zod";
import nodemailer from "nodemailer";

const smtpSchema = z.object({
  host: z.string().min(1, "Host ist erforderlich"),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().optional(),
  password: z.string().optional(),
  fromEmail: z.string().email("Ungültige E-Mail-Adresse"),
  fromName: z.string().optional(),
});

export type SmtpFormValues = z.infer<typeof smtpSchema>;
export type SmtpResult = { ok: true } | { ok: false; error: string };
export type SmtpConfigData = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  fromEmail: string;
  fromName: string | null;
  // Passwort wird nie zurückgegeben — nur ob eines gesetzt ist
  hasPassword: boolean;
};

// ── Tenant-SMTP ────────────────────────────────────────────────────────────────

export async function getTenantSmtpConfig(): Promise<SmtpConfigData | null> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const config = await prisma.smtpConfig.findUnique({ where: { tenantId } });
  if (!config) return null;

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    hasPassword: !!config.passwordEnc,
  };
}

export async function saveTenantSmtpConfig(values: SmtpFormValues): Promise<SmtpResult> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const parsed = smtpSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { host, port, secure, user, password, fromEmail, fromName } = parsed.data;
  const passwordFields =
    password ? encryptSmtpPassword(password) : {};

  await prisma.smtpConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      host, port, secure,
      user: user || null,
      fromEmail, fromName: fromName || null,
      ...passwordFields,
    },
    update: {
      host, port, secure,
      user: user || null,
      fromEmail, fromName: fromName || null,
      ...(password ? passwordFields : {}),
    },
  });

  logger.info({ tenantId }, "Tenant SMTP config saved");
  return { ok: true };
}

export async function deleteTenantSmtpConfig(): Promise<SmtpResult> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  await prisma.smtpConfig.deleteMany({ where: { tenantId } });
  logger.info({ tenantId }, "Tenant SMTP config deleted (using reseller/env fallback)");
  return { ok: true };
}

// ── Reseller-SMTP ──────────────────────────────────────────────────────────────

export async function getResellerSmtpConfig(): Promise<SmtpConfigData | null> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const config = await prisma.smtpConfig.findUnique({ where: { resellerId } });
  if (!config) return null;

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    hasPassword: !!config.passwordEnc,
  };
}

export async function saveResellerSmtpConfig(values: SmtpFormValues): Promise<SmtpResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = smtpSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };

  const { host, port, secure, user, password, fromEmail, fromName } = parsed.data;
  const passwordFields = password ? encryptSmtpPassword(password) : {};

  await prisma.smtpConfig.upsert({
    where: { resellerId },
    create: {
      resellerId,
      host, port, secure,
      user: user || null,
      fromEmail, fromName: fromName || null,
      ...passwordFields,
    },
    update: {
      host, port, secure,
      user: user || null,
      fromEmail, fromName: fromName || null,
      ...(password ? passwordFields : {}),
    },
  });

  logger.info({ resellerId }, "Reseller SMTP config saved");
  return { ok: true };
}

// ── Verbindungstest ────────────────────────────────────────────────────────────

export type SmtpTestResult = { ok: true } | { ok: false; error: string };

async function testSmtpConnection(
  values: SmtpFormValues,
  existingPassword?: string | null,
): Promise<SmtpTestResult> {
  const password = values.password || existingPassword || undefined;

  const transporter = nodemailer.createTransport({
    host: values.host,
    port: values.port,
    secure: values.secure,
    auth: values.user ? { user: values.user, pass: password } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return { ok: false, error: message };
  }
}

export async function testTenantSmtpConfig(values: SmtpFormValues): Promise<SmtpTestResult> {
  await requireTenantAdmin();
  return testSmtpConnection(values);
}

export async function testResellerSmtpConfig(values: SmtpFormValues): Promise<SmtpTestResult> {
  await requireReseller();
  return testSmtpConnection(values);
}
