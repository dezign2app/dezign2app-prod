import React from "react";
import { GitBranch, ArrowRight } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import type { RouterDecisionState } from "../types";

export interface RouterDecisionCardProps {
  routerDecision: RouterDecisionState;
}

export function RouterDecisionCard({ routerDecision }: RouterDecisionCardProps) {
  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-sky-950/20 border border-sky-500/30 text-xs">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-sky-500/20">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 font-bold text-sky-400 text-[10.5px] uppercase tracking-wider font-mono">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            Active Route:
          </span>
          <Badge className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border-sky-500/40 text-[10px] font-mono px-2 py-0.5">
            {routerDecision.selectedRoute || "Default Route"}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span>Proceeding to:</span>
          <span className="font-semibold text-sky-300 flex items-center gap-1 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30">
            <ArrowRight className="w-3 h-3 text-sky-400" />
            {routerDecision.targetNodeLabel || routerDecision.targetNodeId || "END"}
          </span>
        </div>
      </div>

      {routerDecision.condition && (
        <div className="flex items-center justify-between text-[9.5px] font-mono bg-black/40 px-2 py-1 rounded border border-sky-500/20">
          <span className="text-muted-foreground">Matched Rule:</span>
          <span className="text-sky-300 font-semibold">{routerDecision.condition}</span>
        </div>
      )}

      {routerDecision.evaluatedBranches && routerDecision.evaluatedBranches.length > 0 && (
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Configured Routes Evaluated ({routerDecision.evaluatedBranches.length})
          </span>
          <div className="flex flex-col gap-1">
            {routerDecision.evaluatedBranches.map((branch, bIdx) => {
              const isWinner =
                branch.matched ||
                (branch.isDefault && routerDecision?.selectedBranchId === branch.id) ||
                (!routerDecision?.selectedBranchId && bIdx === 0 && branch.matched);

              return (
                <div
                  key={branch.id || bIdx}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded border text-[10px] font-mono transition-colors",
                    isWinner
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-medium"
                      : "bg-background/40 border-border/40 text-muted-foreground/80"
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        isWinner
                          ? "bg-emerald-400 shadow-xs shadow-emerald-400"
                          : "bg-muted-foreground/30"
                      )}
                    />
                    <span
                      className={cn(
                        "font-medium",
                        isWinner && "text-foreground font-semibold"
                      )}
                    >
                      {branch.label || `Route ${bIdx + 1}`}
                    </span>
                    {!branch.isDefault && branch.field && (
                      <span className="text-[8.5px] text-muted-foreground bg-muted/40 px-1.5 py-0.2 rounded border border-border/30">
                        {branch.field} {branch.operator} {String(branch.value ?? "")}
                      </span>
                    )}
                    {branch.isDefault && (
                      <span className="text-[8.5px] text-muted-foreground/70 italic">
                        (default fallback)
                      </span>
                    )}
                    {branch.actualValue !== undefined && (
                      <span className="text-[8.5px] text-muted-foreground/60 italic">
                        [state: {JSON.stringify(branch.actualValue)}]
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {branch.targetLabel && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                        {branch.targetLabel}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[8px] px-1.5 py-0 h-4 font-mono uppercase tracking-wider",
                        isWinner
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold"
                          : "bg-muted/20 text-muted-foreground/50 border-border/30"
                      )}
                    >
                      {isWinner ? "Matched" : "Skipped"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
