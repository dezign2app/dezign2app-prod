import { describe, it, expect } from "vitest";
import { calculateVisibleCenterScreenPoint } from "../useCanvasCenterPosition";
import { getOffsetPosition } from "../useCanvasHandlers";
import type { BackendNode } from "@/types/canvas";

describe("useCanvasCenterPosition - calculateVisibleCenterScreenPoint", () => {
  it("calculates exact center with default layout (palette open, toolbar top)", () => {
    const point = calculateVisibleCenterScreenPoint({
      paletteIsOpen: true,
      paletteWidth: 220,
      configSidebarOpen: false,
      aiPanelOpen: false,
      terminalOpen: false,
      windowWidth: 1920,
      windowHeight: 1080,
      toolbarHeight: 56,
    });

    // Left = 220, Right = 1920 => Center X = 220 + (1700 / 2) = 1070
    expect(point.x).toBe(1070);
    // Top = 56, Bottom = 1080 => Center Y = 56 + (1024 / 2) = 568
    expect(point.y).toBe(568);
  });

  it("calculates exact center when palette is closed", () => {
    const point = calculateVisibleCenterScreenPoint({
      paletteIsOpen: false,
      paletteWidth: 220,
      configSidebarOpen: false,
      aiPanelOpen: false,
      terminalOpen: false,
      windowWidth: 1920,
      windowHeight: 1080,
      toolbarHeight: 56,
    });

    // Left = 0, Right = 1920 => Center X = 960
    expect(point.x).toBe(960);
    expect(point.y).toBe(568);
  });

  it("adjusts center X when AI panel is open on the right", () => {
    const point = calculateVisibleCenterScreenPoint({
      paletteIsOpen: true,
      paletteWidth: 220,
      configSidebarOpen: false,
      aiPanelOpen: true,
      aiPanelWidth: 380,
      terminalOpen: false,
      windowWidth: 1920,
      windowHeight: 1080,
      toolbarHeight: 56,
    });

    // Left = 220, Right = 1920 - 380 = 1540
    // Center X = 220 + (1540 - 220) / 2 = 220 + 660 = 880
    expect(point.x).toBe(880);
    expect(point.y).toBe(568);
  });

  it("adjusts center X when Config sidebar is open on the right", () => {
    const point = calculateVisibleCenterScreenPoint({
      paletteIsOpen: true,
      paletteWidth: 220,
      configSidebarOpen: true,
      configSidebarWidth: 420,
      aiPanelOpen: false,
      terminalOpen: false,
      windowWidth: 1920,
      windowHeight: 1080,
      toolbarHeight: 56,
    });

    // Left = 220, Right = 1920 - 420 = 1500
    // Center X = 220 + (1500 - 220) / 2 = 220 + 640 = 860
    expect(point.x).toBe(860);
    expect(point.y).toBe(568);
  });

  it("adjusts center Y when bottom terminal is open", () => {
    const point = calculateVisibleCenterScreenPoint({
      paletteIsOpen: true,
      paletteWidth: 220,
      configSidebarOpen: false,
      aiPanelOpen: false,
      terminalOpen: true,
      terminalHeight: 280,
      windowWidth: 1920,
      windowHeight: 1080,
      toolbarHeight: 56,
    });

    // Top = 56, Bottom = 1080 - 280 = 800
    // Center Y = 56 + (800 - 56) / 2 = 56 + 372 = 428
    expect(point.x).toBe(1070);
    expect(point.y).toBe(428);
  });

  it("staggers consecutive node additions to prevent direct overlap", () => {
    const mockNodes: BackendNode[] = [
      {
        id: "node-1",
        type: "service",
        position: { x: 500, y: 300 },
        fractionalIndex: "a0",
        data: { label: "Node 1" },
      },
    ];

    const first = getOffsetPosition(500, 300, mockNodes);
    expect(first.x).toBe(520);
    expect(first.y).toBe(320);

    mockNodes.push({
      id: "node-2",
      type: "service",
      position: { x: 520, y: 320 },
      fractionalIndex: "a1",
      data: { label: "Node 2" },
    });

    const second = getOffsetPosition(500, 300, mockNodes);
    expect(second.x).toBe(540);
    expect(second.y).toBe(340);
  });
});
