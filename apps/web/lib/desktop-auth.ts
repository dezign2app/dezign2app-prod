import crypto from "crypto";

// Single-use ticket interface for desktop browser-to-app handoff
export interface DesktopTicket {
  userId: string;
  token: string;
  expiresAt: number;
}

const getSecret = () => {
  return (
    process.env.BETTER_AUTH_SECRET ||
    "development-secret-key-at-least-32-chars-long-dezign2app-2026"
  );
};

// In-memory single-use tracking and fallback store (retained for in-process dev)
const globalForTickets = globalThis as unknown as {
  __desktopTickets?: Map<string, DesktopTicket>;
  __consumedTickets?: Set<string>;
};

const desktopTickets =
  globalForTickets.__desktopTickets ||
  (globalForTickets.__desktopTickets = new Map<string, DesktopTicket>());

const consumedTickets =
  globalForTickets.__consumedTickets ||
  (globalForTickets.__consumedTickets = new Set<string>());

// Clean up expired tickets periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of desktopTickets.entries()) {
      if (value.expiresAt < now) {
        desktopTickets.delete(key);
      }
    }
  }, 60000);
}

/**
 * Creates a cryptographically signed ticket containing userId, token, and expiration.
 * Because the ticket is self-contained and HMAC-signed, it can be verified across
 * distinct serverless function instances (e.g. Vercel) without shared in-memory state.
 */
export function createTicket(userId: string, token: string): string {
  const secret = getSecret();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  const nonce = crypto.randomBytes(8).toString("hex");

  const payloadObj = {
    u: userId,
    t: token,
    exp: expiresAt,
    n: nonce,
  };

  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  const signedTicket = `ticket_${payloadStr}.${signature}`;

  // Also cache in memory for local single-process dev
  desktopTickets.set(signedTicket, { userId, token, expiresAt });

  return signedTicket;
}

/**
 * Validates and consumes a desktop sign-in ticket.
 * Checks HMAC signature, expiration, and replay prevention.
 */
export function consumeTicket(ticketId: string): DesktopTicket | null {
  if (!ticketId || typeof ticketId !== "string") return null;

  const trimmed = ticketId.trim();

  // Check if ticket was already consumed
  if (consumedTickets.has(trimmed)) {
    return null;
  }

  // 1. Verify as signed ticket (stateless, works across serverless lambdas & instances)
  if (trimmed.startsWith("ticket_") && trimmed.includes(".")) {
    try {
      const withoutPrefix = trimmed.slice("ticket_".length);
      const dotIndex = withoutPrefix.indexOf(".");
      if (dotIndex !== -1) {
        const payloadStr = withoutPrefix.slice(0, dotIndex);
        const signature = withoutPrefix.slice(dotIndex + 1);

        const secret = getSecret();
        const expectedSig = crypto
          .createHmac("sha256", secret)
          .update(payloadStr)
          .digest("base64url");

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expectedSig);

        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          const payloadJson = Buffer.from(payloadStr, "base64url").toString("utf8");
          const payload = JSON.parse(payloadJson);

          if (payload && payload.t && payload.u && typeof payload.exp === "number") {
            if (payload.exp < Date.now()) {
              return null; // Expired
            }

            consumedTickets.add(trimmed);
            desktopTickets.delete(trimmed);

            return {
              userId: payload.u,
              token: payload.t,
              expiresAt: payload.exp,
            };
          }
        }
      }
    } catch (e) {
      console.warn("[desktop-auth] Signed ticket verification error:", e);
    }
  }

  // 2. Fallback to in-memory store (for legacy tickets or in-memory dev)
  const memTicket = desktopTickets.get(trimmed);
  if (memTicket) {
    desktopTickets.delete(trimmed);
    consumedTickets.add(trimmed);
    if (memTicket.expiresAt < Date.now()) {
      return null;
    }
    return memTicket;
  }

  return null;
}
