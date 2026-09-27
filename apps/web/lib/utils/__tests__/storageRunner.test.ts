import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeEndpointUrl,
  resolveStorageUrl,
  checkStorageConnectionLive,
  type StorageConnectionConfig,
} from "../storageRunner";

describe("storageRunner endpoint normalization and connection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("normalizeEndpointUrl", () => {
    it("handles standard http://localhost:8333 URL without alterations", () => {
      const result = normalizeEndpointUrl("http://localhost:8333");
      expect(result).toBe("http://localhost:8333");
    });

    it("strips double quotes from wrapped endpoints (e.g. from .env files)", () => {
      const result = normalizeEndpointUrl('"http://localhost:8333"');
      expect(result).toBe("http://localhost:8333");
    });

    it("strips single quotes from wrapped endpoints", () => {
      const result = normalizeEndpointUrl("'http://localhost:8333'");
      expect(result).toBe("http://localhost:8333");
    });

    it("automatically prepends http:// when protocol scheme is missing (e.g. localhost:8333)", () => {
      const result = normalizeEndpointUrl("localhost:8333");
      expect(result).toBe("http://localhost:8333");
    });

    it("automatically prepends http:// for raw IP and port (e.g. 127.0.0.1:8333)", () => {
      const result = normalizeEndpointUrl("127.0.0.1:8333");
      expect(result).toBe("http://127.0.0.1:8333");
    });

    it("removes trailing slashes from endpoint URLs", () => {
      const result = normalizeEndpointUrl("http://localhost:8333///");
      expect(result).toBe("http://localhost:8333");
    });

    it("resolves uppercase env var token to process.env value", () => {
      process.env.S3_ENDPOINT_URL = "http://localhost:8333";
      const result = normalizeEndpointUrl("S3_ENDPOINT_URL");
      expect(result).toBe("http://localhost:8333");
    });

    it("resolves process.env.TOKEN format to process.env value", () => {
      process.env.STORAGE_ENDPOINT_URL = "http://127.0.0.1:9000";
      const result = normalizeEndpointUrl("process.env.STORAGE_ENDPOINT_URL");
      expect(result).toBe("http://127.0.0.1:9000");
    });

    it("strips quotes from values loaded from process.env", () => {
      process.env.S3_ENDPOINT_URL = '"http://localhost:8333"';
      const result = normalizeEndpointUrl("S3_ENDPOINT_URL");
      expect(result).toBe("http://localhost:8333");
    });

    it("falls back to process.env.S3_ENDPOINT_URL when raw endpoint is empty", () => {
      process.env.S3_ENDPOINT_URL = "http://localhost:8333";
      const result = normalizeEndpointUrl("");
      expect(result).toBe("http://localhost:8333");
    });

    it("falls back to standard AWS regional endpoint when no endpoint or env var is set", () => {
      delete process.env.S3_ENDPOINT_URL;
      delete process.env.STORAGE_ENDPOINT_URL;
      delete process.env.AWS_ENDPOINT_URL;
      const result = normalizeEndpointUrl("", "eu-west-1");
      expect(result).toBe("https://s3.eu-west-1.amazonaws.com");
    });
  });

  describe("resolveStorageUrl", () => {
    it("correctly resolves http://localhost:8333 with forcePathStyle", () => {
      const config: StorageConnectionConfig = {
        endpointUrl: "http://localhost:8333",
        bucketName: "my-bucket",
        region: "us-east-1",
      };
      const resolved = resolveStorageUrl(config, "avatar.png");
      expect(resolved.endpoint).toBe("http://localhost:8333");
      expect(resolved.url).toBe("http://localhost:8333/my-bucket/avatar.png");
      expect(resolved.host).toBe("localhost:8333");
      expect(resolved.isPathStyle).toBe(true);
    });

    it("handles quoted endpoint string without throwing TypeError: Invalid URL", () => {
      const config: StorageConnectionConfig = {
        endpointUrl: '"http://localhost:8333"',
        bucketName: "documents",
        region: "us-east-1",
      };
      const resolved = resolveStorageUrl(config);
      expect(resolved.endpoint).toBe("http://localhost:8333");
      expect(resolved.url).toBe("http://localhost:8333/documents");
    });

    it("handles localhost:8333 without protocol without throwing TypeError: Invalid URL", () => {
      const config: StorageConnectionConfig = {
        endpointUrl: "localhost:8333",
        bucketName: "documents",
        region: "us-east-1",
      };
      const resolved = resolveStorageUrl(config);
      expect(resolved.endpoint).toBe("http://localhost:8333");
      expect(resolved.url).toBe("http://localhost:8333/documents");
    });

    it("resolves environment variable name token directly", () => {
      process.env.S3_ENDPOINT_URL = "http://localhost:8333";
      const config: StorageConnectionConfig = {
        endpointUrl: "S3_ENDPOINT_URL",
        bucketName: "test-bucket",
      };
      const resolved = resolveStorageUrl(config);
      expect(resolved.endpoint).toBe("http://localhost:8333");
      expect(resolved.url).toBe("http://localhost:8333/test-bucket");
    });

    it("throws a descriptive error when endpoint is completely malformed", () => {
      const config: StorageConnectionConfig = {
        endpointUrl: "http://[invalid-ipv6-host",
        bucketName: "test-bucket",
      };
      expect(() => resolveStorageUrl(config)).toThrow("Invalid storage endpoint URL");
    });
  });

  describe("checkStorageConnectionLive", () => {
    it("returns successful result when storage server responds with HTTP 200", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers({ server: "SeaweedFS S3", "x-amz-request-id": "req-1" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const config: StorageConnectionConfig = {
        endpointUrl: "http://localhost:8333",
        bucketName: "media-bucket",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      };

      const result = await checkStorageConnectionLive(config);
      expect(result.success).toBe(true);
      expect(result.serverActive).toBe(true);
      expect(result.bucketExists).toBe(true);
      expect(result.status).toBe(200);
      expect(result.serverHeader).toBe("SeaweedFS S3");
      expect(result.endpoint).toBe("http://localhost:8333");
    });

    it("returns serverActive: true with tip when storage bucket does not exist (HTTP 404)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ server: "SeaweedFS S3" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const config: StorageConnectionConfig = {
        endpointUrl: "http://localhost:8333",
        bucketName: "non-existent-bucket",
      };

      const result = await checkStorageConnectionLive(config);
      expect(result.success).toBe(false);
      expect(result.serverActive).toBe(true);
      expect(result.bucketExists).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toContain("bucket \"non-existent-bucket\" was not found");
    });

    it("catches connection failure and returns structured result without crashing", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8333"));
      vi.stubGlobal("fetch", mockFetch);

      const config: StorageConnectionConfig = {
        endpointUrl: "http://localhost:8333",
        bucketName: "media-bucket",
      };

      const result = await checkStorageConnectionLive(config);
      expect(result.success).toBe(false);
      expect(result.serverActive).toBe(false);
      expect(result.bucketExists).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toContain("ECONNREFUSED");
      expect(result.tip).toContain("running and reachable");
    });

    it("gracefully catches malformed URL and returns structured error without throwing unhandled error", async () => {
      const config: StorageConnectionConfig = {
        endpointUrl: "http://[invalid-ipv6-host",
        bucketName: "media-bucket",
      };

      const result = await checkStorageConnectionLive(config);
      expect(result.success).toBe(false);
      expect(result.serverActive).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toContain("Invalid storage endpoint URL");
    });
  });
});
