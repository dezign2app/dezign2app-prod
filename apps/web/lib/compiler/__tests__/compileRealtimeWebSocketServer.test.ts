import { describe, it, expect } from "vitest";
import { generateConfigFiles, generateLibFiles, generateServerFile } from "../generators/configGenerator";
import { BackendNode } from "@/types/canvas";

describe("Realtime WebSocket Server Generation", () => {
  it("generates src/lib/realtime.ts with initWebSocketServer, room protection, and wsBroadcast", () => {
    const files = generateLibFiles(true, true);
    const realtimeFile = files.find((f) => f.filename === "src/lib/realtime.ts");
    const indexFile = files.find((f) => f.filename === "src/lib/index.ts");

    expect(realtimeFile).toBeDefined();
    expect(realtimeFile?.content).toContain("export function initWebSocketServer(");
    expect(realtimeFile?.content).toContain("export function getWebSocketServer(");
    expect(realtimeFile?.content).toContain("export function wsBroadcast(");
    expect(realtimeFile?.content).toContain("new WebSocketServer({ server, path: \"/ws\" })");

    // Room subscription and protection logic
    expect(realtimeFile?.content).toContain('action === "join"');
    expect(realtimeFile?.content).toContain('action === "leave"');
    expect(realtimeFile?.content).toContain('action === "ping"');
    expect(realtimeFile?.content).toContain('room.startsWith("private:")');
    expect(realtimeFile?.content).toContain("Authentication required for private rooms");

    // Re-exported in index
    expect(indexFile).toBeDefined();
    expect(indexFile?.content).toContain('export * from "./realtime";');
  });

  it("omits src/lib/realtime.ts and realtime exports when realtime is not enabled", () => {
    const files = generateLibFiles(true, false);
    const realtimeFile = files.find((f) => f.filename === "src/lib/realtime.ts");
    const indexFile = files.find((f) => f.filename === "src/lib/index.ts");

    expect(realtimeFile).toBeUndefined();
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
});
