import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyCookieValue } from "@/app/api/auth/magic-link/route";
import { unwrapTenantMasterKey, unwrapMessageKey, decrypt } from "@/lib/crypto/envelope";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "@/lib/logger";

type Params = { messageId: string; attachmentId: string };

/**
 * Authentifizierter Anhang-Download für das Bürger-Portal.
 *
 * Kein Presigned-URL wird an den Browser weitergegeben — stattdessen:
 * 1. Magic-Link-Cookie validieren
 * 2. Anhang aus S3 holen
 * 3. Entschlüsseln (TMK → MK → Inhalt)
 * 4. Als Byte-Stream mit korrektem Content-Type und Content-Disposition ausliefern
 *
 * Nur für LEVEL_1/2-Nachrichten (TMK-basiert). Passwortgeschützte Nachrichten
 * (LEVEL_3/4) werden über die Server Action decryptWithPassword abgehandelt.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse> {
  const { messageId, attachmentId } = await params;

  // ── 1. Cookie validieren ────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const raw = cookieStore.get("ml_session")?.value;
  if (!raw) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const session = verifyCookieValue(raw);
  if (!session || session.messageId !== messageId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  // ── 2. Nachricht + Anhang laden ─────────────────────────────────────────────
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      deletedAt: true,
      expiresAt: true,
      recipientId: true,
      securityLevel: true,
      messageKey: true,
      messageKeyIv: true,
      messageKeyAuthTag: true,
      tenant: {
        select: {
          tenantMasterKey: true,
          tmkIv: true,
          tmkAuthTag: true,
        },
      },
      attachments: {
        where: { id: attachmentId, virusScanStatus: "CLEAN" },
        select: {
          id: true,
          filenameCiphertext: true,
          filenameIv: true,
          filenameAuthTag: true,
          mimeType: true,
          storageKey: true,
          contentIv: true,
          contentAuthTag: true,
        },
      },
    },
  });

  if (!message || message.deletedAt || message.expiresAt < new Date()) {
    return NextResponse.json({ error: "Nachricht nicht gefunden oder abgelaufen" }, { status: 404 });
  }

  // Nur LEVEL_1/2 — passwortgeschützte Nachrichten nicht über diesen Endpunkt
  if (message.securityLevel === "LEVEL_3" || message.securityLevel === "LEVEL_4") {
    return NextResponse.json(
      { error: "Passwortgeschützte Anhänge nicht über diesen Endpunkt abrufbar" },
      { status: 403 },
    );
  }

  const att = message.attachments[0];
  if (!att) {
    return NextResponse.json({ error: "Anhang nicht gefunden" }, { status: 404 });
  }

  // ── 3. Entschlüsseln ────────────────────────────────────────────────────────
  try {
    const tmk = unwrapTenantMasterKey({
      tenantMasterKey: Buffer.from(message.tenant.tenantMasterKey),
      tmkIv: Buffer.from(message.tenant.tmkIv),
      tmkAuthTag: Buffer.from(message.tenant.tmkAuthTag),
    });

    const mk = unwrapMessageKey(
      {
        messageKey: Buffer.from(message.messageKey),
        messageKeyIv: Buffer.from(message.messageKeyIv),
        messageKeyAuthTag: Buffer.from(message.messageKeyAuthTag),
      },
      tmk,
    );

    // Dateiname entschlüsseln
    const filename = decrypt(
      {
        ciphertext: Buffer.from(att.filenameCiphertext),
        iv: Buffer.from(att.filenameIv),
        authTag: Buffer.from(att.filenameAuthTag),
      },
      mk,
    ).toString("utf-8");

    // ── 4. S3-Objekt abrufen und entschlüsselten Inhalt streamen ───────────────
    const s3 = getS3Client();
    const s3Response = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: att.storageKey }),
    );

    if (!s3Response.Body) {
      return NextResponse.json({ error: "Datei nicht verfügbar" }, { status: 502 });
    }

    // Inhalt als Buffer laden und entschlüsseln
    const encryptedBuffer = Buffer.from(await s3Response.Body.transformToByteArray());
    const decryptedBuffer = decrypt(
      {
        ciphertext: encryptedBuffer,
        iv: Buffer.from(att.contentIv),
        authTag: Buffer.from(att.contentAuthTag),
      },
      mk,
    );

    logger.info({ messageId, attachmentId }, "Citizen attachment downloaded via proxy");

    return new NextResponse(decryptedBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": att.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(decryptedBuffer.length),
        // Kein Caching — sensible Dokumente
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    logger.error({ messageId, attachmentId, err }, "Citizen attachment decrypt failed");
    return NextResponse.json({ error: "Entschlüsselung fehlgeschlagen" }, { status: 500 });
  }
}
