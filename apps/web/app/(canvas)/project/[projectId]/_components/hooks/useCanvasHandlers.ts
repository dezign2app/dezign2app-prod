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

      if (removals.length > 0) {
        const store = useBackendCanvasStore.getState();
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

      if (changes.length > 0) {
        onNodesChangeStore(changes);
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
