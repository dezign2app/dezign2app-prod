import { useCallback } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { BackendNode } from "@/types/canvas";

export function useRedisInstanceConnection(
  id: string,
  data: BackendNode["data"],
  updateNode: (id: string, changes: Partial<BackendNode>) => void,
) {
  // Find all Redis instance nodes with shallow equality check
  const redisInstanceNodes = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) =>
          n.type === "redis_instance" ||
          (n.type === "database" && n.data?.dbEngine === "redis"),
      ),
    ),
  );

  const parentDbNode = useBackendCanvasStore((s) =>
    data?.databaseId ? s.nodes.find((n) => n.id === data.databaseId) : undefined,
  );

  const dbThemeColor = parentDbNode?.data?.color || "#ef4444";

  const handleInstanceChange = useCallback(
    (val: string) => {
      const selectedDbId = val === "none" ? undefined : val;
      const store = useBackendCanvasStore.getState();

      // Update node data
      updateNode(id, {
        data: {
          ...data,
          databaseId: selectedDbId,
        },
      });

      // Clean up existing edge if changed
      const existingEdge = store.edges.find(
        (e) => e.target === id && e.type === "database-connection",
      );
      if (existingEdge && existingEdge.source !== selectedDbId) {
        store.deleteEdge(existingEdge.id);
      }

      // Add new edge if selected
      if (selectedDbId) {
        const edgeExists = store.edges.some(
          (e) => e.source === selectedDbId && e.target === id,
        );
        if (!edgeExists) {
          store.addEdge({
            id: `edge-${selectedDbId}-${id}`,
            source: selectedDbId,
            target: id,
            sourceHandle: "database-source",
            targetHandle: "database-entity-target",
            type: "database-connection",
          });
        }
      }
    },
    [id, data, updateNode],
  );

  return {
    redisInstanceNodes,
    parentDbNode,
    dbThemeColor,
    handleInstanceChange,
  };
}
