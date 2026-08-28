"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Database, Layers, Settings, Trash2 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";

export const VectorDBRefNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const requestDeleteNode = useBackendCanvasStore((s) => s.requestDeleteNode);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const edges = useBackendCanvasStore((s) => s.edges);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const vectorCollections = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) => n?.type === "entity" && n.data?.dbType === "vector",
      ),
    ),
  );

  const selectedCol = vectorCollections.find((c) => c.id === data.collectionRef);

  const handleOpenConfig = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "db_ref",
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestDeleteNode(id);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[240px] max-w-[300px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-violet-500 shadow-violet-500/15 ring-1 ring-violet-500/20"
          : "border-border/80 hover:border-violet-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Top row: Icon + Title + Badge + Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25 shrink-0">
            <Database size={12} />
          </div>
          <span className="text-[9px] uppercase font-bold tracking-wider text-violet-600 dark:text-violet-400 truncate">
            Vector DB Ref
          </span>
          <span className="text-[7px] font-mono px-1 py-0.2 rounded font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 uppercase shrink-0">
            VECTOR
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={handleOpenConfig}
            title="Configure Vector Collection"
          >
            <Settings size={12} />
          </button>
          <button
            className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleDelete}
            title="Delete Node"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Bottom row: Collection Selector */}
      <div className="flex items-center gap-1.5 nodrag">
        <Select
          value={data.collectionRef || ""}
          onValueChange={(val) => {
            const col = vectorCollections.find((c) => c.id === val);
            updateNode(id, {
              data: {
                ...data,
                collectionRef: val,
                dbRef: undefined,
                label: col?.data?.label || "Vector Collection Ref",
                graphPosition: col?.position,
              },
            });
          }}
        >
          <SelectTrigger className="h-6 w-full min-w-0 text-[11px] font-semibold bg-background/60 border-border/70 hover:border-violet-500/50 px-2 py-0 truncate overflow-hidden">
            <div className="flex items-center gap-1 min-w-0 truncate">
              <Layers size={10} className="text-violet-500 shrink-0" />
              <span className="truncate">
                {selectedCol?.data?.label || "Select Collection..."}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="nodrag z-[100]">
            {vectorCollections.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic">
                No vector collections defined
              </div>
            ) : (
              vectorCollections.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.data?.label || "Untitled Collection"}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Target Handle on Left */}
      <Handle
        type="target"
        position={Position.Left}
        id="database-target"
        className="w-2.5 h-2.5 !bg-violet-500 border-2 border-background"
      />
    </div>
  );
};
