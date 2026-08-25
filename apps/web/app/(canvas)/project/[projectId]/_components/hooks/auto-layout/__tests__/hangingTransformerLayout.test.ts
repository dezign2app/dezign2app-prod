import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import { layoutHangingTransformerNodes } from "../hangingTransformerLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("hangingTransformerLayout - Auto-Layout for Hanging Transformers", () => {
  it("positions a local transformer in a dedicated column right before the service node it is connected to", () => {
    const nodes: LayoutNode[] = [
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "Web App" },
      },
      {
        id: "web-client-1",
        type: "webClient",
        position: { x: 0, y: 0 },
        data: { label: "Page Client" },
      },
      {
        id: "trans-local-1",
        type: "transformer",
        position: { x: 0, y: 0 },
        data: {
          label: "Data Transformer",
          scope: "local",
          functionName: "transformData",
        },
      },
      {
        id: "service-products",
        type: "service",
        position: { x: 0, y: 0 },
        data: {
          label: "products",
          endpoints: [{ id: "ep-test", name: "GET test" }],
        },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-web-client",
        source: "web-app-1",
        target: "web-client-1",
        type: "connection",
      },
      {
        id: "e-client-service",
        source: "web-client-1",
        target: "service-products",
        targetHandle: "endpoint-in-ep-test",
        type: "connection",
      },
      {
        id: "e-trans-service",
        source: "trans-local-1",
        target: "service-products",
        sourceHandle: "transformer-out",
        targetHandle: "endpoint-in-ep-test",
        type: "connection",
      },
    ];

    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };

    const fitView = vi.fn();

    performGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
      storeEndpoints: [{ id: "ep-test", nodeId: "service-products" }],
    });

    expect(appliedChanges.length).toBe(4);

    const posMap = new Map(
      appliedChanges.map((c) => [c.id, c.position]),
    );

    const webAppPos = posMap.get("web-app-1")!;
    const webClientPos = posMap.get("web-client-1")!;
    const transPos = posMap.get("trans-local-1")!;
    const servicePos = posMap.get("service-products")!;

    // 1. Service is furthest right in this chain
    expect(servicePos.x).toBeGreaterThan(transPos.x);

    // 2. Transformer is in its dedicated column immediately before service
    // Transformer width is 240, gap is 80 -> transformer X should be ~ servicePos.x - 320
    expect(transPos.x).toBeLessThan(servicePos.x);
    expect(servicePos.x - (transPos.x + 240)).toBeCloseTo(80, 0);

    // 3. Web client is upstream to the left of the transformer column
    expect(webClientPos.x).toBeLessThan(transPos.x);
    expect(webAppPos.x).toBeLessThan(webClientPos.x);
  });

  it("positions global transformer_ref right before the service while master transformer remains separate", () => {
    const nodes: LayoutNode[] = [
      {
        id: "master-global-trans",
        type: "transformer",
        position: { x: 0, y: 0 },
        data: {
          label: "global Data Transformer",
          scope: "global",
          functionName: "globalDataTransformer",
        },
      },
      {
        id: "trans-ref-1",
        type: "transformer_ref",
        position: { x: 0, y: 0 },
        data: {
          label: "global Data Tran... (Ref)",
          transformerRef: "master-global-trans",
        },
      },
      {
        id: "service-products",
        type: "service",
        position: { x: 0, y: 0 },
        data: {
          label: "products",
          endpoints: [{ id: "ep-demo", name: "GET demo" }],
        },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-ref-link",
        source: "master-global-trans",
        target: "trans-ref-1",
        type: "transformer-reference",
      },
      {
        id: "e-ref-service",
        source: "trans-ref-1",
        target: "service-products",
        sourceHandle: "transformer-out",
        targetHandle: "endpoint-in-ep-demo",
        type: "connection",
      },
    ];

    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };

    const fitView = vi.fn();

    performGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
      storeEndpoints: [{ id: "ep-demo", nodeId: "service-products" }],
    });

    const posMap = new Map(
      appliedChanges.map((c) => [c.id, c.position]),
    );

    const refPos = posMap.get("trans-ref-1")!;
    const servicePos = posMap.get("service-products")!;

    // Transformer ref is positioned right before the service
    expect(refPos.x).toBeLessThan(servicePos.x);
    expect(servicePos.x - (refPos.x + 240)).toBeCloseTo(80, 0);
  });

  it("handles multiple hanging transformers on a single service with non-overlapping Y alignment", () => {
    const nodes: LayoutNode[] = [
      {
        id: "trans-local",
        type: "transformer",
        position: { x: 0, y: 0 },
        data: { label: "Local Transformer", scope: "local" },
      },
      {
        id: "trans-ref",
        type: "transformer_ref",
        position: { x: 0, y: 0 },
        data: { label: "Global Transformer Ref" },
      },
      {
        id: "service-1",
        type: "service",
        position: { x: 0, y: 0 },
        data: {
          label: "products",
          endpoints: [
            { id: "ep-1", name: "GET test" },
            { id: "ep-2", name: "GET demo" },
          ],
        },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-trans-1",
        source: "trans-local",
        target: "service-1",
        sourceHandle: "transformer-out",
        targetHandle: "endpoint-in-ep-1",
        type: "connection",
      },
      {
        id: "e-trans-2",
        source: "trans-ref",
        target: "service-1",
        sourceHandle: "transformer-out",
        targetHandle: "endpoint-in-ep-2",
        type: "connection",
      },
    ];

    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };

    const fitView = vi.fn();

    performGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
      storeEndpoints: [
        { id: "ep-1", nodeId: "service-1" },
        { id: "ep-2", nodeId: "service-1" },
      ],
    });

    const posMap = new Map(
      appliedChanges.map((c) => [c.id, c.position]),
    );

    const posLocal = posMap.get("trans-local")!;
    const posRef = posMap.get("trans-ref")!;
    const posService = posMap.get("service-1")!;

    // Both transformers share the same X column right before the service
    expect(posLocal.x).toEqual(posRef.x);
    expect(posService.x - (posLocal.x + 240)).toBeCloseTo(80, 0);

    // They must not overlap vertically: distance between their tops >= height (50) + gap (16) = 66
    const verticalDist = Math.abs(posLocal.y - posRef.y);
    expect(verticalDist).toBeGreaterThanOrEqual(66);
  });
});
