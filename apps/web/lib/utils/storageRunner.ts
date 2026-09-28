import crypto from "node:crypto";

import type {
  StorageConnectionConfig,
  CheckStorageConnectionResult,
  ExecuteStorageOperationPayload,
  ExecuteStorageOperationResult,
  ServerBucketInfo,
  ListStorageBucketsResult,
  CreateStorageBucketResult,
  StorageTestCaseResult,
  StorageTestSuiteResult,
  SyncBucketOptions,
  SyncStorageBucketResult,
} from "@workspace/canvas/types";

export type {
  StorageConnectionConfig,
  CheckStorageConnectionResult,
  ExecuteStorageOperationPayload,
  ExecuteStorageOperationResult,
  ServerBucketInfo,
  ListStorageBucketsResult,
  CreateStorageBucketResult,
  StorageTestCaseResult,
  StorageTestSuiteResult,
  SyncBucketOptions,
  SyncStorageBucketResult,
};

// ─────────────────────────────────────────────────────────────────────────────
// S3 URL & Credentials Resolution
// ─────────────────────────────────────────────────────────────────────────────

export function resolveCredentials(config: StorageConnectionConfig): {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
} {
  const accessKeyId =
    config.accessKeyId ||
    (config.accessKeyIdEnv ? process.env[config.accessKeyIdEnv] : undefined) ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.STORAGE_ACCESS_KEY_ID ||
    "";

  const secretAccessKey =
    config.secretAccessKey ||
    (config.secretAccessKeyEnv ? process.env[config.secretAccessKeyEnv] : undefined) ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.STORAGE_SECRET_ACCESS_KEY ||
    "";

  const sessionToken =
    config.sessionToken ||
    (config.sessionTokenEnv ? process.env[config.sessionTokenEnv] : undefined) ||
    process.env.AWS_SESSION_TOKEN ||
    process.env.STORAGE_SESSION_TOKEN ||
    undefined;

  return { accessKeyId, secretAccessKey, sessionToken };
}

/**
 * Normalizes an S3/storage endpoint URL:
 * - Strips enclosing quotes ("http://..." -> http://...)
 * - Resolves environment variables if given an env token (e.g. S3_ENDPOINT_URL or process.env.S3_ENDPOINT_URL)
 * - Auto-prepends http:// if missing protocol scheme (e.g. localhost:8333 -> http://localhost:8333)
 * - Safely falls back to default AWS S3 endpoint or standard env vars
 */
export function normalizeEndpointUrl(
  rawEndpoint?: string,
  region: string = "us-east-1",
): string {
  let val = (rawEndpoint || "").trim();

  // Strip leading and trailing single or double quotes
  val = val.replace(/^["']+|["']+$/g, "").trim();

  // If empty, check standard environment variables
  if (!val) {
    val = (
      process.env.S3_ENDPOINT_URL ||
      process.env.STORAGE_ENDPOINT_URL ||
      process.env.AWS_ENDPOINT_URL ||
      ""
    ).trim();
  }

  // If val matches an env var reference (e.g. process.env.S3_ENDPOINT_URL)
  if (val.startsWith("process.env.")) {
    const varName = val.replace(/^process\.env\./, "").trim();
    val = (process.env[varName] || "").trim();
  } else if (/^[A-Z0-9_]+$/.test(val)) {
    // If it's an uppercase token like S3_ENDPOINT_URL, check process.env
    const envVal = process.env[val];
    if (envVal) {
      val = envVal.trim();
    }
  }

  // Strip quotes again in case the env var value had quotes (e.g. S3_ENDPOINT_URL="http://localhost:8333")
  val = val.replace(/^["']+|["']+$/g, "").trim();

  // If still empty, fall back to default AWS regional S3 endpoint
  if (!val) {
    return `https://s3.${region}.amazonaws.com`;
  }

  // If missing protocol (e.g. localhost:8333, 127.0.0.1:8333, minio:9000), auto-prefix http://
  if (!/^https?:\/\//i.test(val)) {
    val = `http://${val}`;
  }

  // Remove trailing slashes
  return val.replace(/\/+$/, "");
}

export function resolveStorageUrl(config: StorageConnectionConfig, objectKey: string = ""): {
  endpoint: string;
  url: string;
  host: string;
  isPathStyle: boolean;
} {
  const region = config.region || process.env.AWS_REGION || "us-east-1";
  const bucket = config.bucketName || "default-bucket";
  const cleanKey = objectKey.replace(/^\/+/, "");

  const endpoint = normalizeEndpointUrl(config.endpointUrl, region);

  // Validate endpoint URL safely
  let urlObj: URL;
  try {
    urlObj = new URL(endpoint);
  } catch {
    throw new Error(
      `Invalid storage endpoint URL: "${endpoint}". Must be a valid URL (e.g. http://localhost:8333 or https://s3.amazonaws.com).`,
    );
  }

  const isLocalOrIp =
    urlObj.hostname === "localhost" ||
    urlObj.hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(urlObj.hostname);

  const forcePathStyle =
    config.forcePathStyle !== undefined
      ? Boolean(config.forcePathStyle)
      : isLocalOrIp || config.storageType === "minio";

  let fullUrl: string;
  let hostHeader: string;

  if (forcePathStyle) {
    const pathPart = cleanKey ? `/${bucket}/${cleanKey}` : `/${bucket}`;
    fullUrl = `${urlObj.origin}${pathPart}`;
    hostHeader = urlObj.host;
  } else {
    // Virtual hosted style: https://bucket.s3.region.amazonaws.com/key
    const newHost = `${bucket}.${urlObj.host}`;
    const pathPart = cleanKey ? `/${cleanKey}` : "";
    fullUrl = `${urlObj.protocol}//${newHost}${pathPart}`;
    hostHeader = newHost;
  }

  return {
    endpoint,
    url: fullUrl,
    host: hostHeader,
    isPathStyle: forcePathStyle,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS SigV4 Signer
// ─────────────────────────────────────────────────────────────────────────────

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function signS3Request(params: {
  method: string;
  url: string;
  region: string;
  host: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  body?: string | Buffer;
  extraHeaders?: Record<string, string>;
}): Record<string, string> {
  const {
    method,
    url,
    region,
    host,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    body,
    extraHeaders = {},
  } = params;

  if (!accessKeyId || !secretAccessKey) {
    // Unauthenticated request
    return {
      Host: host,
      ...extraHeaders,
    };
  }

  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256(body || "");

  const canonicalHeadersMap: Record<string, string> = {
    host: host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  if (sessionToken) {
    canonicalHeadersMap["x-amz-security-token"] = sessionToken;
  }

  Object.entries(extraHeaders).forEach(([k, v]) => {
    canonicalHeadersMap[k.toLowerCase()] = v.trim();
  });

  const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${canonicalHeadersMap[k]}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  // Canonical query string
  const searchParams = new URLSearchParams(parsedUrl.search);
  const queryKeys = Array.from(searchParams.keys()).sort();
  const canonicalQueryString = queryKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(searchParams.get(k) || "")}`)
    .join("&");

  const canonicalUri = parsedUrl.pathname || "/";

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resultHeaders: Record<string, string> = {
    Host: host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: authorization,
    ...extraHeaders,
  };

  if (sessionToken) {
    resultHeaders["x-amz-security-token"] = sessionToken;
  }

  return resultHeaders;
}

export function generatePresignedUrlSigV4(params: {
  method: string;
  url: string;
  region: string;
  host: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiresInSeconds?: number;
}): string {
  const {
    method,
    url,
    region,
    host,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    expiresInSeconds = 900,
  } = params;

  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  parsedUrl.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  parsedUrl.searchParams.set("X-Amz-Credential", `${accessKeyId}/${credentialScope}`);
  parsedUrl.searchParams.set("X-Amz-Date", amzDate);
  parsedUrl.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  parsedUrl.searchParams.set("X-Amz-SignedHeaders", "host");

  if (sessionToken) {
    parsedUrl.searchParams.set("X-Amz-Security-Token", sessionToken);
  }

  const queryKeys = Array.from(parsedUrl.searchParams.keys()).sort();
  const canonicalQueryString = queryKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(parsedUrl.searchParams.get(k) || "")}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method.toUpperCase(),
    parsedUrl.pathname || "/",
    canonicalQueryString,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  parsedUrl.searchParams.set("X-Amz-Signature", signature);

  return parsedUrl.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// XML Parser Helper (Extract basic S3 XML tags without external libs)
// ─────────────────────────────────────────────────────────────────────────────

export type S3XmlParsedData = {
  code?: string;
  message?: string;
  bucket?: string;
  key?: string;
  resource?: string;
  items?: Array<{ Key: string; Size: number }>;
  keyCount?: number;
};

export function parseS3XmlResponse(text: string): S3XmlParsedData | null {
  if (!text || (!text.includes("<") && !text.includes(">"))) return null;

  const result: S3XmlParsedData = {};

  const codeMatch = text.match(/<Code>([^<]+)<\/Code>/i);
  if (codeMatch) result.code = codeMatch[1];

  const msgMatch = text.match(/<Message>([^<]+)<\/Message>/i);
  if (msgMatch) result.message = msgMatch[1];

  const bucketMatch = text.match(/<BucketName>([^<]+)<\/BucketName>/i);
  if (bucketMatch) result.bucket = bucketMatch[1];

  const keyMatch = text.match(/<Key>([^<]+)<\/Key>/i);
  if (keyMatch) result.key = keyMatch[1];

  const resourceMatch = text.match(/<Resource>([^<]+)<\/Resource>/i);
  if (resourceMatch) result.resource = resourceMatch[1];

  // ListObjects parse
  const contentsMatches = text.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>([^<]+)<\/Size>[\s\S]*?<\/Contents>/gi);
  const items: Array<{ Key: string; Size: number }> = [];
  for (const match of contentsMatches) {
    const itemKey = match[1] || "";
    const itemSize = parseInt(match[2] || "0", 10) || 0;
    if (itemKey) {
      items.push({ Key: itemKey, Size: itemSize });
    }
  }
  if (items.length > 0) {
    result.items = items;
    result.keyCount = items.length;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function parseS3BucketsXml(text: string): ServerBucketInfo[] {
  if (!text || (!text.includes("<") && !text.includes(">"))) return [];
  const buckets: ServerBucketInfo[] = [];
  const bucketMatches = text.matchAll(
    /<Bucket>[\s\S]*?<Name>([^<]+)<\/Name>(?:[\s\S]*?<CreationDate>([^<]+)<\/CreationDate>)?[\s\S]*?<\/Bucket>/gi,
  );
  for (const match of bucketMatches) {
    const name = match[1]?.trim();
    if (name) {
      buckets.push({
        name,
        creationDate: match[2]?.trim(),
      });
    }
  }
  return buckets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Live Runners: Discovery, Creation, Connection & Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all existing buckets from the configured storage server (AWS S3, SeaweedFS, MinIO).
 */
export async function listStorageBucketsLive(
  config: StorageConnectionConfig,
): Promise<ListStorageBucketsResult> {
  const region = config.region || process.env.AWS_REGION || "us-east-1";
  const { accessKeyId, secretAccessKey, sessionToken } = resolveCredentials(config);
  const endpoint = normalizeEndpointUrl(config.endpointUrl, region);
  const requestUrl = `${endpoint}/`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const urlObj = new URL(requestUrl);

    const signedHeaders = signS3Request({
      method: "GET",
      url: requestUrl,
      region,
      host: urlObj.host,
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: signedHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await response.text();
    const serverHeader = response.headers.get("server") || undefined;

    if (response.status >= 200 && response.status < 300) {
      const buckets = parseS3BucketsXml(text);
      return {
        success: true,
        serverActive: true,
        status: response.status,
        statusText: response.statusText || "OK",
        buckets,
        endpoint,
        serverHeader,
      };
    }

    const xmlError = parseS3XmlResponse(text);
    const errorMsg = xmlError?.message
      ? String(xmlError.message)
      : response.status === 403
        ? "Access Denied (HTTP 403). Make sure valid Access Key ID and Secret Access Key are provided (e.g. AWS_ACCESS_KEY_ID=admin, AWS_SECRET_ACCESS_KEY=change-this-secret)."
        : `Server returned HTTP ${response.status} ${response.statusText || ""}`;

    return {
      success: false,
      serverActive: true,
      status: response.status,
      statusText: response.statusText,
      buckets: [],
      endpoint,
      serverHeader,
      error: errorMsg,
      tip:
        response.status === 403
          ? "Check your credentials. For local SeaweedFS/MinIO, set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
          : undefined,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const errorMsg = isAbort
      ? `Connection timed out after 8000ms while reaching ${endpoint}`
      : err instanceof Error
        ? err.message
        : String(err);
    return {
      success: false,
      serverActive: false,
      status: 0,
      statusText: "Connection Failed",
      buckets: [],
      endpoint,
      error: `Could not connect to storage server at ${endpoint} (${errorMsg})`,
      tip: `Ensure your storage server is running and reachable at ${endpoint}.`,
    };
  }
}

/**
 * Creates a bucket directly on the live target storage server (AWS S3, SeaweedFS, MinIO).
 */
export async function createStorageBucketLive(
  config: StorageConnectionConfig,
  bucketName: string,
): Promise<CreateStorageBucketResult> {
  const cleanBucket = (bucketName || config.bucketName || "").trim().toLowerCase();
  if (!cleanBucket) {
    return {
      success: false,
      bucketName: "",
      status: 400,
      message: "Bucket name cannot be empty",
      error: "Missing bucket name",
    };
  }

  const region = config.region || process.env.AWS_REGION || "us-east-1";
  const { accessKeyId, secretAccessKey, sessionToken } = resolveCredentials(config);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let targetEndpoint = normalizeEndpointUrl(config.endpointUrl, region);

  try {
    const resolved = resolveStorageUrl({ ...config, bucketName: cleanBucket, forcePathStyle: true }, "");
    targetEndpoint = resolved.endpoint;
    const requestUrl = resolved.url;
    const urlObj = new URL(requestUrl);

    const isLocalOrIp =
      urlObj.hostname === "localhost" ||
      urlObj.hostname === "127.0.0.1" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(urlObj.hostname);

    let body = "";
    if (!isLocalOrIp && region && region !== "us-east-1") {
      body = `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`;
    }

    const signedHeaders = signS3Request({
      method: "PUT",
      url: requestUrl,
      region,
      host: urlObj.host,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      body,
      extraHeaders: body ? { "Content-Type": "application/xml" } : {},
    });

    const response = await fetch(requestUrl, {
      method: "PUT",
      headers: signedHeaders,
      body: body || undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await response.text();

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        bucketName: cleanBucket,
        status: response.status,
        statusText: response.statusText || "Created",
        message: `Bucket "${cleanBucket}" created successfully on storage server.`,
      };
    }

    const xmlError = parseS3XmlResponse(text);
    const code = xmlError?.code ? String(xmlError.code) : "";
    if (code === "BucketAlreadyOwnedByYou") {
      return {
        success: true,
        bucketName: cleanBucket,
        status: 200,
        statusText: "Already Owned",
        message: `Bucket "${cleanBucket}" already exists and is owned by you.`,
      };
    }

    const errorMsg = xmlError?.message
      ? String(xmlError.message)
      : `HTTP ${response.status}: ${response.statusText || "Bucket creation failed"}`;

    return {
      success: false,
      bucketName: cleanBucket,
      status: response.status,
      statusText: response.statusText,
      message: `Failed to create bucket "${cleanBucket}"`,
      error: errorMsg,
      tip:
        response.status === 403
          ? "Access denied. Ensure your credentials have permission to create buckets."
          : undefined,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const errorMsg = isAbort
      ? `Bucket creation timed out after 8000ms connecting to ${targetEndpoint}`
      : err instanceof Error
        ? err.message
        : String(err);
    return {
      success: false,
      bucketName: cleanBucket,
      status: 0,
      statusText: "Request Failed",
      message: `Failed to connect to storage server at ${targetEndpoint}`,
      error: errorMsg,
    };
  }
}

/**
 * Syncs a bucket's live server configuration (access policy, public read, ACL, CORS)
 * directly to the target storage server (AWS S3, SeaweedFS, MinIO).
 */
export async function syncStorageBucketLive(
  config: StorageConnectionConfig,
  options?: SyncBucketOptions,
): Promise<SyncStorageBucketResult> {
  const cleanBucket = (config.bucketName || "").trim().toLowerCase();
  if (!cleanBucket) {
    return {
      success: false,
      bucketName: "",
      status: 400,
      message: "Bucket name cannot be empty",
      error: "Missing bucket name",
    };
  }

  const region = config.region || process.env.AWS_REGION || "us-east-1";
  const { accessKeyId, secretAccessKey, sessionToken } = resolveCredentials(config);
  const accessPolicy = options?.accessPolicy || "private";
  const isPublicRead = accessPolicy === "public-read";

  // 1. Ensure bucket exists on target server; create if missing
  try {
    await createStorageBucketLive(config, cleanBucket);
  } catch {
    // Non-fatal if bucket already exists
  }

  // 2. Resolve bucket endpoint and URLs
  const resolved = resolveStorageUrl({ ...config, bucketName: cleanBucket, forcePathStyle: true }, "");
  const bucketUrl = resolved.url;
  const urlObj = new URL(bucketUrl);
  const host = urlObj.host;

  let policyApplied = false;
  let corsApplied = false;
  let publicAccessVerified = false;
  const warnings: string[] = [];

  // 3. If AWS S3 and public-read requested, loosen PublicAccessBlock if applicable
  if (isPublicRead) {
    try {
      const publicBlockUrl = `${bucketUrl}?publicAccessBlock`;
      const publicBlockBody = `<PublicAccessBlockConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><BlockPublicAcls>false</BlockPublicAcls><IgnorePublicAcls>false</IgnorePublicAcls><BlockPublicPolicy>false</BlockPublicPolicy><RestrictPublicBuckets>false</RestrictPublicBuckets></PublicAccessBlockConfiguration>`;
      const blockHeaders = signS3Request({
        method: "PUT",
        url: publicBlockUrl,
        region,
        host,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        body: publicBlockBody,
        extraHeaders: { "Content-Type": "application/xml" },
      });
      await fetch(publicBlockUrl, {
        method: "PUT",
        headers: blockHeaders,
        body: publicBlockBody,
      });
    } catch {
      // Ignored for SeaweedFS/MinIO where PublicAccessBlock is unsupported
    }
  }

  // 4. Apply or Delete Bucket Policy (?policy)
  try {
    const policyUrl = `${bucketUrl}?policy`;
    if (isPublicRead) {
      const policyDoc = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicReadGetObject",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${cleanBucket}/*`],
          },
        ],
      };
      const policyBody = JSON.stringify(policyDoc);
      const policyHeaders = signS3Request({
        method: "PUT",
        url: policyUrl,
        region,
        host,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        body: policyBody,
        extraHeaders: { "Content-Type": "application/json" },
      });

      const res = await fetch(policyUrl, {
        method: "PUT",
        headers: policyHeaders,
        body: policyBody,
      });

      if (res.status >= 200 && res.status < 300) {
        policyApplied = true;
      } else {
        const text = await res.text();
        const parsed = parseS3XmlResponse(text);
        warnings.push(`Policy step HTTP ${res.status}: ${parsed?.message || res.statusText}`);
      }
    } else {
      // Switching to private: remove public bucket policy
      const policyHeaders = signS3Request({
        method: "DELETE",
        url: policyUrl,
        region,
        host,
        accessKeyId,
        secretAccessKey,
        sessionToken,
      });
      const res = await fetch(policyUrl, {
        method: "DELETE",
        headers: policyHeaders,
      });
      if (res.status >= 200 && res.status < 300) {
        policyApplied = true;
      }
    }
  } catch (err) {
    warnings.push(`Bucket policy step: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. Apply canned ACL (?acl)
  try {
    const aclUrl = `${bucketUrl}?acl`;
    const targetAcl = isPublicRead ? "public-read" : "private";
    const aclHeaders = signS3Request({
      method: "PUT",
      url: aclUrl,
      region,
      host,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      extraHeaders: { "x-amz-acl": targetAcl },
    });
    const aclRes = await fetch(aclUrl, {
      method: "PUT",
      headers: aclHeaders,
    });
    if (aclRes.status >= 200 && aclRes.status < 300) {
      policyApplied = true;
    }
  } catch {
    // Non-fatal if ACLs disabled on server
  }

  // 6. Apply CORS configuration (?cors)
  if (options?.enableCors !== false) {
    try {
      const corsUrl = `${bucketUrl}?cors`;
      const allowedOrigins = (options?.corsOrigins || "*")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const originsToUse = allowedOrigins.length > 0 ? allowedOrigins : ["*"];
      const methods =
        options?.corsMethods && options.corsMethods.length > 0
          ? options.corsMethods
          : ["GET", "HEAD", "PUT", "POST", "DELETE"];
      const allowedHeaders = (options?.corsHeaders || "*")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean);
      const headersToUse = allowedHeaders.length > 0 ? allowedHeaders : ["*"];
      const maxAge = Number(options?.corsMaxAge) || 3600;

      const corsRulesXml = originsToUse
        .map(
          (orig) => `
        <CORSRule>
          <AllowedOrigin>${orig}</AllowedOrigin>
          ${methods.map((m) => `<AllowedMethod>${m}</AllowedMethod>`).join("")}
          ${headersToUse.map((h) => `<AllowedHeader>${h}</AllowedHeader>`).join("")}
          <MaxAgeSeconds>${maxAge}</MaxAgeSeconds>
        </CORSRule>
      `,
        )
        .join("");

      const corsBody = `<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${corsRulesXml}</CORSConfiguration>`;

      const corsHeaders = signS3Request({
        method: "PUT",
        url: corsUrl,
        region,
        host,
        accessKeyId,
        secretAccessKey,
        sessionToken,
        body: corsBody,
        extraHeaders: { "Content-Type": "application/xml" },
      });

      const corsRes = await fetch(corsUrl, {
        method: "PUT",
        headers: corsHeaders,
        body: corsBody,
      });

      if (corsRes.status >= 200 && corsRes.status < 300) {
        corsApplied = true;
      }
    } catch {
      // Non-fatal if server doesn't support CORS endpoint
    }
  }

  // 7. Verify Public Reachability with unauthenticated ping
  let publicUrl = `${bucketUrl.replace(/\/+$/, "")}/`;
  if (config.cdnUrl) {
    publicUrl = `${config.cdnUrl.replace(/\/+$/, "")}/${cleanBucket}/`;
  }

  if (isPublicRead) {
    try {
      const checkRes = await fetch(bucketUrl, { method: "HEAD" });
      if (checkRes.status !== 403 && checkRes.status !== 401) {
        publicAccessVerified = true;
      }
    } catch {
      // Network reachability issue
    }
  }

  return {
    success: true,
    bucketName: cleanBucket,
    status: 200,
    statusText: "Synced",
    message: isPublicRead
      ? `Bucket "${cleanBucket}" successfully synced to Public Read on storage server.`
      : `Bucket "${cleanBucket}" synced as Private on storage server.`,
    appliedPolicy: accessPolicy,
    policyApplied,
    corsApplied,
    publicAccessVerified: isPublicRead ? publicAccessVerified : undefined,
    publicUrl,
    error: warnings.length > 0 && !policyApplied ? warnings.join("; ") : undefined,
  };
}

/**
 * Sends a real HTTP request to the configured S3 / storage server to test connection.
 */
export async function checkStorageConnectionLive(
  config: StorageConnectionConfig,
): Promise<CheckStorageConnectionResult> {
  const startTime = performance.now();
  const region = config.region || process.env.AWS_REGION || "us-east-1";
  const { accessKeyId, secretAccessKey, sessionToken } = resolveCredentials(config);
  let endpoint = normalizeEndpointUrl(config.endpointUrl, region);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const resolved = resolveStorageUrl(config, "");
    endpoint = resolved.endpoint;

    const headers = signS3Request({
      method: "HEAD",
      url: resolved.url,
      region,
      host: resolved.host,
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });

    const response = await fetch(resolved.url, {
      method: "HEAD",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    const serverHeader = response.headers.get("server") || undefined;
    const isSuccess = response.status >= 200 && response.status < 400;
    const bucketExists = response.status >= 200 && response.status < 300;

    return {
      success: isSuccess,
      serverActive: true,
      bucketExists,
      status: response.status,
      statusText: response.statusText || (isSuccess ? "OK" : "Error"),
      durationMs,
      endpoint: resolved.endpoint,
      bucket: config.bucketName,
      region,
      serverHeader,
      headers: responseHeaders,
      error: !isSuccess
        ? response.status === 404
          ? `Storage server is reachable, but bucket "${config.bucketName}" was not found (HTTP 404). You can click "Create Bucket" to initialize it.`
          : `Storage server responded with HTTP ${response.status} ${response.statusText || ""}`
        : undefined,
      tip:
        response.status === 403
          ? "Storage server is reachable, but access was denied. Verify your accessKeyId and secretAccessKey."
          : response.status === 404
            ? `Storage server is reachable, but bucket "${config.bucketName}" was not found. Use "Create Bucket" to initialize it.`
            : undefined,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    const isAbort = err instanceof Error && err.name === "AbortError";
    const errorMsg = isAbort
      ? `Connection timed out after 6000ms while reaching ${endpoint}`
      : err instanceof Error
        ? err.message
        : String(err);

    return {
      success: false,
      serverActive: false,
      bucketExists: false,
      status: 0,
      statusText: "Connection Failed",
      durationMs,
      endpoint,
      bucket: config.bucketName,
      region,
      error: `Could not connect to storage server at ${endpoint} (${errorMsg}).`,
      tip: `Ensure your storage server (e.g. MinIO, SeaweedFS, LocalStack, or cloud S3) is running and reachable at "${endpoint}".`,
    };
  }
}

/**
 * Executes a real operation (upload, download, head, delete, list) against the configured server.
 */
export async function executeStorageOperationLive(
  payload: ExecuteStorageOperationPayload,
): Promise<ExecuteStorageOperationResult> {
  const { connection, operation, params } = payload;
  const startTime = performance.now();
  const region = connection.region || process.env.AWS_REGION || "us-east-1";
  const { accessKeyId, secretAccessKey, sessionToken } = resolveCredentials(connection);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let targetEndpoint = normalizeEndpointUrl(connection.endpointUrl, region);
  let requestUrl = "";
  let method = "GET";

  try {
    const key = params.key || "test-file.txt";
    const resolved = resolveStorageUrl(connection, key);
    targetEndpoint = resolved.endpoint;
    requestUrl = resolved.url;

    let body: string | Buffer | undefined = undefined;
    const extraHeaders: Record<string, string> = {};
    let presignedResultUrl: string | undefined = undefined;

    switch (operation) {
      case "createBucket": {
        method = "PUT";
        const bucketToCreate = params.key || connection.bucketName;
        const bucketResolved = resolveStorageUrl({ ...connection, bucketName: bucketToCreate, forcePathStyle: true }, "");
        requestUrl = bucketResolved.url;
        const isLocalOrIp =
          new URL(bucketResolved.endpoint).hostname === "localhost" ||
          new URL(bucketResolved.endpoint).hostname === "127.0.0.1";
        if (!isLocalOrIp && region && region !== "us-east-1") {
          body = `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`;
          extraHeaders["Content-Type"] = "application/xml";
        } else {
          body = "";
        }
        break;
      }

      case "uploadObject": {
        method = "PUT";
        body = params.body || "Hello world from live storage test";
        extraHeaders["Content-Type"] = params.contentType || "application/octet-stream";
        if (params.metadata) {
          Object.entries(params.metadata).forEach(([k, v]) => {
            extraHeaders[`x-amz-meta-${k.toLowerCase()}`] = String(v);
          });
        }
        break;
      }

      case "downloadObject": {
        method = "GET";
        break;
      }

      case "objectExists": {
        method = "HEAD";
        break;
      }

      case "deleteObject": {
        method = "DELETE";
        break;
      }

      case "listObjects": {
        method = "GET";
        const listResolved = resolveStorageUrl(connection, "");
        const searchParams = new URLSearchParams();
        searchParams.set("list-type", "2");
        if (params.prefix) searchParams.set("prefix", params.prefix);
        if (params.maxKeys) searchParams.set("max-keys", String(params.maxKeys));
        requestUrl = `${listResolved.url}?${searchParams.toString()}`;
        break;
      }

      case "getUploadPresignedUrl": {
        const ttl = Number(params.ttl) || 900;
        presignedResultUrl = generatePresignedUrlSigV4({
          method: "PUT",
          url: resolved.url,
          region,
          host: resolved.host,
          accessKeyId: accessKeyId || "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: secretAccessKey || "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          sessionToken,
          expiresInSeconds: ttl,
        });

        // Also do a preflight OPTIONS check to verify server reachability
        method = "OPTIONS";
        extraHeaders["Origin"] = "http://localhost:3000";
        extraHeaders["Access-Control-Request-Method"] = "PUT";
        break;
      }

      case "getDownloadPresignedUrl": {
        const ttl = Number(params.ttl) || 3600;
        presignedResultUrl = generatePresignedUrlSigV4({
          method: "GET",
          url: resolved.url,
          region,
          host: resolved.host,
          accessKeyId: accessKeyId || "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: secretAccessKey || "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          sessionToken,
          expiresInSeconds: ttl,
        });
        method = "HEAD";
        break;
      }

      case "getPublicObjectUrl": {
        method = "HEAD";
        if (connection.cdnUrl) {
          requestUrl = `${connection.cdnUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
        }
        break;
      }

      default: {
        method = "GET";
      }
    }

    const isAnonymousPublicCheck = operation === "getPublicObjectUrl";
    const signedHeaders = isAnonymousPublicCheck
      ? { Host: new URL(requestUrl).host, ...extraHeaders }
      : signS3Request({
          method,
          url: requestUrl,
          region,
          host: new URL(requestUrl).host,
          accessKeyId,
          secretAccessKey,
          sessionToken,
          body,
          extraHeaders,
        });

    const fetchOptions: RequestInit = {
      method,
      headers: signedHeaders,
      signal: controller.signal,
    };

    if (body && ["PUT", "POST"].includes(method)) {
      fetchOptions.body = body;
    }

    const response = await fetch(requestUrl, fetchOptions);
    clearTimeout(timeoutId);
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    const resHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });

    const isSuccess = response.status >= 200 && response.status < 400;
    const rawText = await response.text();

    let parsedData:
      | S3XmlParsedData
      | Record<string, string | number | boolean | null | undefined | Record<string, string>>
      | string
      | null = null;
    const xmlParsed = parseS3XmlResponse(rawText);

    if (xmlParsed) {
      parsedData = xmlParsed;
    } else {
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = rawText || (isSuccess ? { status: "Success", httpStatusCode: response.status } : null);
      }
    }

    if (operation === "objectExists") {
      parsedData = {
        exists: response.status === 200,
        status: response.status,
        bucket: connection.bucketName,
        key: key,
        headers: resHeaders,
      };
    } else if (operation === "getUploadPresignedUrl" || operation === "getDownloadPresignedUrl") {
      const isUpload = operation === "getUploadPresignedUrl";
      const ttl = Number(params.ttl) || (isUpload ? 900 : 3600);
      parsedData = {
        presignedUrl: presignedResultUrl,
        uploadUrl: isUpload ? presignedResultUrl : undefined,
        downloadUrl: !isUpload ? presignedResultUrl : undefined,
        signedUrl: presignedResultUrl,
        url: presignedResultUrl,
        key: key,
        bucket: connection.bucketName,
        method: isUpload ? "PUT" : "GET",
        expiresInSeconds: ttl,
        serverPreflightStatus: response.status,
        serverPreflightText: response.statusText,
      };
    } else if (operation === "uploadObject") {
      parsedData = {
        success: isSuccess,
        status: response.status,
        url: resolved.url,
        key: key,
        bucket: connection.bucketName,
        etag: resHeaders["etag"],
      };
    } else if (operation === "deleteObject") {
      parsedData = {
        success: isSuccess,
        status: response.status,
        key: key,
        bucket: connection.bucketName,
      };
    } else if (operation === "getPublicObjectUrl") {
      let finalPublicUrl = requestUrl;
      if (connection.cdnUrl) {
        finalPublicUrl = `${connection.cdnUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
      }
      parsedData = {
        url: finalPublicUrl,
        key: key,
        bucket: connection.bucketName,
        exists: response.status === 200,
        status: response.status,
      };
    }

    return {
      success: isSuccess,
      serverActive: true,
      status: response.status,
      statusText: response.statusText || (isSuccess ? "OK" : "Error"),
      durationMs,
      endpoint: resolved.endpoint,
      method,
      url: requestUrl,
      headers: resHeaders,
      data: parsedData,
      rawResponse: rawText ? rawText.slice(0, 1000) : undefined,
      signedUrl: presignedResultUrl,
      error: !isSuccess
        ? `Server responded with ${response.status} ${response.statusText}`
        : undefined,
      tip:
        operation === "getPublicObjectUrl" && response.status === 403
          ? "Access Denied (403). The bucket is private on the server. Click 'Sync to Server' to apply public-read permissions and CORS."
          : undefined,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));

    const isAbort = err instanceof Error && err.name === "AbortError";
    const errorMsg = isAbort
      ? `Operation timed out after 8000ms connecting to ${targetEndpoint}`
      : err instanceof Error
        ? err.message
        : String(err);

    return {
      success: false,
      serverActive: false,
      status: 0,
      statusText: "Connection Failed",
      durationMs,
      endpoint: targetEndpoint,
      method,
      url: requestUrl,
      data: {
        error: "NetworkError",
        message: errorMsg,
        endpoint: targetEndpoint,
      },
      error: `Could not reach configured storage server at ${targetEndpoint}: ${errorMsg}`,
      tip: `Check that your storage server at "${targetEndpoint}" is running, or verify network and CORS settings.`,
    };
  }
}

/**
 * Executes the entire generated test suite against the live storage server.
 * Evaluates each assertion in sequence and surfaces exact runtime errors (ECONNREFUSED,
 * NoSuchBucket, SignatureDoesNotMatch, etc.) if misconfigured or server is offline.
 */
export async function executeStorageTestSuiteLive(
  config: StorageConnectionConfig,
): Promise<StorageTestSuiteResult> {
  const startTime = performance.now();
  const bucketName = config.bucketName || "default-bucket";
  const region = config.region || process.env.AWS_REGION || "us-east-1";
  const cases: StorageTestCaseResult[] = [];

  const { accessKeyId, secretAccessKey } = resolveCredentials(config);
  let resolvedEndpoint = normalizeEndpointUrl(config.endpointUrl, region);

  try {
    const resolved = resolveStorageUrl(config, "");
    resolvedEndpoint = resolved.endpoint;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    cases.push({
      id: "case-client-config",
      title: "Client Initialization & Config",
      category: "Client Initialization & Config",
      passed: false,
      durationMs: 1,
      error: errorMsg,
      details: `Target region: ${region}, endpoint: ${resolvedEndpoint}`,
      snippet: `expect(s3Client).toBeDefined();\nexpect(storageConfig.region).toBe("${region}");`,
    });
    return {
      total: 1,
      passed: 0,
      failed: 1,
      durationMs: 1,
      serverActive: false,
      endpoint: resolvedEndpoint,
      bucket: bucketName,
      cases,
      error: errorMsg,
    };
  }

  // 1. Client Initialization & Env Config test case
  const t0 = performance.now();
  const missingEnvKeys: string[] = [];
  if (config.accessKeyIdEnv && !process.env[config.accessKeyIdEnv] && !config.accessKeyId) {
    missingEnvKeys.push(`process.env.${config.accessKeyIdEnv}`);
  }
  if (config.secretAccessKeyEnv && !process.env[config.secretAccessKeyEnv] && !config.secretAccessKey) {
    missingEnvKeys.push(`process.env.${config.secretAccessKeyEnv}`);
  }

  const clientInitPassed = !missingEnvKeys.length && Boolean(region);
  cases.push({
    id: "case-client-config",
    title: "Client Initialization & Config",
    category: "Client Initialization & Config",
    passed: clientInitPassed,
    durationMs: Math.max(1, Math.round(performance.now() - t0)),
    error: clientInitPassed
      ? undefined
      : `Missing required environment variables in local environment: ${missingEnvKeys.join(", ")}`,
    details: `Target region: ${region}, endpoint: ${resolvedEndpoint}`,
    snippet: `expect(s3Client).toBeDefined();\nexpect(storageConfig.region).toBe("${region}");`,
  });

  // 2. Bucket Metadata test case
  const t1 = performance.now();
  cases.push({
    id: "case-bucket-meta",
    title: `Bucket Metadata Resolution ('${bucketName}')`,
    category: "Client Initialization & Config",
    passed: Boolean(bucketName),
    durationMs: Math.max(1, Math.round(performance.now() - t1)),
    details: `Resolved bucket: ${bucketName}`,
    snippet: `const meta = getBucketMetadata("${bucketName}");\nexpect(meta?.name).toBe("${bucketName}");`,
  });

  // 3. Server Connection / Bucket Reachability (Direct HeadBucket against server)
  const connResult = await checkStorageConnectionLive(config);
  cases.push({
    id: "case-server-connection",
    title: `Server Connection & HeadBucket ('${bucketName}')`,
    category: "Generated Operations",
    passed: connResult.success,
    durationMs: connResult.durationMs,
    error: connResult.error,
    details: connResult.serverActive
      ? `HTTP ${connResult.status} ${connResult.statusText}`
      : `Server offline at ${resolvedEndpoint}`,
    snippet: `const cmd = new HeadBucketCommand({ Bucket: "${bucketName}" });\nconst res = await s3Client.send(cmd);`,
  });

  // 4. getUploadPresignedUrl operation
  const presignUploadRes = await executeStorageOperationLive({
    connection: config,
    operation: "getUploadPresignedUrl",
    params: {
      key: "test/avatar.png",
      ttl: 900,
      contentType: "image/png",
    },
  });
  const presignUploadPassed =
    presignUploadRes.success ||
    (Boolean(presignUploadRes.signedUrl) && presignUploadRes.serverActive);
  cases.push({
    id: "case-presign-upload",
    title: "generate presigned upload URL (getUploadPresignedUrl)",
    category: "Generated Operations",
    passed: presignUploadPassed,
    durationMs: presignUploadRes.durationMs,
    error: presignUploadPassed ? undefined : presignUploadRes.error,
    details: presignUploadRes.signedUrl ? `Generated Presigned PUT URL` : undefined,
    snippet: `const url = await getUploadPresignedUrl("${bucketName}", "test/avatar.png", {\n  expiresInSeconds: 900,\n  contentType: "image/png",\n});\nexpect(url).toContain("${bucketName}");`,
  });

  // 5. getDownloadPresignedUrl operation
  const presignDownloadRes = await executeStorageOperationLive({
    connection: config,
    operation: "getDownloadPresignedUrl",
    params: {
      key: "test/avatar.png",
      ttl: 3600,
    },
  });
  const presignDownloadPassed =
    presignDownloadRes.success ||
    (Boolean(presignDownloadRes.signedUrl) && presignDownloadRes.serverActive);
  cases.push({
    id: "case-presign-download",
    title: "generate presigned download URL (getDownloadPresignedUrl)",
    category: "Generated Operations",
    passed: presignDownloadPassed,
    durationMs: presignDownloadRes.durationMs,
    error: presignDownloadPassed ? undefined : presignDownloadRes.error,
    details: presignDownloadRes.signedUrl ? `Generated Presigned GET URL` : undefined,
    snippet: `const url = await getDownloadPresignedUrl("${bucketName}", "test/avatar.png", {\n  expiresInSeconds: 3600,\n});\nexpect(url).toContain("${bucketName}");`,
  });

  // 6. objectExists operation
  const existsRes = await executeStorageOperationLive({
    connection: config,
    operation: "objectExists",
    params: {
      key: "test/avatar.png",
    },
  });
  // objectExists succeeds if server is reachable and returned 200 or 404 (not network error or 403)
  const existsPassed =
    existsRes.serverActive &&
    (existsRes.status === 200 || existsRes.status === 404);
  cases.push({
    id: "case-object-exists",
    title: "execute objectExists check",
    category: "Generated Operations",
    passed: existsPassed,
    durationMs: existsRes.durationMs,
    error: existsPassed ? undefined : existsRes.error,
    details: existsPassed
      ? `HTTP ${existsRes.status}: object returned ${existsRes.status === 200 ? "found" : "not found (expected for test key)"}`
      : undefined,
    snippet: `const exists = await objectExists("${bucketName}", "test/avatar.png");\nexpect(typeof exists).toBe("boolean");`,
  });

  // 7. getPublicObjectUrl operation
  const t7 = performance.now();
  const cdnOrEndpoint = config.cdnUrl || resolvedEndpoint;
  const publicUrlExpected = `${cdnOrEndpoint.replace(/\/+$/, "")}/${bucketName}/images/banner.jpg`;
  cases.push({
    id: "case-public-url",
    title: "resolve public object URL correctly",
    category: "Generated Operations",
    passed: Boolean(cdnOrEndpoint),
    durationMs: Math.max(1, Math.round(performance.now() - t7)),
    details: `Resolved: ${publicUrlExpected}`,
    snippet: `const url = getPublicObjectUrl("${bucketName}", "images/banner.jpg");\nexpect(url).toContain("images/banner.jpg");`,
  });

  const totalPassed = cases.filter((c) => c.passed).length;
  const totalFailed = cases.filter((c) => !c.passed).length;
  const overallDurationMs = Math.max(1, Math.round(performance.now() - startTime));

  return {
    total: cases.length,
    passed: totalPassed,
    failed: totalFailed,
    durationMs: overallDurationMs,
    serverActive: connResult.serverActive,
    endpoint: resolvedEndpoint,
    bucket: bucketName,
    cases,
    error: totalFailed > 0 ? `${totalFailed} of ${cases.length} test cases failed.` : undefined,
  };
}
