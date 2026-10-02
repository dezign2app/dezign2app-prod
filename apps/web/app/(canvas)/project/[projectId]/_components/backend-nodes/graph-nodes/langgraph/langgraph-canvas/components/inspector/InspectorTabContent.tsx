import React from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import type {
  LangGraphStateChannel,
  LangGraphCustomReducer,
  StepNodeData,
  LangGraphLLMNodeData,
  ToolNodeData,
  MiddlewareNodeData,
  AgentNodeData,
  MemoryNodeData,
  OutputNodeData,
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  ToolNode,
  LangGraphToolRefNode,
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
  MemoryNode,
  LangGraphMemoryRefNode,
  OutputNode,
  LangGraphCanvasNode,
} from "@workspace/canvas";
import { LLMNodeInspector } from "./LLMNodeInspector";
import { StepNodeInspector } from "./StepNodeInspector";
import { ToolNodeInspector } from "./ToolNodeInspector";
import { MiddlewareNodeInspector } from "./MiddlewareNodeInspector";
import { AgentNodeInspector } from "./AgentNodeInspector";
import { MemoryNodeInspector } from "./MemoryNodeInspector";
import { OutputNodeInspector } from "./OutputNodeInspector";
import type { ConnectedRouteInfo } from "../../../LangGraphNode";

interface InspectorTabContentProps {
  selectedStepData: StepNodeData | null;
  selectedLLMData?: LangGraphLLMNodeData | null;
  selectedToolData?: ToolNodeData | null;
  selectedMiddlewareData?: MiddlewareNodeData | null;
  selectedAgentData?: AgentNodeData | null;
  selectedMemoryData?: MemoryNodeData | null;
  selectedOutputData?: OutputNodeData | null;
  connectedToolsCount?: number;
  connectedMiddlewareCount?: number;
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  availableMemoryNodes?: (MemoryNode | LangGraphMemoryRefNode)[];
  masterToolNodes?: ToolNode[];
  masterMiddlewareNodes?: MiddlewareNode[];
  nodes?: LangGraphCanvasNode[];
  connectedRoutes?: ConnectedRouteInfo[];
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  connectedMemoryIds?: string[];
  onAddToolRef?: (masterToolId: string) => void;
  onRemoveToolRef?: (toolRefId: string) => void;
  onAddMiddlewareRef?: (masterMwId: string) => void;
  onRemoveMiddlewareRef?: (mwRefId: string) => void;
  onSelectLLM?: (llmId: string | null) => void;
  onToggleTool?: (toolId: string, connect: boolean) => void;
  onToggleMiddleware?: (mwId: string, connect: boolean) => void;
  onToggleMemory?: (memId: string, connect: boolean) => void;
  onDeleteStep: () => void;
  onUpdateStep: (changes: Partial<StepNodeData>) => void;
  onUpdateLLM?: (changes: Partial<LangGraphLLMNodeData>) => void;
  onUpdateTool?: (changes: Partial<ToolNodeData>) => void;
  onUpdateMiddleware?: (changes: Partial<MiddlewareNodeData>) => void;
  onUpdateAgent?: (changes: Partial<AgentNodeData>) => void;
  onUpdateMemory?: (changes: Partial<MemoryNodeData>) => void;
  onUpdateOutput?: (changes: Partial<OutputNodeData>) => void;
  stateChannels: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
  onClose?: () => void;
}

export function InspectorTabContent({
  selectedStepData,
  selectedLLMData,
  selectedToolData,
  selectedMiddlewareData,
  selectedAgentData,
  selectedMemoryData,
  selectedOutputData,
  connectedToolsCount = 0,
  connectedMiddlewareCount = 0,
  availableLLMNodes,
  availableToolNodes,
  availableMiddlewareNodes,
  availableMemoryNodes,
  masterToolNodes,
  masterMiddlewareNodes,
  nodes,
  connectedRoutes = [],
  connectedLLMId,
  connectedToolIds,
  connectedMiddlewareIds,
  connectedMemoryIds,
  onAddToolRef,
  onRemoveToolRef,
  onAddMiddlewareRef,
  onRemoveMiddlewareRef,
  onSelectLLM,
  onToggleTool,
  onToggleMiddleware,
  onToggleMemory,
  onDeleteStep,
  onUpdateStep,
  onUpdateLLM,
  onUpdateTool,
  onUpdateMiddleware,
  onUpdateAgent,
  onUpdateMemory,
  onUpdateOutput,
  stateChannels,
  customReducers,
  onClose,
}: InspectorTabContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
      {onClose && (
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Node Configuration
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
            onClick={onClose}
            title="Close inspector (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      {selectedLLMData ? (
        <LLMNodeInspector
          selectedLLMData={selectedLLMData}
          onDeleteStep={onDeleteStep}
          onUpdateLLM={onUpdateLLM}
        />
      ) : selectedToolData ? (
        <ToolNodeInspector
          selectedToolData={selectedToolData}
          onDeleteTool={onDeleteStep}
          onUpdateTool={onUpdateTool || (() => {})}
          stateChannels={stateChannels}
        />
      ) : selectedMiddlewareData ? (
        <MiddlewareNodeInspector
          selectedMiddlewareData={selectedMiddlewareData}
          onDeleteMiddleware={onDeleteStep}
          onUpdateMiddleware={onUpdateMiddleware || (() => {})}
        />
      ) : selectedMemoryData ? (
        <MemoryNodeInspector
          selectedMemoryData={selectedMemoryData}
          onDeleteMemory={onDeleteStep}
          onUpdateMemory={onUpdateMemory || (() => {})}
        />
      ) : selectedOutputData ? (
        <OutputNodeInspector
          selectedOutputData={selectedOutputData}
          onDeleteOutput={onDeleteStep}
          onUpdateOutput={onUpdateOutput || (() => {})}
          stateChannels={stateChannels}
          availableLLMNodes={availableLLMNodes}
          connectedRoutes={connectedRoutes}
        />
      ) : selectedAgentData ? (
        <AgentNodeInspector
          selectedAgentData={selectedAgentData}
          onDeleteAgent={onDeleteStep}
          onUpdateAgent={onUpdateAgent || (() => {})}
          availableLLMNodes={availableLLMNodes}
          availableToolNodes={availableToolNodes}
          availableMiddlewareNodes={availableMiddlewareNodes}
          masterToolNodes={masterToolNodes}
          masterMiddlewareNodes={masterMiddlewareNodes}
          nodes={nodes}
          connectedLLMId={connectedLLMId}
          connectedToolIds={connectedToolIds}
          connectedMiddlewareIds={connectedMiddlewareIds}
          onSelectLLM={onSelectLLM}
          onToggleTool={onToggleTool}
          onAddToolRef={onAddToolRef}
          onRemoveToolRef={onRemoveToolRef}
          onToggleMiddleware={onToggleMiddleware}
          onAddMiddlewareRef={onAddMiddlewareRef}
          onRemoveMiddlewareRef={onRemoveMiddlewareRef}
          stateChannels={stateChannels}
          customReducers={customReducers}
        />
      ) : selectedStepData ? (
        <StepNodeInspector
          selectedStepData={selectedStepData}
          onDeleteStep={onDeleteStep}
          onUpdateStep={onUpdateStep}
          stateChannels={stateChannels}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-6 text-muted-foreground">
          <Sparkles className="w-8 h-8 text-muted-foreground/40 stroke-[1.5]" />
          <span className="text-sm font-semibold text-foreground">
            Select a node
          </span>
          <span className="text-xs text-muted-foreground">
            Click any step on the canvas to configure it
          </span>
        </div>
      )}
    </div>
  );
}
