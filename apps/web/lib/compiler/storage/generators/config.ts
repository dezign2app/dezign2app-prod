import { BackendNode } from "@/types/canvas";
import { CompiledFile } from "@workspace/canvas/types";

export function generateStorageConfigFile(node: BackendNode): CompiledFile {
  const data = node.data || {};
  const provider = data.storageProvider || "s3";
  const defaultRegion = data.defaultRegion || "us-east-1";
  const buckets = Array.isArray(data.buckets) ? data.buckets : [];
  const bucketWithEndpoint = buckets.find((b: { endpointUrl?: string }) => b.endpointUrl);
  const rawEndpoint = String(data.endpointUrl || bucketWithEndpoint?.endpointUrl || "").trim();
  const forcePathStyle = Boolean(
    data.forcePathStyle ||
      buckets.some((b: { forcePathStyle?: boolean }) => b.forcePathStyle) ||
      provider === "minio",
  );
  const accessKeyEnv = data.accessKeyIdEnv || "AWS_ACCESS_KEY_ID";
  const secretKeyEnv = data.secretAccessKeyEnv || "AWS_SECRET_ACCESS_KEY";
  const sessionTokenEnv = data.sessionTokenEnv || "AWS_SESSION_TOKEN";

  let configuredEnvCheck = "";
  let literalFallback = "undefined";

  if (rawEndpoint) {
    if (rawEndpoint.startsWith("process.env.")) {
      const envName = rawEndpoint.slice("process.env.".length).trim();
      configuredEnvCheck = `process.env["${envName}"],`;
    } else if (/^[A-Za-z0-9_]+$/.test(rawEndpoint) && !rawEndpoint.includes(":") && !rawEndpoint.includes("/")) {
      configuredEnvCheck = `process.env["${rawEndpoint}"],`;
    } else {
      let normalized = rawEndpoint.replace(/^["']+|["']+$/g, "").trim();
      if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
        normalized = `http://${normalized}`;
      }
      literalFallback = JSON.stringify(normalized);
    }
  }

  const forcePathBody = forcePathStyle
    ? `  if (process.env.STORAGE_FORCE_PATH_STYLE !== undefined) {
    return process.env.STORAGE_FORCE_PATH_STYLE === "true";
  }
  return true;`
    : `  if (process.env.STORAGE_FORCE_PATH_STYLE !== undefined) {
    return process.env.STORAGE_FORCE_PATH_STYLE === "true";
  }
  if (typeof endpointUrl === "string" && endpointUrl.length > 0) {
    try {
      const url = new URL(endpointUrl);
      return (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        /^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(url.hostname)
      );
    } catch {
      return false;
    }
  }
  return false;`;

  const content = `// ═══════════════════════════════════════════════════════════════════════════
// Storage Configuration & Credentials
// ═══════════════════════════════════════════════════════════════════════════

export interface StorageConfig {
  provider: "s3" | "r2" | "gcs" | "minio" | "custom" | string;
  region: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  forcePathStyle?: boolean;
}

const accessKeyId =
  process.env["${accessKeyEnv}"] ||
  process.env.AWS_ACCESS_KEY_ID ||
  process.env.STORAGE_ACCESS_KEY_ID;

const secretAccessKey =
  process.env["${secretKeyEnv}"] ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  process.env.STORAGE_SECRET_ACCESS_KEY;

const sessionToken =
  process.env["${sessionTokenEnv}"] ||
  process.env.AWS_SESSION_TOKEN ||
  process.env.STORAGE_SESSION_TOKEN;

function resolveStorageEndpoint(): string | undefined {
  const candidates: (string | undefined)[] = [
    ${configuredEnvCheck ? configuredEnvCheck + "\n    " : ""}process.env.S3_ENDPOINT_URL,
    process.env.AWS_ENDPOINT_URL_S3,
    process.env.AWS_ENDPOINT_URL,
    process.env.STORAGE_ENDPOINT,
    process.env.STORAGE_ENDPOINT_URL,
    ${literalFallback},
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    let val = candidate.trim().replace(/^["']+|["']+$/g, "").trim();
    if (!val) continue;

    if (val.startsWith("process.env.")) {
      const envName = val.slice("process.env.".length).trim();
      const fromEnv = process.env[envName];
      if (fromEnv && fromEnv.trim()) {
        val = fromEnv.trim().replace(/^["']+|["']+$/g, "").trim();
      } else {
        continue;
      }
    } else if (/^[A-Za-z0-9_]+$/.test(val) && !val.includes(":") && !val.includes("/") && process.env[val]) {
      val = process.env[val]!.trim().replace(/^["']+|["']+$/g, "").trim();
    }

    if (!val) continue;

    if (!val.startsWith("http://") && !val.startsWith("https://")) {
      val = \`http://\${val}\`;
    }

    try {
      new URL(val);
      while (val.endsWith("/")) {
        val = val.slice(0, -1);
      }
      return val;
    } catch {
      continue;
    }
  }

  return undefined;
}

function resolveForcePathStyle(endpointUrl?: string): boolean {
${forcePathBody}
}

const resolvedEndpoint = resolveStorageEndpoint();

export const storageConfig: StorageConfig = {
  provider: process.env.STORAGE_PROVIDER || "${provider}",
  region:
    process.env.AWS_REGION ||
    process.env.STORAGE_REGION ||
    "${defaultRegion}",
  endpoint: resolvedEndpoint,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
          ...(sessionToken ? { sessionToken } : {}),
        }
      : undefined,
  forcePathStyle: resolveForcePathStyle(resolvedEndpoint),
};
`;

  return {
    filename: "src/config.ts",
    language: "typescript",
    content,
  };
}
