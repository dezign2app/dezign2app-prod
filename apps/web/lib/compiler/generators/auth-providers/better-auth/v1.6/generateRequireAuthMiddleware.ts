export type AuthStrategy = "db" | "jwks" | "http";

/**
 * Generates `src/middleware/requireAuth.ts` for a compiled Express service.
 *
 * - Strategy is resolved at compile time (not runtime) and baked directly into
 *   the generated source — no switch statement in the output.
 * - Default strategy is "db": direct SQLite session lookup via @workspace/db,
 *   which is correct for the centralized monorepo where the DB is shared.
 * - The returned middleware is a factory: requireAuth() for auth-only,
 *   requireAuth({ roles: ["admin"] }) for auth + role enforcement.
 * - req.user is declared via Express namespace augmentation in the same file
 *   so no separate types.d.ts is needed.
 */
export function generateRequireAuthMiddleware(
  strategy: AuthStrategy = "db"
): string {
  const sessionBlock = buildSessionBlock(strategy);

  return `import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createLogger } from "@workspace/logger";
${buildImports(strategy)}

// Extend Express Request to carry the resolved user identity
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

const logger = createLogger("middleware:requireAuth");

interface AuthOptions {
  /** When provided, the request is rejected with 403 unless req.user.role is in this list. */
  roles?: string[];
}

/**
 * Express middleware factory for authentication (and optional role-based authorization).
 *
 * Usage:
 *   router.get("/public",  handler);
 *   router.get("/private", requireAuth(), handler);
 *   router.post("/admin",  requireAuth({ roles: ["admin"] }), handler);
 *
 * On success, attaches \`req.user = { id, role }\` and calls next().
 * On failure, responds immediately with 401 (unauthenticated) or 403 (unauthorized).
 */
export function requireAuth(options: AuthOptions = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("Auth failed: missing or malformed Authorization header", {
        headersReceived: Object.keys(req.headers),
      });
      return res.status(401).json({ error: "Unauthorized: Missing Bearer token" });
    }

    const token = authHeader.substring(7).trim();

    try {
${sessionBlock}
    } catch (err) {
      logger.error("requireAuth: unexpected error during session resolution", {
        error: String(err),
      });
      return res.status(500).json({ error: "Internal Server Error during authentication" });
    }

    if (options.roles && options.roles.length > 0) {
      const userRole = req.user!.role;
      if (!options.roles.includes(userRole)) {
        logger.warn("Auth failed: insufficient role", {
          userRole,
          required: options.roles,
        });
        return res.status(403).json({ error: "Forbidden: Insufficient role" });
      }
    }

    next();
  };
}
`;
}

// ---------------------------------------------------------------------------
// Strategy-specific helpers
// ---------------------------------------------------------------------------

function buildImports(strategy: AuthStrategy): string {
  if (strategy === "db") {
    return `import { db } from "@workspace/db";`;
  }
  if (strategy === "jwks") {
    return `import { jwtVerify, createRemoteJWKSet } from "jose";`;
  }
  // http — no extra compile-time import needed; uses global fetch
  return "";
}

function buildSessionBlock(strategy: AuthStrategy): string {
  if (strategy === "db") return buildDbSessionBlock();
  if (strategy === "jwks") return buildJwksSessionBlock();
  return buildHttpSessionBlock();
}

function buildDbSessionBlock(): string {
  return `      // Strategy: db — direct session lookup via shared @workspace/db (better-auth v1.6 schema)
      type SessionRow = { userId: string; expiresAt: string };
      const session = db
        .prepare("SELECT userId, expiresAt FROM session WHERE token = ?")
        .get(token) as SessionRow | undefined;

      if (!session?.userId) {
        logger.warn("Auth failed: session not found", {
          tokenPrefix: token.substring(0, 8) + "...",
        });
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
        logger.warn("Auth failed: session expired", { expiresAt: session.expiresAt });
        return res.status(401).json({ error: "Unauthorized: Session has expired" });
      }

      type UserRow = { role?: string };
      const userRecord = db
        .prepare("SELECT role FROM user WHERE id = ?")
        .get(session.userId) as UserRow | undefined;

      req.user = {
        id: String(session.userId),
        role: String(userRecord?.role ?? "user"),
      };

      logger.info("Auth: session resolved via shared DB", { userId: req.user.id, role: req.user.role });`;
}

function buildJwksSessionBlock(): string {
  return `      // Strategy: jwks — stateless JWT verification via JWKS endpoint (better-auth v1.6)
      const authServerUrl =
        process.env.AUTH_SERVER_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
      const JWKS = createRemoteJWKSet(new URL(\`\${authServerUrl}/api/auth/jwks\`));
      const { payload } = await jwtVerify(token, JWKS);

      const sub = payload.sub ?? (payload as Record<string, unknown>)["id"] ?? (payload as Record<string, unknown>)["userId"];
      if (!sub) {
        logger.warn("Auth failed: JWT payload has no subject");
        return res.status(401).json({ error: "Unauthorized: Invalid token payload" });
      }

      req.user = {
        id: String(sub),
        role: String((payload as Record<string, unknown>)["role"] ?? "user"),
      };

      logger.info("Auth: session resolved via JWKS", { userId: req.user.id, role: req.user.role });`;
}

function buildHttpSessionBlock(): string {
  return `      // Strategy: http — session lookup via Better Auth /api/auth/get-session
      const authServerUrl =
        process.env.AUTH_SERVER_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

      const authRes = await fetch(\`\${authServerUrl}/api/auth/get-session\`, {
        headers: {
          authorization: authHeader,
          "x-better-auth-session-token": token,
          cookie: req.headers.cookie ?? \`better-auth.session_token=\${token}\`,
        },
      });

      if (!authRes.ok) {
        logger.warn("Auth failed: auth server returned non-OK", { status: authRes.status });
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      const contentType = authRes.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        logger.warn("Auth failed: unexpected content-type from auth server", { contentType });
        return res.status(401).json({ error: "Unauthorized: Invalid auth server response" });
      }

      const data = (await authRes.json()) as Record<string, unknown> & {
        user?: { id?: string; role?: string };
        session?: { userId?: string };
      };

      const userId = data?.user?.id ?? data?.session?.userId;
      if (!userId) {
        logger.warn("Auth failed: no userId in auth server response");
        return res.status(401).json({ error: "Unauthorized: User not found" });
      }

      req.user = {
        id: String(userId),
        role: String(data?.user?.role ?? "user"),
      };

      logger.info("Auth: session resolved via HTTP get-session", { userId: req.user.id, role: req.user.role });`;
}
