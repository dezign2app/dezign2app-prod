"use client";

import React, { useState, useEffect, useRef } from "react";
import { NodeProps, Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { Braces, Settings, Trash, Plus, Copy, Lock, ArrowUpRight, AlertCircle, Package, RefreshCw, ChevronDown } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { LocalInput } from "../../common/LocalInput";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";
import type { CustomTypeItem } from "@workspace/canvas/types";
import { createExtendedTypeNode, refreshPackageTypesFromNodeModules } from "@/lib/stores/backendCanvas/packageTypesSync";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// TypeRow – extracted so it can be rendered in both the pinned + scroll areas
// ---------------------------------------------------------------------------
interface TypeRowProps {
  item: CustomTypeItem;
  isConnected: boolean;  // has an active outgoing edge OR extendedFrom
  incoming: boolean;
  outgoing: boolean;
  isPackageNode: boolean;
  onOpenConfig: (e: React.MouseEvent) => void;
  onExtend: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}

const TypeRow = React.memo(function TypeRow({
  item,
  isConnected,
  incoming,
  outgoing,
  isPackageNode,
  onOpenConfig,
  onExtend,
  onDelete,
}: TypeRowProps) {
  const fieldCount = React.useMemo(() => {
    if (item.kind === "enum") return `${item.enumValues?.length ?? 0} vals`;
    if (item.fields && item.fields.length > 0) return `${item.fields.length} props`;
    const src = item.rawCode || item.typeAliasValue || "";
    const bodyStart = src.indexOf("{");
    const bodyEnd = src.lastIndexOf("}");
    if (bodyStart !== -1 && bodyEnd > bodyStart) {
      const count = (src.slice(bodyStart + 1, bodyEnd).match(/;/g) || []).length;
      return count > 0 ? `~${count} props` : "alias";
    }
    return "alias";
  }, [item]);

  return (
    <div
      className={cn(
        "group/type relative flex items-center justify-between gap-1.5 px-2 py-1",
        "bg-sidebar-accent/40 hover:bg-sidebar-accent/80 border border-sidebar-border/60",
        "transition-colors text-xs",
        isConnected && "border-l-2 border-l-purple-500/60",
      )}
      onClick={onOpenConfig}
    >
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`type-in-${item.id}`}
        className={cn(
          "!w-2 !h-2 !border !border-background -left-1 z-20 transition-all",
          incoming || item.extendedFrom
            ? "!bg-purple-400 !border-purple-200 !opacity-100 ring-2 ring-purple-500/30"
            : "opacity-0 group-hover/type:opacity-100 hover:scale-125",
          isPackageNode ? "!bg-emerald-400 hover:!bg-emerald-300" : "!bg-indigo-400 hover:!bg-indigo-300",
        )}
        style={{ top: "50%", transform: "translateY(-50%)" }}
        title={`Input Handle: ${item.name}`}
      />

      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`type-out-${item.id}`}
        className={cn(
          "!w-2 !h-2 !border !border-background -right-1 z-20 transition-all",
          outgoing
            ? "!bg-purple-400 !border-purple-200 !opacity-100 ring-2 ring-purple-500/30"
            : "opacity-0 group-hover/type:opacity-100 hover:scale-125",
          isPackageNode ? "!bg-emerald-400 hover:!bg-emerald-300" : "!bg-indigo-400 hover:!bg-indigo-300",
        )}
        style={{ top: "50%", transform: "translateY(-50%)" }}
        title={`Output Handle: ${item.name}`}
      />

      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span
          className={cn(
            "text-[8px] font-mono font-bold px-1.5 py-0.2 rounded uppercase shrink-0",
            item.extendedFrom
              ? "bg-purple-500/15 text-purple-400"
              : isPackageNode
                ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                : "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400",
          )}
        >
          {item.kind === "interface" ? "intf" : item.kind === "enum" ? "enum" : "type"}
        </span>
        <span className="font-mono text-[11px] text-foreground font-semibold truncate">
          {item.name}
        </span>
        {item.extendedFrom && (
          <span
            className="text-[7px] font-mono px-1 py-0.2 rounded bg-purple-500/15 text-purple-400 font-bold shrink-0 truncate max-w-[90px]"
            title={`Extends ${item.extendedFrom}`}
          >
            EXTENDS
          </span>
        )}
        {item.packageSource && !item.extendedFrom && (
          <span
            className="text-[7px] font-mono px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-500 font-bold shrink-0"
            title={`Imported from package: ${item.packageSource}`}
          >
            PKG
          </span>
        )}
        {item.isReadOnly && (
          <span title="Read-only package type" className="inline-flex items-center shrink-0">
            <Lock size={10} className="text-muted-foreground/60" />
          </span>
        )}
        <span className="text-[9px] text-muted-foreground/50 font-mono shrink-0">
          {fieldCount}
        </span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {item.isExtendable !== false && (
          <button
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              outgoing
                ? "text-purple-400 bg-purple-500/15 hover:bg-purple-500/25"
                : "text-muted-foreground/60 hover:text-purple-400 hover:bg-purple-500/15",
            )}
            onClick={onExtend}
            title={outgoing ? `Type ${item.name} is extended` : `Extend ${item.name} into custom type`}
          >
            <ArrowUpRight size={12} />
          </button>
        )}
        <button
          className="p-1 rounded text-muted-foreground/60 hover:text-indigo-400 hover:bg-indigo-500/15 transition-colors cursor-pointer"
          onClick={onOpenConfig}
          title={`Configure ${item.name}`}
        >
          <Settings size={12} />
        </button>
        {onDelete && (
          <button
            className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/type:opacity-100 cursor-pointer"
            onClick={onDelete}
            title={`Delete ${item.name}`}
          >
            <Trash size={11} />
          </button>
        )}
      </div>
    </div>
  );
});


export const TypesNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const edges = useBackendCanvasStore((s) => s.edges);
  const requestDeleteNode = useBackendCanvasStore((s) => s.requestDeleteNode);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );
  const updateNodeInternals = useUpdateNodeInternals();

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const [isEditing, setIsEditing] = useState(!data.label);
  const [name, setName] = useState(data.label || "Custom Types");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const scope = data.scope || "global";
  const rawTypesList: CustomTypeItem[] = data.types || [];
  const [isRefreshing, setIsRefreshing] = useState(false);

  const COLLAPSED_THRESHOLD = 6;
  const [isListCollapsed, setIsListCollapsed] = useState(true);

  // Connected = has an active outgoing edge OR extends another type.
  // These are pinned above the scroll area so their handles are never clipped.
  const { connectedTypes, restTypes, totalCount } = React.useMemo(() => {
    const connected: CustomTypeItem[] = [];
    const rest: CustomTypeItem[] = [];
    for (const t of rawTypesList) {
      const hasOutgoing = edges.some(
        (e) => e.source === id && e.sourceHandle === `type-out-${t.id}`,
      );
      if (t.extendedFrom || hasOutgoing) {
        connected.push(t);
      } else {
        rest.push(t);
      }
    }
    return { connectedTypes: connected, restTypes: rest, totalCount: rawTypesList.length };
  }, [rawTypesList, edges, id]);

  // Collapse only applies to the non-connected rest list
  const shouldCollapse = restTypes.length > COLLAPSED_THRESHOLD;

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const pkg = data.packageName || data.label;
    if (!pkg) return;
    setIsRefreshing(true);
    try {
      await refreshPackageTypesFromNodeModules(id, pkg);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Re-calculate XYFlow handle bounds whenever the types list changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, rawTypesList, updateNodeInternals]);

  React.useEffect(() => {
    setName(data.label || "Custom Types");
    if (!data.label) {
      setIsEditing(true);
    }
  }, [data.label]);

  React.useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      if (!data.label) {
        deleteNode(id);
        return;
      }
      setName(data.label || "Custom Types");
      setIsEditing(false);
      return;
    }
    updateNode(id, {
      data: {
        ...data,
        label: trimmed,
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
      type: "types",
      selectedTypeId: (connectedTypes[0] ?? restTypes[0])?.id,
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestDeleteNode(id);
  };

  // Add new type handler
  const handleAddType = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newTypeId = `type-${Date.now()}`;
    const newType: CustomTypeItem = {
      id: newTypeId,
      name: `Type${rawTypesList.length + 1}`,
      kind: "interface",
      description: "",
      fields: [
        { id: `f-${Date.now()}-1`, name: "id", type: "string", required: true, isArray: false },
        { id: `f-${Date.now()}-2`, name: "name", type: "string", required: true, isArray: false },
      ],
    };
    const updated = [...rawTypesList, newType];
    updateNode(id, {
      data: {
        ...data,
        types: updated,
      },
    });
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "types",
      selectedTypeId: newTypeId,
    });
  };

  // Open config specifically for a selected type
  const handleOpenConfigForType = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "types",
      selectedTypeId: typeId,
    });
  };

  // Delete a specific type and any edges attached to it
  const handleDeleteType = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = rawTypesList.filter((t) => t.id !== typeId);
    updateNode(id, {
      data: {
        ...data,
        types: updated,
      },
    });
    // Clean up any edges connected to this specific type's handles
    const connectedEdges = edges.filter(
      (edge) =>
        (edge.source === id && edge.sourceHandle === `type-out-${typeId}`) ||
        (edge.target === id && edge.targetHandle === `type-in-${typeId}`),
    );
    connectedEdges.forEach((edge) => deleteEdge(edge.id));
  };

  const hasIncomingEdge = (typeId: string) =>
    edges.some((e) => e.target === id && e.targetHandle === `type-in-${typeId}`);
  const hasOutgoingEdge = (typeId: string) =>
    edges.some((e) => e.source === id && e.sourceHandle === `type-out-${typeId}`);

  const isPackageNode = Boolean(
    data.isPackageNode ||
      (data.packageSources && data.packageSources.length > 0 && !data.isExtended),
  );
  const isInstalled = data.isInstalled !== false;
  const hasInstallError = isPackageNode && (!isInstalled || Boolean(data.installError));

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[250px] max-w-[320px] shadow-md transition-all duration-150 cursor-pointer select-none",
        hasInstallError
          ? "border-red-500 shadow-red-500/20 ring-1 ring-red-500/50"
          : selected
            ? "border-indigo-500 shadow-indigo-500/20 ring-1 ring-indigo-500/30"
            : isPackageNode
              ? "border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg"
              : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Handles for connections and extensions */}
      <Handle
        type="target"
        position={Position.Left}
        id="types-in"
        className={cn(
          "!w-2.5 !h-2.5 !border-2 !border-background -left-1.5",
          hasInstallError ? "!bg-red-500" : isPackageNode ? "!bg-emerald-400" : "!bg-indigo-400",
        )}
        style={{ top: "24px" }}
        title="Incoming Type Reference"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="types-out"
        className={cn(
          "!w-2.5 !h-2.5 !border-2 !border-background -right-1.5",
          hasInstallError ? "!bg-red-500" : isPackageNode ? "!bg-emerald-400" : "!bg-indigo-400",
        )}
        style={{ top: "24px" }}
        title="Outgoing Type Reference"
      />

      {/* Top Header Row: Icon + Label + Actions */}
      <div className="flex items-center justify-between gap-2.5 px-3 pt-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              "p-1.5 rounded-lg shrink-0 border",
              hasInstallError
                ? "bg-red-500/15 text-red-500 border-red-500/30"
                : isPackageNode
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
            )}
          >
            {isPackageNode ? <Package size={15} /> : <Braces size={15} />}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "text-[8px] uppercase font-bold tracking-wider",
                  hasInstallError
                    ? "text-red-500"
                    : isPackageNode
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-indigo-600 dark:text-indigo-400",
                )}
              >
                {isPackageNode ? "Package Types" : "Custom Types"}
              </span>

              {!isPackageNode && (
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
              )}

              {Boolean(data.isExtended) && (
                <span className="text-[7px] font-mono px-1 py-0.2 rounded font-medium bg-purple-500/15 text-purple-400">
                  EXTENDED
                </span>
              )}

              {isPackageNode && (
                <span className="text-[7px] font-mono px-1 py-0.2 rounded font-medium bg-emerald-500/15 text-emerald-400">
                  {data.packageName || "PKG"}
                </span>
              )}

              {hasInstallError && (
                <span className="text-[7px] font-mono px-1 py-0.2 rounded font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                  NOT INSTALLED
                </span>
              )}

              {/* Type count badge */}
              {totalCount > 0 && (
                <span
                  className={cn(
                    "text-[7px] font-mono px-1.5 py-0.2 rounded-full font-bold tabular-nums",
                    isPackageNode
                      ? "bg-emerald-500/10 text-emerald-500/80"
                      : "bg-indigo-500/10 text-indigo-500/80",
                  )}
                >
                  {totalCount}
                </span>
              )}
            </div>

            {isPackageNode ? (
              <span
                className="text-xs font-semibold text-foreground truncate"
                title={data.packageName || data.label || "Package Types"}
              >
                {data.packageName || data.label || "Package Types"}
              </span>
            ) : isEditing ? (
              <LocalInput
                ref={inputRef}
                value={name}
                placeholder="Enter types label..."
                onChange={(e) => setName(e.target.value)}
                className="h-5 text-xs font-semibold px-1 py-0 bg-background/80 border-border/80"
                autoFocus
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    if (!data.label) {
                      deleteNode(id);
                      return;
                    }
                    setName(data.label || "Custom Types");
                    setIsEditing(false);
                  }
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
                title={data.label || "Custom Types"}
              >
                {data.label || "Custom Types"}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: Plus (+ only for custom types), Gear (Settings), Trash (Delete) */}
        <div className="flex items-center gap-1 shrink-0">
          {isPackageNode && (
            <button
              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer disabled:opacity-50"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Re-sync types from node_modules"
            >
              <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
            </button>
          )}
          {!isPackageNode && (
            <button
              className="p-1 rounded-md text-muted-foreground/70 hover:text-indigo-400 hover:bg-indigo-500/15 transition-colors cursor-pointer"
              onClick={handleAddType}
              title="Add New Type"
            >
              <Plus size={14} />
            </button>
          )}
          <button
            className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={handleOpenConfig}
            title="Configure Node"
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

      {/* Missing node_modules Alert Banner */}
      {hasInstallError && (
        <div className="mx-2.5 p-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <AlertCircle size={13} className="text-red-500 shrink-0" />
            <span>Missing from node_modules</span>
          </div>
          <p className="text-[10px] text-red-300/80 leading-tight">
            {data.installError ||
              `Package "${data.packageName || "dependency"}" saved to package.json. Run pnpm i to install.`}
          </p>
          <div className="flex items-center justify-between gap-1 mt-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-red-500/20 font-mono text-[9px] text-red-200">
            <span className="truncate">pnpm i</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText("pnpm i");
                  toast.success("Copied: pnpm i");
                }
              }}
              className="hover:text-white p-0.5 cursor-pointer"
              title="Copy install command"
            >
              <Copy size={10} />
            </button>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[9px] font-semibold border border-red-500/30 transition-colors cursor-pointer disabled:opacity-50 mt-1"
            title="Re-check node_modules and extract types"
          >
            <RefreshCw size={10} className={cn(isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? "Checking..." : "Check Again / Sync"}</span>
          </button>
        </div>
      )}

      {/* Body: types list split into pinned (connected) + collapsible (rest) */}
      <div className="flex flex-col border-t border-border/50">
        {totalCount > 0 ? (
          <>
            {/* ── PINNED SECTION: Connected / extended types ──────────────────
                These are always rendered outside any overflow container so
                xyflow can correctly position edge handles regardless of scroll. */}
            {connectedTypes.length > 0 && (
              <div className="flex flex-col">
                {connectedTypes.length > 0 && restTypes.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 border-b border-border/30 bg-purple-500/5">
                    <span className="text-[7px] uppercase font-bold tracking-wider text-purple-400/70">
                      Connected
                    </span>
                    <span className="text-[7px] font-mono text-purple-400/50">
                      {connectedTypes.length}
                    </span>
                  </div>
                )}
                {connectedTypes.map((item) => (
                  <TypeRow
                    key={item.id}
                    item={item}
                    isConnected
                    incoming={hasIncomingEdge(item.id)}
                    outgoing={hasOutgoingEdge(item.id)}
                    isPackageNode={isPackageNode}
                    onOpenConfig={(e) => handleOpenConfigForType(item.id, e)}
                    onExtend={(e) => { e.stopPropagation(); createExtendedTypeNode(id, item.id); }}
                    onDelete={
                      !item.isReadOnly && !isPackageNode
                        ? (e) => handleDeleteType(item.id, e)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            {/* ── SCROLLABLE SECTION: Rest of types (no active connections) ── */}
            {restTypes.length > 0 && (
              <div className="flex flex-col">
                {connectedTypes.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 border-t border-b border-border/30 bg-muted/20">
                    <span className={cn(
                      "text-[7px] uppercase font-bold tracking-wider",
                      isPackageNode ? "text-emerald-500/60" : "text-indigo-400/60",
                    )}>
                      All types
                    </span>
                    <span className={cn(
                      "text-[7px] font-mono",
                      isPackageNode ? "text-emerald-500/40" : "text-indigo-400/40",
                    )}>
                      {restTypes.length}
                    </span>
                  </div>
                )}

                <div className="relative">
                  <div
                    className={cn(
                      "flex flex-col overflow-y-auto transition-all duration-200",
                      shouldCollapse && isListCollapsed ? "max-h-[180px]" : "max-h-none",
                    )}
                  >
                    {restTypes.map((item) => (
                      <TypeRow
                        key={item.id}
                        item={item}
                        isConnected={false}
                        incoming={hasIncomingEdge(item.id)}
                        outgoing={hasOutgoingEdge(item.id)}
                        isPackageNode={isPackageNode}
                        onOpenConfig={(e) => handleOpenConfigForType(item.id, e)}
                        onExtend={(e) => { e.stopPropagation(); createExtendedTypeNode(id, item.id); }}
                        onDelete={
                          !item.isReadOnly && !isPackageNode
                            ? (e) => handleDeleteType(item.id, e)
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  {/* Fade overlay when collapsed */}
                  {shouldCollapse && isListCollapsed && (
                    <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-t from-card/95 via-card/60 to-transparent" />
                  )}
                </div>

                {/* Show all / Collapse toggle */}
                {shouldCollapse && (
                  <button
                    className={cn(
                      "w-full flex items-center justify-center gap-1 py-1 text-[9px] font-semibold transition-colors border-t border-border/40",
                      isPackageNode
                        ? "text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/5"
                        : "text-indigo-500/70 hover:text-indigo-400 hover:bg-indigo-500/5",
                    )}
                    onClick={(e) => { e.stopPropagation(); setIsListCollapsed((v) => !v); }}
                  >
                    {isListCollapsed ? (
                      <>
                        <span>Show all {restTypes.length} types</span>
                        <ChevronDown size={10} />
                      </>
                    ) : (
                      <>
                        <span>Collapse</span>
                        <ChevronDown size={10} className="rotate-180" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Add type button – custom types only */}
            {!isPackageNode && (
              <button
                className="w-full flex items-center justify-center gap-1.5 py-1 text-[10px] font-medium text-muted-foreground/70 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all border-t border-border/30"
                onClick={handleAddType}
              >
                <Plus size={12} />
                <span>Add Type</span>
              </button>
            )}
          </>
        ) : (
          !isPackageNode && (
            <button
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border/60 hover:border-indigo-500/40 text-xs text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
              onClick={handleAddType}
            >
              <Plus size={13} />
              <span>Add First Type</span>
            </button>
          )
        )}
      </div>
    </div>
  );
};
