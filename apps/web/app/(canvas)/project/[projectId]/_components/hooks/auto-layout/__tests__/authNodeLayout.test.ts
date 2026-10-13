import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import { AUTH_WEBAPP_GAP } from "../authNodeLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("authNodeLayout - Auto-Layout for Better Auth and WebApp", () => {
  it("positions Auth node behind (to the left of) the connected WebApp node and not in the servers line", () => {
    const nodes: LayoutNode[] = [
      {
        id: "auth-1",
        type: "auth",
        position: { x: 0, y: 0 },
        data: { label: "Auth" },
      },
      {
        id: "web-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "web" },
      },
      {
        id: "service-1",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "API Service" },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-auth-web",
        source: "auth-1",
        target: "web-1",
        sourceHandle: "auth-out",
        targetHandle: "auth-in",
        type: "connection",
      },
      {
        id: "e-web-service",
        source: "web-1",
        target: "service-1",
        type: "connection",
      },
    ];

    let appliedChanges: PositionNodeChange[] = [];
    performGraphLayout({
      nodes,
      edges,
      onNodesChange: (c) => {
        appliedChanges = c;
      },
      fitView: vi.fn(),
      direction: "LR",
    });

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const authPos = posMap.get("auth-1")!;
    const webPos = posMap.get("web-1")!;
    const servicePos = posMap.get("service-1")!;

    expect(authPos).toBeDefined();
    expect(webPos).toBeDefined();
    expect(servicePos).toBeDefined();

    // 1. Auth node must be strictly to the left of the connected WebApp node
    expect(authPos.x).toBeLessThan(webPos.x);

    // 2. WebApp node must be to the left of backend servers
    expect(webPos.x).toBeLessThan(servicePos.x);

    // 3. Auth gap to WebApp is cleanly separated (200px gap)
    // Auth width is 300
    expect(webPos.x - (authPos.x + 300)).toBeCloseTo(AUTH_WEBAPP_GAP, 0);

    // 4. Auth top Y is aligned with WebApp top Y
    expect(authPos.y).toBeCloseTo(webPos.y, 0);
  });

  it("positions Auth node behind WebApp when connected via authNodeId data property", () => {
    const nodes: LayoutNode[] = [
      {
        id: "auth-1",
        type: "auth",
        position: { x: 0, y: 0 },
        data: { label: "Auth" },
      },
      {
        id: "web-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "web", authNodeId: "auth-1" },
      },
    ];

    const edges: LayoutEdge[] = [];

    let appliedChanges: PositionNodeChange[] = [];
    performGraphLayout({
      nodes,
      edges,
      onNodesChange: (c) => {
        appliedChanges = c;
      },
      fitView: vi.fn(),
      direction: "LR",
    });

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const authPos = posMap.get("auth-1")!;
    const webPos = posMap.get("web-1")!;

    expect(authPos.x).toBeLessThan(webPos.x);
    expect(webPos.x - (authPos.x + 300)).toBeCloseTo(AUTH_WEBAPP_GAP, 0);
  });
});
