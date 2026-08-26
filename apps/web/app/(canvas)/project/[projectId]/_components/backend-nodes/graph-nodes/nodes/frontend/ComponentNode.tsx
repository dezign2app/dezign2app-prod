"use client";

import React, { useState } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { Layout, Settings2, Trash2 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { LocalInput } from "../../common/LocalInput";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";

export const ComponentNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const [isEditing, setIsEditing] = useState(
    data.label === "" || data.label === "Untitled",
  );
  const [name, setName] = useState(data.label || data.componentName || "CustomComponent");

  const handleSave = () => {
    updateNode(id, {
      data: {
        ...data,
        label: name || "CustomComponent",
        componentName: name || "CustomComponent",
      },
    });
    setIsEditing(false);
  };

  const handleOpenConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "component",
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  const scope = data.scope || "global";
  const slotName = (data.slotName || "main").toUpperCase();
  const propsCount = data.propsSchema?.length || 0;

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[220px] max-w-[280px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-indigo-500 shadow-indigo-500/15 ring-1 ring-indigo-500/20"
          : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Input handle on the left to receive props/state from Hook or parent Component */}
      <Handle
        type="target"
        position={Position.Left}
        id="component-in"
        className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background"
      />

      {/* Icon + Label */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
          <Layout size={14} />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
              Component
            </span>
            <span
              className={cn(
                "text-[7px] font-mono px-1 py-0.2 rounded font-medium",
                scope === "global"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-sky-500/10 text-sky-400",
              )}
            >
              {scope === "global" ? "GLOBAL" : "LOCAL"}
            </span>
            <span className="text-[7px] font-mono px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-500 font-medium">
              {slotName}
            </span>
          </div>

          {isEditing ? (
            <LocalInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-5 text-xs font-semibold px-1 py-0 bg-background/80 border-border/80"
              autoFocus
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setIsEditing(false);
              }}
              onBlur={handleSave}
            />
          ) : (
            <span
              className="text-xs font-semibold text-foreground truncate hover:text-indigo-400 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title={data.label || data.componentName || "CustomComponent"}
            >
              {data.label || data.componentName || "CustomComponent"}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons: Gear (Settings) + Delete */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
          onClick={handleOpenConfig}
          title="Configure Component"
        >
          <Settings2 size={13} />
        </button>
        <button
          className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={handleDelete}
          title="Delete Node"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Single outgoing handle on the right to plug into WebPage slots or child slots */}
      <Handle
        type="source"
        position={Position.Right}
        id="component-out"
        className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background"
      />
    </div>
  );
};
