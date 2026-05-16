"use server";

import { prisma } from "@/lib/db";
import { requireTenantAdmin } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "@/lib/logger";

// ── Datenexport (Art. 20 DSGVO — Recht auf Datenportabilität) ─────────────────

export type CustomerExportData = {
  exportedAt: string;
  customer: {
    id: string;
    salutation: string | null;
    firstName: string;
    lastName: string;
    email: string;
    mobilePhone: string | null;
    landlinePhone: string | null;
    street: string | null;
    zipCode: string | null;
    city: string | null;
    country: string | null;
    trustLevel: string;
    hasAccount: boolean;
    createdAt: string;
  };
  messages: {
    id: string;
    subject: string | null;
    sentAt: string;
    expiresAt: string;
    securityLevel: string;
    senderName: string;
    attachmentCount: number;
  }[];
  notes: {
    content: string;
    authorName: string;
    createdAt: string;
  }[];
  trustMethods: {
    method: string;
    verifiedAt: string;
  }[];
};

export async function exportCustomerData(
  customerId: string,
): Promise<{ ok: true; data: CustomerExportData } | { ok: false; error: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      receivedMessages: {
        where: { deletedAt: null },
        select: {
          id: true,
          subjectPlain: true,
          subjectIsEncrypted: true,
          sentAt: true,
          expiresAt: true,
          securityLevel: true,
          sender: { select: { firstName: true, lastName: true } },
          _count: { select: { attachments: true } },
        },
        orderBy: { sentAt: "desc" },
      },
      notes: {
        select: {
          content: true,
          createdAt: true,
          author: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      trustMethods: {
        select: { method: true, verifiedAt: true },
        orderBy: { verifiedAt: "desc" },
      },
    },
  });

  if (!customer || customer.tenantId !== tenantId) {
    return { ok: false, error: "Kunde nicht gefunden" };
  }

  logger.info({ customerId, tenantId }, "GDPR: Customer data export requested");

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      customer: {
        id: customer.id,
        salutation: customer.salutation,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        mobilePhone: customer.mobilePhone,
        landlinePhone: customer.landlinePhone,
        street: customer.street,
        zipCode: customer.zipCode,
        city: customer.city,
        country: customer.country,
        trustLevel: customer.trustLevel,
        hasAccount: customer.hasAccount,
        createdAt: customer.createdAt.toISOString(),
      },
      messages: customer.receivedMessages.map((m) => ({
        id: m.id,
        subject: m.subjectIsEncrypted ? "[verschlüsselt]" : (m.subjectPlain ?? null),
        sentAt: m.sentAt.toISOString(),
        expiresAt: m.expiresAt.toISOString(),
        securityLevel: m.securityLevel,
        senderName: `${m.sender.firstName} ${m.sender.lastName}`,
        attachmentCount: m._count.attachments,
      })),
      notes: customer.notes.map((n) => ({
        content: n.content,
        authorName: `${n.author.firstName} ${n.author.lastName}`,
        createdAt: n.createdAt.toISOString(),
      })),
      trustMethods: customer.trustMethods.map((t) => ({
        method: t.method,
        verifiedAt: t.verifiedAt.toISOString(),
      })),
    },
  };
}

// ── Hard-Delete / Anonymisierung (Art. 17 DSGVO — Recht auf Löschung) ─────────

export async function hardDeleteCustomer(
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireTenantAdmin();
  const { tenantId } = await getTenantContext();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      tenantId: true,
      receivedMessages: {
        select: {
          id: true,
          attachments: { select: { storageKey: true } },
        },
      },
    },
  });

  if (!customer || customer.tenantId !== tenantId) {
    return { ok: false, error: "Kunde nicht gefunden" };
  }

  // S3-Anhänge löschen (bevor DB-Records verschwinden)
  const s3 = getS3Client();
  const storageKeys = customer.receivedMessages.flatMap((m) =>
    m.attachments.map((a) => a.storageKey),
  );

  for (const key of storageKeys) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (err) {
      logger.warn({ key, err }, "GDPR: S3 delete failed for attachment");
    }
  }

  // Nachrichten und alle verknüpften Records löschen (Cascade via Prisma-Schema)
  await prisma.message.deleteMany({
    where: {
      tenantId,
      recipientId: customerId,
    },
  });

  // Kundendaten anonymisieren statt hard-delete (bewahrt Audit-Trail-Integrität)
  // Personenbezogene Felder werden überschrieben, ID bleibt für referenzielle Integrität
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: "[gelöscht]",
      lastName: "[gelöscht]",
      email: `deleted-${customerId}@deleted.invalid`,
      salutation: null,
      mobilePhone: null,
      landlinePhone: null,
      street: null,
      zipCode: null,
      city: null,
      country: null,
      passwordHash: null,
      totpSecret: null,
      totpEnabled: false,
      hasAccount: false,
      publicKey: null,
    },
  });

  // Notizen löschen
  await prisma.customerNote.deleteMany({ where: { customerId } });

  // Trust-Methoden löschen
  await prisma.trustMethod.deleteMany({ where: { customerId } });

  logger.info({ customerId, tenantId, attachmentsDeleted: storageKeys.length }, "GDPR: Customer hard-deleted");

  return { ok: true };
}
