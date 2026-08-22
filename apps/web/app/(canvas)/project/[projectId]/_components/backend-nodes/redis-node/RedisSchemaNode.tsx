import React, { useState, useRef, useEffect } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { DatabaseZap, Trash2, Settings, Key, Clock, ShieldAlert, Sparkles, Layers } from "lucide-react";
import { BackendNode, RedisHashField } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { ColumnList } from "../entity-node/ColumnList";
import { RedisConfig } from "../entity-node/RedisConfig";
import { DbOperationsList } from "../entity-node/DbOperationsList";
import { getUniqueNodeLabel } from "@workspace/canvas";

export const RedisSchemaNode = ({ id, data, selected }: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const setNodesPendingDeletion = useBackendCanvasStore(
    (s) => s.setNodesPendingDeletion,
  );
  const [editingName, setEditingName] = useState(data.label || "User_Cache");
  const [isEditingName, setIsEditingName] = useState(data.label === "");
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditingName(data.label || "User_Cache");
  }, [data.label]);

  useEffect(() => {
    if (isEditingName) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isEditingName]);

  const saveName = (e?: React.SyntheticEvent) => {
    let finalName = editingName.trim();
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
        const defaultName = getUniqueNodeLabel(allNodes, "User_Cache", "redis_schema");
        updateNode(id, { data: { ...latestNode.data, label: defaultName } });
        setEditingName(defaultName);
        setNameError(false);
        setIsEditingName(false);
      }
      return;
    }

    // Check global uniqueness
    const allNodes = useBackendCanvasStore.getState().nodes;
    const exists = allNodes.some(
      (n) =>
        n.id !== id &&
        (n.type === "redis_schema" || n.type === "entity") &&
        Boolean(n.data?.label && n.data.label.toLowerCase() === finalName.toLowerCase()),
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

  const allNodes = useBackendCanvasStore((s) => s.nodes);
  // Find all Redis instance nodes
  const redisInstanceNodes = allNodes.filter(
    (n) => n.type === "redis_instance" || (n.type === "database" && n.data?.dbEngine === "redis"),
  );
  const parentDbNode = allNodes.find((n) => n.id === data.databaseId);
  const dbThemeColor = parentDbNode?.data?.color || "#ef4444";

  const openSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      type: "redisSchema",
      id: id,
      nodeId: id,
    });
  };

  const redisStructure = data.redisDataStructure || "hash";

  const handleUpdateNodeWithSync = (targetNodeId: string, changes: Partial<BackendNode>) => {
    if (changes.data?.columns && redisStructure === "hash") {
      const newFields: RedisHashField[] = changes.data.columns.map((c) => ({
        name: c.name,
        type:
          c.type === "INTEGER" || c.type === "REAL" || c.type === "FLOAT" || c.type === "NUMERIC"
            ? "number"
            : c.type === "BOOLEAN" || c.type === "BOOL"
              ? "boolean"
              : c.type === "JSON" || c.type === "OBJECT"
                ? "json"
                : "string",
        required: Boolean(c.isPrimaryKey || c.isNotNull),
      }));
      updateNode(targetNodeId, {
        ...changes,
        data: {
          ...changes.data,
          hashConfig: {
            ...changes.data.hashConfig,
            fields: newFields,
          },
        },
      });
      return;
    }
    updateNode(targetNodeId, changes);
  };

  return (
    <div
      ref={nodeRef}
      tabIndex={-1}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setActiveConfigItem({
          type: "redisSchema",
          id: id,
          nodeId: id,
        });
      }}
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[280px] max-w-[370px] focus:outline-none transition-all",
        selected ? "border-primary" : "border-border",
      )}
      style={{
        borderColor: dbThemeColor ? dbThemeColor : undefined,
        boxShadow: selected
          ? `0 0 0 2px ${dbThemeColor || "var(--primary)"}50, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`
          : undefined,
      }}
    >
      {/* Top Handle for Redis Instance Node connection */}
      <Handle
        type="target"
        position={Position.Top}
        id="database-entity-target"
        className="w-3 h-3 border-2 border-background !-top-1.5"
        style={{ backgroundColor: dbThemeColor }}
      />

      {/* Header */}
      <div className="px-3 py-2 border-b flex flex-col gap-1.5 group rounded-t-[10px] bg-red-500/10 text-red-700 dark:text-red-400">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center flex-1 min-w-0">
            <DatabaseZap
              size={14}
              className="mr-2 shrink-0 text-red-500"
              style={{ color: dbThemeColor }}
            />
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
                      setEditingName(data.label || "User_Cache");
                      setNameError(false);
                      setIsEditingName(false);
                    }
                  }}
                  onBlur={saveName}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="font-bold text-xs cursor-pointer hover:opacity-80 transition-colors truncate text-red-700 dark:text-red-300"
                  style={{ color: dbThemeColor }}
                  onClick={() => setIsEditingName(true)}
                >
                  {data.label || "User_Cache"}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 uppercase font-mono bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 shrink-0"
                >
                  {redisStructure}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Configure Redis Schema"
              onClick={openSettings}
            >
              <Settings size={14} />
            </div>
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const cols = data.columns || [];
                const isEmpty = cols.length === 0;
                if (!isEmpty) {
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

        {/* Redis Instance Association Dropdown */}
        <div className="flex items-center justify-between gap-1.5 nodrag pt-1 border-t border-border/40 text-[10px]">
          <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1">
            <DatabaseZap size={10} className="text-red-500" style={{ color: dbThemeColor }} />
            Redis Instance:
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
              <SelectValue placeholder="Standalone Redis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs italic text-muted-foreground">
                Standalone (In-Memory / Env)
              </SelectItem>
              {redisInstanceNodes.map((db) => (
                <SelectItem key={db.id} value={db.id} className="text-xs">
                  {db.data.label || "Redis Instance"} (redis)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="px-3 py-1.5 bg-secondary/10 border-b nodrag">
        <Textarea
          value={data.description || ""}
          onChange={(e) =>
            updateNode(id, { data: { ...data, description: e.target.value } })
          }
          placeholder="Describe cache schema / invalidation rules..."
          className="h-10 text-xs min-h-[36px] bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Redis Key & Structure Settings */}
      <RedisConfig id={id} data={data} updateNode={updateNode} />

      {/* Schema Columns (for Hash or JSON structures) */}
      {(redisStructure === "hash" || redisStructure === "json") && (
        <ColumnList
          nodeId={id}
          items={data.columns || []}
          updateNode={handleUpdateNodeWithSync}
          data={data}
          isVector={false}
        />
      )}

      {/* DB / Redis Operations list */}
      <DbOperationsList nodeId={id} data={data} updateNode={updateNode} />
    </div>
  );
};
