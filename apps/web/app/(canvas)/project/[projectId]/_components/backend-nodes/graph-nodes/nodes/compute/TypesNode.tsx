"use client";

import React, { useState, useEffect, useRef } from "react";
import { NodeProps, Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { Braces, Settings, Trash, Plus, Copy, Lock, ArrowUpRight, AlertCircle, Package, RefreshCw } from "lucide-react";
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
  const typesList: CustomTypeItem[] = data.types || [];
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Re-calculate XYFlow handle bounds whenever typesList changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, typesList, updateNodeInternals]);

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
      selectedTypeId: typesList[0]?.id,
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
      name: `Type${typesList.length + 1}`,
      kind: "interface",
      description: "",
      fields: [
        { id: `f-${Date.now()}-1`, name: "id", type: "string", required: true, isArray: false },
        { id: `f-${Date.now()}-2`, name: "name", type: "string", required: true, isArray: false },
      ],
    };
    const updated = [...typesList, newType];
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
    const updated = typesList.filter((t) => t.id !== typeId);
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

      {/* Body: List of defined types with individual outgoing and incoming handles to each type */}
      <div className="flex flex-col border-t border-border/50">
        {typesList.length > 0 ? (
          <>
            {typesList.map((item) => {
              const incoming = hasIncomingEdge(item.id);
              const outgoing = hasOutgoingEdge(item.id);

              return (
                <div
                  key={item.id}
                  className="group/type relative flex items-center justify-between gap-1.5 px-2 py-1 bg-sidebar-accent/40 hover:bg-sidebar-accent/80 border border-sidebar-border/60 transition-colors text-xs"
                  onClick={(e) => handleOpenConfigForType(item.id, e)}
                >
                  {/* Row Target Handle (Left) - Connects inheritance from base type or external type */}
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`type-in-${item.id}`}
                    className={cn(
                      "!w-2 !h-2 !border !border-background -left-1 z-20 transition-all",
                      incoming || item.extendedFrom
                        ? "!bg-purple-400 !border-purple-200 !opacity-100 ring-2 ring-purple-500/30"
                        : "opacity-0 group-hover/type:opacity-100 hover:scale-125",
                      isPackageNode
                        ? "!bg-emerald-400 hover:!bg-emerald-300"
                        : "!bg-indigo-400 hover:!bg-indigo-300",
                    )}
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                    title={`Input Handle: ${item.name}`}
                  />

                  {/* Row Source Handle (Right) - Connects extension outwards or type reference */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`type-out-${item.id}`}
                    className={cn(
                      "!w-2 !h-2 !border !border-background -right-1 z-20 transition-all",
                      outgoing
                        ? "!bg-purple-400 !border-purple-200 !opacity-100 ring-2 ring-purple-500/30"
                        : "opacity-0 group-hover/type:opacity-100 hover:scale-125",
                      isPackageNode
                        ? "!bg-emerald-400 hover:!bg-emerald-300"
                        : "!bg-indigo-400 hover:!bg-indigo-300",
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
                      {item.kind === "interface"
                        ? "intf"
                        : item.kind === "enum"
                          ? "enum"
                          : "type"}
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
                      {item.kind === "enum"
                        ? `${item.enumValues?.length || 0} vals`
                        : (() => {
                            if (item.fields && item.fields.length > 0) {
                              return `${item.fields.length} props`;
                            }
                            // Count property declarations by semicolons inside the type body
                            const src = item.rawCode || item.typeAliasValue || "";
                            // Extract the body between first { and last }
                            const bodyStart = src.indexOf("{");
                            const bodyEnd = src.lastIndexOf("}");
                            if (bodyStart !== -1 && bodyEnd > bodyStart) {
                              const body = src.slice(bodyStart + 1, bodyEnd);
                              const count = (body.match(/;/g) || []).length;
                              return count > 0 ? `~${count} props` : "alias";
                            }
                            return "alias";
                          })()}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Extend Type button */}
                    {item.isExtendable !== false && (
                      <button
                        className={cn(
                          "p-1 rounded transition-colors cursor-pointer",
                          outgoing
                            ? "text-purple-400 bg-purple-500/15 hover:bg-purple-500/25"
                            : "text-muted-foreground/60 hover:text-purple-400 hover:bg-purple-500/15",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          createExtendedTypeNode(id, item.id);
                        }}
                        title={
                          outgoing
                            ? `Type ${item.name} is extended`
                            : `Extend ${item.name} into custom type`
                        }
                      >
                        <ArrowUpRight size={12} />
                      </button>
                    )}
                    {/* Per-type Gear configuration button */}
                    <button
                      className="p-1 rounded text-muted-foreground/60 hover:text-indigo-400 hover:bg-indigo-500/15 transition-colors cursor-pointer"
                      onClick={(e) => handleOpenConfigForType(item.id, e)}
                      title={`Configure ${item.name}`}
                    >
                      <Settings size={12} />
                    </button>
                    {/* Delete type button (only for non-package types) */}
                    {!item.isReadOnly && !isPackageNode && (
                      <button
                        className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/type:opacity-100 cursor-pointer"
                        onClick={(e) => handleDeleteType(item.id, e)}
                        title={`Delete ${item.name}`}
                      >
                        <Trash size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Quick add type button at bottom of list - ONLY for custom editable types */}
            {!isPackageNode && (
              <button
                className="w-full flex items-center justify-center gap-1.5 py-1 text-[10px] font-medium text-muted-foreground/70 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all mt-0.5"
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
