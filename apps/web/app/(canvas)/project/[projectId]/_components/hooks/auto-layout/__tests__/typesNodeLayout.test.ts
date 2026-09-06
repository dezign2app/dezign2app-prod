import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("typesNodeLayout - Auto-Layout for TypesNode", () => {
  it("parks a single package types node in Column 1 (x: 60) and shifts WebApp to the right", () => {
    const nodes: LayoutNode[] = [
      {
        id: "types-pkg-xyflow",
        type: "types",
        position: { x: 0, y: 0 },
        data: {
          label: "@xyflow/react",
          isPackageNode: true,
          types: [{ id: "t1", name: "Node", kind: "type" }],
        },
      },
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "Web App" },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-types-webapp",
        source: "types-pkg-xyflow",
        target: "web-app-1",
        type: "type-reference",
        sourceHandle: "types-out",
        targetHandle: "types-in",
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
    });

    expect(appliedChanges.length).toBe(2);

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const typesPos = posMap.get("types-pkg-xyflow")!;
    const webAppPos = posMap.get("web-app-1")!;

    // 1. Types node is parked in Column 1 at x: 60
    expect(typesPos.x).toBe(60);
    expect(typesPos.y).toBe(60);

    // 2. WebApp starts safely to the right of the Types section (col1 width 270 + separation 200 = 530)
    expect(webAppPos.x).toBeGreaterThanOrEqual(530);

    // 3. Types node has correct handle orientations for left-to-right edge routing
    const typesChange = appliedChanges.find((c) => c.id === "types-pkg-xyflow")!;
    expect(typesChange.sourcePosition).toBe("right");
    expect(typesChange.targetPosition).toBe("left");
  });

  it("stacks multiple base types nodes vertically in Column 1 with clean row spacing", () => {
    const nodes: LayoutNode[] = [
      {
        id: "types-pkg-1",
        type: "types",
        position: { x: 0, y: 0 },
        data: {
          label: "@xyflow/react",
          isPackageNode: true,
          types: [{ id: "t1", name: "Node", kind: "type" }],
        },
      },
      {
        id: "types-pkg-2",
        type: "types",
        position: { x: 0, y: 0 },
        data: {
          label: "lucide-react",
          isPackageNode: true,
          types: [{ id: "t2", name: "Icon", kind: "type" }],
        },
      },
    ];

    const edges: LayoutEdge[] = [];

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
    });

    expect(appliedChanges.length).toBe(2);

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const pos1 = posMap.get("types-pkg-1")!;
    const pos2 = posMap.get("types-pkg-2")!;

    // Both are in Column 1
    expect(pos1.x).toBe(60);
    expect(pos2.x).toBe(60);

    // Stacked vertically
    expect(pos2.y).toBeGreaterThan(pos1.y);
  });

  it("places extended types nodes in Column 2 (x: 380) aligned with parent base node", () => {
    const nodes: LayoutNode[] = [
      {
        id: "types-base-lucide",
        type: "types",
        position: { x: 0, y: 0 },
        data: {
          label: "lucide-react",
          isPackageNode: true,
          types: [{ id: "t-lucide", name: "LucideIcon", kind: "type" }],
        },
      },
      {
        id: "types-ext-custom",
        type: "types",
        position: { x: 0, y: 0 },
        data: {
          label: "CustomSvgType",
          isExtended: true,
          extendedFromNodeId: "types-base-lucide",
          types: [{ id: "t-custom", name: "CustomSvg", kind: "type" }],
        },
      },
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "Web App" },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-ext-link",
        source: "types-base-lucide",
        target: "types-ext-custom",
        type: "type-reference",
      },
      {
        id: "e-ext-app",
        source: "types-ext-custom",
        target: "web-app-1",
        type: "type-reference",
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
    });

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const basePos = posMap.get("types-base-lucide")!;
    const extPos = posMap.get("types-ext-custom")!;
    const webAppPos = posMap.get("web-app-1")!;

    // 1. Base is in Column 1 at x: 60
    expect(basePos.x).toBe(60);

    // 2. Extended is in Column 2 at x: 410 (60 + 270 + 80)
    expect(extPos.x).toBe(410);
    expect(extPos.y).toBe(basePos.y);

    // 3. WebApp is shifted past both columns (410 + 270 + 200 = 880)
    expect(webAppPos.x).toBeGreaterThanOrEqual(880);
  });

  it("runs cleanly when no types nodes are present", () => {
    const nodes: LayoutNode[] = [
      {
        id: "service-1",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "Service 1" },
      },
    ];

    const edges: LayoutEdge[] = [];

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
    });

    expect(appliedChanges.length).toBe(1);
    expect(appliedChanges[0]?.position.x).toBeGreaterThanOrEqual(60);
    expect(appliedChanges[0]?.position.y).toBeGreaterThanOrEqual(60);
  });
});
