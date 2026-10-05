import React from "react";
import type { BrowserCheckpoint } from "@/lib/simulation/indexedDBCheckpointer";

export interface TestingCheckpointsTabProps {
  checkpoints: BrowserCheckpoint[];
  threadId: string;
  isTraceExpanded: boolean;
}

export function TestingCheckpointsTab({
  checkpoints,
  threadId,
  isTraceExpanded,
}: TestingCheckpointsTabProps) {
  if (checkpoints.length === 0) {
    return (
      <div className="text-center p-6 border rounded-xl border-dashed text-muted-foreground text-[11px]">
        No checkpoints for thread <code>{threadId}</code>.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 overflow-y-auto hide-scrollbar transition-all ${
        isTraceExpanded ? "max-h-[600px]" : "max-h-[380px]"
      }`}
    >
      {checkpoints.map((cp, idx) => (
        <div
          key={cp.id}
          className="p-2 rounded-lg border bg-background/80 flex flex-col gap-1 text-[10px]"
        >
          <div className="flex items-center justify-between font-mono">
            <span className="text-primary font-bold">
              Turn #{idx + 1} — {cp.stepName}
            </span>
            <span className="text-muted-foreground text-[9px]">
              {new Date(cp.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-[9px] text-muted-foreground">
            State keys: {Object.keys(cp.state).join(", ") || "(empty)"}
          </div>
        </div>
      ))}
    </div>
  );
}
