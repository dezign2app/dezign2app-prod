import React from "react";
import { Cpu, Wrench, Shield, GitMerge } from "lucide-react";
import type { Edge } from "@xyflow/react";
import type { LLMConfigState } from "@workspace/canvas";

interface NodeResourceBadgesProps {
  boundLLMs: Edge[];
  boundTools: Edge[];
  boundMiddlewares: Edge[];
  boundStateReducers?: Edge[];
  llmConfig: LLMConfigState;
}

export const NodeResourceBadges: React.FC<NodeResourceBadgesProps> = ({
  boundLLMs,
  boundTools,
  boundMiddlewares,
  boundStateReducers = [],
  llmConfig,
}) => {
  return (
    <div className="grid grid-cols-4 gap-1.5 pb-1">
      <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-secondary/20 border border-border/50 text-center">
        <Cpu className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
        <span className="text-[8px] font-semibold text-muted-foreground uppercase">
          Model
        </span>
        <span className="text-[10px] font-bold text-foreground font-mono truncate max-w-full">
          {boundLLMs.length > 0
            ? "Bound"
            : Boolean(llmConfig.enabled)
              ? "Default"
              : "Off"}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-secondary/20 border border-border/50 text-center">
        <Wrench className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
        <span className="text-[8px] font-semibold text-muted-foreground uppercase">
          Tools
        </span>
        <span className="text-[10px] font-bold text-foreground font-mono truncate max-w-full">
          {boundTools.length} attached
        </span>
      </div>

      <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-secondary/20 border border-border/50 text-center">
        <Shield className="w-3.5 h-3.5 text-purple-400 mb-0.5" />
        <span className="text-[8px] font-semibold text-muted-foreground uppercase">
          Middleware
        </span>
        <span className="text-[10px] font-bold text-foreground font-mono truncate max-w-full">
          {boundMiddlewares.length} active
        </span>
      </div>

      <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-secondary/20 border border-border/50 text-center">
        <GitMerge className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
        <span className="text-[8px] font-semibold text-muted-foreground uppercase">
          State
        </span>
        <span className="text-[10px] font-bold text-foreground font-mono truncate max-w-full">
          {boundStateReducers.length > 0
            ? `${boundStateReducers.length} mutated`
            : "messages"}
        </span>
      </div>
    </div>
  );
};
