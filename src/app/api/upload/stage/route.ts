import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// No body size limit — file is streamed directly to S3
export const maxDuration = 300;

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.userType !== "employee") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant" }, { status: 403 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: { select: { maxFileSizeMB: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Mandant nicht gefunden" }, { status: 404 });

  const name = decodeURIComponent(req.headers.get("x-file-name") ?? "datei");
  const sizeHeader = req.headers.get("x-file-size");
  const mimeType = req.headers.get("x-file-mime") ?? "application/octet-stream";
  const size = sizeHeader ? Number(sizeHeader) : 0;

  const maxBytes = tenant.plan.maxFileSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    return NextResponse.json(
      { error: `Datei überschreitet die maximale Größe von ${tenant.plan.maxFileSizeMB} MB` },
      { status: 413 },
    );
  }

  if (!req.body) {
    return NextResponse.json({ error: "Kein Dateiinhalt" }, { status: 400 });
  }

  const stagingKey = `staging/${tenantId}/${randomBytes(16).toString("hex")}`;
  const s3 = getS3Client();

  // Convert Web ReadableStream → Node.js Readable so AWS SDK can stream it
  const nodeStream = Readable.fromWeb(req.body as import("stream/web").ReadableStream);

  // Stream body directly to S3 — no buffering in memory
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: stagingKey,
      Body: nodeStream,
      ContentType: "application/octet-stream",
      ContentLength: size > 0 ? size : undefined,
      Metadata: {
        "original-name": encodeURIComponent(name),
        "mime-type": mimeType,
        "scan-status": "PENDING",
        "tenant-id": tenantId,
        "uploaded-by": session.user.id!,
      },
    }),
  );

  logger.info({ stagingKey, size, tenantId }, "File staged (pending scan)");

  return NextResponse.json({ stagingKey, name, size, mimeType });
}
