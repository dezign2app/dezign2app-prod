import { BetterAuthV16NodeData } from "../types";

/**
 * Generates the Hono server entry point (`src/index.ts`)
 */
export function generateAuthIndex(data: BetterAuthV16NodeData): string {
  return `import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Mount Better Auth HTTP handler at /api/auth/*
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.get("/health", (c) => c.json({ status: "ok", service: "${data.label || "auth-server"}" }));

const port = Number(process.env.PORT || 3001);
console.log(\`Better Auth Server running on http://localhost:\${port}\`);

serve({
  fetch: app.fetch,
  port,
});
`;
}
