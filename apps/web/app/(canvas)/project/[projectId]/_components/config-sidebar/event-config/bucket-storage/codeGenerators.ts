import { ConfigItemData } from "../types";

export function generateOperationInvocationCode(
  opKey: string,
  bucketName: string,
  params: {
    key: string;
    body?: string;
    contentType?: string;
    ttl?: string;
    metadata?: Record<string, string>;
    prefix?: string;
    maxKeys?: number;
  },
): string {
  switch (opKey) {
    case "uploadObject":
      return `import { uploadObject } from "@workspace/storage/operations";

const result = await uploadObject(
  "${bucketName}",
  "${params.key}",
  Buffer.from("${params.body ? params.body.slice(0, 40) + "..." : "File payload"}"),
  {
    contentType: "${params.contentType || "application/octet-stream"}",
    metadata: ${JSON.stringify(params.metadata || { uploadedBy: "testUser" }, null, 4).replace(/\n/g, "\n  ")},
  }
);
console.log("Upload result:", result);`;

    case "downloadObject":
      return `import { downloadObject } from "@workspace/storage/operations";

const stream = await downloadObject("${bucketName}", "${params.key}");
console.log("Download stream received for ${params.key}");`;

    case "getUploadPresignedUrl":
      return `import { getUploadPresignedUrl } from "@workspace/storage/operations";

const signedPutUrl = await getUploadPresignedUrl(
  "${bucketName}",
  "${params.key}",
  {
    expiresInSeconds: ${params.ttl || 900},
    contentType: "${params.contentType || "image/png"}",
  }
);
console.log("Signed PUT URL:", signedPutUrl);`;

    case "getDownloadPresignedUrl":
      return `import { getDownloadPresignedUrl } from "@workspace/storage/operations";

const signedGetUrl = await getDownloadPresignedUrl(
  "${bucketName}",
  "${params.key}",
  {
    expiresInSeconds: ${params.ttl || 3600},
  }
);
console.log("Signed GET URL:", signedGetUrl);`;

    case "objectExists":
      return `import { objectExists } from "@workspace/storage/operations";

const exists = await objectExists("${bucketName}", "${params.key}");
console.log("Object exists:", exists);`;

    case "deleteObject":
      return `import { deleteObject } from "@workspace/storage/operations";

const response = await deleteObject("${bucketName}", "${params.key}");
console.log("Delete status:", response);`;

    case "listObjects":
      return `import { listObjects } from "@workspace/storage/operations";

const items = await listObjects(
  "${bucketName}",
  "${params.prefix || "uploads/"}",
  ${params.maxKeys || 100}
);
console.log(\`Found \${items.length} objects\`);`;

    case "getPublicObjectUrl":
      return `import { getPublicObjectUrl } from "@workspace/storage/operations";

const publicUrl = getPublicObjectUrl("${bucketName}", "${params.key}");
console.log("Public URL:", publicUrl);`;

    default:
      return `// Operation ${opKey} on ${bucketName}`;
  }
}

export function generateFullVitestSuite(item: ConfigItemData): string {
  const bucketName = item.name || "user-avatars";
  const region = item.region || "us-east-1";

  return `import { describe, it, expect } from "vitest";
import { s3Client } from "../src/client";
import { storageConfig } from "../src/config";
import { getBucketMetadata } from "../src/buckets";
import {
  uploadObject,
  downloadObject,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  objectExists,
  deleteObject,
  listObjects,
  getPublicObjectUrl,
} from "../src/operations";

describe("${bucketName} \u2014 Generated S3 Client & Operations Suite", () => {
  describe("Client Initialization & Config", () => {
    it("should export initialized s3Client and storageConfig", () => {
      expect(s3Client).toBeDefined();
      expect(storageConfig).toBeDefined();
      expect(storageConfig.region).toBe("${region}");
    });

    it("should resolve bucket metadata for '${bucketName}'", () => {
      const meta = getBucketMetadata("${bucketName}");
      expect(meta).toBeDefined();
      expect(meta?.name).toBe("${bucketName}");
    });
  });

  describe("Generated Operations", () => {
    it("should generate presigned upload URL", async () => {
      const url = await getUploadPresignedUrl("${bucketName}", "test/avatar.png", {
        expiresInSeconds: 900,
        contentType: "image/png",
      });
      expect(url).toContain("https://");
      expect(url).toContain("${bucketName}");
    });

    it("should generate presigned download URL", async () => {
      const url = await getDownloadPresignedUrl("${bucketName}", "test/avatar.png", {
        expiresInSeconds: 3600,
      });
      expect(url).toContain("https://");
      expect(url).toContain("${bucketName}");
    });

    it("should execute objectExists check", async () => {
      const exists = await objectExists("${bucketName}", "test/avatar.png");
      expect(typeof exists).toBe("boolean");
    });

    it("should resolve public object URL correctly", () => {
      const url = getPublicObjectUrl("${bucketName}", "images/banner.jpg");
      expect(url).toContain("images/banner.jpg");
    });
  });
});
`;
}
