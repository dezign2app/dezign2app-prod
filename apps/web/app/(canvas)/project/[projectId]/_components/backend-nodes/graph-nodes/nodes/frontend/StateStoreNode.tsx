"use client";

import React, { useState } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { Database, Settings, Trash, Layers } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { LocalInput } from "../../common/LocalInput";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";

export const StateStoreNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const requestDeleteNode = useBackendCanvasStore((s) => s.requestDeleteNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const [isEditing, setIsEditing] = useState(!data.label && !data.storeName);
  const [name, setName] = useState(data.label || data.storeName || "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setName(data.label || data.storeName || "");
    if (!data.label && !data.storeName) {
      setIsEditing(true);
    }
  }, [data.label, data.storeName]);

  React.useEffect(() => {
    if (isEditing) {
      const focus = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      };
      const raf = requestAnimationFrame(focus);
      const timer = setTimeout(focus, 50);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      if (!data.label && !data.storeName) {
        deleteNode(id);
        return;
      }
      setName(data.label || data.storeName || "");
      setIsEditing(false);
      return;
    }
    updateNode(id, {
      data: {
        ...data,
        label: trimmed,
        storeName: trimmed,
      },
    });
    setName(trimmed);
    setIsEditing(false);
  };

  const handleOpenConfig = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "state_store",
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestDeleteNode(id);
  };

  const scope = data.scope || "global";
  const storage = data.storage || "memory";

  const handleToggleScope = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextScope = scope === "global" ? "local" : "global";
    updateNode(id, {
      data: {
        ...data,
        scope: nextScope,
      },
    });
  };

  const fieldCount = data.fields?.length || 0;
  const actionCount = data.actions?.length || 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1.5 px-3 py-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[220px] max-w-[280px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-indigo-500 shadow-indigo-500/15 ring-1 ring-indigo-500/20"
          : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Fallback generic handle for legacy edges */}
      <Handle
        type="target"
        position={Position.Left}
        id="store-in"
        style={{ top: "50%", opacity: 0, pointerEvents: "none" }}
      />

      <div className="flex items-center justify-between gap-3 w-full">
        {/* Icon + Label */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
            <Database size={14} />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                State Store
              </span>
              <button
                type="button"
                onClick={handleToggleScope}
                className={cn(
                  "text-[7px] font-mono px-1 py-0.2 rounded font-medium border transition-colors cursor-pointer",
                  scope === "global"
                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25"
                    : "bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25",
                )}
                title="Click to toggle Global / Local scope"
              >
                {scope === "global" ? "GLOBAL" : "LOCAL"}
              </button>
              {storage !== "memory" && (
                <span className="text-[7px] font-mono px-1 py-0.2 rounded font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {storage === "localStorage" ? "LOCAL" : "SESSION"}
                </span>
              )}
            </div>

            {isEditing ? (
              <div
                className="nodrag nowheel nopan relative flex-1 min-w-0"
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onDragStart={(e) => e.stopPropagation()}
              >
                <LocalInput
                  ref={inputRef}
                  value={name}
                  placeholder="Enter store name..."
                  onChange={(e) => setName(e.target.value)}
                  className="h-5 text-xs font-semibold px-1 py-0 bg-background/80 border-border/80 w-full"
                  autoFocus
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      if (!data.label && !data.storeName) {
                        deleteNode(id);
                        return;
                      }
                      setName(data.label || data.storeName || "");
                      setIsEditing(false);
                    }
                  }}
                  onBlur={handleSave}
                />
              </div>
            ) : (
              <span
                className="text-xs font-semibold text-foreground truncate hover:text-indigo-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                title={data.label || data.storeName || "StateStore"}
              >
                {data.label || data.storeName || "StateStore"}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: Gear (Settings) + Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={handleOpenConfig}
            title="Configure State Store"
          >
            <Settings size={13} />
          </button>
          <button
            className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleDelete}
            title="Delete Node"
          >
            <Trash size={13} />
          </button>
        </div>
      </div>

      {/* Info footer: fields and actions count */}
      <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Layers size={10} className="text-indigo-400/80" />
            {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </span>
          <span>•</span>
          <span>{actionCount} {actionCount === 1 ? "action" : "actions"}</span>
        </div>
        <span className="text-[8px] text-indigo-500/80 font-bold uppercase tracking-wide">Zustand</span>
      </div>

      {/* Actions list with handles aligned on the right edge */}
      <div className="flex flex-col gap-1 pt-1.5 border-t border-border/40 text-[9px] font-mono">
        {/* 1. Load / Populate Action */}
        <div className="relative flex items-center justify-between px-1.5 py-0.5 rounded bg-muted/20 hover:bg-muted/40 transition-colors group/row">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-foreground/90">load</span>
            <span className="text-[8px] text-muted-foreground/60">(populate)</span>
          </div>
          {/* Inbound target handle */}
          <Handle
            type="target"
            position={Position.Right}
            id="populate-in"
            className="w-2.5 h-2.5 !bg-emerald-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10"
            style={{ top: "50%" }}
            title="load: Wire to/from pageLoad action"
          />
          {/* Outbound source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="populate-out"
            className="w-2.5 h-2.5 !bg-emerald-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10 opacity-0 hover:opacity-100"
            style={{ top: "50%" }}
            title="load: Wire to/from pageLoad action"
          />
        </div>

        {/* 2. Mutate Action */}
        <div className="relative flex items-center justify-between px-1.5 py-0.5 rounded bg-muted/20 hover:bg-muted/40 transition-colors group/row">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="font-semibold text-foreground/90">mutate</span>
            <span className="text-[8px] text-muted-foreground/60">(actions)</span>
          </div>
          {/* Inbound target handle */}
          <Handle
            type="target"
            position={Position.Right}
            id="mutate-in"
            className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10"
            style={{ top: "50%" }}
            title="mutate: Wire to/from button or user interaction action"
          />
          {/* Outbound source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="mutate-out"
            className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10 opacity-0 hover:opacity-100"
            style={{ top: "50%" }}
            title="mutate: Wire to/from button or user interaction action"
          />
        </div>

        {/* 3. Reset Action */}
        <div className="relative flex items-center justify-between px-1.5 py-0.5 rounded bg-muted/20 hover:bg-muted/40 transition-colors group/row">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span className="font-semibold text-foreground/90">reset</span>
            <span className="text-[8px] text-muted-foreground/60">(unmount)</span>
          </div>
          {/* Inbound target handle */}
          <Handle
            type="target"
            position={Position.Right}
            id="reset-in"
            className="w-2.5 h-2.5 !bg-rose-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10"
            style={{ top: "50%" }}
            title="reset: Wire to/from unmount or reset event"
          />
          {/* Outbound source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="reset-out"
            className="w-2.5 h-2.5 !bg-rose-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10 opacity-0 hover:opacity-100"
            style={{ top: "50%" }}
            title="reset: Wire to/from unmount or reset event"
          />
        </div>

        {/* Custom Actions if defined */}
        {data.actions && data.actions.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-border/30">
            {data.actions.map((act) => (
              <div
                key={act.id}
                className="relative flex items-center justify-between px-1.5 py-0.5 rounded bg-muted/15 hover:bg-muted/30 transition-colors group/row text-[8px]"
              >
                <div className="flex items-center gap-1 truncate max-w-[170px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="font-medium text-foreground truncate">{act.name}</span>
                  <span className="text-[7px] text-muted-foreground/60 uppercase shrink-0">({act.actionType})</span>
                </div>
                <Handle
                  type="target"
                  position={Position.Right}
                  id={`store-action-in-${act.id}`}
                  className="w-2 h-2 !bg-indigo-400 border border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10"
                  style={{ top: "50%" }}
                  title={`${act.name}: Wire to/from page action`}
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`store-action-out-${act.id}`}
                  className="w-2 h-2 !bg-indigo-400 border border-background cursor-pointer hover:scale-125 transition-transform -right-3 z-10 opacity-0 hover:opacity-100"
                  style={{ top: "50%" }}
                  title={`${act.name}: Wire to/from page action`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fallback hidden store-out handle for legacy edges */}
      <Handle
        type="source"
        position={Position.Right}
        id="store-out"
        style={{ top: "50%", opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
};
