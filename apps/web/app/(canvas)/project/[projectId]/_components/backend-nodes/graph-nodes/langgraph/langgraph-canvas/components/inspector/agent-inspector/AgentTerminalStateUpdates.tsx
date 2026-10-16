import React from "react";
import { Zap, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Switch } from "@workspace/ui/components/switch";
import type {
  AgentNodeData,
  LangGraphStateChannel,
  LangGraphCustomReducer,
} from "@workspace/canvas";
import { AgentStateUpdatesSection } from "./AgentStateUpdatesSection";

interface AgentTerminalStateUpdatesProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  isStateUpdatesOpen: boolean;
  onToggleOpen: () => void;
  isStateUpdatesEnabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  stateChannels?: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
}

export function AgentTerminalStateUpdates({
  selectedAgentData,
  onUpdateAgent,
  isStateUpdatesOpen,
  onToggleOpen,
  isStateUpdatesEnabled,
  onToggleEnabled,
  stateChannels = [],
  customReducers = [],
}: AgentTerminalStateUpdatesProps) {
  return (
    <div className="flex flex-col gap-2 pt-2.5 border-t border-border/50">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Node Output / State Return
        </span>
        <span className="text-[10px] font-mono text-amber-400/90 font-medium">
          Fixed Terminal Step
        </span>
      </div>

      <div className="rounded-xl border border-amber-500/40 bg-secondary/15 overflow-hidden shadow-xs">
        <div
          className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
          onClick={onToggleOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground font-mono">
                  State Updates
                </span>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 h-4 border font-mono shrink-0 ${
                    isStateUpdatesEnabled
                      ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                      : "border-muted-foreground/30 text-muted-foreground bg-muted/20"
                  }`}
                >
                  {isStateUpdatesEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground truncate">
                Commit returned updates &amp; reducers to graph channels
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-mono text-muted-foreground">
              {(selectedAgentData.stateUpdates || []).length} mapped
            </span>
            <Switch
              checked={isStateUpdatesEnabled}
              onCheckedChange={onToggleEnabled}
              className="scale-85"
              title="Toggle State Updates ON/OFF (Node return value)"
            />
            <button
              type="button"
              onClick={onToggleOpen}
              className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              title={isStateUpdatesOpen ? "Collapse" : "Expand"}
            >
              {isStateUpdatesOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {isStateUpdatesOpen && (
          <div className="border-t border-border/40 p-3 bg-background/30">
            {isStateUpdatesEnabled ? (
              <AgentStateUpdatesSection
                embedded
                selectedAgentData={selectedAgentData}
                onUpdateAgent={onUpdateAgent}
                stateChannels={stateChannels}
                customReducers={customReducers}
              />
            ) : (
              <div className="py-4 px-3 text-center text-xs text-muted-foreground font-mono bg-secondary/10 rounded-lg border border-border/30">
                State updates are disabled. This node will execute without committing custom state mutations back to graph channels.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
