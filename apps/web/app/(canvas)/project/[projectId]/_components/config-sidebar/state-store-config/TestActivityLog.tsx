"use client";

import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Terminal } from "lucide-react";
import { TestHistoryEntry } from "./types";

export interface TestActivityLogProps {
  history: TestHistoryEntry[];
}

export const TestActivityLog: React.FC<TestActivityLogProps> = ({ history }) => {
  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Terminal size={12} />
        <span>Activity Log & State Diffs ({history.length})</span>
      </Label>

      {history.length === 0 ? (
        <div className="p-3 text-center text-[10px] text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border/60">
          No actions dispatched yet. Click &quot;Run Manipulator&quot; or run test cases above to see live state changes.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg bg-card/80 border border-border/70 space-y-1.5 text-[10px] font-mono"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-indigo-400">{item.manipulatorName}()</span>
                  <Badge variant="secondary" className="text-[8px] py-0 px-1">
                    {item.category.replace("_", " ")}
                  </Badge>
                </div>
                <span className="text-muted-foreground/60 text-[9px]">{item.timestamp}</span>
              </div>

              {/* Changed Keys Badges */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-muted-foreground text-[9px]">Mutated:</span>
                {item.changedKeys.length === 0 ? (
                  <span className="text-muted-foreground/70 italic text-[9px]">None</span>
                ) : (
                  item.changedKeys.map((key) => (
                    <span
                      key={key}
                      className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px]"
                    >
                      {key}: {JSON.stringify(item.beforeState[key])} → {JSON.stringify(item.afterState[key])}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
