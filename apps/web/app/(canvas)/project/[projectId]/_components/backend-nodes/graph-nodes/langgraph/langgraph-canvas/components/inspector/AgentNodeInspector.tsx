import React from "react";
import { Database } from "lucide-react";
import type {
  AgentNodeData,
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  ToolNode,
  LangGraphToolRefNode,
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
  LangGraphAgentResponseFormatConfig,
  LangGraphStateChannel,
} from "@workspace/canvas";

import { AgentIdentitySection } from "./agent-inspector/AgentIdentitySection";
import { AgentAttachedComponentsSection } from "./agent-inspector/AgentAttachedComponentsSection";
import { AgentStructuredOutputSection } from "./agent-inspector/AgentStructuredOutputSection";
import { AgentEventStreamingSection } from "./agent-inspector/AgentEventStreamingSection";
import { AgentStateUpdatesSection } from "./agent-inspector/AgentStateUpdatesSection";

interface AgentNodeInspectorProps {
  selectedAgentData: AgentNodeData;
  onDeleteAgent: () => void;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  onSelectLLM?: (llmId: string | null) => void;
  onToggleTool?: (toolId: string, connect: boolean) => void;
  onToggleMiddleware?: (mwId: string, connect: boolean) => void;
  stateChannels?: LangGraphStateChannel[];
}

export function AgentNodeInspector({
  selectedAgentData,
  onDeleteAgent,
  onUpdateAgent,
  availableLLMNodes = [],
  availableToolNodes = [],
  availableMiddlewareNodes = [],
  connectedLLMId = null,
  connectedToolIds = [],
  connectedMiddlewareIds = [],
  onSelectLLM,
  onToggleTool,
  onToggleMiddleware,
  stateChannels = [],
}: AgentNodeInspectorProps) {
  const rfConfig: LangGraphAgentResponseFormatConfig =
    selectedAgentData.responseFormat || {
      enabled: false,
      strategy: "auto",
      schemaType: "json_schema",
      schemaJson: "",
      handleErrorMode: "default",
    };

  const updateResponseFormat = (
    changes: Partial<LangGraphAgentResponseFormatConfig>,
  ) => {
    onUpdateAgent({
      responseFormat: {
        ...rfConfig,
        ...changes,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ─── 1. Identity & System Prompt ─────────────────────────────────────── */}
      <AgentIdentitySection
        selectedAgentData={selectedAgentData}
        onDeleteAgent={onDeleteAgent}
        onUpdateAgent={onUpdateAgent}
      />

      {/* ─── 2. Attached Resources Selection ─────────────────────────────────── */}
      <AgentAttachedComponentsSection
        availableLLMNodes={availableLLMNodes}
        availableToolNodes={availableToolNodes}
        availableMiddlewareNodes={availableMiddlewareNodes}
        connectedLLMId={connectedLLMId}
        connectedToolIds={connectedToolIds}
        connectedMiddlewareIds={connectedMiddlewareIds}
        onSelectLLM={onSelectLLM}
        onToggleTool={onToggleTool}
        onToggleMiddleware={onToggleMiddleware}
      />

      {/* ─── 3. State Channel Updates ─────────────────────────────────────────── */}
      <AgentStateUpdatesSection
        selectedAgentData={selectedAgentData}
        onUpdateAgent={onUpdateAgent}
        stateChannels={stateChannels}
      />

      {/* ─── 4. Graph Checkpointer Notice ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3 bg-amber-950/10 dark:bg-amber-950/20 rounded-xl border border-amber-500/20">
        <div className="p-2 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-500 shrink-0">
          <Database className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Graph Checkpointer & Memory
          </span>
          <span className="text-[10px] text-muted-foreground leading-normal">
            Checkpointers save graph state across turns globally. Configure engine and storage via the canvas Checkpointer node or the Memory tab.
          </span>
        </div>
      </div>

      {/* ─── 5. Structured Output / Response Format ────────────────────────────── */}
      <AgentStructuredOutputSection
        rfConfig={rfConfig}
        updateResponseFormat={updateResponseFormat}
      />

      {/* ─── 6. Event Streaming Configuration ──────────────────────────────────── */}
      <AgentEventStreamingSection
        selectedAgentData={selectedAgentData}
        onUpdateAgent={onUpdateAgent}
      />
    </div>
  );
}
