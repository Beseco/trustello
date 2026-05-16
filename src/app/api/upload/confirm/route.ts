import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getS3Client, S3_BUCKET } from "@/lib/storage/s3";
import { GetObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { scanBuffer } from "@/lib/clamav";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.userType !== "employee") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant" }, { status: 403 });

  const { stagingKey } = await req.json() as { stagingKey: string };

  if (!stagingKey || !stagingKey.startsWith(`staging/${tenantId}/`)) {
    return NextResponse.json({ error: "Ungültiger Schlüssel" }, { status: 400 });
  }

  const s3 = getS3Client();

  // Read metadata to verify ownership
  const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: stagingKey }));
  if (head.Metadata?.["tenant-id"] !== tenantId) {
    return NextResponse.json({ error: "Zugriff verweigert" }, { status: 403 });
  }

  // Download file for ClamAV scan
  const obj = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: stagingKey }));
  const fileBuffer = Buffer.from(await obj.Body!.transformToByteArray());

  let scanStatus: "CLEAN" | "INFECTED" | "ERROR" = "ERROR";
  let scanResult: string | null = null;
  try {
    const scan = await scanBuffer(fileBuffer);
    scanStatus = scan.clean ? "CLEAN" : "INFECTED";
    scanResult = scan.clean ? null : scan.result;
  } catch (err) {
    logger.warn({ stagingKey, err }, "ClamAV scan failed");
    scanStatus = "ERROR";
  }

  if (scanStatus === "INFECTED") {
    logger.warn({ stagingKey, scanResult, tenantId }, "ClamAV: infected file rejected");
    return NextResponse.json(
      { error: `Datei wurde vom Virenscanner abgelehnt (${scanResult ?? "unbekannte Bedrohung"})` },
      { status: 422 },
    );
  }

  // Update scan status in S3 metadata via copy-in-place
  const existingMeta = head.Metadata ?? {};
  await s3.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${stagingKey}`,
      Key: stagingKey,
      MetadataDirective: "REPLACE",
      ContentType: "application/octet-stream",
      Metadata: { ...existingMeta, "scan-status": scanStatus },
    }),
  );

  logger.info({ stagingKey, scanStatus }, "File scan confirmed");
  return NextResponse.json({ scanStatus });
}
