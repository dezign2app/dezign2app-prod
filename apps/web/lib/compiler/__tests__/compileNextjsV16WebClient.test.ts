import { describe, it, expect } from "vitest";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

describe("compileNextjsV16WebClient with Bearer token & headers", () => {
  it("should generate lib/auth-token.ts and pass Bearer token to authenticated endpoints", () => {
    const webClientNode: BackendNode = {
      id: "node-client-1",
      type: "webClient",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/dashboard",
        appSlug: "customer-portal",
        requireAuth: true,
        headers: [
          { id: "h1", name: "X-Client-Id", type: "string", required: true, value: "client-123" },
        ],
        queryParams: [
          { id: "q1", name: "source", type: "string", required: true, value: "web" },
        ],
        requestBody: {
          id: "b1",
          rawJson: JSON.stringify({ action: "test-action" }),
        },
        events: [
          {
            id: "evt-load-1",
            name: "pageLoad",
            event: "pageLoad",
          },
          {
            id: "evt-btn-1",
            name: "SubmitOrder",
            event: "click",
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-1",
      type: "service",
      position: { x: 400, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "OrderService",
        port: "8080",
        endpoints: [],
      },
    };

    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-get-orders",
        nodeId: "node-service-1",
        name: "/api/orders",
        type: "GET",
        requireAuth: true,
      },
      {
        id: "ep-post-order",
        nodeId: "node-service-1",
        name: "/api/orders",
        type: "POST",
        requireAuth: true,
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-1",
        source: "node-client-1",
        target: "node-service-1",
        sourceHandle: "events-evt-load-1",
        targetHandle: "endpoint-in-ep-get-orders",
        type: "connection",
      },
      {
        id: "edge-2",
        source: "node-client-1",
        target: "node-service-1",
        sourceHandle: "events-evt-btn-1",
        targetHandle: "endpoint-in-ep-post-order",
        type: "connection",
      },
    ];

    const result = compileNextjsV16WebClient(
      [webClientNode],
      endpoints,
      [],
      [webClientNode, serviceNode],
      edges,
      "TestProject",
    );

    // 1. Verify lib/auth-token.ts was generated
    const authTokenFile = result.files.find((f) => f.filename === "lib/auth-token.ts");
    expect(authTokenFile).toBeDefined();
    expect(authTokenFile?.content).toContain("export async function getAuthBearerToken()");

    // 2. Verify page.tsx includes Bearer token and headers in pageLoad
    const pageFile = result.files.find((f) => f.filename.endsWith("page.tsx"));
    expect(pageFile).toBeDefined();
    expect(pageFile?.content).toContain("getAuthBearerToken");
    expect(pageFile?.content).toContain("X-Client-Id");
    expect(pageFile?.content).toContain("Authorization");

    // 3. Verify action button component passes requireAuth = true
    const actionFile = result.files.find((f) => f.filename.endsWith("Action.tsx"));
    expect(actionFile).toBeDefined();
    expect(actionFile?.content).toContain("true"); // requireAuth boolean
    expect(actionFile?.content).toContain("X-Client-Id");
  });

  it("should handle endpoints with requireAuth: false without requiring token", () => {
    const webClientNode: BackendNode = {
      id: "node-client-2",
      type: "webClient",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/public",
        appSlug: "web-app",
        events: [
          {
            id: "evt-btn-2",
            name: "PublicPing",
            event: "click",
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-2",
      type: "service",
      position: { x: 400, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "PublicService",
        port: "8081",
        endpoints: [],
      },
    };

    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-ping",
        nodeId: "node-service-2",
        name: "/api/ping",
        type: "GET",
        requireAuth: false,
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-ping",
        source: "node-client-2",
        target: "node-service-2",
        sourceHandle: "events-evt-btn-2",
        targetHandle: "endpoint-in-ep-ping",
        type: "connection",
      },
    ];

    const result = compileNextjsV16WebClient(
      [webClientNode],
      endpoints,
      [],
      [webClientNode, serviceNode],
      edges,
      "TestProject",
    );

    const actionFile = result.files.find((f) => f.filename.endsWith("Action.tsx"));
    expect(actionFile).toBeDefined();
    expect(actionFile?.content).toContain("false"); // requireAuth boolean is false
  });
});
