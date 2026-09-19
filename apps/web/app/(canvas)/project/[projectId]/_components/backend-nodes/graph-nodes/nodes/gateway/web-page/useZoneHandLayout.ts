import React, { useCallback, useMemo } from "react";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { WebAppZone } from "@workspace/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export const CARD_HEADER_OFFSET_Y = 44;
export const CARD_HEADER_OFFSET_X = -8;
export const CARD_EXPANDED_GAP_Y = 420;

export interface ZoneHandLayoutInfo {
  connectedWebAppNode: BackendNode | null;
  connectedZone: WebAppZone | null;
  zoneHandleId: string | null;
  siblingPages: BackendNode[];
  cardIndex: number;
  totalCards: number;
  hasMultipleCards: boolean;
  isStacked: boolean;
  isZoneExpanded: boolean;
  toggleZoneHand: () => void;
  selectCard: (targetIndex: number) => void;
}

/**
 * Sorts web page nodes in a stable, logical order:
 * 1. Root page "/"
 * 2. "/not-found"
 * 3. Alphabetical by route / label
 */
export function sortZonePages(pages: BackendNode[]): BackendNode[] {
  return [...pages].sort((a, b) => {
    const labelA = (a.data?.label || "").trim().toLowerCase();
    const labelB = (b.data?.label || "").trim().toLowerCase();

    if (labelA === "/" || a.data?.isRoot) return -1;
    if (labelB === "/" || b.data?.isRoot) return 1;
    if (labelA === "/not-found" || labelA === "not-found") return -1;
    if (labelB === "/not-found" || labelB === "not-found") return 1;
    if (labelA === "layout" || a.data?.isLayout) return -1;
    if (labelB === "layout" || b.data?.isLayout) return 1;

    return labelA.localeCompare(labelB);
  });
}

/**
 * Toggles a zone between stacked hand-of-cards mode and fanned-out expanded mode.
 * Updates node positions in the store so React Flow visually animates / displays them.
 */
export function toggleZoneHandLayout({
  webAppNode,
  zoneId,
  allNodes,
  allEdges,
  updateNode,
}: {
  webAppNode: BackendNode;
  zoneId: string;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
}) {
  const defaultZones: WebAppZone[] = [
    { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
    { id: "zone-private", handleId: "private-in", name: "Private Section", accessType: "protected" },
  ];
  const zones: WebAppZone[] =
    webAppNode.data?.zones && webAppNode.data.zones.length > 0
      ? webAppNode.data.zones
      : defaultZones;

  const targetZone = zones.find((z) => z.id === zoneId) || zones[0];
  if (!targetZone) return;

  const handleId = targetZone.handleId;

  // Find all WebPage nodes connected to this zone handle
  const connectedEdges = allEdges.filter(
    (e) =>
      (e.source === webAppNode.id && e.sourceHandle === handleId) ||
      (e.target === webAppNode.id && e.targetHandle === handleId),
  );

  const connectedPageIds = new Set(
    connectedEdges.map((e) => (e.source === webAppNode.id ? e.target : e.source)),
  );

  const unsortedPages = allNodes.filter(
    (n) => n.type === "webPage" && connectedPageIds.has(n.id),
  );

  if (unsortedPages.length <= 1) return;

  const pages = sortZonePages(unsortedPages);
  const currentExpanded = Array.isArray(webAppNode.data?.expandedZones)
    ? webAppNode.data.expandedZones
    : [];

  const isCurrentlyExpanded = currentExpanded.includes(zoneId);

  // Find base position from the first page (or webApp position as fallback)
  const baseX = pages[0]?.position?.x ?? ((webAppNode.position?.x ?? 200) + 380);
  const baseY = pages[0]?.position?.y ?? (webAppNode.position?.y ?? 200);

  if (isCurrentlyExpanded) {
    // Transition to STACKED HAND mode
    const nextExpanded = currentExpanded.filter((id) => id !== zoneId);
    updateNode(webAppNode.id, {
      data: {
        ...webAppNode.data,
        expandedZones: nextExpanded,
      },
    });

    // Reposition pages along the Z-axis with 44px vertical offset (header height)
    pages.forEach((page, index) => {
      updateNode(page.id, {
        position: {
          x: baseX + index * CARD_HEADER_OFFSET_X,
          y: baseY + index * CARD_HEADER_OFFSET_Y,
        },
      });
    });
  } else {
    // Transition to FANNED OUT / EXPANDED mode
    const nextExpanded = [...currentExpanded, zoneId];
    updateNode(webAppNode.id, {
      data: {
        ...webAppNode.data,
        expandedZones: nextExpanded,
      },
    });

    // Fan out pages vertically so each has plenty of room
    pages.forEach((page, index) => {
      updateNode(page.id, {
        position: {
          x: baseX,
          y: baseY + index * CARD_EXPANDED_GAP_Y,
        },
      });
    });
  }
}

/**
 * Hook for WebPageNode to determine its hand-of-cards status and controls.
 */
export function useZoneHandLayout(
  pageId: string,
  nodes: BackendNode[],
  edges: BackendEdge[],
  updateNode: (id: string, changes: Partial<BackendNode>) => void,
): ZoneHandLayoutInfo {
  // Find incoming WebApp edge connecting to this page
  const incomingEdge = useMemo(() => {
    return edges.find((e) => {
      const isTarget = e.target === pageId;
      const isSource = e.source === pageId;
      if (!isTarget && !isSource) return false;
      const otherId = isSource ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.type === "webApp";
    });
  }, [edges, nodes, pageId]);

  const connectedWebAppNode = useMemo(() => {
    if (!incomingEdge) return null;
    return (
      nodes.find(
        (n) =>
          n.type === "webApp" &&
          (n.id === incomingEdge.source || n.id === incomingEdge.target),
      ) || null
    );
  }, [incomingEdge, nodes]);

  const zoneHandleId = useMemo(() => {
    if (!connectedWebAppNode || !incomingEdge) return null;
    return incomingEdge.source === connectedWebAppNode.id
      ? incomingEdge.sourceHandle || null
      : incomingEdge.targetHandle || null;
  }, [connectedWebAppNode, incomingEdge]);

  const connectedZone = useMemo(() => {
    if (!connectedWebAppNode || !zoneHandleId) return null;
    const defaultZones: WebAppZone[] = [
      { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
      { id: "zone-private", handleId: "private-in", name: "Private Section", accessType: "protected" },
    ];
    const zones: WebAppZone[] =
      connectedWebAppNode.data?.zones && connectedWebAppNode.data.zones.length > 0
        ? connectedWebAppNode.data.zones
        : defaultZones;

    return zones.find((z) => z.handleId === zoneHandleId) || null;
  }, [connectedWebAppNode, zoneHandleId]);

  // Find all sibling WebPage nodes attached to the same zone handle
  const siblingPages = useMemo(() => {
    if (!connectedWebAppNode || !zoneHandleId) return [];
    const connectedEdges = edges.filter(
      (e) =>
        (e.source === connectedWebAppNode.id && e.sourceHandle === zoneHandleId) ||
        (e.target === connectedWebAppNode.id && e.targetHandle === zoneHandleId),
    );
    const pageIds = new Set(
      connectedEdges.map((e) => (e.source === connectedWebAppNode.id ? e.target : e.source)),
    );
    const pages = nodes.filter((n) => n.type === "webPage" && pageIds.has(n.id));
    return sortZonePages(pages);
  }, [connectedWebAppNode, zoneHandleId, edges, nodes]);

  const cardIndex = useMemo(() => {
    const idx = siblingPages.findIndex((p) => p.id === pageId);
    return idx >= 0 ? idx : 0;
  }, [siblingPages, pageId]);

  const totalCards = siblingPages.length;
  const hasMultipleCards = totalCards > 1;

  const isZoneExpanded = useMemo(() => {
    if (!connectedWebAppNode || !connectedZone) return false;
    const expandedList = Array.isArray(connectedWebAppNode.data?.expandedZones)
      ? connectedWebAppNode.data.expandedZones
      : [];
    return expandedList.includes(connectedZone.id);
  }, [connectedWebAppNode, connectedZone]);

  const isStacked = hasMultipleCards && !isZoneExpanded;

  // Auto-pack / re-align legacy projects or cards where indentations or offsets don't match
  React.useEffect(() => {
    if (cardIndex !== 0 || !hasMultipleCards || isZoneExpanded || !connectedWebAppNode || !connectedZone) return;

    const firstCard = siblingPages[0];
    const secondCard = siblingPages[1];
    if (!firstCard?.position || !secondCard?.position) return;

    const deltaY = secondCard.position.y - firstCard.position.y;
    const deltaX = secondCard.position.x - firstCard.position.x;
    const needsAlignment =
      Math.abs(deltaY - CARD_HEADER_OFFSET_Y) > 5 ||
      Math.abs(deltaX - CARD_HEADER_OFFSET_X) > 2;

    if (needsAlignment) {
      const baseX = firstCard.position.x;
      const baseY = firstCard.position.y;
      siblingPages.forEach((page, idx) => {
        updateNode(page.id, {
          position: {
            x: baseX + idx * CARD_HEADER_OFFSET_X,
            y: baseY + idx * CARD_HEADER_OFFSET_Y,
          },
        });
      });
    }
  }, [cardIndex, hasMultipleCards, isZoneExpanded, connectedWebAppNode, connectedZone, siblingPages, updateNode]);

  const selectCard = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= siblingPages.length) return;
      const targetPage = siblingPages[targetIndex];
      if (!targetPage) return;

      const store = useBackendCanvasStore.getState();
      store.onNodesChange(
        nodes
          .filter((n) => n.type === "webPage")
          .map((p) => ({
            type: "select" as const,
            id: p.id,
            selected: p.id === targetPage.id,
          })),
      );
    },
    [siblingPages, nodes],
  );

  const toggleZoneHand = useCallback(() => {
    if (!connectedWebAppNode || !connectedZone) return;
    toggleZoneHandLayout({
      webAppNode: connectedWebAppNode,
      zoneId: connectedZone.id,
      allNodes: nodes,
      allEdges: edges,
      updateNode,
    });
  }, [connectedWebAppNode, connectedZone, nodes, edges, updateNode]);

  return {
    connectedWebAppNode,
    connectedZone,
    zoneHandleId,
    siblingPages,
    cardIndex,
    totalCards,
    hasMultipleCards,
    isStacked,
    isZoneExpanded,
    toggleZoneHand,
    selectCard,
  };
}
