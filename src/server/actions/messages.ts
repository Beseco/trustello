"use server";

import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { requireEmployee } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { sendMessageSchema } from "@/lib/validation/messages";
import {
  unwrapTenantMasterKey,
  createMessageKeyMaterial,
  encrypt,
  wrapKey,
  getMasterKey,
  decrypt,
} from "@/lib/crypto/envelope";
import { deriveKeyFromPassword, generateSalt } from "@/lib/crypto/kdf";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail/send";
import { messageNotificationTemplate } from "@/lib/mail/templates/message-notification";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

export type SendMessageResult = {
  messageId?: string;
  error?: string;
};

export async function sendMessage(formData: FormData): Promise<SendMessageResult> {
  const rawData = {
    recipientId: formData.get("recipientId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    securityLevel: formData.get("securityLevel"),
    minTrustLevel: formData.get("minTrustLevel"),
    allowReply: formData.get("allowReply") === "true",
    encryptSubject: formData.get("encryptSubject") === "true",
    password: (formData.get("password") as string) || undefined,
    passwordHint: (formData.get("passwordHint") as string) || undefined,
    ouId: (formData.get("ouId") as string) || undefined,
    senderIsAnonymous: formData.get("senderIsAnonymous") === "true",
  };

  const parsed = sendMessageSchema.safeParse(rawData);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Ungültige Eingabe" };
  }

  try {
    return await _sendMessageInner(parsed.data, formData);
  } catch (err) {
    logger.error({ err }, "sendMessage: unhandled exception");
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Interner Fehler: ${message}` };
  }
}

async function _sendMessageInner(
  parsed: ReturnType<typeof sendMessageSchema.parse>,
  formData: FormData,
): Promise<SendMessageResult> {

  const {
    recipientId,
    subject,
    body,
    securityLevel,
    minTrustLevel,
    allowReply,
    encryptSubject,
    password,
    passwordHint,
    ouId,
    senderIsAnonymous,
  } = parsed;

  const isPasswordProtected = securityLevel === "LEVEL_3" || securityLevel === "LEVEL_4";
  if (isPasswordProtected && !password) {
    return { error: "Für LEVEL_3/4 ist ein Passwort erforderlich." };
  }

  let tenantId: string;
  let userId: string;

  try {
    ({ tenantId, userId } = await getTenantContext());
  } catch {
    return { error: "Nicht authentifiziert" };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: { select: { retentionDays: true, maxFileSizeMB: true, storageGB: true } } },
    // resellerId wird für die sipgate-Konfiguration benötigt
  });

  if (!tenant) return { error: "Mandant nicht gefunden" };

  // Plan-Limit: Speicherplatz prüfen
  const maxStorageBytes = BigInt(tenant.plan.storageGB) * BigInt(1024 ** 3);
  if (tenant.storageUsedBytes >= maxStorageBytes) {
    return {
      error: `Ihr Speicherkontingent von ${tenant.plan.storageGB} GB ist erschöpft. Bitte kontaktieren Sie Ihren Administrator.`,
    };
  }

  const recipient = await prisma.customer.findUnique({
    where: { id: recipientId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      firstName: true,
      lastName: true,
      mobilePhone: true,
      smsMonthlyQuota: true,
      citizenAccountId: true,
      citizenAccount: {
        select: {
          id: true,
          vaultEnabled: true,
          vaultKeyMaster: true,
          vaultKeyMasterIv: true,
          vaultKeyMasterAuthTag: true,
        },
      },
    },
  });

  if (!recipient || recipient.tenantId !== tenantId) {
    return { error: "Empfänger nicht gefunden" };
  }

  // Collect staged file keys (uploaded via /api/upload/stage)
  const stagingKeysRaw = formData.get("stagingKeys");
  const stagingEntries: Array<{ stagingKey: string; name: string; size: number; mimeType: string }> =
    stagingKeysRaw ? JSON.parse(stagingKeysRaw as string) : [];

  // Unwrap tenant master key + create message key
  const tmk = unwrapTenantMasterKey({
    tenantMasterKey: Buffer.from(tenant.tenantMasterKey),
    tmkIv: Buffer.from(tenant.tmkIv),
    tmkAuthTag: Buffer.from(tenant.tmkAuthTag),
  });

  // Einmalig generieren — plain und wrapped müssen dasselbe Key-Paar sein
  const { plain: messagePlainKey, wrapped: tmkWrapped } = createMessageKeyMaterial(tmk);

  let messageKeyMaterial: { messageKey: Buffer; messageKeyIv: Buffer; messageKeyAuthTag: Buffer };
  let passwordSaltBytes: Buffer | null = null;

  if (isPasswordProtected && password) {
    // LEVEL_3/4: Message-Key mit Passwort-abgeleitetem Key wrappen statt TMK
    const salt = generateSalt();
    const derivedKey = await deriveKeyFromPassword(password, salt);
    const wrapped = wrapKey(messagePlainKey, derivedKey);
    messageKeyMaterial = {
      messageKey: wrapped.ciphertext,
      messageKeyIv: wrapped.iv,
      messageKeyAuthTag: wrapped.authTag,
    };
    passwordSaltBytes = salt;
  } else {
    messageKeyMaterial = tmkWrapped;
  }

  // Encrypt body
  const bodyEnc = encrypt(Buffer.from(body, "utf-8"), messagePlainKey);

  // Encrypt subject
  let subjectFields: Record<string, unknown>;
  if (encryptSubject) {
    const subjectEnc = encrypt(Buffer.from(subject, "utf-8"), messagePlainKey);
    subjectFields = {
      subjectIsEncrypted: true,
      subjectCiphertext: subjectEnc.ciphertext as unknown as Uint8Array<ArrayBuffer>,
      subjectIv: subjectEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      subjectAuthTag: subjectEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
    };
  } else {
    subjectFields = { subjectIsEncrypted: false, subjectPlain: subject };
  }

  const expiresAt = new Date(Date.now() + tenant.plan.retentionDays * 24 * 60 * 60 * 1000);

  // Process attachments: scan → encrypt → upload to S3
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
  const s3 = getS3Client();
  const stagingKeysToDelete: string[] = [];

  for (const entry of stagingEntries) {
    // Verify the staging key belongs to this tenant (security check)
    if (!entry.stagingKey.startsWith(`staging/${tenantId}/`)) {
      return { error: "Ungültiger Anhang-Schlüssel" };
    }

    // Verify via S3 metadata that the file was scanned and belongs to this tenant
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: entry.stagingKey }),
    );
    const meta = head.Metadata ?? {};
    if (meta["tenant-id"] !== tenantId) return { error: "Anhang gehört nicht zu diesem Mandanten" };
    const scanStatus = (meta["scan-status"] ?? "ERROR") as "CLEAN" | "INFECTED" | "ERROR";
    if (scanStatus === "INFECTED") {
      return { error: `Datei "${entry.name}" wurde vom Virenscanner abgelehnt` };
    }

    // Download raw file from staging
    const getResult = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: entry.stagingKey }),
    );
    const fileBuffer = Buffer.from(await getResult.Body!.transformToByteArray());

    // Encrypt file content + filename with message key
    const contentEnc = encrypt(fileBuffer, messagePlainKey);
    const filenameEnc = encrypt(Buffer.from(entry.name, "utf-8"), messagePlainKey);

    // Upload encrypted content to final S3 location
    const storageKey = `${tenantId}/${randomBytes(16).toString("hex")}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: contentEnc.ciphertext,
        ContentType: "application/octet-stream",
      }),
    );

    stagingKeysToDelete.push(entry.stagingKey);

    attachmentInputs.push({
      filenameCiphertext: filenameEnc.ciphertext as unknown as Uint8Array<ArrayBuffer>,
      filenameIv: filenameEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      filenameAuthTag: filenameEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
      mimeType: entry.mimeType,
      sizeBytes: BigInt(entry.size),
      storageKey,
      contentIv: contentEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      contentAuthTag: contentEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
      virusScanStatus: scanStatus,
      virusScanResult: null,
    });
  }

  // Vault-Wrapping: Falls Empfänger einen aktiven Tresor hat, Message Key auch mit CMK wrappen
  let vaultMessageKeyFields: {
    vaultMessageKey?: Uint8Array<ArrayBuffer>;
    vaultMessageKeyIv?: Uint8Array<ArrayBuffer>;
    vaultMessageKeyAuthTag?: Uint8Array<ArrayBuffer>;
  } = {};

  if (
    !isPasswordProtected &&
    recipient.citizenAccount?.vaultEnabled &&
    recipient.citizenAccount.vaultKeyMaster &&
    recipient.citizenAccount.vaultKeyMasterIv &&
    recipient.citizenAccount.vaultKeyMasterAuthTag
  ) {
    try {
      const plainCMK = decrypt(
        {
          ciphertext: Buffer.from(recipient.citizenAccount.vaultKeyMaster),
          iv: Buffer.from(recipient.citizenAccount.vaultKeyMasterIv),
          authTag: Buffer.from(recipient.citizenAccount.vaultKeyMasterAuthTag),
        },
        getMasterKey(),
      );
      const vaultWrapped = wrapKey(messagePlainKey, plainCMK);
      vaultMessageKeyFields = {
        vaultMessageKey: vaultWrapped.ciphertext as unknown as Uint8Array<ArrayBuffer>,
        vaultMessageKeyIv: vaultWrapped.iv as unknown as Uint8Array<ArrayBuffer>,
        vaultMessageKeyAuthTag: vaultWrapped.authTag as unknown as Uint8Array<ArrayBuffer>,
      };
      logger.info({ recipientId }, "Message wrapped with citizen vault CMK");
    } catch (err) {
      logger.error({ recipientId, err }, "Failed to wrap message with vault CMK — falling back to TMK-only");
    }
  }

  const message = await prisma.message.create({
    data: {
      tenantId,
      senderId: userId,
      recipientId,
      ouId: ouId ?? null,
      senderIsAnonymous,
      ...subjectFields,
      bodyCiphertext: bodyEnc.ciphertext as unknown as Uint8Array<ArrayBuffer>,
      bodyIv: bodyEnc.iv as unknown as Uint8Array<ArrayBuffer>,
      bodyAuthTag: bodyEnc.authTag as unknown as Uint8Array<ArrayBuffer>,
      securityLevel,
      minTrustLevel,
      messageKey: messageKeyMaterial.messageKey as unknown as Uint8Array<ArrayBuffer>,
      messageKeyIv: messageKeyMaterial.messageKeyIv as unknown as Uint8Array<ArrayBuffer>,
      messageKeyAuthTag: messageKeyMaterial.messageKeyAuthTag as unknown as Uint8Array<ArrayBuffer>,
      ...vaultMessageKeyFields,
      passwordSalt: passwordSaltBytes
        ? (passwordSaltBytes as unknown as Uint8Array<ArrayBuffer>)
        : undefined,
      passwordHint: passwordHint ?? null,
      allowReply,
      allowReplyAttach: allowReply,
      expiresAt,
      events: {
        create: { eventType: "SENT", actorType: "USER", actorId: userId },
      },
      attachments:
        attachmentInputs.length > 0
          ? { create: attachmentInputs }
          : undefined,
    },
  });

  // Update tenant storage usage
  const totalBytes = attachmentInputs.reduce((sum, a) => sum + a.sizeBytes, 0n);
  if (totalBytes > 0n) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { storageUsedBytes: { increment: totalBytes } },
    });
  }

  // Clean up staging files (fire-and-forget, don't block on errors)
  for (const key of stagingKeysToDelete) {
    s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })).catch(() => {});
  }

  logger.info(
    { messageId: message.id, tenantId, senderId: userId, recipientId, attachments: attachmentInputs.length },
    "Message sent",
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Magic-Link-Token direkt in die Benachrichtigungs-E-Mail einbetten,
  // damit der Bürger mit einem Klick sofort zur Nachricht gelangt.
  // Gilt für alle Nachrichten die E-Mail-Verifizierung erfordern (minTrustLevel >= EMAIL).
  const LEVELS_NEEDING_MAGIC_LINK = ["EMAIL", "SMS", "PIN_LETTER", "BAYERN_ID_S", "BAYERN_ID_H", "EID"];
  let notificationUrl = `${appUrl}/m/${message.id}`;
  if (LEVELS_NEEDING_MAGIC_LINK.includes(minTrustLevel)) {
    const token = randomBytes(32).toString("hex");
    await prisma.magicLinkToken.create({
      data: {
        token,
        messageId: message.id,
        recipientEmail: recipient.email.toLowerCase(),
        expiresAt: new Date(expiresAt), // Token läuft mit Nachricht ab
      },
    });
    notificationUrl = `${appUrl}/api/auth/magic-link?token=${token}`;
    logger.info({ messageId: message.id }, "Magic link token created for notification email");
  }

  // Invite-Token: Falls noch kein CitizenAccount vorhanden, Einladungslink erstellen
  let inviteUrl: string | undefined;
  try {
    if (!recipient.citizenAccountId) {
      const existingInvite = await prisma.citizenInviteToken.findFirst({
        where: { customerId: recipient.id, usedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!existingInvite) {
        const inviteToken = randomBytes(32).toString("hex");
        const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Tage
        await prisma.citizenInviteToken.create({
          data: { token: inviteToken, email: recipient.email.toLowerCase(), customerId: recipient.id, expiresAt: inviteExpiresAt },
        });
        inviteUrl = `${appUrl}/postfach/registrieren?token=${inviteToken}`;
      }
    }
  } catch (err) {
    logger.warn({ messageId: message.id, err }, "Invite token creation failed — non-fatal");
  }

  // Sender-Label für E-Mail ermitteln
  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  const ouName = ouId
    ? (await prisma.organisationUnit.findUnique({ where: { id: ouId }, select: { name: true } }))?.name
    : undefined;
  const tenantName = tenant.name;

  let senderLabel: string;
  if (senderIsAnonymous) {
    senderLabel = ouName ? `Mitarbeiter/in · ${ouName} · ${tenantName}` : `Mitarbeiter/in · ${tenantName}`;
  } else {
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Mitarbeiter/in";
    senderLabel = ouName ? `${senderName} · ${ouName} · ${tenantName}` : `${senderName} · ${tenantName}`;
  }

  try {
    await sendMail({
      to: recipient.email,
      subject: encryptSubject ? "Sie haben eine neue sichere Nachricht" : `Neue Nachricht: ${subject}`,
      html: messageNotificationTemplate({
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        messageUrl: notificationUrl,
        expiresAt,
        senderLabel,
        inviteUrl,
      }),
    }, tenantId);
  } catch {
    logger.warn({ messageId: message.id }, "Notification email failed");
  }

  // --- SMS-Passwortübermittlung (Stufe 3 / 4) ---
  if (isPasswordProtected && password && recipient.mobilePhone) {
    try {
      const { sendSms } = await import("@/lib/sms/sipgate");
      const { getCurrentMonth } = await import("@/lib/sms/phone");
      const { checkAndSendSmsQuotaWarnings } = await import("@/server/actions/sipgate-settings");

      const currentMonth = getCurrentMonth();

      // Harte Kontingent-Sperre: Prüfung VOR dem Versand
      let quotaBlocked = false;
      if (recipient.smsMonthlyQuota) {
        const existingUsage = await prisma.smsUsage.findUnique({
          where: { customerId_month: { customerId: recipient.id, month: currentMonth } },
        });
        if ((existingUsage?.count ?? 0) >= recipient.smsMonthlyQuota) {
          quotaBlocked = true;
          logger.warn(
            { messageId: message.id, customerId: recipient.id, quota: recipient.smsMonthlyQuota },
            "SMS-Kontingent erschöpft — SMS nicht gesendet",
          );
        }
      }

      if (!quotaBlocked) {
        const smsText =
          `Ihr Zugangscode für die sichere Nachricht von ${tenant.name}:\n` +
          `${password}\n` +
          `Bitte unter ${appUrl}/m/${message.id} eingeben.`;
        const smsResult = await sendSms(recipient.mobilePhone, smsText, tenant.resellerId);

        if (!smsResult.ok) {
          logger.warn({ messageId: message.id, error: smsResult.error }, "SMS-Versand fehlgeschlagen");
        } else {
          logger.info({ messageId: message.id }, "Passwort per SMS gesendet");

          // Verbrauch inkrementieren
          const updatedUsage = await prisma.smsUsage.upsert({
            where: { customerId_month: { customerId: recipient.id, month: currentMonth } },
            create: {
              customerId: recipient.id,
              tenantId,
              resellerId: tenant.resellerId,
              month: currentMonth,
              count: 1,
            },
            update: { count: { increment: 1 } },
          });

          // Quota-Warnungen prüfen und versenden (non-fatal)
          checkAndSendSmsQuotaWarnings({
            usage: updatedUsage,
            recipient,
            tenant,
            resellerId: tenant.resellerId,
          }).catch((err) => logger.warn({ err, messageId: message.id }, "SMS quota warning failed"));
        }
      }
    } catch (err) {
      logger.warn({ messageId: message.id, err }, "SMS-Versand Fehler — non-fatal");
    }
  }

  return { messageId: message.id };
}

/** Returns a short-lived presigned S3 URL for downloading an attachment.
 *  Prüft: Anhang gehört zum Tenant UND der anfragende Mitarbeiter ist Sender oder Empfänger.
 */
export async function getAttachmentDownloadUrl(attachmentId: string): Promise<string | null> {
  let tenantId: string;
  let userId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
    const session = await requireEmployee();
    userId = session.user.id!;
  } catch {
    return null;
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: { select: { tenantId: true, senderId: true, recipientId: true } },
    },
  });

  if (!attachment || attachment.message.tenantId !== tenantId) return null;

  // Zugriffskontrolle: nur Sender oder Empfänger
  const isParty =
    attachment.message.senderId === userId || attachment.message.recipientId === userId;
  if (!isParty) return null;

  const s3 = getS3Client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: attachment.storageKey }),
    { expiresIn: 300 },
  );
}

export async function deleteMessage(messageId: string): Promise<{ error?: string }> {
  const session = await requireEmployee();
  const { tenantId } = await getTenantContext();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { tenantId: true, senderId: true, deletedAt: true },
  });

  if (!message || message.tenantId !== tenantId) return { error: "Nicht gefunden" };
  if (message.deletedAt) return { error: "Bereits gelöscht" };

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const isAdmin = roles.includes("TENANT_ADMIN") || roles.includes("USER_MANAGER");
  if (!isAdmin && message.senderId !== session.user.id) {
    return { error: "Keine Berechtigung" };
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/inbox");
  return {};
}
