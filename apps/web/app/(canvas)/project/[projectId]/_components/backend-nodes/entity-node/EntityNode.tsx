import React, { useState, useRef, useEffect } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { Database, Table2, Trash2, Settings } from "lucide-react";
import {
  BackendNode,
  DATABASE_ENGINE_OPTIONS,
  DatabaseEngine,
} from "@/types/canvas";

function isDatabaseEngine(val: string): val is DatabaseEngine {
  return DATABASE_ENGINE_OPTIONS.some((e) => e.value === val);
}
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { ColumnList } from "./ColumnList";
import { IndexList } from "./IndexList";
import { VectorConfig } from "./VectorConfig";
import { DbOperationsList } from "./DbOperationsList";

import { DEFAULT_DATABASE_NODE_LABEL, getUniqueNodeLabel } from "@workspace/canvas";

export const EntityNode = ({ id, data, selected }: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const setNodesPendingDeletion = useBackendCanvasStore(
    (s) => s.setNodesPendingDeletion,
  );
  const [editingName, setEditingName] = useState(data.label);
  const [isEditingName, setIsEditingName] = useState(data.label === "");
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingName) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isEditingName]);

  const columns = data.columns || [];
  const indexes = data.indexes || [];

  const saveName = (e?: React.FocusEvent | React.KeyboardEvent) => {
    let finalName = editingName.trim();
    if (!finalName) {
      if (!data.label) {
        const isBlur = e?.type === "blur";
        if (isBlur) {
          const relatedTarget = (e as React.FocusEvent)
            .relatedTarget as Node | null;
          if (nodeRef.current?.contains(relatedTarget)) {
            const allNodes = useBackendCanvasStore.getState().nodes;
            const defaultName = getUniqueNodeLabel(allNodes, "Untitled_Table", "entity");
            const latestNode = allNodes.find((n) => n.id === id);
            if (latestNode) {
              updateNode(id, {
                data: { ...latestNode.data, label: defaultName },
              });
            }
            setEditingName(defaultName);
            setNameError(false);
            setIsEditingName(false);
            return;
          }
        }

        const latestNode = useBackendCanvasStore
          .getState()
          .nodes.find((n) => n.id === id);
        if (!latestNode) return;

        const latestCols = latestNode.data.columns || [];
        const latestIdxs = latestNode.data.indexes || [];

        const isEmpty = latestCols.length === 0 && latestIdxs.length === 0;
        const isInitial =
          latestCols.length === 1 &&
          latestCols[0]?.name === "_id" &&
          latestIdxs.length === 0;

        if (isEmpty || isInitial) {
          useBackendCanvasStore.getState().deleteNode(id);
        } else {
          const allNodes = useBackendCanvasStore.getState().nodes;
          const defaultName = getUniqueNodeLabel(allNodes, "Untitled_Table", "entity");
          updateNode(id, { data: { ...latestNode.data, label: defaultName } });
          setEditingName(defaultName);
          setNameError(false);
          setIsEditingName(false);
        }
        return;
      }
      finalName = data.label; // revert to original valid name
      setEditingName(finalName);
      setNameError(false);
      setIsEditingName(false);
      return;
    }

    // Check global uniqueness for entities
    const allNodes = useBackendCanvasStore.getState().nodes;
    const exists = allNodes.some(
      (n) =>
        n.id !== id &&
        n.type === "entity" &&
        n.data.label.toLowerCase() === finalName.toLowerCase(),
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
  };

  const currentDbEngine = data.dbEngine || "sqlite";

  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const dbNodes = allNodes.filter((n) => n.type === "database");
  const parentDbNode = allNodes.find((n) => n.id === data.databaseId);
  const dbThemeColor = parentDbNode?.data?.color;

  return (
    <div
      ref={nodeRef}
      tabIndex={-1}
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[250px] max-w-[350px] focus:outline-none transition-all",
        !dbThemeColor && (selected ? "border-primary" : "border-border"),
      )}
      style={{
        borderColor: dbThemeColor ? dbThemeColor : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${dbThemeColor || "var(--primary)"}50, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`
          : undefined,
      }}
    >
      {/* Top Handle for Database Node connection */}
      <Handle
        type="target"
        position={Position.Top}
        id="database-entity-target"
        className="w-3 h-3 border-2 border-background !-top-1.5"
        style={{ backgroundColor: dbThemeColor || "#f59e0b" }}
      />

      <div
        className={cn(
          "px-3 py-2 border-b flex flex-col gap-1.5 group rounded-t-[10px]",
          data.dbType === "vector"
            ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
            : "bg-secondary/80",
        )}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center flex-1">
            {data.dbType === "vector" ? (
              <Database size={14} className="mr-2 shrink-0" style={dbThemeColor ? { color: dbThemeColor } : undefined} />
            ) : (
              <Table2
                size={14}
                className="mr-2 shrink-0 text-muted-foreground"
                style={dbThemeColor ? { color: dbThemeColor } : undefined}
              />
            )}
            {isEditingName ? (
              <div className="flex flex-1 items-center gap-1">
                <Input
                  ref={inputRef}
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  className={cn(
                    "h-6 text-xs px-1",
                    nameError &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName(e);
                    if (e.key === "Escape") {
                      setEditingName(data.label);
                      setNameError(false);
                      setIsEditingName(false);
                    }
                  }}
                  onBlur={saveName}
                />
              </div>
            ) : (
              <span
                className="font-bold text-sm cursor-pointer hover:opacity-80 transition-colors flex-1 truncate"
                style={dbThemeColor ? { color: dbThemeColor } : undefined}
                onClick={() => setIsEditingName(true)}
              >
                {data.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="DB Operation Functions"
              onClick={(e) => {
                e.stopPropagation();
                setActiveConfigItem({
                  type: "entityFunctions",
                  id: id,
                  nodeId: id,
                });
              }}
            >
              <Settings size={14} />
            </div>
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const cols = data.columns || [];
                const idxs = data.indexes || [];
                const isEmpty = cols.length === 0 && idxs.length === 0;
                const isInitial =
                  cols.length === 1 &&
                  cols[0]?.name === "_id" &&
                  idxs.length === 0;

                if (!isEmpty && !isInitial) {
                  const node = useBackendCanvasStore
                    .getState()
                    .nodes.find((n) => n.id === id);
                  if (node) setNodesPendingDeletion([node]);
                } else {
                  useBackendCanvasStore.getState().deleteNode(id);
                }
              }}
            >
              <Trash2 size={14} />
            </div>
          </div>
        </div>

        {/* Database Node Association Dropdown */}
        <div className="flex items-center justify-between gap-1.5 nodrag pt-1 border-t border-border/40 text-[10px]">
          <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1">
            <Database size={10} style={{ color: dbThemeColor || "#f59e0b" }} />
            DB Node:
          </span>
          <Select
            value={data.databaseId || "none"}
            onValueChange={(val: string) => {
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
            }}
          >
            <SelectTrigger className="h-5 text-[10px] font-semibold bg-background/60 hover:bg-background border-border/40 px-1.5 py-0 shadow-none">
              <SelectValue placeholder="Unattached" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs italic text-muted-foreground">
                Unattached
              </SelectItem>
              {dbNodes.map((db) => (
                <SelectItem key={db.id} value={db.id} className="text-xs">
                  {db.data.label || "SQLite DB"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="px-3 py-2 bg-secondary/5 border-b nodrag">
        <Textarea
          className="min-h-[20px] text-xs bg-transparent border-none shadow-none p-1 resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          placeholder="description"
          value={data.description || ""}
          onChange={(e) =>
            updateNode(id, { data: { ...data, description: e.target.value } })
          }
        />
      </div>

      {/* Vector Collection Settings */}
      {data.dbType === "vector" && (
        <VectorConfig id={id} data={data} updateNode={updateNode} />
      )}

      <ColumnList
        nodeId={id}
        items={columns}
        updateNode={updateNode}
        data={data}
        isVector={data.dbType === "vector"}
      />

      <IndexList
        id={id}
        indexes={indexes}
        columns={columns}
        data={data}
        updateNode={updateNode}
      />

      <DbOperationsList nodeId={id} data={data} updateNode={updateNode} />

      <div className="h-2 w-full border-t border-transparent rounded-b-[10px]" />
    </div>
  );
};
