"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Activity, RotateCcw } from "lucide-react";
import { StoreState } from "./types";

export interface LiveStateInspectorProps {
  sandboxState: StoreState;
  onResetDefaults: () => void;
}

export const LiveStateInspector: React.FC<LiveStateInspectorProps> = ({
  sandboxState,
  onResetDefaults,
}) => {
  const entries = Object.entries(sandboxState);

  return (
    <div className="p-3 rounded-lg bg-card/80 border border-border/80 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Activity size={13} className="text-indigo-400" />
          <span>Live Sandbox State</span>
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onResetDefaults}
          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
        >
          <RotateCcw size={10} />
          <span>Reset Defaults</span>
        </Button>
      </div>

      {/* Formatted Live State Tree */}
      <div className="p-2.5 rounded bg-muted/40 font-mono text-[11px] border border-border/50 max-h-40 overflow-y-auto space-y-1">
        {entries.length === 0 ? (
          <span className="text-muted-foreground/60 italic">No state defined</span>
        ) : (
          entries.map(([key, val]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-2 py-0.5 border-b border-border/20 last:border-0"
            >
              <span className="text-indigo-400 font-semibold">{key}:</span>
              <span
                className="text-foreground/90 truncate max-w-[200px]"
                title={typeof val === "object" && val !== null ? JSON.stringify(val) : String(val ?? "")}
              >
                {typeof val === "object" && val !== null ? JSON.stringify(val) : String(val ?? "")}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
