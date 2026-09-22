"use client";

import React, { useState, useMemo } from "react";
import { NodeProps, Handle, Position } from "@xyflow/react";
import { Database, Settings, Trash, Layers, AlertTriangle, Edit3 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { toast } from "sonner";
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
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);
  const addEdge = useBackendCanvasStore((s) => s.addEdge);
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

  const currentStoreName = (data.storeName || data.label || "").trim();
  const isDuplicateStoreName = useMemo(() => {
    if (!currentStoreName) return false;
    const key = currentStoreName.toLowerCase();
    return allNodes.some(
      (n) =>
        n.id !== id &&
        n.type === "state_store" &&
        (n.data?.storeName || n.data?.label || "").trim().toLowerCase() === key,
    );
  }, [allNodes, id, currentStoreName]);

  const duplicateFieldIds = useMemo(() => {
    const counts = new Map<string, number>();
    (data.fields || []).forEach((f) => {
      const key = f.name?.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const dupes = new Set<string>();
    (data.fields || []).forEach((f) => {
      const key = f.name?.trim().toLowerCase();
      if (key && (counts.get(key) || 0) > 1) {
        dupes.add(f.id);
      }
    });
    return dupes;
  }, [data.fields]);

  const hasErrors = isDuplicateStoreName || duplicateFieldIds.size > 0;

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
    const isColliding = allNodes.some(
      (n) =>
        n.id !== id &&
        n.type === "state_store" &&
        (n.data?.storeName || n.data?.label || "").trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (isColliding) {
      toast.error(`An App Store named "${trimmed}" already exists. Store names must be unique.`);
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

  // Auto-sync type reference edges between TypesNode and store fields
  React.useEffect(() => {
    if (!data.fields || data.fields.length === 0) return;
    data.fields.forEach((f) => {
      if (!f.type) return;
      const baseTypeName = f.type.replace(/\[\]$/, "").trim();
      if (!baseTypeName || ["string", "number", "boolean", "array", "object", "any"].includes(baseTypeName.toLowerCase())) {
        return;
      }
      const typesNode = allNodes.find(
        (n) => n.type === "types" && (n.data?.types || []).some((t: any) => t.name === baseTypeName),
      );
      if (!typesNode) return;
      const typeItem = (typesNode.data?.types || []).find((t: any) => t.name === baseTypeName);
      if (!typeItem) return;

      const expectedSourceHandle = `type-out-${typeItem.id}`;
      const expectedTargetHandle = `store-field-in-${f.id}`;

      const edgeExists = edges.some(
        (e) =>
          e.source === typesNode.id &&
          e.target === id &&
          e.sourceHandle === expectedSourceHandle &&
          e.targetHandle === expectedTargetHandle,
      );

      if (!edgeExists) {
        addEdge({
          id: `edge-type-${typesNode.id}-${typeItem.id}-${id}-${f.id}`,
          source: typesNode.id,
          target: id,
          sourceHandle: expectedSourceHandle,
          targetHandle: expectedTargetHandle,
          type: "type-reference",
          data: {
            label: typeItem.name,
            isTypeReference: true,
            baseTypeName: typeItem.name,
          },
        });
      }
    });
  }, [data.fields, id, allNodes, edges, addEdge]);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl bg-card/95 backdrop-blur border-2 min-w-[220px] max-w-[280px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? hasErrors
            ? "border-destructive shadow-destructive/20 ring-1 ring-destructive/40"
            : "border-indigo-500 shadow-indigo-500/15 ring-1 ring-indigo-500/20"
          : hasErrors
            ? "border-destructive/80 hover:border-destructive shadow-md shadow-destructive/10"
            : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Node-level target handle for TypesNode / Action connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="store-in"
        className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background -left-1.5"
        style={{ top: "28px" }}
        title="Connect from TypesNode, Page, or Action"
      />

      {/* Header Container */}
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-2">
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Icon + Label */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
              <Database size={14} />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[8px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                  State Store
                </span>
                {isDuplicateStoreName && (
                  <span
                    className="flex items-center gap-0.5 text-[7px] font-mono px-1 py-0.2 rounded font-bold bg-destructive/15 text-destructive border border-destructive/30 uppercase tracking-wide"
                    title={`Duplicate App Store name "${currentStoreName}"! Each App Store must have a unique name.`}
                  >
                    <AlertTriangle size={8} />
                    <span>DUP STORE</span>
                  </span>
                )}
                {duplicateFieldIds.size > 0 && (
                  <span
                    className="flex items-center gap-0.5 text-[7px] font-mono px-1 py-0.2 rounded font-bold bg-destructive/15 text-destructive border border-destructive/30 uppercase tracking-wide"
                    title="Duplicate field names detected in this store!"
                  >
                    <AlertTriangle size={8} />
                    <span>DUP FIELDS</span>
                  </span>
                )}
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
                        } else {
                          setName(data.storeName || data.label || "");
                          setIsEditing(false);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (!data.label && !data.storeName && !name.trim()) {
                        deleteNode(id);
                      } else {
                        handleSave();
                      }
                    }}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 cursor-pointer min-w-0 group/name"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  title="Click to rename"
                >
                  <span className="text-xs font-semibold text-foreground truncate hover:text-indigo-400 transition-colors">
                    {currentStoreName}
                  </span>
                  <Edit3
                    size={9}
                    className="opacity-0 group-hover/name:opacity-70 text-muted-foreground transition-opacity shrink-0"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-colors"
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
      </div>

      {/* Dynamic State Objects (Fields) list */}
      <div className="flex flex-col border-t border-border/40 text-[9px] font-mono">
        <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 py-1 bg-muted/10">
          <div className="flex items-center gap-1">
            <span className={cn("font-bold", duplicateFieldIds.size > 0 ? "text-destructive" : "text-cyan-500")}>•</span>
            <span>State Objects</span>
          </div>
          {duplicateFieldIds.size > 0 ? (
            <span className="text-[7px] text-destructive font-bold bg-destructive/15 px-1 rounded border border-destructive/30 flex items-center gap-0.5">
              <AlertTriangle size={8} />
              <span>Duplicate Fields</span>
            </span>
          ) : (
            <span className="text-[7px] text-cyan-600 dark:text-cyan-400 font-semibold">{fieldCount} {fieldCount === 1 ? "field" : "fields"}</span>
          )}
        </div>
        {data.fields && data.fields.length > 0 ? (
          data.fields.map((f) => {
            const isDupe = duplicateFieldIds.has(f.id);
            const isOutputConnected = edges.some(
              (e) => e.source === id && e.sourceHandle === `store-field-out-${f.id}`,
            );
            const isInputConnected = edges.some(
              (e) => e.target === id && e.targetHandle === `store-field-in-${f.id}`,
            );

            return (
              <div
                key={f.id}
                className={cn(
                  "relative flex items-center justify-between px-3 py-1 border-b border-border/20 transition-colors group/field",
                  isDupe
                    ? "bg-destructive/15 text-destructive border-destructive/40"
                    : "bg-muted/5 hover:bg-muted/20",
                )}
              >
                {/* Left target handle for custom type contract from TypesNode */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`store-field-in-${f.id}`}
                  className={cn(
                    "w-2 h-2 border border-background -left-1 z-10 transition-all",
                    isInputConnected
                      ? "!bg-purple-400 ring-2 ring-purple-500/40 opacity-100"
                      : "!bg-indigo-400 opacity-0 group-hover/field:opacity-100 hover:scale-125",
                  )}
                  style={{ top: "50%" }}
                  title={`${f.name}: Connect custom type contract from TypesNode`}
                />

                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isDupe ? (
                    <span title={`Duplicate field name "${f.name}". Field names must be unique.`}>
                      <AlertTriangle size={8} className="text-destructive shrink-0" />
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                  )}
                  <span className={cn("font-semibold truncate", isDupe ? "text-destructive font-bold" : "text-foreground/90")}>{f.name}</span>
                  <span className={cn(
                    "text-[7px] px-1 py-0.2 rounded border shrink-0",
                    isDupe ? "bg-destructive/20 border-destructive/40 text-destructive" : "bg-secondary text-muted-foreground border-border/40"
                  )}>
                    {f.type}
                  </span>
                  {f.defaultValue !== undefined && f.defaultValue !== "" && (
                    <span className="text-[7px] text-muted-foreground/60 truncate font-mono">
                      = {typeof f.defaultValue === "object" ? JSON.stringify(f.defaultValue) : String(f.defaultValue)}
                    </span>
                  )}
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`store-field-out-${f.id}`}
                  className={cn(
                    "w-2 h-2 border border-background cursor-pointer hover:scale-125 transition-all -right-1 z-10",
                    isOutputConnected
                      ? "!bg-cyan-400 ring-2 ring-cyan-500/40 scale-110"
                      : "!bg-cyan-500 hover:!bg-cyan-400",
                  )}
                  style={{ top: "50%" }}
                  title={`${f.name}: Drag to WebPage to render state${isOutputConnected ? " (connected)" : ""}`}
                />
              </div>
            );
          })
        ) : (
          <div className="px-3 py-1 text-[8px] text-muted-foreground/50 italic">
            No fields defined yet
          </div>
        )}
      </div>

      {/* Actions list with handles aligned on the right edge */}
      <div className="flex flex-col border-t border-border/40 text-[9px] font-mono">
        <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 py-1 bg-muted/10">
          <div className="flex items-center gap-1">
            <span className="text-indigo-500 font-bold">•</span>
            <span>Manipulators</span>
          </div>
          <span className="text-[7px] text-indigo-500 font-semibold">{actionCount} {actionCount === 1 ? "action" : "actions"}</span>
        </div>

        {/* 1. Load / Populate Action */}
        <div className="relative flex items-center justify-between px-3 py-1 border-b border-border/20 bg-muted/5 hover:bg-muted/20 transition-colors group/row">
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
            className="w-2.5 h-2.5 !bg-emerald-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-1.5 z-10"
            style={{ top: "50%" }}
            title="load: Wire to/from pageLoad action"
          />
          {/* Outbound source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="populate-out"
            className="w-2.5 h-2.5 !bg-emerald-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-1.5 z-10 opacity-0 hover:opacity-100"
            style={{ top: "50%" }}
            title="load: Wire to/from pageLoad action"
          />
        </div>

        {/* 2. Mutate Action */}
        <div className="relative flex items-center justify-between px-3 py-1 border-b border-border/20 bg-muted/5 hover:bg-muted/20 transition-colors group/row">
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
            className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-1.5 z-10"
            style={{ top: "50%" }}
            title="mutate: Wire to/from button or user interaction action"
          />
          {/* Outbound source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="mutate-out"
            className="w-2.5 h-2.5 !bg-indigo-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-1.5 z-10 opacity-0 hover:opacity-100"
            style={{ top: "50%" }}
            title="mutate: Wire to/from button or user interaction action"
          />
        </div>

        {/* 3. Reset Action */}
        <div
          className={cn(
            "relative flex items-center justify-between px-3 py-1 bg-muted/5 hover:bg-muted/20 transition-colors group/row",
            (!data.actions || data.actions.length === 0) && "rounded-b-[10px]",
            data.actions && data.actions.length > 0 && "border-b border-border/20",
          )}
        >
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
            className="w-2.5 h-2.5 !bg-rose-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-1.5 z-10"
            style={{ top: "50%" }}
            title="reset: Wire to/from unmount or reset event"
          />
          {/* Outbound source handle */}
          <Handle
            type="source"
            position={Position.Right}
            id="reset-out"
            className="w-2.5 h-2.5 !bg-rose-500 border-2 border-background cursor-pointer hover:scale-125 transition-transform -right-1.5 z-10 opacity-0 hover:opacity-100"
            style={{ top: "50%" }}
            title="reset: Wire to/from unmount or reset event"
          />
        </div>

        {/* Custom Actions if defined */}
        {data.actions && data.actions.length > 0 && (
          <div className="flex flex-col">
            {data.actions.map((act, idx) => {
              const isLast = idx === data.actions!.length - 1;
              return (
                <div
                  key={act.id}
                  className={cn(
                    "relative flex items-center justify-between px-3 py-1 bg-muted/5 hover:bg-muted/20 transition-colors group/row text-[8px]",
                    !isLast && "border-b border-border/20",
                    isLast && "rounded-b-[10px]",
                  )}
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
                    className="w-2 h-2 !bg-indigo-400 border border-background cursor-pointer hover:scale-125 transition-transform -right-1 z-10"
                    style={{ top: "50%" }}
                    title={`${act.name}: Wire to/from page action`}
                  />
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`store-action-out-${act.id}`}
                    className="w-2 h-2 !bg-indigo-400 border border-background cursor-pointer hover:scale-125 transition-transform -right-1 z-10 opacity-0 hover:opacity-100"
                    style={{ top: "50%" }}
                    title={`${act.name}: Wire to/from page action`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fallback generic handle for legacy edges */}
      <Handle
        type="source"
        position={Position.Right}
        id="store-out"
        style={{ top: "28px", opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
};
