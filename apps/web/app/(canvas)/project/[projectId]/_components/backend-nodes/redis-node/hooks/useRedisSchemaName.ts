import { useState, useRef, useEffect, useCallback } from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { getUniqueNodeLabel } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";

export function useRedisSchemaName(
  id: string,
  data: BackendNode["data"],
  updateNode: (id: string, changes: Partial<BackendNode>) => void,
) {
  const [editingName, setEditingName] = useState(data.label || "");
  const [isEditingName, setIsEditingName] = useState(!data.label);
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingName(data.label || "");
    if (!data.label) {
      setIsEditingName(true);
    }
  }, [data.label]);

  useEffect(() => {
    if (isEditingName) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [isEditingName]);

  const saveName = useCallback(
    (e?: React.SyntheticEvent) => {
      const finalName = editingName.trim();
      if (!finalName) {
        if (!data.label || data.label.trim() === "") {
          useBackendCanvasStore.getState().deleteNode(id);
          return;
        }
        setEditingName(data.label);
        setNameError(false);
        setIsEditingName(false);
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
    if (!data.label || data.label.trim() === "") {
      useBackendCanvasStore.getState().deleteNode(id);
      return;
    }
    setEditingName(data.label);
    setNameError(false);
    setIsEditingName(false);
  }, [data.label, id]);

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
