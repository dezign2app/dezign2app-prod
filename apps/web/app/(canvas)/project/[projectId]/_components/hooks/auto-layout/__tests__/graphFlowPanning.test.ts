import { describe, it, expect, vi } from "vitest";
import { performGraphLayout, getGraphFlowNodes } from "../graphLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("GraphView Auto Layout - Flow-focused Panning (Start to End)", () => {
  it("extracts flow nodes from entry to sink while ignoring types and disconnected nodes", () => {
    const nodes: LayoutNode[] = [
      {
        id: "webApp-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "Web Portal" },
      },
      {
        id: "gateway-1",
        type: "gateway",
        position: { x: 0, y: 0 },
        data: { label: "API Gateway" },
      },
      {
        id: "service-users",
        type: "microservice",
        position: { x: 0, y: 0 },
        data: { label: "User Service" },
      },
      {
        id: "queue-notifications",
        type: "queue",
        position: { x: 0, y: 0 },
        data: { label: "Notification Queue" },
      },
      {
        id: "types-global",
        type: "types",
        position: { x: -300, y: 0 },
        data: { label: "Global Types" },
      },
      {
        id: "entity-user",
        type: "entity",
        position: { x: 0, y: 0 },
        data: { label: "User Entity" },
      },
      {
        id: "service-dangling",
        type: "microservice",
        position: { x: 1000, y: 1000 },
        data: { label: "Disconnected Service" },
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "webApp-1", target: "gateway-1", type: "connection" },
      { id: "e2", source: "gateway-1", target: "service-users", type: "connection" },
      { id: "e3", source: "service-users", target: "queue-notifications", type: "connection" },
    ];

    const flowNodes = getGraphFlowNodes(nodes, edges);
    const flowNodeIds = flowNodes.map((n) => n.id);

    // Should include connected architecture flow nodes
    expect(flowNodeIds).toContain("webApp-1");
    expect(flowNodeIds).toContain("gateway-1");
    expect(flowNodeIds).toContain("service-users");
    expect(flowNodeIds).toContain("queue-notifications");

    // Must ignore auxiliary and definition nodes
    expect(flowNodeIds).not.toContain("types-global");
    expect(flowNodeIds).not.toContain("entity-user");

    // Must ignore disconnected nodes
    expect(flowNodeIds).not.toContain("service-dangling");
  });

  it("passes only the flow nodes to fitView during performGraphLayout", () => {
    const nodes: LayoutNode[] = [
      { id: "webApp-1", type: "webApp", position: { x: 0, y: 0 }, data: {} },
      { id: "service-orders", type: "microservice", position: { x: 0, y: 0 }, data: {} },
      { id: "types-order", type: "types", position: { x: 0, y: 0 }, data: {} },
      { id: "orphan-service", type: "microservice", position: { x: 0, y: 0 }, data: {} },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "webApp-1", target: "service-orders", type: "connection" },
    ];

    vi.useFakeTimers();
    const fitView = vi.fn();
    const onNodesChange = vi.fn();

    performGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
    });

    vi.runAllTimers();
    vi.useRealTimers();

    expect(fitView).toHaveBeenCalledTimes(1);
    const fitViewArgs = fitView.mock.calls[0]![0];

    expect(fitViewArgs).toBeDefined();
    expect(fitViewArgs.nodes).toBeDefined();

    const targetedIds = fitViewArgs.nodes.map((n: { id: string }) => n.id);
    expect(targetedIds).toEqual(["webApp-1", "service-orders"]);
    expect(targetedIds).not.toContain("types-order");
    expect(targetedIds).not.toContain("orphan-service");
  });
});
