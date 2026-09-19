import { describe, it, expect, vi } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import {
  sortZonePages,
  toggleZoneHandLayout,
  CARD_HEADER_OFFSET_X,
  CARD_HEADER_OFFSET_Y,
  CARD_EXPANDED_GAP_Y,
} from "../useZoneHandLayout";

describe("Zone Hand Layout (Deck of Cards on Z-axis)", () => {
  it("sorts pages with '/' first, then '/not-found', then alphabetically", () => {
    const pages: BackendNode[] = [
      { id: "p3", type: "webPage", position: { x: 0, y: 0 }, fractionalIndex: "a0", data: { label: "/privacy-policy" } },
      { id: "p1", type: "webPage", position: { x: 0, y: 0 }, fractionalIndex: "a1", data: { label: "/not-found" } },
      { id: "p0", type: "webPage", position: { x: 0, y: 0 }, fractionalIndex: "a2", data: { label: "/" } },
      { id: "p2", type: "webPage", position: { x: 0, y: 0 }, fractionalIndex: "a3", data: { label: "/about" } },
    ];

    const sorted = sortZonePages(pages);
    expect(sorted.map((p) => p.data?.label)).toEqual([
      "/",
      "/not-found",
      "/about",
      "/privacy-policy",
    ]);
  });

  it("toggles stacked zone pages into fanned-out layout when currently stacked", () => {
    const updateNode = vi.fn();

    const webAppNode: BackendNode = {
      id: "web-1",
      type: "webApp",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        zones: [
          { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
        ],
        expandedZones: [], // Currently stacked (not expanded)
      },
    };

    const p0: BackendNode = {
      id: "p0",
      type: "webPage",
      position: { x: 400, y: 100 },
      fractionalIndex: "a1",
      data: { label: "/" },
    };
    const p1: BackendNode = {
      id: "p1",
      type: "webPage",
      position: { x: 408, y: 144 },
      fractionalIndex: "a2",
      data: { label: "/not-found" },
    };
    const p2: BackendNode = {
      id: "p2",
      type: "webPage",
      position: { x: 416, y: 188 },
      fractionalIndex: "a3",
      data: { label: "/privacy-policy" },
    };

    const edges: BackendEdge[] = [
      { id: "e0", source: "web-1", sourceHandle: "public-in", target: "p0", targetHandle: "page-in", type: "connection", fractionalIndex: "a0" },
      { id: "e1", source: "web-1", sourceHandle: "public-in", target: "p1", targetHandle: "page-in", type: "connection", fractionalIndex: "a1" },
      { id: "e2", source: "web-1", sourceHandle: "public-in", target: "p2", targetHandle: "page-in", type: "connection", fractionalIndex: "a2" },
    ];

    toggleZoneHandLayout({
      webAppNode,
      zoneId: "zone-public",
      allNodes: [webAppNode, p0, p1, p2],
      allEdges: edges,
      updateNode,
    });

    // Should update webApp with expandedZones containing zone-public
    expect(updateNode).toHaveBeenCalledWith("web-1", {
      data: {
        ...webAppNode.data,
        expandedZones: ["zone-public"],
      },
    });

    // Should fan out pages vertically
    expect(updateNode).toHaveBeenCalledWith("p0", {
      position: { x: 400, y: 100 },
    });
    expect(updateNode).toHaveBeenCalledWith("p1", {
      position: { x: 400, y: 100 + CARD_EXPANDED_GAP_Y },
    });
    expect(updateNode).toHaveBeenCalledWith("p2", {
      position: { x: 400, y: 100 + 2 * CARD_EXPANDED_GAP_Y },
    });
  });

  it("toggles fanned-out zone pages into stacked hand layout when currently expanded", () => {
    const updateNode = vi.fn();

    const webAppNode: BackendNode = {
      id: "web-1",
      type: "webApp",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        zones: [
          { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
        ],
        expandedZones: ["zone-public"], // Currently expanded
      },
    };

    const p0: BackendNode = {
      id: "p0",
      type: "webPage",
      position: { x: 400, y: 100 },
      fractionalIndex: "a1",
      data: { label: "/" },
    };
    const p1: BackendNode = {
      id: "p1",
      type: "webPage",
      position: { x: 400, y: 520 },
      fractionalIndex: "a2",
      data: { label: "/not-found" },
    };

    const edges: BackendEdge[] = [
      { id: "e0", source: "web-1", sourceHandle: "public-in", target: "p0", targetHandle: "page-in", type: "connection", fractionalIndex: "a0" },
      { id: "e1", source: "web-1", sourceHandle: "public-in", target: "p1", targetHandle: "page-in", type: "connection", fractionalIndex: "a1" },
    ];

    toggleZoneHandLayout({
      webAppNode,
      zoneId: "zone-public",
      allNodes: [webAppNode, p0, p1],
      allEdges: edges,
      updateNode,
    });

    // Should update webApp with expandedZones removing zone-public
    expect(updateNode).toHaveBeenCalledWith("web-1", {
      data: {
        ...webAppNode.data,
        expandedZones: [],
      },
    });

    // Should stack pages along the Z-axis with 44px offset
    expect(updateNode).toHaveBeenCalledWith("p0", {
      position: { x: 400, y: 100 },
    });
    expect(updateNode).toHaveBeenCalledWith("p1", {
      position: { x: 400 + CARD_HEADER_OFFSET_X, y: 100 + CARD_HEADER_OFFSET_Y },
    });
  });

  it("handles 3-card hand layout so all 3 cards are ordered and positioned without hiding the 3rd card", () => {
    const updateNode = vi.fn();

    const webAppNode: BackendNode = {
      id: "web-1",
      type: "webApp",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        zones: [
          { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
        ],
        expandedZones: ["zone-public"], // Currently expanded
      },
    };

    const p0: BackendNode = { id: "p0", type: "webPage", position: { x: 400, y: 100 }, fractionalIndex: "a1", data: { label: "/dashboard" } };
    const p1: BackendNode = { id: "p1", type: "webPage", position: { x: 400, y: 520 }, fractionalIndex: "a2", data: { label: "/onboarding" } };
    const p2: BackendNode = { id: "p2", type: "webPage", position: { x: 400, y: 940 }, fractionalIndex: "a3", data: { label: "/settings" } };

    const edges: BackendEdge[] = [
      { id: "e0", source: "web-1", sourceHandle: "public-in", target: "p0", targetHandle: "page-in", type: "connection", fractionalIndex: "a0" },
      { id: "e1", source: "web-1", sourceHandle: "public-in", target: "p1", targetHandle: "page-in", type: "connection", fractionalIndex: "a1" },
      { id: "e2", source: "web-1", sourceHandle: "public-in", target: "p2", targetHandle: "page-in", type: "connection", fractionalIndex: "a2" },
    ];

    toggleZoneHandLayout({
      webAppNode,
      zoneId: "zone-public",
      allNodes: [webAppNode, p0, p1, p2],
      allEdges: edges,
      updateNode,
    });

    expect(updateNode).toHaveBeenCalledWith("web-1", {
      data: {
        ...webAppNode.data,
        expandedZones: [],
      },
    });

    expect(updateNode).toHaveBeenCalledWith("p0", {
      position: { x: 400, y: 100 },
    });
    expect(updateNode).toHaveBeenCalledWith("p1", {
      position: { x: 400 + CARD_HEADER_OFFSET_X, y: 100 + CARD_HEADER_OFFSET_Y },
    });
    expect(updateNode).toHaveBeenCalledWith("p2", {
      position: { x: 400 + 2 * CARD_HEADER_OFFSET_X, y: 100 + 2 * CARD_HEADER_OFFSET_Y },
    });
  });
});
