import { describe, it, expect, vi } from "vitest";
import { performGraphLayout } from "../graphLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("hangingStateStoreLayout - Auto-Layout for Hanging State Store Nodes", () => {
  it("positions a StateStore node in a dedicated column immediately before the WebPage node it connects to, NOT aligned with WebApp", () => {
    const nodes: LayoutNode[] = [
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: {
          label: "web",
          zones: [
            { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
          ],
        },
      },
      {
        id: "web-page-1",
        type: "webPage",
        position: { x: 0, y: 0 },
        data: {
          label: "conversations",
          sections: [
            {
              id: "sec-main",
              name: "Main Section",
              renderMode: "client",
              actions: [],
              stateObjects: [
                { id: "st-msg", name: "messages", type: "Message[]", storeId: "store-conv-1", fieldId: "f-msg" },
              ],
            },
          ],
        },
      },
      {
        id: "store-conv-1",
        type: "state_store",
        position: { x: 0, y: 0 },
        data: {
          label: "conversationStore",
          storeName: "conversationStore",
          fields: [
            { id: "f-msg", name: "messages", type: "Message[]", defaultValue: [] },
          ],
          actions: [],
        },
      },
    ];

    const edges: LayoutEdge[] = [
      {
        id: "e-app-page",
        source: "web-app-1",
        target: "web-page-1",
        sourceHandle: "public-in",
        targetHandle: "page-in",
        type: "connection",
      },
      {
        id: "e-store-page",
        source: "store-conv-1",
        target: "web-page-1",
        sourceHandle: "store-field-out-f-msg",
        targetHandle: "section-state-in-sec-main-st-msg",
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
    const webAppPos = posMap.get("web-app-1")!;
    const webPagePos = posMap.get("web-page-1")!;
    const storePos = posMap.get("store-conv-1")!;

    // 1. WebApp is on the left
    // 2. WebPage is on the right
    expect(webPagePos.x).toBeGreaterThan(webAppPos.x);

    // 3. StateStore does NOT align with WebApp node and does not overlap WebApp
    const webAppRight = webAppPos.x + 330;
    expect(storePos.x).toBeGreaterThanOrEqual(webAppRight);

    // 4. StateStore sits in its dedicated column immediately before the WebPage node
    expect(storePos.x).toBeLessThan(webPagePos.x);
    expect(webPagePos.x - (storePos.x + 260)).toBeCloseTo(80, 0);
  });

  it("positions StateStore relative to WebPage when pages are in a Hand-of-Cards stack", () => {
    const nodes: LayoutNode[] = [
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: {
          label: "web",
          zones: [
            { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
          ],
        },
      },
      {
        id: "page-root",
        type: "webPage",
        position: { x: 0, y: 0 },
        data: { label: "/" },
      },
      {
        id: "page-notfound",
        type: "webPage",
        position: { x: 0, y: 0 },
        data: { label: "/not-found" },
      },
      {
        id: "page-conv",
        type: "webPage",
        position: { x: 0, y: 0 },
        data: {
          label: "conversations",
          sections: [
            {
              id: "sec-main",
              name: "Main Section",
              renderMode: "client",
              actions: [],
              stateObjects: [
                { id: "st-conv", name: "conversations", type: "Conversation[]", storeId: "store-conv", fieldId: "f-conv" },
              ],
            },
          ],
        },
      },
      {
        id: "store-conv",
        type: "state_store",
        position: { x: 0, y: 0 },
        data: {
          label: "conversationStore",
          storeName: "conversationStore",
          fields: [
            { id: "f-conv", name: "conversations", type: "Conversation[]", defaultValue: [] },
          ],
        },
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "web-app-1", target: "page-root", sourceHandle: "public-in", targetHandle: "page-in" },
      { id: "e2", source: "web-app-1", target: "page-notfound", sourceHandle: "public-in", targetHandle: "page-in" },
      { id: "e3", source: "web-app-1", target: "page-conv", sourceHandle: "public-in", targetHandle: "page-in" },
      {
        id: "e-store",
        source: "store-conv",
        target: "page-conv",
        sourceHandle: "store-field-out-f-conv",
        targetHandle: "section-state-in-sec-main-st-conv",
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

    expect(appliedChanges.length).toBe(5);

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const webAppPos = posMap.get("web-app-1")!;
    const storePos = posMap.get("store-conv")!;
    const pageConvPos = posMap.get("page-conv")!;

    // StateStore does not align with WebApp and is strictly to the right of WebApp
    const webAppRight = webAppPos.x + 330;
    expect(storePos.x).toBeGreaterThanOrEqual(webAppRight);

    // StateStore is to the left of the page stack
    expect(storePos.x).toBeLessThan(pageConvPos.x);
  });

  it("handles multiple StateStore nodes connected to the same WebPage without collision", () => {
    const nodes: LayoutNode[] = [
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 0, y: 0 },
        data: {
          label: "web",
          zones: [{ id: "zone-public", handleId: "public-in", name: "Public Section" }],
        },
      },
      {
        id: "page-dash",
        type: "webPage",
        position: { x: 0, y: 0 },
        data: { label: "dashboard" },
      },
      {
        id: "store-user",
        type: "state_store",
        position: { x: 0, y: 0 },
        data: { label: "userStore", storeName: "userStore" },
      },
      {
        id: "store-theme",
        type: "state_store",
        position: { x: 0, y: 0 },
        data: { label: "themeStore", storeName: "themeStore" },
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "web-app-1", target: "page-dash", sourceHandle: "public-in", targetHandle: "page-in" },
      { id: "e-user", source: "store-user", target: "page-dash", sourceHandle: "store-field-out-user", targetHandle: "section-state-in-sec-user" },
      { id: "e-theme", source: "store-theme", target: "page-dash", sourceHandle: "store-field-out-theme", targetHandle: "section-state-in-sec-theme" },
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
    const userStorePos = posMap.get("store-user")!;
    const themeStorePos = posMap.get("store-theme")!;
    const webAppPos = posMap.get("web-app-1")!;

    // Both stores share the same column before the page
    expect(userStorePos.x).toBeCloseTo(themeStorePos.x, 0);

    // Neither aligns with WebApp
    expect(userStorePos.x).toBeGreaterThan(webAppPos.x);

    // They do not vertically overlap
    const userTop = userStorePos.y;
    const userBottom = userStorePos.y + 160;
    const themeTop = themeStorePos.y;
    const themeBottom = themeStorePos.y + 160;
    const overlaps = !(userBottom <= themeTop || themeBottom <= userTop);
    expect(overlaps).toBe(false);
  });

  it("handles unattached StateStore nodes gracefully without colliding with WebApp", () => {
    const nodes: LayoutNode[] = [
      {
        id: "web-app-1",
        type: "webApp",
        position: { x: 100, y: 100 },
        data: { label: "web" },
      },
      {
        id: "unattached-store",
        type: "state_store",
        position: { x: 500, y: 400 },
        data: { label: "freeStore" },
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

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const storePos = posMap.get("unattached-store")!;
    expect(storePos).toBeDefined();
    // Does not collapse onto webApp (which is at x >= 60 after margin shift)
    expect(storePos.x).toBeGreaterThanOrEqual(60);
  });
});
