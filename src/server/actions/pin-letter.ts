"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import argon2 from "argon2";
import { randomInt } from "node:crypto";
import { addDays } from "date-fns";
import qrcode from "qrcode";
import { generatePinLetterPdf } from "@/lib/letter/pdf";
import { sendLetter } from "@/lib/letter/letterxpress";

const MAX_ATTEMPTS = 5;
const LETTER_VALID_DAYS = 30;

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function generatePin(): string {
  // 6-stellig, mit führenden Nullen
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function fetchLogoAsDataUrl(logoUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(logoUrl, { next: { revalidate: 3600 } });
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}

// ── Brief senden (Tenant-Admin) ──────────────────────────────────────────────

export type SendPinLetterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendPinLetter(customerId: string): Promise<SendPinLetterResult> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  // Tenant und Kunde laden
  const [customer, tenant] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        street: true,
        zipCode: true,
        city: true,
        country: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        resellerId: true,
        billingAddress: true,
      },
    }),
  ]);

  if (!customer) return { ok: false, error: "Kunde nicht gefunden" };
  if (!tenant) return { ok: false, error: "Mandant nicht gefunden" };

  if (!customer.street || !customer.zipCode || !customer.city) {
    return {
      ok: false,
      error:
        "Bitte hinterlegen Sie zuerst die vollständige Postanschrift des Kunden (Straße, PLZ, Ort).",
    };
  }

  // Alten ausstehenden Brief als ersetzt markieren
  await prisma.pinLetterToken.updateMany({
    where: { customerId, supersededAt: null, usedAt: null },
    data: { supersededAt: new Date() },
  });

  // PIN und QR-Token generieren
  const pin = generatePin();
  const pinHash = await argon2.hash(pin, { type: argon2.argon2id });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://app.trustello.de";
  const expiresAt = addDays(new Date(), LETTER_VALID_DAYS);

  // Neuen Token in DB anlegen (qrToken via @default(cuid()))
  const token = await prisma.pinLetterToken.create({
    data: {
      customerId,
      tenantId,
      pinHash,
      expiresAt,
    },
  });

  const qrUrl = `${appUrl}/pin-verify?token=${token.qrToken}`;

  // QR-Code als PNG-Data-URL generieren
  const qrCodeDataUrl = await qrcode.toDataURL(qrUrl, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  // Tenant-Logo laden (optional)
  const tenantLogoDataUrl = tenant.logoUrl
    ? await fetchLogoAsDataUrl(tenant.logoUrl)
    : undefined;

  // Billing-Adresse des Mandanten für den Absender-Block
  const billing = tenant.billingAddress as Record<string, string> | null;
  const tenantStreet = billing?.street ?? undefined;
  const tenantZip = billing?.zipCode ?? undefined;
  const tenantCity = billing?.city ?? undefined;

  // PDF generieren
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePinLetterPdf({
      recipientName: `${customer.firstName} ${customer.lastName}`,
      recipientStreet: customer.street,
      recipientZip: customer.zipCode,
      recipientCity: customer.city,
      tenantName: tenant.name,
      tenantLogoDataUrl,
      tenantStreet,
      tenantZip,
      tenantCity,
      primaryColor: tenant.primaryColor ?? "#1e3a8a",
      pin,
      qrCodeDataUrl,
      verifyUrl: `${appUrl}/pin-verify/manual`,
      expiresAt,
    });
  } catch (err) {
    logger.error({ err, customerId }, "PIN-Brief PDF-Generierung fehlgeschlagen");
    return { ok: false, error: "PDF-Generierung fehlgeschlagen" };
  }

  // Brief versenden
  const sendResult = await sendLetter(
    pdfBuffer.toString("base64"),
    tenant.resellerId,
  );

  if (!sendResult.ok) {
    // Token wieder löschen damit kein hängendes Token in der DB bleibt
    await prisma.pinLetterToken.delete({ where: { id: token.id } });
    return { ok: false, error: sendResult.error };
  }

  // Job-ID von LetterXpress speichern
  await prisma.pinLetterToken.update({
    where: { id: token.id },
    data: { letterxpressId: sendResult.jobId },
  });

  logger.info(
    { customerId, tenantId, jobId: sendResult.jobId },
    "PIN-Brief versendet",
  );

  revalidatePath(`/admin/customers/${customerId}`);
  return { ok: true };
}

// ── Interne Hilfsfunktion: Token verifizieren ─────────────────────────────────

export type VerifyPinResult =
  | { ok: true; tenantSlug?: string }
  | { ok: false; error: string; attemptsLeft?: number };

async function applyVerification(
  token: {
    id: string;
    customerId: string;
    tenantId: string;
    pinHash: string;
    usedAt: Date | null;
    supersededAt: Date | null;
    expiresAt: Date;
    attempts: number;
    tenant: { slug: string };
  },
  pin: string,
): Promise<VerifyPinResult> {
  if (token.usedAt) return { ok: false, error: "Dieser Zugangscode wurde bereits verwendet." };
  if (token.supersededAt)
    return { ok: false, error: "Ein neuerer Brief wurde versendet. Bitte verwenden Sie den aktuellen Code." };
  if (token.expiresAt < new Date())
    return { ok: false, error: "Der Zugangscode ist abgelaufen. Bitte fordern Sie einen neuen Brief an." };
  if (token.attempts >= MAX_ATTEMPTS)
    return { ok: false, error: "Zu viele Fehlversuche. Bitte fordern Sie einen neuen Brief an." };

  const valid = await argon2.verify(token.pinHash, pin);

  if (!valid) {
    const newAttempts = token.attempts + 1;
    await prisma.pinLetterToken.update({
      where: { id: token.id },
      data: { attempts: newAttempts },
    });
    const left = MAX_ATTEMPTS - newAttempts;
    return {
      ok: false,
      error: `Falscher Zugangscode. ${left > 0 ? `Noch ${left} Versuch${left === 1 ? "" : "e"}.` : "Kein weiterer Versuch möglich."}`,
      attemptsLeft: left,
    };
  }

  await prisma.$transaction([
    prisma.pinLetterToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.customer.update({
      where: { id: token.customerId },
      data: { trustLevel: "PIN_LETTER", trustVerifiedAt: new Date() },
    }),
    prisma.trustMethod.create({
      data: {
        customerId: token.customerId,
        method: "PIN_LETTER",
        verifiedAt: new Date(),
        metadata: { source: "pin_letter", tokenId: token.id },
      },
    }),
  ]);

  logger.info({ customerId: token.customerId, tenantId: token.tenantId }, "PIN-Brief-Verifizierung erfolgreich");
  return { ok: true, tenantSlug: token.tenant.slug };
}

// ── PIN manuell verifizieren (E-Mail + PIN) ───────────────────────────────────

export async function verifyPinByEmail(
  email: string,
  pin: string,
): Promise<VerifyPinResult> {
  // Aktiven Token für diesen Kunden per E-Mail finden
  const token = await prisma.pinLetterToken.findFirst({
    where: {
      customer: { email },
      usedAt: null,
      supersededAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { sentAt: "desc" },
    include: { tenant: { select: { slug: true } } },
  });

  if (!token) {
    return {
      ok: false,
      error: "Kein gültiger Zugangscode gefunden. Prüfen Sie die E-Mail-Adresse oder fordern Sie einen neuen Brief an.",
    };
  }

  return applyVerification(token, pin);
}

// ── QR-Code-Verifizierung (automatisch, kein PIN nötig) ──────────────────────

export async function verifyPinByQrToken(
  qrToken: string,
): Promise<VerifyPinResult> {
  const token = await prisma.pinLetterToken.findUnique({
    where: { qrToken },
    include: { tenant: { select: { id: true, slug: true } } },
  });

  if (!token) return { ok: false, error: "Ungültiger QR-Code." };
  if (token.usedAt) return { ok: false, error: "Dieser QR-Code wurde bereits verwendet." };
  if (token.supersededAt) return { ok: false, error: "Ein neuerer Brief wurde versendet." };
  if (token.expiresAt < new Date())
    return { ok: false, error: "Der QR-Code ist abgelaufen. Bitte fordern Sie einen neuen Brief an." };

  await prisma.$transaction([
    prisma.pinLetterToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    prisma.customer.update({
      where: { id: token.customerId },
      data: { trustLevel: "PIN_LETTER", trustVerifiedAt: new Date() },
    }),
    prisma.trustMethod.create({
      data: {
        customerId: token.customerId,
        method: "PIN_LETTER",
        verifiedAt: new Date(),
        metadata: { source: "pin_letter_qr", tokenId: token.id },
      },
    }),
  ]);

  logger.info({ customerId: token.customerId, tenantId: token.tenantId }, "PIN-Brief QR-Verifizierung erfolgreich");
  return { ok: true, tenantSlug: token.tenant.slug };
}

// ── Letzten Brief-Status abrufen (für Admin-UI) ────────────────────────────────

export type PinLetterStatus = {
  id: string;
  sentAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  supersededAt: Date | null;
  letterxpressId: string | null;
  attempts: number;
};

export async function getLatestPinLetterStatus(
  customerId: string,
): Promise<PinLetterStatus | null> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  return prisma.pinLetterToken.findFirst({
    where: { customerId, tenantId, supersededAt: null },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      sentAt: true,
      expiresAt: true,
      usedAt: true,
      supersededAt: true,
      letterxpressId: true,
      attempts: true,
    },
  });
}
