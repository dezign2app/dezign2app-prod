import type { CompileContext, RouteEndpoint } from "../types";
import { toCamelCase, toPascalCase, escapeStr } from "../utils";

export function buildServerFile(ctx: CompileContext, routes: RouteEndpoint[]): string {
  const graphVarName = `${toCamelCase(ctx.graphId)}Graph`;
  const hasMemory = ctx.hasMemory;

  // Deduplicate routes by path+method so we don't emit the same route twice
  const seen = new Set<string>();
  const deduped = routes.filter((r) => {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const routeHandlers = deduped
    .map((route) => {
      const isEvent = route.kind === "event";
      const payloadMap = route.payloadMapping ?? {};
      const stateChannels = ctx.input.stateChannels || [];

      // Collect all defined state channel keys + explicit payload mapping keys
      const allStateKeys = new Set<string>();
      stateChannels.forEach((ch) => allStateKeys.add(ch.key));
      Object.keys(payloadMap).forEach((k) => allStateKeys.add(k));
      if (allStateKeys.size === 0) {
        allStateKeys.add("messages");
      }

      const stateFields: string[] = [];
      for (const key of allStateKeys) {
        const customPath = payloadMap[key];
        const camelKey = toCamelCase(key);
        if (customPath) {
          const accessor = customPath.startsWith("headers.")
            ? `req.headers["${customPath.slice(8)}"]`
            : customPath.startsWith("body.")
              ? `req.body?.${customPath.slice(5)}`
              : `req.body?.${customPath}`;
          stateFields.push(`      ${camelKey}: ${accessor}`);
        } else if (key === "messages") {
          if (isEvent) {
            stateFields.push(
              `      messages: (typeof req.body === "object" && req.body !== null && "messages" in req.body && Array.isArray(req.body.messages)) ? req.body.messages : [{ role: "user", content: JSON.stringify(req.body) }]`,
            );
          } else {
            stateFields.push(
              `      messages: (typeof req.body === "object" && req.body !== null && "messages" in req.body && Array.isArray(req.body.messages)) ? req.body.messages : [{ role: "user", content: typeof req.body?.message === "string" ? req.body.message : (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) }]`,
            );
          }
        } else {
          stateFields.push(`      ${camelKey}: req.body?.${key} ?? req.body?.${camelKey}`);
        }
      }

      const stateInit = `{\n${stateFields.join(",\n")}\n    }`;

      const preInvokeBlock = (() => {
        if (route.preInvokeCode && route.preInvokeCode.trim()) {
          return `\n      // Pre-Invoke Business Logic\n      ${route.preInvokeCode.trim().replace(/\n/g, "\n      ")}\n`;
        }
        if (route.preInvokePrompt && route.preInvokePrompt.trim()) {
          // Natural language: emit as a comment directive for the AI agent
          const lines = route.preInvokePrompt.trim().split("\n");
          const commentLines = lines
            .map((l, i) => `      // STEP ${i + 1}: ${l.trim()}`)
            .join("\n");
          return `\n      // Pre-Invoke Business Logic (natural language spec — implement below):\n${commentLines}\n`;
        }
        return "";
      })();

      const postInvokeBlock = (() => {
        if (route.postInvokeCode && route.postInvokeCode.trim()) {
          return `\n      // Post-Invoke Business Logic\n      ${route.postInvokeCode.trim().replace(/\n/g, "\n      ")}\n`;
        }
        if (route.postInvokePrompt && route.postInvokePrompt.trim()) {
          const lines = route.postInvokePrompt.trim().split("\n");
          const commentLines = lines
            .map((l, i) => `      // POST-STEP ${i + 1}: ${l.trim()}`)
            .join("\n");
          return `\n      // Post-Invoke Business Logic (natural language spec — implement below):\n${commentLines}\n`;
        }
        return "";
      })();

      const threadIdLine = hasMemory
        ? `\n    const threadId = (typeof req.body === "object" && req.body !== null && "thread_id" in req.body && typeof req.body.thread_id === "string") ? req.body.thread_id : (typeof req.headers["x-thread-id"] === "string" ? req.headers["x-thread-id"] : "default");`
        : "";

      const configLine = hasMemory
        ? `,\n      { configurable: { thread_id: threadId } }`
        : "";

      const normalizedRoutePath = route.path.startsWith("/") ? route.path : `/${route.path}`;
      const comment = isEvent
        ? `// Event: ${route.eventName ?? normalizedRoutePath} (from ${route.sourceNodeLabel ?? "event source"})`
        : `// Route: ${route.method} ${normalizedRoutePath} (from ${route.sourceNodeLabel ?? "service"})`;

      const isStream = route.responseExecutionMode === "stream";
      const isAsyncAck = route.responseExecutionMode === "async_ack";

      if (isStream) {
        return `
  ${comment}
  app.${route.method.toLowerCase()}(${JSON.stringify(normalizedRoutePath)}, async (req: Request, res: Response) => {
    let isAborted = false;
    let activeStream: { return?: () => void } | null = null;

    req.on("close", () => {
      isAborted = true;
      if (activeStream && typeof activeStream.return === "function") {
        activeStream.return();
      }
    });

    try {${threadIdLine}
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const state: Partial<${toPascalCase(ctx.graphId)}StateUpdateType> = ${stateInit};${preInvokeBlock}
      const streamOptions = { streamMode: "messages"${configLine ? `, ${configLine.replace(/^, /, "")}` : ""} };
      const stream = await ${graphVarName}.stream(state, streamOptions);
      activeStream = stream;

      for await (const chunk of stream) {
        if (isAborted) break;
        const [messageChunk, metadata] = Array.isArray(chunk) ? chunk : [chunk, undefined];
        const token = messageChunk && typeof messageChunk === "object" && "content" in messageChunk
          ? messageChunk.content
          : typeof chunk === "string"
            ? chunk
            : chunk && typeof chunk === "object" && "content" in chunk
              ? chunk.content
              : chunk;
        const nodeName = metadata && typeof metadata === "object" && "langgraph_node" in metadata
          ? metadata.langgraph_node
          : undefined;
        if (token !== undefined && token !== "") {
          res.write(\`data: \${JSON.stringify({ token, node: nodeName })}\\n\\n\`);
        }
      }
      if (!isAborted) {
        res.write("data: [DONE]\\n\\n");
        res.end();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[${route.method} ${normalizedRoutePath}] stream error:", message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: message });
      } else {
        res.write(\`data: \${JSON.stringify({ error: message })}\\n\\n\`);
        res.end();
      }
    }
  });`;
      }

      if (isAsyncAck) {
        return `
  ${comment}
  app.${route.method.toLowerCase()}(${JSON.stringify(normalizedRoutePath)}, async (req: Request, res: Response) => {
    try {${threadIdLine}
      const state: Partial<${toPascalCase(ctx.graphId)}StateUpdateType> = ${stateInit};${preInvokeBlock}
      
      // Async background execution: acknowledge caller immediately with 202 Accepted
      res.status(202).json({ ok: true, status: "processing"${hasMemory ? `, threadId` : ""} });

      // Run graph asynchronously with promise rejection handling
      ${graphVarName}.invoke(state${configLine}).then((result) => {${postInvokeBlock}
        console.log("[${route.method} ${normalizedRoutePath}] Async background execution completed:", result);
      }).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[${route.method} ${normalizedRoutePath}] Async background error:", message);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[${route.method} ${normalizedRoutePath}] error:", message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: message });
      }
    }
  });`;
      }

      // Default Sync REST Response Mode
      const resultExpr =
        route.responseOutputMode === "selected" &&
        route.responseFields &&
        route.responseFields.length > 0
          ? `{\n${route.responseFields.map((f) => `        ${JSON.stringify(f)}: (result && typeof result === "object" && ${JSON.stringify(f)} in result) ? (result as Record<string, string | number | boolean | object>)[${JSON.stringify(f)}] : undefined`).join(",\n")}\n      }`
          : "result";

      return `
  ${comment}
  app.${route.method.toLowerCase()}(${JSON.stringify(normalizedRoutePath)}, async (req: Request, res: Response) => {
    try {${threadIdLine}
      const state: Partial<${toPascalCase(ctx.graphId)}StateUpdateType> = ${stateInit};${preInvokeBlock}
      const result = await ${graphVarName}.invoke(state${configLine});${postInvokeBlock}
      res.json({ ok: true, result: ${resultExpr} });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[${route.method} ${normalizedRoutePath}] error:", message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: message });
      }
    }
  });`;
    })
    .join("\n");

  const portEnvLine = `const PORT = Number(process.env.PORT ?? 3001);`;
  const agentLabel = escapeStr(ctx.input.graphLabel || "LangGraph Agent");

  return `import "dotenv/config";
import express, { type Request, type Response } from "express";
import { ${graphVarName} } from "./graph.js";
import type { ${toPascalCase(ctx.graphId)}StateUpdateType } from "./state.js";

/**
 * HTTP Server for ${agentLabel}
 *
 * Auto-generated by Dezign2App — exposes the LangGraph agent over HTTP.
 * Each route corresponds to a connected endpoint or event on the main canvas.
 *
 * Start: ts-node src/server.ts  (or compile and run dist/server.js)
 */

const app = express();
app.use(express.json());
${portEnvLine}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, agent: ${JSON.stringify(agentLabel)} });
});

// ── Agent routes ──────────────────────────────────────────────────────────────
${routeHandlers}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(\`🤖 ${agentLabel} running on http://localhost:\${PORT}\`);
  console.log("Routes:");
${deduped.map((r) => {
  const normPath = r.path.startsWith("/") ? r.path : `/${r.path}`;
  return `  console.log("  ${r.method.padEnd(6)} http://localhost:\${PORT}${normPath}");`;
}).join("\n")}
  console.log("  GET    http://localhost:\${PORT}/health");
});
`;
}

export function buildExpressDtsFile(): string {
  return `declare module "express" {
  export interface Request {
    body?: Record<string, string | number | boolean | object | null | undefined>;
    headers: Record<string, string | string[] | undefined>;
    params: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    on(event: string, listener: () => void): this;
  }
  export interface Response {
    status(code: number): this;
    json(body: Record<string, string | number | boolean | object | null | undefined> | boolean | string | number): this;
    setHeader(name: string, value: string): this;
    write(chunk: string): boolean;
    end(): this;
    headersSent: boolean;
  }
  export type RequestHandler = (
    req: Request,
    res: Response,
    next?: () => void,
  ) => void | Promise<void>;
  export interface ExpressApp {
    use(middleware: RequestHandler): this;
    get(path: string, handler: RequestHandler): this;
    post(path: string, handler: RequestHandler): this;
    put(path: string, handler: RequestHandler): this;
    delete(path: string, handler: RequestHandler): this;
    listen(port: number, callback?: () => void): void;
  }
  function express(): ExpressApp;
  namespace express {
    export function json(): RequestHandler;
    export type { Request, Response };
  }
  export default express;
}
`;
}
