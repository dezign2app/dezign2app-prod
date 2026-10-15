/**
 * Real Bearer Token & JWT Generator for external endpoint testing (Postman, cURL, etc.)
 *
 * Provides RFC 7519 compliant HMAC-SHA256 signed JSON Web Tokens (JWT)
 * and high-entropy Better Auth session tokens.
 * Works seamlessly in client (browser), Node.js, and edge runtimes.
 */

export const DEFAULT_AUTH_SECRET =
  "default_super_secret_key_change_in_production";

export interface JwtClaimOptions {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
  sessionId?: string;
  secret?: string;
  expiresInSeconds?: number;
  extraClaims?: Record<string, unknown>;
}

export interface DecodedJwtInfo {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  isValidStructure: boolean;
  isExpired: boolean;
  expiresAtFormatted: string;
}

// ── Base64URL Encoding & Decoding ──────────────────────────────────────────

export function base64UrlEncode(strOrBytes: string | Uint8Array): string {
  let base64 = "";
  if (typeof strOrBytes === "string") {
    // UTF-8 string encoding
    base64 = btoa(
      encodeURIComponent(strOrBytes).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16)),
      ),
    );
  } else {
    // Uint8Array bytes
    let binary = "";
    const len = strOrBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(strOrBytes[i]!);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// ── Synchronous Pure-JS HMAC-SHA256 (Bitwise Engine) ───────────────────────

function sha256Internal(ascii: string): number[] {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i: number, j: number;
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while (ascii[lengthProperty] % 64 - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] = (words[i >> 2] || 0) | (j << ((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15]!,
        w2 = w[i - 2]!;
      const a = hash[0]!,
        e = hash[4]!;
      const temp1 =
        hash[7]! +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]!) ^ (~e & hash[6]!)) +
        k[i]! +
        (w[i] =
          i < 16
            ? w[i]!
            : (w[i - 16]! +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7]! +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]!) ^ (a & hash[2]!) ^ (hash[1]! & hash[2]!));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4]! + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i]! + oldHash[i]!) | 0;
    }
  }

  const bytes: number[] = [];
  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      bytes.push((hash[i]! >> (8 * b)) & 255);
    }
  }
  return bytes;
}

export function signHmacSha256Sync(keyStr: string, messageStr: string): string {
  const encoder = new TextEncoder();
  let keyBytes = Array.from(encoder.encode(keyStr));
  const msgBytes = Array.from(encoder.encode(messageStr));
  const blockSize = 64;

  if (keyBytes.length > blockSize) {
    keyBytes = sha256Internal(String.fromCharCode(...keyBytes));
  }
  while (keyBytes.length < blockSize) {
    keyBytes.push(0);
  }

  const oPad = keyBytes.map((b) => b ^ 0x5c);
  const iPad = keyBytes.map((b) => b ^ 0x36);
  const inner = sha256Internal(
    String.fromCharCode(...iPad) + String.fromCharCode(...msgBytes),
  );
  const outer = sha256Internal(
    String.fromCharCode(...oPad) + String.fromCharCode(...inner),
  );
  return base64UrlEncode(new Uint8Array(outer));
}

// ── Web Crypto Asynchronous HMAC-SHA256 ─────────────────────────────────────

export async function signHmacSha256(
  keyStr: string,
  messageStr: string,
): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(keyStr),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(messageStr),
      );
      return base64UrlEncode(new Uint8Array(signature));
    } catch {
      // Fallback to sync bitwise engine
    }
  }
  return signHmacSha256Sync(keyStr, messageStr);
}

// ── Real JWT Bearer Token Generators ───────────────────────────────────────

/**
 * Builds standard JWT claims payload with sub, userId, email, role, session, and timestamps.
 */
export function buildJwtPayload({
  userId,
  email,
  name,
  role = "user",
  sessionId,
  expiresInSeconds = 60 * 60 * 24 * 365, // 1 year default for test personas
  extraClaims = {},
}: Omit<JwtClaimOptions, "secret">) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: userId,
    userId: userId,
    id: userId,
    email: email || `${userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "user"}@example.com`,
    name: name || "Test Persona",
    role: role || "user",
    sessionId: sessionId || `sess_${userId}`,
    iat: now,
    exp: now + expiresInSeconds,
    iss: "better-auth",
    aud: "dezign2app-api",
    ...extraClaims,
  };
}

/**
 * Generates an RFC 7519 compliant HMAC-SHA256 signed JWT synchronously.
 */
export function generateRealBearerJwtSync({
  userId,
  email,
  name,
  role = "user",
  sessionId,
  secret = DEFAULT_AUTH_SECRET,
  expiresInSeconds = 60 * 60 * 24 * 365,
  extraClaims = {},
}: JwtClaimOptions): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = buildJwtPayload({
    userId,
    email,
    name,
    role,
    sessionId,
    expiresInSeconds,
    extraClaims,
  });

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encHeader}.${encPayload}`;
  const sig = signHmacSha256Sync(secret, message);
  return `${message}.${sig}`;
}

/**
 * Generates an RFC 7519 compliant HMAC-SHA256 signed JWT using Web Crypto (async).
 */
export async function generateRealBearerJwt({
  userId,
  email,
  name,
  role = "user",
  sessionId,
  secret = DEFAULT_AUTH_SECRET,
  expiresInSeconds = 60 * 60 * 24 * 365,
  extraClaims = {},
}: JwtClaimOptions): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = buildJwtPayload({
    userId,
    email,
    name,
    role,
    sessionId,
    expiresInSeconds,
    extraClaims,
  });

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encHeader}.${encPayload}`;
  const sig = await signHmacSha256(secret, message);
  return `${message}.${sig}`;
}

/**
 * Generates a high-entropy 64-char crypto session token for Better Auth session table.
 */
export function generateRealSessionToken(prefix = "ba_sess_"): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 24; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}${hex}`;
}

// ── JWT Inspection & Decoding ──────────────────────────────────────────────

/**
 * Safely parses and decodes a JWT without verification.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!token || typeof token !== "string") return null;
  const clean = token.replace(/^Bearer\s+/i, "").trim();
  const parts = clean.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = base64UrlDecode(parts[1]!);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Full JWT inspection with header, payload, expiry status, and formatted date.
 */
export function inspectJwt(token: string): DecodedJwtInfo | null {
  if (!token || typeof token !== "string") return null;
  const clean = token.replace(/^Bearer\s+/i, "").trim();
  const parts = clean.split(".");
  if (parts.length !== 3) return null;

  try {
    const headerJson = base64UrlDecode(parts[0]!);
    const payloadJson = base64UrlDecode(parts[1]!);
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    const isExpired = exp > 0 && exp < now;
    const expiresAtFormatted = exp
      ? new Date(exp * 1000).toLocaleString()
      : "No Expiration";

    return {
      header,
      payload,
      isValidStructure: true,
      isExpired,
      expiresAtFormatted,
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a string has valid 3-segment JWT syntax.
 */
export function isRealJwt(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const clean = token.replace(/^Bearer\s+/i, "").trim();
  const parts = clean.split(".");
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[a-zA-Z0-9_-]+$/.test(p));
}

// ── Header & Testing Formatting ───────────────────────────────────────────

/**
 * Formats token as `Bearer <token>`.
 */
export function formatBearerHeader(token?: string): string {
  if (!token || !token.trim()) return "";
  const clean = token.replace(/^Bearer\s+/i, "").trim();
  if (!clean) return "";
  return `Bearer ${clean}`;
}

/**
 * Generates an executable cURL command snippet for Postman/CLI testing.
 */
export function formatCurlExample(
  method: string,
  url: string,
  token?: string,
): string {
  const cleanMethod = (method || "GET").toUpperCase();
  const cleanUrl = url || "http://localhost:8080/api/endpoint";
  const bearer = formatBearerHeader(token);

  if (bearer) {
    return `curl -X ${cleanMethod} "${cleanUrl}" \\
  -H "Authorization: ${bearer}" \\
  -H "Content-Type: application/json"`;
  }

  return `curl -X ${cleanMethod} "${cleanUrl}" \\
  -H "Content-Type: application/json"`;
}
