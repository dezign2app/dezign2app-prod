"use client";

import React, { useState } from "react";
import { NodeProps } from "@xyflow/react";
import { Braces, Settings, Trash, Plus } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { LocalInput } from "../../common/LocalInput";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";
import type { CustomTypeItem } from "@workspace/canvas/types";

export const TypesNode = ({
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

  const [isEditing, setIsEditing] = useState(!data.label);
  const [name, setName] = useState(data.label || "Custom Types");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const scope = data.scope || "global";
  const typesList: CustomTypeItem[] = data.types || [];

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

  // Delete a specific type
  const handleDeleteType = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = typesList.filter((t) => t.id !== typeId);
    updateNode(id, {
      data: {
        ...data,
        types: updated,
      },
    });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[250px] max-w-[320px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-indigo-500 shadow-indigo-500/20 ring-1 ring-indigo-500/30"
          : "border-border/80 hover:border-indigo-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Top Header Row: Icon + Label + Actions */}
      <div className="flex items-center justify-between gap-2.5 px-3 pt-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
            <Braces size={15} />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                Custom Types
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
            </div>

            {isEditing ? (
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

        {/* Action Buttons: Plus (+), Gear (Settings), Trash (Delete) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1 rounded-md text-muted-foreground/70 hover:text-indigo-400 hover:bg-indigo-500/15 transition-colors"
            onClick={handleAddType}
            title="Add New Type"
          >
            <Plus size={14} />
          </button>
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

      {/* Body: List of defined types with individual outgoing handle to each type */}
      <div className="flex flex-col border-t border-border/50">
        {typesList.length > 0 ? (
          <>
            {typesList.map((item) => (
              <div
                key={item.id}
                className="group/type relative flex items-center justify-between gap-1.5 px-2 py-1 bg-sidebar-accent/40 hover:bg-sidebar-accent/80 border border-sidebar-border/60 transition-colors text-xs"
                onClick={(e) => handleOpenConfigForType(item.id, e)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 uppercase shrink-0">
                    {item.kind === "interface"
                      ? "intf"
                      : item.kind === "enum"
                        ? "enum"
                        : "type"}
                  </span>
                  <span className="font-mono text-[11px] text-foreground font-semibold truncate">
                    {item.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono shrink-0">
                    {item.kind === "enum"
                      ? `${item.enumValues?.length || 0} vals`
                      : `${item.fields?.length || 0} props`}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Per-type Gear configuration button */}
                  <button
                    className="p-1 rounded text-muted-foreground/60 hover:text-indigo-400 hover:bg-indigo-500/15 transition-colors"
                    onClick={(e) => handleOpenConfigForType(item.id, e)}
                    title={`Configure ${item.name}`}
                  >
                    <Settings size={12} />
                  </button>
                  {/* Delete type button */}
                  <button
                    className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover/type:opacity-100"
                    onClick={(e) => handleDeleteType(item.id, e)}
                    title={`Delete ${item.name}`}
                  >
                    <Trash size={11} />
                  </button>
                </div>
              </div>
            ))}

            {/* Quick add type button at bottom of list */}
            <button
              className="w-full flex items-center justify-center gap-1.5 py-1  text-[10px] font-medium text-muted-foreground/70 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all mt-0.5"
              onClick={handleAddType}
            >
              <Plus size={12} />
              <span>Add Type</span>
            </button>
          </>
        ) : (
          <button
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border/60 hover:border-indigo-500/40 text-xs text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/5 transition-all"
            onClick={handleAddType}
          >
            <Plus size={13} />
            <span>Add First Type</span>
          </button>
        )}
      </div>
    </div>
  );
};
