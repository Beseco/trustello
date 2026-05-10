import { prisma } from "@/lib/db";

export async function GET() {
  const dbOk = await prisma.$queryRaw`SELECT 1`
    .then(() => true)
    .catch(() => false);

  return Response.json({ ok: true, db: dbOk, time: new Date().toISOString() });
}
