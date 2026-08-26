import { useState, useRef, useEffect, useCallback } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { getUniqueNodeLabel } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";

export function useRedisSchemaName(
  id: string,
  data: BackendNode["data"],
  updateNode: (id: string, changes: Partial<BackendNode>) => void,
) {
  const [editingName, setEditingName] = useState(data.label || "User_Cache");
  const [isEditingName, setIsEditingName] = useState(data.label === "");
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingName(data.label || "User_Cache");
  }, [data.label]);

  useEffect(() => {
    if (isEditingName) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isEditingName]);

  const saveName = useCallback(
    (e?: React.SyntheticEvent) => {
      const finalName = editingName.trim();
      if (!finalName) {
        const latestNode = useBackendCanvasStore
          .getState()
          .nodes.find((n) => n.id === id);
        if (!latestNode) return;

        const latestCols = latestNode.data?.columns || [];
        const isEmpty = latestCols.length === 0;
        if (isEmpty) {
          useBackendCanvasStore.getState().deleteNode(id);
        } else {
          const allNodes = useBackendCanvasStore.getState().nodes;
          const defaultName = getUniqueNodeLabel(
            allNodes,
            "User_Cache",
            "redis_schema",
          );
          updateNode(id, { data: { ...latestNode.data, label: defaultName } });
          setEditingName(defaultName);
          setNameError(false);
          setIsEditingName(false);
        }
        return;
      }

      // Check global uniqueness against entities and other redis schemas
      const allNodes = useBackendCanvasStore.getState().nodes;
      const exists = allNodes.some(
        (n) =>
          n.id !== id &&
          (n.type === "redis_schema" || n.type === "entity") &&
          Boolean(
            n.data?.label &&
              n.data.label.toLowerCase() === finalName.toLowerCase(),
          ),
      );

      if (exists) {
        setNameError(true);
        if (e?.type === "blur") {
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        return;
      }

      setNameError(false);
      const latestNode = useBackendCanvasStore
        .getState()
        .nodes.find((n) => n.id === id);
      if (latestNode) {
        updateNode(id, { data: { ...latestNode.data, label: finalName } });
      } else {
        updateNode(id, { data: { ...data, label: finalName } });
      }
      setEditingName(finalName);
      setIsEditingName(false);
    },
    [editingName, id, data, updateNode],
  );

  const cancelEdit = useCallback(() => {
    setEditingName(data.label || "User_Cache");
    setNameError(false);
    setIsEditingName(false);
  }, [data.label]);

  return {
    editingName,
    setEditingName,
    isEditingName,
    setIsEditingName,
    nameError,
    setNameError,
    inputRef,
    saveName,
    cancelEdit,
  };
}
