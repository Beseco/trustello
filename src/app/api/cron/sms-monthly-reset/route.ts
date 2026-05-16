import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Läuft am 1. eines jeden Monats (z.B. via Vercel Cron: "0 0 1 * *")
// Bereinigt alte SmsUsage-Einträge (> 13 Monate).
// Kein aktiver Reset nötig — neuer Monat erzeugt automatisch eine neue Zeile.
//
// Absichern via CRON_SECRET: Authorization: Bearer <CRON_SECRET>
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET nicht konfiguriert — Endpunkt gesperrt" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Monat vor 13 Monaten berechnen (YYYYMM)
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 13);
  const cutoffMonth = cutoff.getFullYear() * 100 + (cutoff.getMonth() + 1);

  const deleted = await prisma.smsUsage.deleteMany({
    where: { month: { lt: cutoffMonth } },
  });

  logger.info({ deletedCount: deleted.count, cutoffMonth }, "SMS usage cleanup completed");

  return Response.json({
    ok: true,
    cleaned: { smsUsageEntries: deleted.count },
    cutoffMonth,
    timestamp: new Date().toISOString(),
  });
}
