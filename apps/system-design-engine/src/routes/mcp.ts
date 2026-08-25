import { Router, type Router as ExpressRouter } from "express";
import crypto from "crypto";
import { extractAuthToken, resolveAuth } from "../mcp/auth";
import { createSession, cleanupOldSessions, Session } from "../mcp/session";

export const mcpRouter: ExpressRouter = Router();

const sessions = new Map<string, Session>();
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const SESSION_CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour

setInterval(() => {
  cleanupOldSessions(sessions, SESSION_MAX_AGE);
}, SESSION_CLEANUP_INTERVAL);

mcpRouter.options("/", (req, res) => {
  res.sendStatus(204);
});

mcpRouter.all("/", async (req, res) => {
  try {
    const existingSessionId = req.headers["mcp-session-id"] as
      | string
      | undefined;

    console.log(`\n[DEBUG] ${req.method} /mcp`);

    const authToken = extractAuthToken(req);

    // Detect if this is an initialize request
    const isInitialize =
      req.method === "POST" && req.body?.method === "initialize";

    let sessionId: string;

    if (isInitialize || !existingSessionId) {
      // Resolve auth context (optional for local testing)
      const authContext = authToken ? await resolveAuth(authToken) : null;

      if (!authContext) {
        console.warn(
          `[AUTH] Warning: No valid auth token provided. Allowing unauthenticated session for local testing.`,
        );
      }

      // Create a fresh session for initialize requests
      sessionId = crypto.randomUUID();
      console.log(
        `\n[REQUEST] ${req.method} /mcp | New session=${sessionId} | Auth: user=${authContext?.userId || "anonymous"}`,
      );

      const session = await createSession(sessionId, authContext);
      sessions.set(sessionId, session);

      res.setHeader("mcp-session-id", sessionId);

      if (req.method === "GET") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        await session.transport.handleRequest(req, res);
      } else {
        await session.transport.handleRequest(req, res, req.body);
      }
    } else {
      sessionId = existingSessionId;
      const session = sessions.get(sessionId);

      if (!session) {
        console.error(`[REQUEST] Session not found: ${sessionId}`);
        res.status(404).json({ error: "Session not found" });
        return;
      }

      console.log(
        `\n[REQUEST] ${req.method} /mcp | session=${sessionId}${session.userId ? ` | user=${session.userId}` : ""}`,
      );

      // Check for token updates
      if (authToken) {
        const auth = await resolveAuth(authToken);
        if (auth && (!session.userId || session.userId !== auth.userId)) {
          console.log(
            `[AUTH] Updating session ${sessionId} context for user ${auth.userId}`,
          );
          session.userId = auth.userId;
          session.orgId = auth.orgId;
          session.keyId = auth.keyId;
          session.projectId = auth.projectId;
          session.authToken = auth.token;
        }
      }

      res.setHeader("mcp-session-id", sessionId);
      if (req.method === "GET") {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        await session.transport.handleRequest(req, res);
      } else {
        await session.transport.handleRequest(req, res, req.body);
      }
    }

    console.log(`[RESPONSE] Done for session=${sessionId}`);
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: "Internal MCP server error" });
  }
});
