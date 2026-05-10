import { S3Client } from "@aws-sdk/client-s3";

let _s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    _s3Client = new S3Client({
      region: "auto",
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
  }
  return _s3Client;
}

export const S3_BUCKET = process.env.S3_BUCKET ?? "trustello-dev";
