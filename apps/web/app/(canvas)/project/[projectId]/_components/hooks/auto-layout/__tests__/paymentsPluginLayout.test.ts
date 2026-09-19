import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import { PAYMENTS_PLUGIN_GAP } from "../paymentsPluginLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("paymentsPluginLayout - Auto-Layout for Creem Payments and Better Auth", () => {
  it("positions Creem Payments 80px to the left of Better Auth with matching top Y coordinates", () => {
    const nodes: LayoutNode[] = [
      {
        id: "payments-1",
        type: "payments",
        position: { x: 0, y: 0 },
        data: { label: "Creem Payments", provider: "creem" },
      },
      {
        id: "auth-1",
        type: "auth",
        position: { x: 0, y: 0 },
        data: { label: "better auth" },
      },
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "web" },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-payments-auth",
        source: "payments-1",
        target: "auth-1",
        sourceHandle: "injects-plugin-out",
        targetHandle: "payments-plugin-in",
        type: "connection",
      },
      {
        id: "e-auth-webapp",
        source: "auth-1",
        target: "web-app-1",
        sourceHandle: "auth-out",
        targetHandle: "auth-in",
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
    });

    expect(appliedChanges.length).toBe(3);

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const paymentsPos = posMap.get("payments-1")!;
    const authPos = posMap.get("auth-1")!;
    const webAppPos = posMap.get("web-app-1")!;

    // 1. Payments is positioned immediately to the left of Better Auth with exactly 80px gap
    // Payments width is 300
    expect(paymentsPos.x).toBeLessThan(authPos.x);
    expect(authPos.x - (paymentsPos.x + 300)).toBeCloseTo(PAYMENTS_PLUGIN_GAP, 0);

    // 2. Y coordinates match so top: 18px handles align horizontally to the pixel
    expect(paymentsPos.y).toBeCloseTo(authPos.y, 0);

    // 3. Better Auth is positioned before WebApp with normal clean rank separation (not 520px)
    expect(authPos.x).toBeLessThan(webAppPos.x);
    const authToWebGap = webAppPos.x - (authPos.x + 300);
    expect(authToWebGap).toBeLessThanOrEqual(250);
    expect(authToWebGap).toBeGreaterThanOrEqual(150);
  });

  it("handles reverse connection from Better Auth to Payments correctly", () => {
    const nodes: LayoutNode[] = [
      {
        id: "auth-node",
        type: "auth",
        position: { x: 0, y: 0 },
        data: { label: "better auth" },
      },
      {
        id: "payments-node",
        type: "payments",
        position: { x: 0, y: 0 },
        data: { label: "Creem Payments" },
      },
    ];

    // Edge drawn backwards
    const edges: LayoutEdge[] = [
      {
        id: "e-rev",
        source: "auth-node",
        target: "payments-node",
        sourceHandle: "payments-plugin-in",
        targetHandle: "injects-plugin-out",
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
    const paymentsPos = posMap.get("payments-node")!;
    const authPos = posMap.get("auth-node")!;

    expect(paymentsPos.x).toBeLessThan(authPos.x);
    expect(authPos.x - (paymentsPos.x + 300)).toBeCloseTo(PAYMENTS_PLUGIN_GAP, 0);
    expect(paymentsPos.y).toBeCloseTo(authPos.y, 0);
  });

  it("leaves standalone Payments nodes (not connected to Auth) in normal DAG flow", () => {
    const nodes: LayoutNode[] = [
      {
        id: "payments-standalone",
        type: "payments",
        position: { x: 0, y: 0 },
        data: { label: "Creem Payments" },
      },
      {
        id: "web-app-standalone",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: { label: "web" },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-direct",
        source: "payments-standalone",
        target: "web-app-standalone",
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
    const paymentsPos = posMap.get("payments-standalone")!;
    const webAppPos = posMap.get("web-app-standalone")!;

    expect(paymentsPos.x).toBeLessThan(webAppPos.x);
  });
});
