import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { getOffsetPosition } from "./useCanvasHandlers";

export interface CalculateVisibleCenterScreenPointParams {
  paletteIsOpen?: boolean;
  paletteWidth?: number;
  configSidebarOpen?: boolean;
  configSidebarWidth?: number;
  aiPanelOpen?: boolean;
  aiPanelWidth?: number;
  terminalOpen?: boolean;
  terminalHeight?: number;
  windowWidth?: number;
  windowHeight?: number;
  toolbarHeight?: number;
}

export function calculateVisibleCenterScreenPoint({
  paletteIsOpen,
  paletteWidth = 220,
  configSidebarOpen,
  configSidebarWidth = 420,
  aiPanelOpen,
  aiPanelWidth = 380,
  terminalOpen,
  terminalHeight = 280,
  windowWidth = 1920,
  windowHeight = 1080,
  toolbarHeight = 56,
}: CalculateVisibleCenterScreenPointParams): { x: number; y: number } {
  const left = paletteIsOpen ? paletteWidth : 0;
  let right = windowWidth;

  if (configSidebarOpen) {
    right = Math.max(left + 100, right - configSidebarWidth);
  } else if (aiPanelOpen) {
    right = Math.max(left + 100, right - aiPanelWidth);
  }

  const top = toolbarHeight;
  const bottom = terminalOpen
    ? Math.max(top + 100, windowHeight - terminalHeight)
    : windowHeight;

  return {
    x: left + Math.max(0, right - left) / 2,
    y: top + Math.max(0, bottom - top) / 2,
  };
}

export interface CanvasCenterOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  paletteIsOpen?: boolean;
}

export function useCanvasCenterPosition(defaultPaletteIsOpen?: boolean) {
  const { screenToFlowPosition } = useReactFlow();

  const getCenterPosition = useCallback(
    (options?: CanvasCenterOptions | number, maybeHeight?: number) => {
      let nodeWidth = 220;
      let nodeHeight = 100;
      let paletteIsOpen = defaultPaletteIsOpen;

      if (typeof options === "number") {
        nodeWidth = options;
        if (typeof maybeHeight === "number") {
          nodeHeight = maybeHeight;
        }
      } else if (options && typeof options === "object") {
        if (typeof options.nodeWidth === "number") nodeWidth = options.nodeWidth;
        if (typeof options.nodeHeight === "number") nodeHeight = options.nodeHeight;
        if (options.paletteIsOpen !== undefined) paletteIsOpen = options.paletteIsOpen;
      }

      if (typeof window === "undefined") {
        return { x: 100, y: 100 };
      }

      const sidebarStore = useSidebarStore.getState();
      const canvasStore = useBackendCanvasStore.getState();

      const isPaletteOpen =
        paletteIsOpen !== undefined ? paletteIsOpen : sidebarStore.paletteOpen;

      const screenPoint = calculateVisibleCenterScreenPoint({
        paletteIsOpen: isPaletteOpen,
        paletteWidth: sidebarStore.paletteWidth || 220,
        configSidebarOpen: Boolean(canvasStore.activeConfigItem),
        configSidebarWidth: sidebarStore.configSidebarWidth || 420,
        aiPanelOpen: sidebarStore.aiPanelOpen,
        aiPanelWidth: sidebarStore.aiPanelWidth || 380,
        terminalOpen: sidebarStore.terminalOpen,
        terminalHeight: sidebarStore.terminalHeight || 280,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        toolbarHeight: 56,
      });

      const flowPos = screenToFlowPosition(screenPoint);

      const fallbackX = Number.isFinite(flowPos?.x) ? flowPos.x : 300;
      const fallbackY = Number.isFinite(flowPos?.y) ? flowPos.y : 200;

      const centeredX = fallbackX - nodeWidth / 2;
      const centeredY = fallbackY - nodeHeight / 2;

      return getOffsetPosition(centeredX, centeredY, canvasStore.nodes);
    },
    [screenToFlowPosition, defaultPaletteIsOpen],
  );

  return { getCenterPosition };
}
