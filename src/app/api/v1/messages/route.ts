import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, requireScope, handleApiAuthError, apiError } from "@/lib/api-auth";
import { z } from "zod";
import {
  unwrapTenantMasterKey,
  createMessageKeyMaterial,
  encrypt,
} from "@/lib/crypto/envelope";
import { sendMail } from "@/lib/mail/send";
import { messageNotificationTemplate } from "@/lib/mail/templates/message-notification";
import { logger } from "@/lib/logger";
import { handleOptions } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

// GET /api/v1/messages — Scope: messages:read
// Gibt die gesendeten Nachrichten des Mandanten zurück (ohne Entschlüsselung).
export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    requireScope(auth, "messages:read");

    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
    const recipientId = searchParams.get("recipientId");

    const messages = await prisma.message.findMany({
      where: {
        tenantId: auth.tenantId,
        deletedAt: null,
        ...(recipientId ? { recipientId } : {}),
      },
      orderBy: { sentAt: "desc" },
      take,
      select: {
        id: true,
        securityLevel: true,
        subjectIsEncrypted: true,
        subjectPlain: true,
        sentAt: true,
        expiresAt: true,
        firstReadAt: true,
        allowReply: true,
        recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
        sender: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { attachments: true } },
      },
    });

    const data = messages.map((m) => ({
      id: m.id,
      securityLevel: m.securityLevel,
      subject: m.subjectIsEncrypted ? null : m.subjectPlain,
      subjectEncrypted: m.subjectIsEncrypted,
      sentAt: m.sentAt,
      expiresAt: m.expiresAt,
      readAt: m.firstReadAt,
      allowReply: m.allowReply,
      attachmentCount: m._count.attachments,
      recipient: m.recipient,
      sender: m.sender,
    }));

    return Response.json({ data, count: data.length });
  } catch (err) {
    return handleApiAuthError(err);
  }
}

const postSchema = z.object({
  recipientId: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50000),
  securityLevel: z.enum(["LEVEL_1", "LEVEL_2"]).default("LEVEL_2"),
  minTrustLevel: z.enum(["NONE", "EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"]).default("EMAIL"),
  allowReply: z.boolean().default(true),
});

// POST /api/v1/messages — Scope: messages:write
// Sendet eine neue Nachricht (LEVEL_1/2, kein Passwortschutz, keine Anhänge).
// Absender: erster aktiver TENANT_ADMIN des Mandanten.
export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiKey(request);
    requireScope(auth, "messages:write");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Ungültiger JSON-Body.");
    }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
    }

    const { recipientId, recipientEmail, subject, body: bodyText, securityLevel, minTrustLevel, allowReply } = parsed.data;

    if (!recipientId && !recipientEmail) {
      return apiError(400, "recipientId oder recipientEmail erforderlich.");
    }

    const [tenant, sender] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: auth.tenantId },
        include: { plan: { select: { retentionDays: true } } },
      }),
      prisma.user.findFirst({
        where: { tenantId: auth.tenantId, isActive: true, roles: { has: "TENANT_ADMIN" } },
        select: { id: true },
      }),
    ]);

    if (!tenant) return apiError(500, "Mandant nicht gefunden.");
    if (!sender) return apiError(422, "Kein aktiver Tenant-Admin als Absender gefunden.");

    const recipient = await prisma.customer.findFirst({
      where: {
        tenantId: auth.tenantId,
        ...(recipientId ? { id: recipientId } : { email: recipientEmail }),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!recipient) return apiError(404, "Empfänger nicht gefunden.");

    const tmk = unwrapTenantMasterKey({
      tenantMasterKey: Buffer.from(tenant.tenantMasterKey),
      tmkIv: Buffer.from(tenant.tmkIv),
      tmkAuthTag: Buffer.from(tenant.tmkAuthTag),
    });

    const { plain: messagePlainKey, wrapped: messageKeyMaterial } = createMessageKeyMaterial(tmk);

    const bodyEnc = encrypt(Buffer.from(bodyText, "utf-8"), messagePlainKey);
    const expiresAt = new Date(Date.now() + tenant.plan.retentionDays * 24 * 60 * 60 * 1000);

    const message = await prisma.message.create({
      data: {
        tenantId: auth.tenantId,
        senderId: sender.id,
        recipientId: recipient.id,
        subjectIsEncrypted: false,
        subjectPlain: subject,
        bodyCiphertext: bodyEnc.ciphertext as unknown as Uint8Array<ArrayBuffer>,
        bodyIv: bodyEnc.iv as unknown as Uint8Array<ArrayBuffer>,
        bodyAuthTag: bodyEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
        securityLevel,
        minTrustLevel,
        messageKey: messageKeyMaterial.messageKey as unknown as Uint8Array<ArrayBuffer>,
        messageKeyIv: messageKeyMaterial.messageKeyIv as unknown as Uint8Array<ArrayBuffer>,
        messageKeyAuthTag: messageKeyMaterial.messageKeyAuthTag as unknown as Uint8Array<ArrayBuffer>,
        allowReply,
        allowReplyAttach: allowReply,
        expiresAt,
        events: { create: { eventType: "SENT", actorType: "SYSTEM" } },
      },
    });

    logger.info({ messageId: message.id, tenantId: auth.tenantId, recipientId: recipient.id }, "API message sent");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendMail({
      to: recipient.email,
      subject: `Neue Nachricht: ${subject}`,
      html: messageNotificationTemplate({
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        messageUrl: `${appUrl}/m/${message.id}`,
        expiresAt,
      }),
    }).catch(() => undefined);

    return Response.json({ id: message.id, messageUrl: `${appUrl}/m/${message.id}` }, { status: 201 });
  } catch (err) {
    return handleApiAuthError(err);
  }
}
