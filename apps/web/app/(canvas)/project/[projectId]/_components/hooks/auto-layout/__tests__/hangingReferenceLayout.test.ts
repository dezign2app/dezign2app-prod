import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("hangingReferenceLayout - Auto-Layout for Hanging Reference Nodes (DB Ref & Redis Cache)", () => {
  it("positions db_ref and redis-cache nodes in a dedicated column right after the service node", () => {
    const nodes: LayoutNode[] = [
      {
        id: "service-products",
        type: "service",
        position: { x: 0, y: 0 },
        data: {
          label: "products",
          endpoints: [{ id: "ep-test", name: "GET test" }],
        },
      },
      {
        id: "redis-cache-1",
        type: "redis-cache",
        position: { x: 0, y: 0 },
        data: { label: "Products cache" },
      },
      {
        id: "db-ref-1",
        type: "db_ref",
        position: { x: 0, y: 0 },
        data: { label: "products" },
      },
      {
        id: "kafka-1",
        type: "kafka",
        position: { x: 0, y: 0 },
        data: { label: "Kafka" },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-service-redis",
        source: "service-products",
        target: "redis-cache-1",
        sourceHandle: "endpoint-out-ep-test",
        targetHandle: "database-target",
        type: "connection",
      },
      {
        id: "e-service-db",
        source: "service-products",
        target: "db-ref-1",
        sourceHandle: "endpoint-out-ep-test",
        targetHandle: "database-target",
        type: "connection",
      },
      {
        id: "e-service-kafka",
        source: "service-products",
        target: "kafka-1",
        sourceHandle: "endpoint-out-ep-test",
        targetHandle: "topic-in",
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
      storeEndpoints: [{ id: "ep-test", nodeId: "service-products", name: "ep-test", type: "GET" }],
    });

    expect(appliedChanges.length).toBe(4);

    const posMap = new Map(
      appliedChanges.map((c) => [c.id, c.position]),
    );

    const servicePos = posMap.get("service-products")!;
    const redisPos = posMap.get("redis-cache-1")!;
    const dbRefPos = posMap.get("db-ref-1")!;
    const kafkaPos = posMap.get("kafka-1")!;

    // 1. Both reference nodes are placed to the right of the service node (servicePos.x + serviceWidth + gap)
    expect(redisPos.x).toBeGreaterThan(servicePos.x);
    expect(dbRefPos.x).toBeGreaterThan(servicePos.x);
    expect(redisPos.x).toBeCloseTo(dbRefPos.x, 0);

    // 2. Both reference nodes do not vertically overlap
    const redisTop = redisPos.y;
    const redisBottom = redisPos.y + 80;
    const dbTop = dbRefPos.y;
    const dbBottom = dbRefPos.y + 80;

    const overlaps =
      Math.max(redisTop, dbTop) < Math.min(redisBottom, dbBottom);
    expect(overlaps).toBe(false);

    // 3. Kafka is in the downstream DAG flow and pushed strictly to the right of the reference node column
    expect(kafkaPos.x).toBeGreaterThanOrEqual(dbRefPos.x + 240);
  });
});
