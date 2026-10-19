import React from "react";
import { Zap, Plus, RefreshCw, FileJson } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import type { Parameter } from "@/types/canvas";

interface AgentStateUpdatesHeaderProps {
  isStructured: boolean;
  schemaFields: Parameter[];
  stateUpdatesCount: number;
  onAddUpdate: () => void;
  onAutoMap: () => void;
  onMapAll: () => void;
}

export function AgentStateUpdatesHeader({
  isStructured,
  schemaFields,
  stateUpdatesCount,
  onAddUpdate,
  onAutoMap,
  onMapAll,
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

      {/* Structured Output Schema Preview Banner */}
      {isStructured && (
        <div className="flex flex-col gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-[11px]">
              <FileJson className="w-3.5 h-3.5 text-purple-400" />
              <span>Structured Output Schema Active</span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 border-purple-500/40 text-purple-300 font-mono"
              >
                {schemaFields.length} fields
              </Badge>
            </div>

            {schemaFields.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 gap-1 cursor-pointer"
                  onClick={onAutoMap}
                  title="Auto-match schema fields to state channels by name"
                >
                  <RefreshCw className="w-3 h-3 text-purple-400" />
                  Auto-Map
                </Button>
                <span className="text-purple-400/40 text-[10px]">•</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 gap-1 cursor-pointer"
                  onClick={onMapAll}
                  title="Map all schema fields into channels"
                >
                  Map All
                </Button>
              </div>
            )}
          </div>

          {schemaFields.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {schemaFields.map((f) => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-background/80 border border-purple-500/30 text-purple-200"
                >
                  <span className="font-semibold text-purple-300">
                    {f.name}
                  </span>
                  <span className="text-[8px] text-muted-foreground">
                    :{f.type || "string"}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-purple-300/80 italic">
              No schema properties defined yet. Configure fields in Structured Output below.
            </span>
          )}
        </div>
      )}

      {/* Mapping Rows Header: 1. State Channel | 2. Reducer Action */}
      {stateUpdatesCount > 0 && (
        <div className="flex items-center justify-between px-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="w-[180px]">1. State Channel</span>
            <span className="w-[170px]">2. Reducer Action</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {stateUpdatesCount} update{stateUpdatesCount > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </>
  );
}
