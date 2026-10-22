"use client";

import React from "react";
import { Bot, ExternalLink, Network, Sparkles } from "lucide-react";
import { BackendNode, LangGraphInputChannel } from "@workspace/canvas/types";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

export interface AgentSelectorSectionProps {
  availableAgents: BackendNode[];
  selectedAgentNode: BackendNode | undefined;
  inputChannels: LangGraphInputChannel[];
  stateChannels: Array<{ key: string; type: string }>;
  projectId?: string;
  onSelectAgent: (nodeId: string) => void;
  onOpenStudio?: () => void;
}

export const AgentSelectorSection: React.FC<AgentSelectorSectionProps> = ({
  availableAgents,
  selectedAgentNode,
  inputChannels,
  stateChannels,
  projectId,
  onSelectAgent,
  onOpenStudio,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-secondary/20 rounded-xl border border-border/50">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
          Target LangGraph Agent
        </Label>
        <div className="flex items-center gap-2">
          {projectId && selectedAgentNode && onOpenStudio && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenStudio}
              className="h-6 text-[10px] font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2"
              title="Open this agent in LangGraph Studio (new tab)"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open in Studio</span>
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">
            {availableAgents.length} available
          </span>
        </div>
      </div>
      <Select
        value={selectedAgentNode?.id || ""}
        onValueChange={onSelectAgent}
      >
        <SelectTrigger className="h-9 text-xs bg-background/80 border-border/60">
          <SelectValue placeholder="Select an agent..." />
        </SelectTrigger>
        <SelectContent>
          {availableAgents.map((agent) => (
            <SelectItem
              key={agent.id}
              value={agent.id}
              className="text-xs flex items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold text-foreground">
                  {agent.data?.label || "LangGraph Agent"}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedAgentNode && (
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground bg-background/50 px-2.5 py-1.5 rounded-lg border border-border/40">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="font-medium text-foreground">
            {selectedAgentNode.data?.label || "Agent"}
          </span>
          {inputChannels.length > 0 && (
            <>
              <span className="text-[10px]">•</span>
              <span className="text-primary font-mono text-[10px]">
                {inputChannels.length} input {inputChannels.length === 1 ? "channel" : "channels"}
              </span>
            </>
          )}
          <span className="text-[10px]">•</span>
          <span>{stateChannels.length} state channels</span>
          {selectedAgentNode.data?.memoryConfig?.checkpointer && (
            <>
              <span className="text-[10px]">•</span>
              <span className="text-emerald-400 font-mono text-[10px]">
                Memory ({selectedAgentNode.data.memoryConfig.checkpointer})
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
