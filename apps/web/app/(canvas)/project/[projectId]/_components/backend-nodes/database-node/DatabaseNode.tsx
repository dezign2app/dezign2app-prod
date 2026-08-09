import React, { useState, useRef, useEffect } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { Database, Trash2, Settings, Server, Table2, Key } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { DEFAULT_DATABASE_NODE_LABEL } from "@workspace/canvas";

export const DatabaseNode = ({ id, data, selected }: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const allNodes = useBackendCanvasStore((s) => s.nodes);

  const label = data.label || DEFAULT_DATABASE_NODE_LABEL;
  const [editingName, setEditingName] = useState(label);
  const [isEditingName, setIsEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isEditingName]);

  const saveName = () => {
    const finalName = editingName.trim() || DEFAULT_DATABASE_NODE_LABEL;
    updateNode(id, { data: { ...data, label: finalName } });
    setEditingName(finalName);
    setIsEditingName(false);
  };

  // Find all entity nodes hanging off this DB
  const attachedTables = allNodes.filter(
    (n) => n.type === "entity" && n.data?.databaseId === id,
  );

  const engine = data.dbEngine || "sqlite";
  const connStringEnv = data.connectionStringEnv || "DATABASE_URL";
  const dbFilePathEnv = data.dbFilePathEnv || "DB_FILE_PATH";

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setActiveConfigItem({
          type: "database",
          id: id,
          nodeId: id,
        });
      }}
      className={cn(
        "shadow-lg rounded-xl bg-card border-2 min-w-[260px] max-w-[340px] focus:outline-none transition-all group",
        selected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-amber-500/40 hover:border-amber-500/70",
      )}
    >
      {/* Incoming Connection Handle for Services/Tasks */}
      <Handle
        type="target"
        position={Position.Top}
        id="database-target"
        className="w-3 h-3 bg-amber-500 border-2 border-background !-top-1.5"
      />

      {/* Node Header */}
      <div className="px-3 py-2 border-b flex flex-col gap-1.5 rounded-t-[10px] bg-amber-500/10 text-amber-900 dark:text-amber-300">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center flex-1 min-w-0">
            <Database size={16} className="mr-2 text-amber-500 shrink-0" />
            {isEditingName ? (
              <Input
                ref={inputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-6 text-xs px-1 font-semibold"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditingName(label);
                    setIsEditingName(false);
                  }
                }}
                onBlur={saveName}
              />
            ) : (
              <span
                className="font-bold text-sm cursor-pointer hover:text-amber-500 transition-colors truncate"
                onClick={() => setIsEditingName(true)}
              >
                {label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-mono uppercase bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
            >
              {engine}
            </Badge>
            <div
              className="flex items-center justify-center p-1.5 rounded hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 transition-all cursor-pointer"
              title="Configure Database"
              onClick={(e) => {
                e.stopPropagation();
                setActiveConfigItem({
                  type: "database",
                  id: id,
                  nodeId: id,
                });
              }}
            >
              <Settings size={15} />
            </div>
            <div
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              title="Delete Database"
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(id);
              }}
            >
              <Trash2 size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Body / Config Summary */}
      <div className="p-3 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between bg-muted/30 p-1.5 rounded-lg border border-border/40">
          <div className="flex items-center text-muted-foreground gap-1.5">
            <Key size={12} className="text-amber-500 shrink-0" />
            <span className="text-[11px] font-medium">ENV Connection</span>
          </div>
          <code className="text-[10px] font-mono font-semibold bg-background px-1.5 py-0.5 rounded border border-border/60 text-amber-600 dark:text-amber-400">
            {connStringEnv}
          </code>
        </div>

        {engine === "sqlite" && (
          <div className="flex items-center justify-between bg-muted/30 p-1.5 rounded-lg border border-border/40">
            <div className="flex items-center text-muted-foreground gap-1.5">
              <Server size={12} className="text-amber-500 shrink-0" />
              <span className="text-[11px] font-medium">File Path ENV</span>
            </div>
            <code className="text-[10px] font-mono font-semibold bg-background px-1.5 py-0.5 rounded border border-border/60 text-foreground/80">
              {dbFilePathEnv}
            </code>
          </div>
        )}

        {/* Connected Entities Counter */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Table2 size={12} className="text-amber-500" />
            <span>Hanging Tables</span>
          </div>
          <span className="font-semibold text-foreground bg-secondary px-1.5 rounded-full">
            {attachedTables.length}
          </span>
        </div>
      </div>

      {/* Outgoing Handle to Hanging Entity Nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="database-source"
        className="w-3 h-3 bg-amber-500 border-2 border-background !-bottom-1.5"
      />
    </div>
  );
};
