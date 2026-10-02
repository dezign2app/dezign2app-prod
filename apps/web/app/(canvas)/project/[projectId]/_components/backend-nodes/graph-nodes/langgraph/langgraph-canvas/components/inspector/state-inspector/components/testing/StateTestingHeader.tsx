import React from "react";
import { Play, RotateCcw, Layers, Code2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";

export interface StateTestingHeaderProps {
  testingSubMode: "transition" | "playground";
  onSubModeChange: (mode: "transition" | "playground") => void;
  channelCount: number;
  onResetToInitial: () => void;
}

export function StateTestingHeader({
  testingSubMode,
  onSubModeChange,
  channelCount,
  onResetToInitial,
}: StateTestingHeaderProps) {
  return (
    <div className="flex flex-col gap-2.5 bg-muted/30 p-3 rounded-lg border border-border/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Play className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <span>State & Reducer Simulation Sandbox</span>
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono"
              >
                LIVE
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Test state transitions, LangGraph reducers, and message deduplication
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onResetToInitial}
          className="h-7 px-2 text-[11px] gap-1 font-mono hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          title="Reset state to channel default values"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset State</span>
        </Button>
      </div>

      {/* Sub-mode pill buttons */}
      <div className="flex items-center gap-1 bg-background/60 p-0.5 rounded-md border border-border/40">
        <button
          type="button"
          onClick={() => onSubModeChange("transition")}
          className={`flex-1 py-1 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            testingSubMode === "transition"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Simulate State Updates</span>
          <span className="text-[10px] opacity-80 font-mono">
            ({channelCount} channels)
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSubModeChange("playground")}
          className={`flex-1 py-1 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            testingSubMode === "playground"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Reducer Playground</span>
          <Badge
            variant="secondary"
            className="text-[9px] px-1 py-0 h-3.5 bg-purple-500/20 text-purple-200 border-0"
          >
            Unit Test
          </Badge>
        </button>
      </div>
    </div>
  );
}
