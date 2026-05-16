"use server";

import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail/send";
import { logger } from "@/lib/logger";
import { z } from "zod";
import {
  unwrapTenantMasterKey,
  createMessageKeyMaterial,
  encrypt,
} from "@/lib/crypto/envelope";
import { randomBytes } from "node:crypto";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { scanBuffer } from "@/lib/clamav";
import { citizenReplyNotificationTemplate } from "@/lib/mail/templates/citizen-reply-notification";

const replySchema = z.object({
  originalMessageId: z.string().min(1),
  body: z.string().min(1, "Nachricht darf nicht leer sein").max(20000, "Nachricht zu lang"),
});

export type CitizenReplyResult = { ok: true } | { ok: false; error: string };

export async function submitCitizenReply(formData: FormData): Promise<CitizenReplyResult> {
  const parsed = replySchema.safeParse({
    originalMessageId: formData.get("originalMessageId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { originalMessageId, body } = parsed.data;

  const original = await prisma.message.findUnique({
    where: { id: originalMessageId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          tenantMasterKey: true,
          tmkIv: true,
          tmkAuthTag: true,
          plan: { select: { retentionDays: true, maxFileSizeMB: true } },
        },
      },
      sender: { select: { id: true, email: true, firstName: true, lastName: true } },
      recipient: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  if (!original || original.deletedAt) return { ok: false, error: "Nachricht nicht gefunden" };
  if (!original.allowReply) return { ok: false, error: "Antworten ist für diese Nachricht deaktiviert" };
  if (original.expiresAt < new Date()) return { ok: false, error: "Diese Nachricht ist abgelaufen" };

  const tenant = original.tenant;

  const tmk = unwrapTenantMasterKey({
    tenantMasterKey: Buffer.from(tenant.tenantMasterKey),
    tmkIv: Buffer.from(tenant.tmkIv),
    tmkAuthTag: Buffer.from(tenant.tmkAuthTag),
  });

  const { plain: messagePlainKey, wrapped: messageKeyMaterial } = createMessageKeyMaterial(tmk);

  const bodyEnc = encrypt(Buffer.from(body, "utf-8"), messagePlainKey);
  const subjectText = `Antwort auf Ihre Nachricht`;
  const expiresAt = new Date(Date.now() + tenant.plan.retentionDays * 24 * 60 * 60 * 1000);

  // Anhänge verarbeiten
  const files = formData.getAll("attachments") as File[];
  const maxFileSizeBytes = tenant.plan.maxFileSizeMB * 1024 * 1024;

  type AttachmentInput = {
    filenameCiphertext: Uint8Array<ArrayBuffer>;
    filenameIv: Uint8Array<ArrayBuffer>;
    filenameAuthTag: Uint8Array<ArrayBuffer>;
    mimeType: string;
    sizeBytes: bigint;
    storageKey: string;
    contentIv: Uint8Array<ArrayBuffer>;
    contentAuthTag: Uint8Array<ArrayBuffer>;
    virusScanStatus: "CLEAN" | "INFECTED" | "ERROR";
    virusScanResult: string | null;
  };

  const attachmentInputs: AttachmentInput[] = [];

  for (const file of files.filter((f) => f.size > 0)) {
    if (!original.allowReplyAttach) break;
    if (file.size > maxFileSizeBytes) {
      return { ok: false, error: `Datei "${file.name}" überschreitet ${tenant.plan.maxFileSizeMB} MB` };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let scanStatus: "CLEAN" | "INFECTED" | "ERROR" = "ERROR";
    let scanResult: string | null = null;
    try {
      const scan = await scanBuffer(fileBuffer);
      scanStatus = scan.clean ? "CLEAN" : "INFECTED";
      scanResult = scan.clean ? null : scan.result;
    } catch {
      scanStatus = "ERROR";
    }

    if (scanStatus === "INFECTED") {
      logger.warn({ filename: file.name, threat: scanResult }, "ClamAV: Datei abgelehnt (Bürger-Antwort)");
      return {
        ok: false,
        error: `Datei "${file.name}" wurde vom Virenscanner abgelehnt (${scanResult ?? "unbekannte Bedrohung"}).`,
      };
    }

    const contentEnc = encrypt(fileBuffer, messagePlainKey);
    const filenameEnc = encrypt(Buffer.from(file.name, "utf-8"), messagePlainKey);
    const storageKey = `${tenant.id}/${randomBytes(16).toString("hex")}`;

    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: contentEnc.ciphertext,
        ContentType: "application/octet-stream",
      }),
    );

    attachmentInputs.push({
      filenameCiphertext: filenameEnc.ciphertext as unknown as Uint8Array<ArrayBuffer>,
      filenameIv: filenameEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      filenameAuthTag: filenameEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: BigInt(file.size),
      storageKey,
      contentIv: contentEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      contentAuthTag: contentEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
      virusScanStatus: scanStatus,
      virusScanResult: scanResult,
    });
  }

  const reply = await prisma.message.create({
    data: {
      tenantId: tenant.id,
      parentMessageId: originalMessageId,
      senderId: original.senderId,       // Mitarbeiter bleibt technischer Absender (User-FK)
      recipientId: original.recipientId, // Kunde bleibt recipientId (Customer-FK — senderId wäre User-ID, nicht Customer-ID)
      subjectIsEncrypted: false,
      subjectPlain: subjectText,
      bodyCiphertext: bodyEnc.ciphertext as unknown as Uint8Array<ArrayBuffer>,
      bodyIv: bodyEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      bodyAuthTag: bodyEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
      securityLevel: "LEVEL_2",
      minTrustLevel: "NONE",
      messageKey: messageKeyMaterial.messageKey as unknown as Uint8Array<ArrayBuffer>,
      messageKeyIv: messageKeyMaterial.messageKeyIv as unknown as Uint8Array<ArrayBuffer>,
      messageKeyAuthTag: messageKeyMaterial.messageKeyAuthTag as unknown as Uint8Array<ArrayBuffer>,
      allowReply: false,
      allowReplyAttach: false,
      expiresAt,
      events: {
        create: { eventType: "SENT", actorType: "CUSTOMER", actorId: original.recipientId },
      },
      attachments: attachmentInputs.length > 0 ? { create: attachmentInputs } : undefined,
    },
  });

  // Ereignis auf Originalnachricht: Beantwortet
  await prisma.messageEvent.create({
    data: {
      messageId: originalMessageId,
      eventType: "REPLIED",
      actorType: "CUSTOMER",
      actorId: original.recipientId,
    },
  });

  logger.info({ replyId: reply.id, originalId: originalMessageId }, "Citizen reply submitted");

  try {
    await sendMail({
      to: original.sender.email,
      subject: `${original.recipient.firstName} ${original.recipient.lastName} hat auf Ihre Nachricht geantwortet`,
      html: citizenReplyNotificationTemplate({
        employeeName: `${original.sender.firstName} ${original.sender.lastName}`,
        customerName: `${original.recipient.firstName} ${original.recipient.lastName}`,
        originalMessageId,
      }),
    }, tenant.id);
  } catch {
    logger.warn({ replyId: reply.id }, "Reply notification email failed");
  }

  return { ok: true };
}
