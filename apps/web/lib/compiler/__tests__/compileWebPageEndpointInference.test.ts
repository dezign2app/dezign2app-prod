import { describe, it, expect } from "vitest";
import { compileNextjsV16WebClient } from "../webClients/nextjs/v16";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, CompiledFile } from "@workspace/canvas/types";

describe("compileNextjsV16WebClient - Request Types & Inferred Form UI", () => {
  it("should infer TypeScript request types and generate interactive form inputs for field_builder endpoint", () => {
    const webPageNode: BackendNode = {
      id: "node-client-1",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Users Page",
        appSlug: "web-app",
        events: [
          {
            id: "evt-create-user",
            name: "Create User",
            event: "click",
            headers: [
              { id: "h1", name: "X-Tenant-Id", type: "string", required: true, defaultValue: "tenant_123" },
            ],
            pathParams: [
              { id: "p1", name: "orgId", type: "string", required: true, defaultValue: "org_456" },
            ],
            queryParams: [
              { id: "q1", name: "notifyAdmin", type: "boolean", required: false, defaultValue: "true" },
            ],
            requestBodyMode: "field_builder",
            requestBody: {
              id: "sb-1",
              fields: [
                { id: "f1", name: "fullName", type: "string", required: true },
                { id: "f2", name: "userAge", type: "number", required: false, defaultValue: "25" },
                { id: "f3", name: "isAdmin", type: "boolean", required: true },
                { id: "f4", name: "metadata", type: "object", required: false },
              ],
            },
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
        label: "UserService",
        port: "8080",
        endpoints: [],
      },
    };

    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-create-user",
        nodeId: "node-service-1",
        name: "/api/orgs/:orgId/users",
        type: "POST",
        pathParams: [
          { id: "p1", name: "orgId", type: "string", required: true },
        ],
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-1",
        source: "node-client-1",
        target: "node-service-1",
        sourceHandle: "events-evt-create-user",
        targetHandle: "endpoint-in-ep-create-user",
        type: "connection",
        fractionalIndex: "a0",
      },
    ];

    const result = compileNextjsV16WebClient(
      [webPageNode],
      endpoints,
      [],
      [webPageNode, serviceNode],
      edges,
      "Monorepo App",
    );

    // Verify Action component file exists
    const actionFile = result.files.find((f: CompiledFile) =>
      f.filename.endsWith("CreateUserAction.tsx"),
    );
    expect(actionFile).toBeDefined();
    const content = actionFile?.content || "";

    // 1. Verify TypeScript interfaces
    expect(content).toContain("export interface CreateUserActionPathParams");
    expect(content).toContain("orgId: string;");
    expect(content).toContain("export interface CreateUserActionQueryParams");
    expect(content).toContain("notifyAdmin?: boolean;");
    expect(content).toContain("export interface CreateUserActionHeaders");
    expect(content).toContain('"X-Tenant-Id": string;');
    expect(content).toContain("export interface CreateUserActionRequestBody");
    expect(content).toContain("fullName: string;");
    expect(content).toContain("userAge?: number;");
    expect(content).toContain("isAdmin: boolean;");
    expect(content).toContain("metadata?: Record<string, unknown>;");
    expect(content).toContain("export interface CreateUserActionRequestPayload");

    // 2. Verify form inputs
    expect(content).toContain(":orgId");
    expect(content).toContain("notifyAdmin");
    expect(content).toContain("X-Tenant-Id");
    expect(content).toContain("fullName");
    expect(content).toContain("userAge");
    expect(content).toContain("isAdmin");
    expect(content).toContain("metadata");

    // 3. Verify URL interpolation & QueryString logic
    expect(content).toContain("computeFinalUrl");
    expect(content).toContain("URLSearchParams");
    expect(content).toContain("handleFormSubmit");
    expect(content).toContain("onTrigger");
  });

  it("should infer TypeScript types and render JSON textarea for raw_json endpoint", () => {
    const webPageNode: BackendNode = {
      id: "node-client-2",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Checkout Page",
        appSlug: "web-app",
        events: [
          {
            id: "evt-checkout",
            name: "Submit Checkout",
            event: "submit",
            requestBodyMode: "raw_json",
            requestBody: {
              id: "sb-2",
              rawJson: JSON.stringify({
                cartId: "cart_999",
                discountCode: "SUMMER",
                itemsCount: 3,
                isExpress: true,
              }),
            },
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
        label: "PaymentService",
        port: "8085",
        endpoints: [],
      },
    };

    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-checkout",
        nodeId: "node-service-2",
        name: "/api/checkout",
        type: "POST",
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-checkout",
        source: "node-client-2",
        target: "node-service-2",
        sourceHandle: "events-evt-checkout",
        targetHandle: "endpoint-in-ep-checkout",
        type: "connection",
        fractionalIndex: "a0",
      },
    ];

    const result = compileNextjsV16WebClient(
      [webPageNode],
      endpoints,
      [],
      [webPageNode, serviceNode],
      edges,
      "Monorepo App",
    );

    const actionFile = result.files.find((f: CompiledFile) =>
      f.filename.endsWith("SubmitCheckoutAction.tsx"),
    );
    expect(actionFile).toBeDefined();
    const content = actionFile?.content || "";

    // Inferred types from JSON
    expect(content).toContain("export interface SubmitCheckoutActionRequestBody");
    expect(content).toContain("cartId?: string;");
    expect(content).toContain("discountCode?: string;");
    expect(content).toContain("itemsCount?: number;");
    expect(content).toContain("isExpress?: boolean;");

    // Raw JSON Textarea
    expect(content).toContain("rawJsonBody");
    expect(content).toContain("Request Body (JSON)");
    expect(content).toContain("jsonError");
  });
});
