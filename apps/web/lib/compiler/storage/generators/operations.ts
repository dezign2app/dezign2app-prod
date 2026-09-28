import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";

export function generateStorageOperationsFile(node: BackendNode): CompiledFile {
  const content = `// ═══════════════════════════════════════════════════════════════════════════
// Storage Operations (Upload, Download, Presigned URLs, Delete, List)
// ═══════════════════════════════════════════════════════════════════════════

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./client";
import { getBucketMetadata } from "./buckets";
import { storageConfig } from "./config";

export interface PresignedUrlOptions {
  expiresInSeconds?: number;
  contentType?: string;
  acl?: ObjectCannedACL;
}

export interface UploadObjectOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: ObjectCannedACL;
}

/**
 * Generates a presigned PUT URL allowing clients to upload directly to S3/R2/GCS.
 */
export async function getUploadPresignedUrl(
  bucketName: string,
  key: string,
  options?: PresignedUrlOptions,
): Promise<string> {
  const meta = getBucketMetadata(bucketName);
  const ttl = options?.expiresInSeconds ?? meta?.presignedUrlTtl ?? 900;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: options?.contentType,
    ACL: options?.acl,
  });

  return getSignedUrl(s3Client, command, { expiresIn: ttl });
}

/**
 * Generates a presigned GET URL allowing clients to download private files securely.
 */
export async function getDownloadPresignedUrl(
  bucketName: string,
  key: string,
  options?: { expiresInSeconds?: number },
): Promise<string> {
  const ttl = options?.expiresInSeconds ?? 3600;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: ttl });
}

/**
 * Uploads an object directly from server memory or stream.
 */
export async function uploadObject(
  bucketName: string,
  key: string,
  body: PutObjectCommandInput["Body"],
  options?: UploadObjectOptions,
) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: options?.contentType,
    Metadata: options?.metadata,
    ACL: options?.acl,
  });

  return s3Client.send(command);
}

/**
 * Downloads an object from storage.
 */
export async function downloadObject(bucketName: string, key: string) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await s3Client.send(command);
  return response.Body;
}

/**
 * Deletes a single object from storage.
 */
export async function deleteObject(bucketName: string, key: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
}

/**
 * Deletes multiple objects in a single batch request.
 */
export async function deleteObjects(bucketName: string, keys: string[]) {
  const command = new DeleteObjectsCommand({
    Bucket: bucketName,
    Delete: {
      Objects: keys.map((k) => ({ Key: k })),
    },
  });

  return s3Client.send(command);
}

/**
 * Lists objects in a bucket under a specified prefix.
 */
export async function listObjects(
  bucketName: string,
  prefix?: string,
  maxKeys: number = 1000,
) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await s3Client.send(command);
  return response.Contents || [];
}

/**
 * Checks if an object exists in storage using a lightweight HEAD request.
 */
export async function objectExists(bucketName: string, key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (("name" in error && error.name === "NotFound") ||
        ("$metadata" in error &&
          typeof error.$metadata === "object" &&
          error.$metadata !== null &&
          "httpStatusCode" in error.$metadata &&
          error.$metadata.httpStatusCode === 404))
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Copies an object from a source bucket/key to a destination bucket/key without memory buffering.
 */
export async function copyObject(
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string,
) {
  let cleanSourceKey = sourceKey;
  while (cleanSourceKey.startsWith("/")) {
    cleanSourceKey = cleanSourceKey.slice(1);
  }
  const command = new CopyObjectCommand({
    CopySource: sourceBucket + "/" + cleanSourceKey,
    Bucket: destBucket,
    Key: destKey,
  });

  return s3Client.send(command);
}

/**
 * Returns a public CDN or direct URL for an object if configured.
 */
export function getPublicObjectUrl(bucketName: string, key: string): string {
  const meta = getBucketMetadata(bucketName);
  let cleanKey = key;
  while (cleanKey.startsWith("/")) {
    cleanKey = cleanKey.slice(1);
  }
  if (meta?.cdnUrl) {
    let base = meta.cdnUrl;
    while (base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    return base + "/" + cleanKey;
  }
  if (storageConfig.endpoint) {
    let endpoint = storageConfig.endpoint;
    while (endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }
    if (storageConfig.forcePathStyle) {
      return endpoint + "/" + bucketName + "/" + cleanKey;
    }
    try {
      const url = new URL(endpoint);
      return url.protocol + "//" + bucketName + "." + url.host + "/" + cleanKey;
    } catch {
      return endpoint + "/" + bucketName + "/" + cleanKey;
    }
  }
  return "https://" + bucketName + ".s3.amazonaws.com/" + cleanKey;
}

`;

  return {
    filename: "src/operations.ts",
    language: "typescript",
    content,
  };
}
