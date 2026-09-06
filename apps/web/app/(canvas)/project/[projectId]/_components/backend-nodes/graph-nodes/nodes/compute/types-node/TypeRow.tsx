"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Settings, Trash, ArrowUpRight, Lock } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { TypeRowProps } from "./types";

export const TypeRow = React.memo(function TypeRow({
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
