import React from "react";
import { Zap, Plus } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import type { Parameter } from "@/types/canvas";

interface AgentStateUpdatesHeaderProps {
  isStructured?: boolean;
  schemaFields?: Parameter[];
  stateUpdatesCount: number;
  onAddUpdate: () => void;
  onAutoMap?: () => void;
  onMapAll?: () => void;
}

export function AgentStateUpdatesHeader({
  stateUpdatesCount,
  onAddUpdate,
}: AgentStateUpdatesHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Graph State Updates
          </span>
          <span className="text-[10px] text-muted-foreground">
            Mutate channels returned by this node via their configured reducers
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-border gap-1 cursor-pointer"
          onClick={onAddUpdate}
        >
          <Plus className="w-3.5 h-3.5" /> Add Update
        </Button>
      </div>

      {/* Mapping Rows Header: 1. State Channel | 2. Reducer Action | ← | Source Step & Field */}
      {stateUpdatesCount > 0 && (
        <div className="flex items-center justify-between px-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="w-[160px]">1. State Channel</span>
            <span className="w-[140px]">2. Reducer Action</span>
            <span className="text-muted-foreground/50 font-mono">←</span>
            <span>3. New Value / Mapping</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {stateUpdatesCount} update{stateUpdatesCount > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </>
  );
}
