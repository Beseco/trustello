"use server";

import { prisma } from "@/lib/db";
import { requireReseller } from "@/lib/auth-helpers";
import { encryptSipgateToken, decryptSipgateToken } from "@/lib/sms/sipgate";
import { sendMail } from "@/lib/mail/send";
import { smsQuotaWarningCustomerTemplate, smsQuotaWarningResellerTemplate } from "@/lib/mail/templates/sms-quota-warning";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { formatPhoneE164, getCurrentMonth } from "@/lib/sms/phone";
import type { Customer, SmsUsage, Tenant } from "@prisma/client";

const sipgateSchema = z.object({
  tokenId: z.string().min(1, "Token-ID ist erforderlich"),
  token: z.string().optional(),
  smsId: z.string().min(1, "SMS-ID ist erforderlich").default("s0"),
});

export type SipgateFormValues = z.infer<typeof sipgateSchema>;
export type SipgateResult = { ok: true } | { ok: false; error: string };

export type SipgateConfigData = {
  tokenId: string;
  smsId: string;
  hasToken: boolean;
};

export async function getResellerSipgateConfig(): Promise<SipgateConfigData | null> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const config = await prisma.sipgateConfig.findUnique({ where: { resellerId } });
  if (!config) return null;

  return {
    tokenId: config.tokenId,
    smsId: config.smsId,
    hasToken: true,
  };
}

export async function saveResellerSipgateConfig(values: SipgateFormValues): Promise<SipgateResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const parsed = sipgateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { tokenId, token, smsId } = parsed.data;

  const existing = await prisma.sipgateConfig.findUnique({ where: { resellerId } });

  if (!existing && !token) {
    return { ok: false, error: "Token ist beim ersten Speichern erforderlich" };
  }

  if (token) {
    const encrypted = encryptSipgateToken(token);
    await prisma.sipgateConfig.upsert({
      where: { resellerId },
      create: { resellerId, tokenId, smsId, ...encrypted },
      update: { tokenId, smsId, ...encrypted },
    });
  } else {
    await prisma.sipgateConfig.update({
      where: { resellerId },
      data: { tokenId, smsId },
    });
  }

  logger.info({ resellerId }, "Reseller sipgate config saved");
  return { ok: true };
}

export async function deleteResellerSipgateConfig(): Promise<SipgateResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  await prisma.sipgateConfig.deleteMany({ where: { resellerId } });
  logger.info({ resellerId }, "Reseller sipgate config deleted");
  return { ok: true };
}

export type SipgateTestResult = { ok: true } | { ok: false; error: string };

export async function testResellerSipgateConfig(
  values: SipgateFormValues & { testPhone: string },
): Promise<SipgateTestResult> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const formatted = formatPhoneE164(values.testPhone);
  if (!formatted) {
    return { ok: false, error: `Ungültiges Nummernformat: ${values.testPhone}` };
  }

  let token = values.token;
  if (!token) {
    const existing = await prisma.sipgateConfig.findUnique({ where: { resellerId } });
    if (!existing) return { ok: false, error: "Keine sipgate-Konfiguration gespeichert" };
    token = decryptSipgateToken({
      tokenEnc: Buffer.from(existing.tokenEnc),
      tokenIv: Buffer.from(existing.tokenIv),
      tokenTag: Buffer.from(existing.tokenTag),
    }) ?? undefined;
    if (!token) return { ok: false, error: "Token konnte nicht entschlüsselt werden" };
  }

  const tokenId = values.tokenId || (await prisma.sipgateConfig.findUnique({ where: { resellerId } }))?.tokenId;
  if (!tokenId) return { ok: false, error: "Token-ID fehlt" };

  const smsId = values.smsId ?? "s0";
  const SIPGATE_API = "https://api.sipgate.com/v2/sessions/sms";

  try {
    const res = await fetch(SIPGATE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${tokenId}:${token}`).toString("base64"),
      },
      body: JSON.stringify({ smsId, message: "Trustello sipgate-Test erfolgreich ✓", recipient: formatted }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `sipgate ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Verbindung fehlgeschlagen";
    return { ok: false, error: msg };
  }
}

// ── SMS-Nutzungsübersicht ──────────────────────────────────────────────────────

export type SmsUsageRow = {
  customerId: string;
  customerName: string;
  customerEmail: string;
  tenantId: string;
  tenantName: string;
  month: number;
  count: number;
  quota: number | null;
  pct: number | null;
};

export async function getResellerSmsUsage(month?: number): Promise<SmsUsageRow[]> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  const currentMonth = month ?? getCurrentMonth();

  // Kunden mit Verbrauch diesen Monat ODER gesetztem Kontingent
  const [usageRows, quotaCustomers] = await Promise.all([
    prisma.smsUsage.findMany({
      where: { resellerId, month: currentMonth },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, smsMonthlyQuota: true } },
        tenant: { select: { id: true, name: true } },
      },
      orderBy: { count: "desc" },
    }),
    prisma.customer.findMany({
      where: {
        tenant: { resellerId },
        smsMonthlyQuota: { not: null },
        // Nur Kunden die noch keinen Eintrag für diesen Monat haben
        smsUsage: { none: { month: currentMonth } },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true, smsMonthlyQuota: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
  ]);

  const rows: SmsUsageRow[] = [
    ...usageRows.map((u) => ({
      customerId: u.customerId,
      customerName: `${u.customer.firstName} ${u.customer.lastName}`,
      customerEmail: u.customer.email,
      tenantId: u.tenantId,
      tenantName: u.tenant.name,
      month: u.month,
      count: u.count,
      quota: u.customer.smsMonthlyQuota,
      pct: u.customer.smsMonthlyQuota ? Math.round((u.count / u.customer.smsMonthlyQuota) * 100) : null,
    })),
    ...quotaCustomers.map((c) => ({
      customerId: c.id,
      customerName: `${c.firstName} ${c.lastName}`,
      customerEmail: c.email,
      tenantId: c.tenant.id,
      tenantName: c.tenant.name,
      month: currentMonth,
      count: 0,
      quota: c.smsMonthlyQuota,
      pct: 0,
    })),
  ];

  return rows;
}

export async function setCustomerSmsQuota(
  customerId: string,
  quota: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireReseller();
  const resellerId = session.user.resellerId!;

  // Sicherheitscheck: Kunde gehört zu diesem Reseller
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenant: { resellerId } },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Kunde nicht gefunden" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { smsMonthlyQuota: quota },
  });

  logger.info({ customerId, quota, resellerId }, "Customer SMS quota updated");
  return { ok: true };
}

// ── Quota-Warnung (intern, wird von messages.ts aufgerufen) ────────────────────

export type SmsQuotaWarningContext = {
  usage: Pick<SmsUsage, "id" | "count" | "notified80" | "notified90" | "notified100">;
  recipient: Pick<Customer, "id" | "firstName" | "lastName" | "email" | "smsMonthlyQuota">;
  tenant: Pick<Tenant, "id" | "name" | "resellerId">;
  resellerId: string;
};

export async function checkAndSendSmsQuotaWarnings(ctx: SmsQuotaWarningContext): Promise<void> {
  const { usage, recipient, tenant } = ctx;
  const quota = recipient.smsMonthlyQuota;
  if (!quota || quota <= 0) return;

  const pct = (usage.count / quota) * 100;

  // Reseller-Admin E-Mail ermitteln
  const resellerAdmin = await prisma.resellerAdmin.findFirst({
    where: { resellerId: ctx.resellerId },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  const thresholds: Array<{ threshold: 80 | 90 | 100; flag: "notified80" | "notified90" | "notified100"; minPct: number }> = [
    { threshold: 100, flag: "notified100", minPct: 100 },
    { threshold: 90, flag: "notified90", minPct: 90 },
    { threshold: 80, flag: "notified80", minPct: 80 },
  ];

  for (const { threshold, flag, minPct } of thresholds) {
    if (pct >= minPct && !usage[flag]) {
      try {
        const customerName = `${recipient.firstName} ${recipient.lastName}`;

        // E-Mail an Kunden
        await sendMail(
          {
            to: recipient.email,
            subject: `SMS-Kontingent zu ${threshold} % verbraucht – ${tenant.name}`,
            html: smsQuotaWarningCustomerTemplate({
              recipientName: customerName,
              tenantName: tenant.name,
              threshold,
              used: usage.count,
              quota,
            }),
          },
          tenant.id,
        );

        // E-Mail an Reseller-Admin
        if (resellerAdmin) {
          await sendMail(
            {
              to: resellerAdmin.email,
              subject: `SMS-Kontingent ${threshold} % – ${customerName} (${tenant.name})`,
              html: smsQuotaWarningResellerTemplate({
                customerName,
                customerEmail: recipient.email,
                tenantName: tenant.name,
                threshold,
                used: usage.count,
                quota,
              }),
            },
            undefined,
            ctx.resellerId,
          );
        }

        // Flag setzen
        await prisma.smsUsage.update({
          where: { id: usage.id },
          data: { [flag]: true },
        });

        logger.info({ customerId: recipient.id, threshold, tenantId: tenant.id }, `SMS quota ${threshold}% warning sent`);
      } catch (err) {
        logger.warn({ err, customerId: recipient.id, threshold }, "SMS quota warning email failed");
      }

      // Nur die höchste überschrittene Schwelle benachrichtigen
      break;
    }
  }
}

