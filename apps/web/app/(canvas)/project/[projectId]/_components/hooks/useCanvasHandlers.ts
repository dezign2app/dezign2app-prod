import { useCallback } from "react";
import { NodeChange } from "@xyflow/react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode, BackendCanvasView } from "@/types/canvas";

export function useCanvasHandlers(projectId: string, view: BackendCanvasView) {
  const onNodesChangeStore = useBackendCanvasStore((s) => s.onNodesChange);
  const nodes = useBackendCanvasStore((s) => s.nodes);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removals = changes.filter((c) => c.type === "remove");
      const otherChanges = changes.filter((c) => c.type !== "remove");

      const store = useBackendCanvasStore.getState();

      if (removals.length > 0) {
        const removedIdsSet = new Set(removals.map((r) => r.id));
        const nodesToConfirm = store.nodes.filter((n) => removedIdsSet.has(n.id));

        if (nodesToConfirm.length > 0) {
          store.setNodesPendingDeletion(nodesToConfirm);
          if (otherChanges.length > 0) {
            onNodesChangeStore(otherChanges);
          }
          return;
        }
      }

      // Synchronize dragging for stacked hand-of-cards WebPageNodes
      const positionChanges = changes.filter(
        (c): c is NodeChange & { type: "position"; position: { x: number; y: number } } =>
          c.type === "position" && Boolean(c.position),
      );

      const additionalChanges: NodeChange[] = [];
      const changedIds = new Set(changes.map((c) => c.id));

      positionChanges.forEach((change) => {
        const targetNode = store.nodes.find((n) => n.id === change.id);
        if (targetNode?.type === "webPage" && targetNode.position) {
          const dx = change.position.x - targetNode.position.x;
          const dy = change.position.y - targetNode.position.y;
          if (dx === 0 && dy === 0) return;

          const incomingEdge = store.edges.find((e) => {
            const isTarget = e.target === targetNode.id;
            const isSource = e.source === targetNode.id;
            if (!isTarget && !isSource) return false;
            const otherId = isSource ? e.target : e.source;
            const otherNode = store.nodes.find((n) => n.id === otherId);
            return otherNode?.type === "webApp";
          });

          if (!incomingEdge) return;
          const webAppNode = store.nodes.find(
            (n) => n.type === "webApp" && (n.id === incomingEdge.source || n.id === incomingEdge.target),
          );
          if (!webAppNode) return;

          const handleId =
            incomingEdge.source === webAppNode.id ? incomingEdge.sourceHandle : incomingEdge.targetHandle;
          if (!handleId) return;

          const zones = Array.isArray(webAppNode.data?.zones) ? webAppNode.data.zones : [];
          const zone = zones.find((z: any) => z.handleId === handleId);
          const zoneId = zone?.id || (handleId.includes("private") ? "zone-private" : "zone-public");

          const expandedList = Array.isArray(webAppNode.data?.expandedZones)
            ? webAppNode.data.expandedZones
            : [];
          if (expandedList.includes(zoneId)) return; // Fanned out, drag independently

          const siblingEdges = store.edges.filter(
            (e) =>
              (e.source === webAppNode.id && e.sourceHandle === handleId) ||
              (e.target === webAppNode.id && e.targetHandle === handleId),
          );
          const siblingIds = new Set(
            siblingEdges.map((e) => (e.source === webAppNode.id ? e.target : e.source)),
          );

          if (siblingIds.size <= 1) return;

          siblingIds.forEach((sId) => {
            if (sId !== targetNode.id && !changedIds.has(sId)) {
              const sibling = store.nodes.find((n) => n.id === sId);
              if (sibling?.position) {
                additionalChanges.push({
                  type: "position",
                  id: sId,
                  position: {
                    x: sibling.position.x + dx,
                    y: sibling.position.y + dy,
                  },
                });
                changedIds.add(sId);
              }
            }
          });
        }
      });

      const allChanges = [...changes, ...additionalChanges];
      if (allChanges.length > 0) {
        onNodesChangeStore(allChanges);
      }
    },
    [onNodesChangeStore],
  );

  const handleNodeDragStart = useCallback(() => {
    useBackendCanvasStore.getState().pushHistorySnapshot(view);
  }, [view]);

  const handleSelectionDragStart = useCallback(() => {
    useBackendCanvasStore.getState().pushHistorySnapshot(view);
  }, [view]);

  const handleMoveEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent | null,
      viewport: { x: number; y: number; zoom: number },
    ) => {
      localStorage.setItem(
        `canvas_viewport_${projectId}_${view}`,
        JSON.stringify(viewport),
      );
    },
    [projectId, view],
  );

  return {
    handleNodesChange,
    handleNodeDragStart,
    handleSelectionDragStart,
    handleMoveEnd,
  };
}

export function getOffsetPosition(
  baseX: number,
  baseY: number,
  nodes: BackendNode[],
) {
  let x = baseX;
  let y = baseY;
  const offset = 20;

  // Find a position that doesn't exactly overlap with existing nodes
  while (
    nodes.some(
      (node) =>
        Math.abs(node.position.x - x) < 5 && Math.abs(node.position.y - y) < 5,
    )
  ) {
    x += offset;
    y += offset;
  }

  return { x, y };
}
