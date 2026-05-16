"use server";

import { prisma } from "@/lib/db";
import { unwrapKey, decrypt } from "@/lib/crypto/envelope";
import { deriveKeyFromPassword } from "@/lib/crypto/kdf";
import { logger } from "@/lib/logger";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireEmployee } from "@/lib/auth-helpers";
import { getTenantContext } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type DecryptedMessage = {
  subject: string;
  body: string;
  senderName: string;
  sentAt: string;
  expiresAt: string;
  securityLevel: string;
  attachments: { id: string; filename: string; mimeType: string; sizeBytes: string; downloadUrl: string }[];
};

export type DecryptResult =
  | { ok: true; message: DecryptedMessage }
  | { ok: false; error: string };

// Max. 5 Fehlversuche pro Nachricht + IP pro Stunde
const DECRYPT_MAX_ATTEMPTS = 5;
const DECRYPT_WINDOW_MS = 60 * 60 * 1000;

export async function decryptWithPassword(
  messageId: string,
  password: string,
): Promise<DecryptResult> {
  // Rate-Limit: IP aus Request-Header lesen
  const reqHeaders = await headers();
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    "unknown";

  const allowed = await checkRateLimit(
    `pwd-decrypt:${messageId}:${ip}`,
    DECRYPT_MAX_ATTEMPTS,
    DECRYPT_WINDOW_MS,
  );
  if (!allowed) {
    logger.warn({ messageId, ip }, "Password decrypt rate limit exceeded");
    return {
      ok: false,
      error: "Zu viele Versuche. Bitte warten Sie eine Stunde und versuchen Sie es erneut.",
    };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { firstName: true, lastName: true } },
      attachments: {
        where: { virusScanStatus: "CLEAN" },
        select: {
          id: true,
          filenameCiphertext: true,
          filenameIv: true,
          filenameAuthTag: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
          contentIv: true,
          contentAuthTag: true,
        },
      },
    },
  });

  if (!message || message.deletedAt) return { ok: false, error: "Nachricht nicht gefunden" };
  if (message.expiresAt < new Date()) return { ok: false, error: "Diese Nachricht ist abgelaufen" };

  const isPasswordLevel = message.securityLevel === "LEVEL_3" || message.securityLevel === "LEVEL_4";
  if (!isPasswordLevel) return { ok: false, error: "Ungültige Anfrage" };

  if (!message.passwordSalt) return { ok: false, error: "Kein Passwort-Salt gespeichert" };

  try {
    const salt = Buffer.from(message.passwordSalt);
    const derivedKey = await deriveKeyFromPassword(password, salt);

    const mk = unwrapKey(
      {
        ciphertext: Buffer.from(message.messageKey),
        iv: Buffer.from(message.messageKeyIv),
        authTag: Buffer.from(message.messageKeyAuthTag),
      },
      derivedKey,
    );

    const body = decrypt(
      {
        ciphertext: Buffer.from(message.bodyCiphertext),
        iv: Buffer.from(message.bodyIv),
        authTag: Buffer.from(message.bodyAuthTag),
      },
      mk,
    ).toString("utf-8");

    let subject = "(kein Betreff)";
    if (
      message.subjectIsEncrypted &&
      message.subjectCiphertext &&
      message.subjectIv &&
      message.subjectAuthTag
    ) {
      subject = decrypt(
        {
          ciphertext: Buffer.from(message.subjectCiphertext),
          iv: Buffer.from(message.subjectIv),
          authTag: Buffer.from(message.subjectAuthTag),
        },
        mk,
      ).toString("utf-8");
    } else if (message.subjectPlain) {
      subject = message.subjectPlain;
    }

    const s3 = getS3Client();
    const attachments = await Promise.all(
      message.attachments.map(async (att) => {
        const filename = decrypt(
          {
            ciphertext: Buffer.from(att.filenameCiphertext),
            iv: Buffer.from(att.filenameIv),
            authTag: Buffer.from(att.filenameAuthTag),
          },
          mk,
        ).toString("utf-8");

        const downloadUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: att.storageKey,
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
          }),
          { expiresIn: 300 },
        );

        return {
          id: att.id,
          filename,
          mimeType: att.mimeType,
          sizeBytes: String(att.sizeBytes),
          downloadUrl,
        };
      }),
    );

    // Record open event
    const now = new Date();
    if (!message.firstReadAt) {
      await prisma.message.update({
        where: { id: messageId },
        data: { firstReadAt: now, lastReadAt: now },
      });
      await prisma.messageEvent.create({
        data: { messageId, eventType: "OPENED", actorType: "CUSTOMER", actorId: message.recipientId },
      });
    } else {
      await prisma.message.update({ where: { id: messageId }, data: { lastReadAt: now } });
    }

    return {
      ok: true,
      message: {
        subject,
        body,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
        sentAt: message.sentAt.toISOString(),
        expiresAt: message.expiresAt.toISOString(),
        securityLevel: message.securityLevel,
        attachments,
      },
    };
  } catch (err) {
    logger.warn({ messageId, err }, "Password decrypt failed");
    return { ok: false, error: "Falsches Passwort oder Nachricht beschädigt" };
  }
}

export async function decryptMessageForEmployee(
  messageId: string,
  password: string,
): Promise<DecryptResult> {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();

  // Rate-Limit pro Mitarbeiter-Session + Nachricht
  const allowed = await checkRateLimit(
    `pwd-decrypt-emp:${messageId}:${session.user.id}`,
    DECRYPT_MAX_ATTEMPTS,
    DECRYPT_WINDOW_MS,
  );
  if (!allowed) {
    logger.warn({ messageId, userId: session.user.id }, "Employee password decrypt rate limit exceeded");
    return {
      ok: false,
      error: "Zu viele Versuche. Bitte warten Sie eine Stunde und versuchen Sie es erneut.",
    };
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { firstName: true, lastName: true } },
      attachments: {
        where: { virusScanStatus: "CLEAN" },
        select: {
          id: true,
          filenameCiphertext: true,
          filenameIv: true,
          filenameAuthTag: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
          contentIv: true,
          contentAuthTag: true,
        },
      },
    },
  });

  if (!message || message.tenantId !== tenantId || message.deletedAt)
    return { ok: false, error: "Nachricht nicht gefunden" };
  if (message.expiresAt < new Date()) return { ok: false, error: "Diese Nachricht ist abgelaufen" };

  const isPasswordLevel = message.securityLevel === "LEVEL_3" || message.securityLevel === "LEVEL_4";
  if (!isPasswordLevel) return { ok: false, error: "Ungültige Anfrage" };
  if (!message.passwordSalt) return { ok: false, error: "Kein Passwort-Salt gespeichert" };

  try {
    const salt = Buffer.from(message.passwordSalt);
    const derivedKey = await deriveKeyFromPassword(password, salt);

    const mk = unwrapKey(
      {
        ciphertext: Buffer.from(message.messageKey),
        iv: Buffer.from(message.messageKeyIv),
        authTag: Buffer.from(message.messageKeyAuthTag),
      },
      derivedKey,
    );

    const body = decrypt(
      {
        ciphertext: Buffer.from(message.bodyCiphertext),
        iv: Buffer.from(message.bodyIv),
        authTag: Buffer.from(message.bodyAuthTag),
      },
      mk,
    ).toString("utf-8");

    let subject = "(kein Betreff)";
    if (message.subjectIsEncrypted && message.subjectCiphertext && message.subjectIv && message.subjectAuthTag) {
      subject = decrypt(
        {
          ciphertext: Buffer.from(message.subjectCiphertext),
          iv: Buffer.from(message.subjectIv),
          authTag: Buffer.from(message.subjectAuthTag),
        },
        mk,
      ).toString("utf-8");
    } else if (message.subjectPlain) {
      subject = message.subjectPlain;
    }

    const s3 = getS3Client();
    const attachments = await Promise.all(
      message.attachments.map(async (att) => {
        const filename = decrypt(
          {
            ciphertext: Buffer.from(att.filenameCiphertext),
            iv: Buffer.from(att.filenameIv),
            authTag: Buffer.from(att.filenameAuthTag),
          },
          mk,
        ).toString("utf-8");

        const downloadUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: att.storageKey,
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
          }),
          { expiresIn: 300 },
        );

        return { id: att.id, filename, mimeType: att.mimeType, sizeBytes: String(att.sizeBytes), downloadUrl };
      }),
    );

    const now = new Date();
    if (!message.firstReadAt) {
      await prisma.message.update({ where: { id: messageId }, data: { firstReadAt: now, lastReadAt: now } });
      await prisma.messageEvent.create({
        data: { messageId, eventType: "OPENED", actorType: "USER", actorId: session.user.id },
      });
    } else {
      await prisma.message.update({ where: { id: messageId }, data: { lastReadAt: now } });
    }

    return {
      ok: true,
      message: {
        subject,
        body,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
        sentAt: message.sentAt.toISOString(),
        expiresAt: message.expiresAt.toISOString(),
        securityLevel: message.securityLevel,
        attachments,
      },
    };
  } catch (err) {
    logger.warn({ messageId, err }, "Employee password decrypt failed");
    return { ok: false, error: "Falsches Passwort oder Nachricht beschädigt" };
  }
}
