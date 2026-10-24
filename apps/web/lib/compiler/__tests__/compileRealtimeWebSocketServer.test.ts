import { describe, it, expect } from "vitest";
import { generateConfigFiles, generateLibFiles, generateServerFile } from "../generators/configGenerator";
import { BackendNode } from "@/types/canvas";

describe("Realtime WebSocket Server Generation", () => {
  it("generates src/lib/websocket.ts with initWebSocketServer, room protection, and wsBroadcast", () => {
    const files = generateLibFiles(true, { ws: true });
    const wsFile = files.find((f) => f.filename === "src/lib/websocket.ts");
    const sseFile = files.find((f) => f.filename === "src/lib/sse.ts");
    const realtimeFile = files.find((f) => f.filename === "src/lib/realtime.ts");
    const indexFile = files.find((f) => f.filename === "src/lib/index.ts");

    expect(wsFile).toBeDefined();
    expect(wsFile?.content).toContain("export function initWebSocketServer(");
    expect(wsFile?.content).toContain("export function getWebSocketServer(");
    expect(wsFile?.content).toContain("export function wsBroadcast(");
    expect(wsFile?.content).toContain("new WebSocketServer({ server, path: \"/ws\" })");

    // Room subscription and protection logic
    expect(wsFile?.content).toContain('action === "join"');
    expect(wsFile?.content).toContain('action === "leave"');
    expect(wsFile?.content).toContain('action === "ping"');
    expect(wsFile?.content).toContain('room.startsWith("private:")');
    expect(wsFile?.content).toContain("Authentication required for private rooms");

    // Strict typing checks: no implicit or explicit any/unknown, typed callbacks
    expect(wsFile?.content).toContain('import { Server as HttpServer, IncomingMessage } from "http";');
    expect(wsFile?.content).toContain('import { WebSocketServer, WebSocket, RawData } from "ws";');
    expect(wsFile?.content).toContain('(ws: WebSocket, req: IncomingMessage)');
    expect(wsFile?.content).toContain('(raw: RawData)');
    expect(wsFile?.content).toContain('(err: Error)');
    expect(wsFile?.content).not.toMatch(/\(ws:\s*WebSocket,\s*req\)\s*=>/);
    expect(wsFile?.content).not.toMatch(/\(raw\)\s*=>/);
    expect(wsFile?.content).not.toMatch(/\(err\)\s*=>/);
    expect(wsFile?.content).not.toMatch(/:\s*any\b/);
    expect(wsFile?.content).not.toMatch(/:\s*unknown\b/);
    expect(wsFile?.content).not.toMatch(/\bas\s+any\b/);
    expect(wsFile?.content).not.toMatch(/\bas\s+unknown\b/);

    // SSE file should be omitted when only WS is enabled
    expect(sseFile).toBeUndefined();

    // Re-exported in realtime and index
    expect(realtimeFile).toBeDefined();
    expect(realtimeFile?.content).toContain('export * from "./websocket";');
    expect(realtimeFile?.content).not.toContain('export * from "./sse";');

    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toContain('export * from "./realtime";');
  });

  it("generates src/lib/sse.ts and omits websocket code when only SSE is configured", () => {
    const files = generateLibFiles(true, { sse: true });
    const sseFile = files.find((f) => f.filename === "src/lib/sse.ts");
    const wsFile = files.find((f) => f.filename === "src/lib/websocket.ts");
    const realtimeFile = files.find((f) => f.filename === "src/lib/realtime.ts");
    const indexFile = files.find((f) => f.filename === "src/lib/index.ts");

    expect(sseFile).toBeDefined();
    expect(sseFile?.content).toContain("export function handleSseConnection(");
    expect(sseFile?.content).toContain("export function sseBroadcast(");
    expect(sseFile?.content).not.toContain("WebSocketServer");
    expect(sseFile?.content).not.toContain("initWebSocketServer");
    expect(sseFile?.content).not.toContain('from "ws"');

    // WebSocket file should be omitted when only SSE is enabled
    expect(wsFile).toBeUndefined();

    // Realtime barrel re-exports only SSE
    expect(realtimeFile).toBeDefined();
    expect(realtimeFile?.content).toContain('export * from "./sse";');
    expect(realtimeFile?.content).not.toContain('export * from "./websocket";');
    expect(realtimeFile?.content).not.toContain("initWebSocketServer");

    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toContain('export * from "./realtime";');
  });

  it("omits src/lib/realtime.ts, sse.ts, websocket.ts and realtime exports when realtime is not enabled", () => {
    const files = generateLibFiles(true, false);
    const realtimeFile = files.find((f) => f.filename === "src/lib/realtime.ts");
    const sseFile = files.find((f) => f.filename === "src/lib/sse.ts");
    const wsFile = files.find((f) => f.filename === "src/lib/websocket.ts");
    const indexFile = files.find((f) => f.filename === "src/lib/index.ts");

    expect(realtimeFile).toBeUndefined();
    expect(sseFile).toBeUndefined();
    expect(wsFile).toBeUndefined();
    expect(indexFile).toBeDefined();
    expect(indexFile?.content).not.toContain('export * from "./realtime";');
    expect(indexFile?.content).toContain("export function formatResponse<T>");
  });

  it("generates src/index.ts with http.createServer and initWebSocketServer attached when enabled", () => {
    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "ChatService",
        port: "8080",
        enableWebSocket: true,
      },
    };

    const serverFile = generateServerFile(
      "ChatService",
      "8080",
      true,
      "*",
      serviceNode,
      [serviceNode],
      [],
    );
    expect(serverFile).toBeDefined();
    expect(serverFile.filename).toBe("src/index.ts");

    const content = serverFile.content;
    expect(content).toContain('import http from "http";');
    expect(content).toContain('import { initWebSocketServer } from "./lib";');
    expect(content).toContain("const server = http.createServer(app);");
    expect(content).toContain("initWebSocketServer(server);");
    expect(content).toContain("server.listen(PORT, () => {");
    expect(content).toContain('WebSocket realtime server at ws://localhost:${PORT}/ws');
    expect(content).not.toContain("SSE realtime stream");
  });

  it("includes ws and @types/ws in generated package.json when WebSocket is enabled", () => {
    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "OrderService",
        port: "8085",
        enableWebSocket: true,
      },
    };

    const files = generateConfigFiles(
      serviceNode,
      "order-service",
      "OrderService",
      "8085",
      true,
      [],
      [],
      [serviceNode],
      [],
    );

    const packageFile = files.find((f) => f.filename === "package.json");
    expect(packageFile).toBeDefined();

    const pkg = JSON.parse(packageFile!.content);
    expect(pkg.dependencies).toHaveProperty("ws");
    expect(pkg.devDependencies).toHaveProperty("@types/ws");
  });

  it("generates clean REST server without WebSocket or SSE when not configured", () => {
    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "ConversationsService",
        port: "8080",
      },
    };

    const serverFile = generateServerFile(
      "ConversationsService",
      "8080",
      true,
      "*",
      serviceNode,
      [serviceNode],
      [],
    );
    expect(serverFile).toBeDefined();

    const content = serverFile.content;
    // Clean express setup
    expect(content).toContain("app.listen(PORT, () => {");
    expect(content).not.toContain('import http from "http";');
    expect(content).not.toContain("initWebSocketServer");
    expect(content).not.toContain("handleSseConnection");
    expect(content).not.toContain("WebSocket realtime server");
    expect(content).not.toContain("SSE realtime stream");
    expect(content).not.toContain("/events");
    expect(content).not.toContain("/sse");
    expect(content).not.toContain("/ws");

    // Package.json should not have ws
    const configFiles = generateConfigFiles(
      serviceNode,
      "conversations",
      "ConversationsService",
      "8080",
      true,
      [],
      [],
      [serviceNode],
      [],
    );
    const packageFile = configFiles.find((f) => f.filename === "package.json");
    const pkg = JSON.parse(packageFile!.content);
    expect(pkg.dependencies).not.toHaveProperty("ws");
    expect(pkg.devDependencies).not.toHaveProperty("@types/ws");
  });

  it("generates SSE-only server when only SSE is configured", () => {
    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "EventsService",
        port: "8080",
        enableSse: true,
      },
    };

    const serverFile = generateServerFile(
      "EventsService",
      "8080",
      true,
      "*",
      serviceNode,
      [serviceNode],
      [],
    );
    expect(serverFile).toBeDefined();

    const content = serverFile.content;
    expect(content).toContain('import { handleSseConnection } from "./lib";');
    expect(content).toContain('app.get("/events", handleSseConnection);');
    expect(content).toContain('app.get("/sse", handleSseConnection);');
    expect(content).toContain('SSE realtime stream at http://localhost:${PORT}/events');
    expect(content).not.toContain("initWebSocketServer");
    expect(content).not.toContain("WebSocket realtime server");
  });

  it("does not include ws or @types/ws in package.json when only SSE is enabled", () => {
    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "EventsService",
        port: "8080",
        enableSse: true,
      },
    };

    const configFiles = generateConfigFiles(
      serviceNode,
      "events-service",
      "EventsService",
      "8080",
      true,
      [],
      [],
      [serviceNode],
      [],
    );
    const packageFile = configFiles.find((f) => f.filename === "package.json");
    expect(packageFile).toBeDefined();

    const pkg = JSON.parse(packageFile!.content);
    expect(pkg.dependencies).not.toHaveProperty("ws");
    expect(pkg.devDependencies).not.toHaveProperty("@types/ws");
  });
});
