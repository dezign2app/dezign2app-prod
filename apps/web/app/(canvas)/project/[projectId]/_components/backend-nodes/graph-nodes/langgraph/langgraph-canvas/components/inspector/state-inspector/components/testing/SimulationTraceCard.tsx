import React from "react";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import type { ChannelSimulationResult } from "../../utils/reducerSimulationEngine";

export interface SimulationTraceCardProps {
  simulationResult: {
    channelResults: ChannelSimulationResult[];
    unmatchedPayloadKeys: string[];
  };
}

export function SimulationTraceCard({
  simulationResult,
}: SimulationTraceCardProps) {
  const updatedCount = simulationResult.channelResults.filter(
    (r) => r.status === "updated",
  ).length;

  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/25">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-foreground text-xs">
            Reducer Execution Trace & State Transition
          </span>
        </div>
        <Badge
          variant="secondary"
          className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono"
        >
          {updatedCount} updated
        </Badge>
      </div>

      {/* Unmatched Payload Warning */}
      {simulationResult.unmatchedPayloadKeys.length > 0 && (
        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Warning: Incoming update returned keys not defined in State Channels:{" "}
            <strong>
              {simulationResult.unmatchedPayloadKeys.join(", ")}
            </strong>
          </span>
        </div>
      )}

      {/* Channel-by-channel diff cards */}
      <div className="flex flex-col gap-2">
        {simulationResult.channelResults.map((r) => (
          <div
            key={r.channelKey}
            className={`flex flex-col gap-1.5 p-2 rounded border text-xs font-mono ${
              r.status === "updated"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : r.status === "error"
                  ? "bg-destructive/10 border-destructive/30"
                  : "bg-muted/15 border-border/40 opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-foreground">
                  {r.channelKey}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[9px] h-3.5 px-1 py-0 bg-blue-500/20 text-blue-300 border-0"
                >
                  {r.reducerName}
                </Badge>
                {r.status === "updated" && (
                  <Badge
                    variant="secondary"
                    className="text-[8px] h-3.5 px-1 py-0 bg-emerald-500/20 text-emerald-300 border-0"
                  >
                    UPDATED
                  </Badge>
                )}
                {r.status === "unchanged" && (
                  <span className="text-[9px] text-muted-foreground font-sans">
                    (No incoming update)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
                <Clock className="w-2.5 h-2.5" />
                <span>{r.durationMs.toFixed(2)}ms</span>
              </div>
            </div>

            {r.status === "error" && r.error && (
              <div className="text-[10px] text-destructive flex items-center gap-1 font-mono">
                <AlertCircle className="w-3 h-3" />
                <span>Reducer Error: {r.error}</span>
              </div>
            )}

            {r.status === "updated" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] mt-1 pt-1 border-t border-border/30">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground font-sans font-semibold">
                    1. Previous (prev):
                  </span>
                  <pre className="p-1 rounded bg-background/50 border border-border/30 overflow-x-auto text-muted-foreground">
                    {JSON.stringify(r.prevValue, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground font-sans font-semibold">
                    2. Incoming (next):
                  </span>
                  <pre className="p-1 rounded bg-background/50 border border-border/30 overflow-x-auto text-blue-300">
                    {JSON.stringify(r.updateValue, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground font-sans font-semibold text-emerald-400">
                    3. Merged Result:
                  </span>
                  <pre className="p-1 rounded bg-background/50 border border-border/30 overflow-x-auto text-emerald-300 font-bold">
                    {JSON.stringify(r.nextValue, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
