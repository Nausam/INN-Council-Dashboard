import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const correspondenceBucketName = process.env.R2_CORRESPONDENCE_BUCKET_NAME;

function getR2Client(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

const DEFAULT_EXPIRES_IN = 3600; // 1 hour

/**
 * Generate a presigned URL for viewing an R2 object (inline in browser).
 */
export async function getPresignedViewUrl(
  objectKey: string,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<string> {
  if (!bucketName) throw new Error("R2_BUCKET_NAME is not set");
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading an R2 object (attachment).
 */
export async function getPresignedDownloadUrl(
  objectKey: string,
  filename?: string,
  expiresIn: number = DEFAULT_EXPIRES_IN
): Promise<string> {
  if (!bucketName) throw new Error("R2_BUCKET_NAME is not set");
  const client = getR2Client();
  const params: GetObjectCommandInput = {
    Bucket: bucketName,
    Key: objectKey,
    ResponseContentDisposition: filename
      ? `attachment; filename="${filename}"`
      : "attachment",
  };
  const command = new GetObjectCommand(params);
  return getSignedUrl(client, command, { expiresIn });
}

export function isR2Configured(): boolean {
  return Boolean(
    accountId && accessKeyId && secretAccessKey && bucketName
  );
}

/** R2 bucket for council correspondence attachments (separate from salary slips). */
export function isCorrespondenceR2Configured(): boolean {
  return Boolean(
    accountId &&
      accessKeyId &&
      secretAccessKey &&
      correspondenceBucketName
  );
}

/**
 * Upload a file to R2. Used for salary slip PDFs.
 */
export async function uploadToR2(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  if (!bucketName) throw new Error("R2_BUCKET_NAME is not set");
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

async function getObjectBufferFromBucket(
  bucket: string,
  objectKey: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const client = getR2Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
  const body = out.Body as
    | { transformToByteArray: () => Promise<Uint8Array> }
    | undefined;
  if (!body?.transformToByteArray) {
    throw new Error("Empty R2 response body");
  }
  const bytes = await body.transformToByteArray();
  return {
    buffer: Buffer.from(bytes),
    contentType: out.ContentType ?? "application/octet-stream",
  };
}

/**
 * Download a correspondence attachment from the correspondence R2 bucket.
 */
export async function downloadCorrespondenceFromR2(
  objectKey: string
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!correspondenceBucketName) {
    throw new Error("R2_CORRESPONDENCE_BUCKET_NAME is not set");
  }
  return getObjectBufferFromBucket(correspondenceBucketName, objectKey);
}

/**
 * Delete an object from the correspondence R2 bucket.
 */
export async function deleteCorrespondenceFromR2(
  objectKey: string
): Promise<void> {
  if (!correspondenceBucketName) {
    throw new Error("R2_CORRESPONDENCE_BUCKET_NAME is not set");
  }
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: correspondenceBucketName,
      Key: objectKey,
    })
  );
}

/**
 * Upload correspondence attachment to the correspondence R2 bucket.
 */
export async function uploadCorrespondenceToR2(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  if (!correspondenceBucketName) {
    throw new Error("R2_CORRESPONDENCE_BUCKET_NAME is not set");
  }
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: correspondenceBucketName,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}
