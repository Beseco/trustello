import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// Wird per Cron (täglich) oder manuell aufgerufen.
// Absichern via CRON_SECRET-Header:  Authorization: Bearer <CRON_SECRET>
// CRON_SECRET MUSS gesetzt sein — andernfalls lehnt der Endpunkt alle Anfragen ab.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Kein Secret konfiguriert → Endpunkt ist gesperrt (fail-closed)
    return Response.json(
      { error: "CRON_SECRET nicht konfiguriert — Endpunkt gesperrt" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. Abgelaufene Nachrichten soft-deleten + S3-Anhänge löschen
  const expiredWithAttachments = await prisma.message.findMany({
    where: { expiresAt: { lt: now }, deletedAt: null },
    select: { id: true, attachments: { select: { storageKey: true } } },
  });

  // S3-Objekte löschen bevor soft-delete (DSGVO-konform: Daten werden wirklich entfernt)
  const s3 = getS3Client();
  let deletedAttachments = 0;
  for (const msg of expiredWithAttachments) {
    for (const att of msg.attachments) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: att.storageKey }));
        deletedAttachments++;
      } catch (err) {
        logger.warn({ storageKey: att.storageKey, err }, "Cleanup: S3 delete failed");
      }
    }
  }

  const { count: expiredMessages } = await prisma.message.updateMany({
    where: { expiresAt: { lt: now }, deletedAt: null },
    data: { deletedAt: now },
  });

  // 2. Verbrauchte/abgelaufene Magic-Link-Tokens löschen
  const { count: magicLinks } = await prisma.magicLinkToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
  });

  // 3. Verbrauchte/abgelaufene Passwort-Reset-Tokens löschen
  const { count: resetTokens } = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
  });

  // 4. Alte Import-Jobs (> 90 Tage) löschen
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const { count: importJobs } = await prisma.importJob.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  logger.info(
    { expiredMessages, deletedAttachments, magicLinks, resetTokens, importJobs },
    "Cleanup completed",
  );

  return Response.json({
    ok: true,
    cleaned: { expiredMessages, deletedAttachments, magicLinks, resetTokens, importJobs },
    timestamp: now.toISOString(),
  });
}
