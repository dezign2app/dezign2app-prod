import { describe, it, expect } from "vitest";
import { generateServiceUnitTests } from "../generators/testGenerator";
import { Endpoint, SimulationTestCase } from "@workspace/canvas/types";

describe("Service Unit Test Generation - Strict Typing", () => {
  it("should generate strongly-typed unit tests importing from @workspace/types without any or unknown", () => {
    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-create-order",
        nodeId: "srv-orders",
        name: "/orders",
        type: "POST",
        summary: "Create a new order",
        pathParams: [],
        queryParams: [],
        requestBody: {
          id: "ep-create-order",
          fields: [
            { id: "f1", name: "item", type: "string", required: true },
            { id: "f2", name: "quantity", type: "number", required: true },
          ],
        },
      },
    ];

    const testCases: SimulationTestCase[] = [
      {
        id: "tc-order-valid",
        targetNodeId: "srv-orders",
        targetEventId: "ep-create-order",
        name: "Valid Order Request",
        expectedStatus: 201,
        request: {
          headers: { "content-type": "application/json" },
          params: {},
          body: { item: "Widget", quantity: 5 },
        },
      },
    ];

    const files = generateServiceUnitTests("OrderService", endpoints, testCases);

    expect(files.length).toBeGreaterThan(0);
    const testFile = files[0];
    expect(testFile.filename).toBe("tests/unit/postOrders_validOrderRequest.unit.test.ts");

    // 1. Must import generated types from @workspace/types
    expect(testFile.content).toContain('from "@workspace/types"');
    expect(testFile.content).toContain("OrderServicePostOrdersParams");
    expect(testFile.content).toContain("OrderServicePostOrdersBody");

    // 2. Must not contain any or unknown
    expect(testFile.content).not.toContain(": any");
    expect(testFile.content).not.toContain(": unknown");
    expect(testFile.content).not.toContain("as any");
    expect(testFile.content).not.toContain("as unknown");
    expect(testFile.content).not.toContain("as OrderService");
  });

  it("should generate clean healthRoute unit test with zero any casting", () => {
    const files = generateServiceUnitTests("PaymentService", []);
    expect(files.length).toBe(1);
    const healthTest = files[0];
    expect(healthTest.filename).toBe("tests/unit/healthRoute.unit.test.ts");
    expect(healthTest.content).not.toContain(": any");
    expect(healthTest.content).not.toContain(": unknown");
    expect(healthTest.content).not.toContain("as any");
  });
});
