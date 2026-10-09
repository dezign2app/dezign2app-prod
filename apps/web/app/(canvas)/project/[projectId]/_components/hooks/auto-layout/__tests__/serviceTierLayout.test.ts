import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import { computeTierRanks } from "../serviceTierLayout";
import type { LayoutNode, LayoutEdge } from "../types";

describe("Service Tier Auto Layout - Level 1 alignment and intra-tier invocation", () => {
  it("aligns all client-invoked servers at Level 1, and downstream servers at Level 2", () => {
    const nodes: LayoutNode[] = [
      { id: "client", type: "webPage", position: { x: 0, y: 0 }, data: {} },
      { id: "service-1", type: "service", position: { x: 0, y: 0 }, data: {} },
      { id: "service-2", type: "service", position: { x: 0, y: 0 }, data: {} },
      { id: "service-3", type: "service", position: { x: 0, y: 0 }, data: {} },
      { id: "service-4", type: "service", position: { x: 0, y: 0 }, data: {} },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "client", target: "service-1", type: "connection" },
      { id: "e2", source: "client", target: "service-2", type: "connection" },
      { id: "e3", source: "service-1", target: "service-3", type: "connection" },
      { id: "e4", source: "service-2", target: "service-4", type: "connection" },
    ];

    const { assignedRankMap } = computeTierRanks({
      mainGraphNodes: nodes,
      flowEdges: edges,
    });

    expect(assignedRankMap.get("client")).toBe(0);
    expect(assignedRankMap.get("service-1")).toBe(1);
    expect(assignedRankMap.get("service-2")).toBe(1);
    expect(assignedRankMap.get("service-3")).toBe(2);
    expect(assignedRankMap.get("service-4")).toBe(2);
  });

  it("does not push service-2 to Level 2 when service-1 also invokes service-2", () => {
    // Client connects to service-1 and service-2.
    // service-1 also invokes service-2.
    // Both service-1 and service-2 must remain at Level 1.
    const nodes: LayoutNode[] = [
      { id: "client", type: "webPage", position: { x: 0, y: 0 }, data: {} },
      { id: "service-1", type: "service", position: { x: 0, y: 0 }, data: {} },
      { id: "service-2", type: "service", position: { x: 0, y: 0 }, data: {} },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "client", target: "service-1", type: "connection" },
      { id: "e2", source: "client", target: "service-2", type: "connection" },
      { id: "e3", source: "service-1", target: "service-2", type: "connection" },
    ];

    const { assignedRankMap, intraRankEdgeIds } = computeTierRanks({
      mainGraphNodes: nodes,
      flowEdges: edges,
    });

    expect(assignedRankMap.get("client")).toBe(0);
    expect(assignedRankMap.get("service-1")).toBe(1);
    expect(assignedRankMap.get("service-2")).toBe(1);
    expect(intraRankEdgeIds.has("e3")).toBe(true);
  });

  it("positions service-1 and service-2 at the same X coordinate in performGraphLayout", () => {
    const nodes: LayoutNode[] = [
      { id: "client", type: "webPage", position: { x: 0, y: 0 }, data: {} },
      { id: "service-1", type: "service", position: { x: 0, y: 0 }, data: {} },
      { id: "service-2", type: "service", position: { x: 0, y: 0 }, data: {} },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "client", target: "service-1", type: "connection" },
      { id: "e2", source: "client", target: "service-2", type: "connection" },
      { id: "e3", source: "service-1", target: "service-2", type: "connection" },
    ];

    const onNodesChange = vi.fn();
    const fitView = vi.fn();

    performGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
    });

    expect(onNodesChange).toHaveBeenCalled();
    const changes = onNodesChange.mock.calls[0]?.[0];

    const s1Pos = changes.find((c: any) => c.id === "service-1")?.position;
    const s2Pos = changes.find((c: any) => c.id === "service-2")?.position;
    const clientPos = changes.find((c: any) => c.id === "client")?.position;

    expect(s1Pos).toBeDefined();
    expect(s2Pos).toBeDefined();
    expect(clientPos).toBeDefined();

    // Both service nodes must be to the right of client
    expect(s1Pos.x).toBeGreaterThan(clientPos.x);
    expect(s2Pos.x).toBeGreaterThan(clientPos.x);

    // Both service nodes must be aligned at the exact same X column (Level 1)
    expect(s1Pos.x).toBeCloseTo(s2Pos.x, 1);

    // And they must not vertically overlap
    expect(Math.abs(s1Pos.y - s2Pos.y)).toBeGreaterThan(50);
  });
});
