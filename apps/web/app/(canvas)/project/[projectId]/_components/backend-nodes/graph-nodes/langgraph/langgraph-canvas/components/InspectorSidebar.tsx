import React, { useState, useCallback } from "react";
import type {
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
  LangGraphStepConfig,
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
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
} from "@workspace/canvas";
import { InspectorTabContent } from "./inspector/InspectorTabContent";
import { LangGraphTestCasesInspector } from "./inspector/LangGraphTestCasesInspector";
import { StateTabContent } from "./inspector/StateTabContent";
import { InputsTabContent } from "./inspector/InputsTabContent";
import { MemoryTabContent } from "./inspector/MemoryTabContent";
import { StartNodeInspector } from "./inspector/StartNodeInspector";

import type { ConnectedRouteInfo } from "../../LangGraphNode";
import type { SimulationTestCase } from "@workspace/canvas";

export interface InspectorSidebarProps {
  selectedNodeId?: string | null;
  onClose?: () => void;
  activeSideTab?: "inspector" | "inputs" | "state" | "memory" | "testing";
  setActiveSideTab?: (tab: "inspector" | "inputs" | "state" | "memory" | "testing") => void;
  nodes?: LangGraphCanvasNode[];
  edges?: LangGraphCanvasEdge[];
  graphLabel?: string;
  selectedStepData: StepNodeData | null;
  selectedLLMData?: LangGraphLLMNodeData | null;
  selectedToolData?: ToolNodeData | null;
  selectedMiddlewareData?: MiddlewareNodeData | null;
  selectedAgentData?: AgentNodeData | null;
  selectedMemoryData?: MemoryNodeData | null;
  selectedOutputData?: OutputNodeData | null;
  selectedStartData?: { inputChannels?: LangGraphInputChannel[] } | null;
  /** Params from connected endpoint used as default suggestions */
  suggestedParams?: Array<{ key: string; type: LangGraphInputChannel["type"]; description?: string; required?: boolean }>;
  graphNodeId?: string;
  graphSteps?: LangGraphStepConfig[];
  graphEdges?: Array<{
    source: string;
    sourceHandle?: string | null;
    target: string;
  }>;
  graphNodeLabels?: Record<string, string>;
  onRunTestCase?: (testCase: SimulationTestCase) => void;
  connectedToolsCount?: number;
  connectedMiddlewareCount?: number;
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  availableMemoryNodes?: (MemoryNode | LangGraphMemoryRefNode)[];
  connectedRoutes?: ConnectedRouteInfo[];
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  connectedMemoryIds?: string[];
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
  inputChannels?: LangGraphInputChannel[];
  setInputChannels?: React.Dispatch<
    React.SetStateAction<LangGraphInputChannel[]>
  >;
  stateChannels: LangGraphStateChannel[];
  setStateChannels?: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  memoryConfig?: LangGraphMemoryConfig;
  setMemoryConfig?: React.Dispatch<React.SetStateAction<LangGraphMemoryConfig>>;
}

export function InspectorSidebar({
  selectedNodeId,
  onClose,
  activeSideTab,
  setActiveSideTab,
  selectedStepData,
  selectedLLMData,
  selectedToolData,
  selectedMiddlewareData,
  selectedAgentData,
  selectedMemoryData,
  selectedOutputData,
  selectedStartData,
  graphNodeId,
  graphSteps = [],
  graphEdges = [],
  graphNodeLabels = {},
  onRunTestCase,
  connectedToolsCount = 0,
  connectedMiddlewareCount = 0,
  availableLLMNodes,
  availableToolNodes,
  availableMiddlewareNodes,
  availableMemoryNodes,
  connectedRoutes = [],
  connectedLLMId,
  connectedToolIds,
  connectedMiddlewareIds,
  connectedMemoryIds,
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
  setStateChannels,
  inputChannels = [],
  setInputChannels,
  memoryConfig,
  setMemoryConfig,
  suggestedParams,
  nodes = [],
  edges = [],
  graphLabel,
}: InspectorSidebarProps) {
  const [width, setWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      mouseDownEvent.preventDefault();
      mouseDownEvent.stopPropagation();
      setIsResizing(true);

      const startX = mouseDownEvent.clientX;
      const startWidth = width;

      const onMouseMove = (mouseMoveEvent: MouseEvent) => {
        const deltaX = startX - mouseMoveEvent.clientX;
        const newWidth = Math.min(Math.max(startWidth + deltaX, 260), 640);
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [width],
  );

  const isStateSelected =
    selectedNodeId === "STATE_GLOBAL" || activeSideTab === "state";
  const isInputsSelected = activeSideTab === "inputs";
  const isTestingSelected = activeSideTab === "testing";
  const isMemorySelected = activeSideTab === "memory";
  const isStartSelected =
    selectedNodeId === "START" ||
    isInputsSelected ||
    isTestingSelected ||
    Boolean(selectedStartData);

  const hasSelectedNode = Boolean(
    selectedStepData ||
    selectedLLMData ||
    selectedToolData ||
    selectedMiddlewareData ||
    selectedAgentData ||
    selectedMemoryData ||
    selectedOutputData ||
    selectedStartData ||
    isStateSelected ||
    isStartSelected ||
    isMemorySelected,
  );

  if (!hasSelectedNode) return null;

  return (
    <div
      style={{ width: `${width}px` }}
      className={`border-l border-border bg-card flex flex-col h-full min-h-0 overflow-hidden shrink-0 relative ${
        isResizing ? "select-none" : ""
      }`}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Resizing Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-20 ${
          isResizing ? "bg-primary" : "bg-transparent"
        }`}
        onMouseDown={startResizing}
        title="Drag left/right to resize inspector"
      />

      {isStateSelected && setStateChannels ? (
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
          <StateTabContent
            stateChannels={stateChannels}
            setStateChannels={setStateChannels}
            onClose={onClose}
          />
        </div>
      ) : isStartSelected && setInputChannels ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <StartNodeInspector
            inputChannels={inputChannels}
            setInputChannels={setInputChannels}
            stateChannels={stateChannels}
            suggestedParams={suggestedParams}
            nodes={nodes}
            edges={edges}
            memoryConfig={memoryConfig}
            graphLabel={graphLabel}
            graphNodeId={graphNodeId}
            graphSteps={graphSteps}
            graphEdges={graphEdges}
            graphNodeLabels={graphNodeLabels}
            connectedRoutes={connectedRoutes}
            onRunTestCase={onRunTestCase}
            defaultTab={isTestingSelected ? "testing" : "inputs"}
          />
        </div>
      ) : isMemorySelected && setMemoryConfig && memoryConfig ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <MemoryTabContent
            memoryConfig={memoryConfig}
            setMemoryConfig={setMemoryConfig}
          />
        </div>
      ) : (
        <InspectorTabContent
          selectedStepData={selectedStepData}
          selectedLLMData={selectedLLMData}
          selectedToolData={selectedToolData}
          selectedMiddlewareData={selectedMiddlewareData}
          selectedAgentData={selectedAgentData}
          selectedMemoryData={selectedMemoryData}
          selectedOutputData={selectedOutputData}
          connectedToolsCount={connectedToolsCount}
          connectedMiddlewareCount={connectedMiddlewareCount}
          availableLLMNodes={availableLLMNodes}
          availableToolNodes={availableToolNodes}
          availableMiddlewareNodes={availableMiddlewareNodes}
          availableMemoryNodes={availableMemoryNodes}
          connectedRoutes={connectedRoutes}
          connectedLLMId={connectedLLMId}
          connectedToolIds={connectedToolIds}
          connectedMiddlewareIds={connectedMiddlewareIds}
          connectedMemoryIds={connectedMemoryIds}
          onSelectLLM={onSelectLLM}
          onToggleTool={onToggleTool}
          onToggleMiddleware={onToggleMiddleware}
          onToggleMemory={onToggleMemory}
          onDeleteStep={onDeleteStep}
          onUpdateStep={onUpdateStep}
          onUpdateLLM={onUpdateLLM}
          onUpdateTool={onUpdateTool}
          onUpdateMiddleware={onUpdateMiddleware}
          onUpdateAgent={onUpdateAgent}
          onUpdateMemory={onUpdateMemory}
          onUpdateOutput={onUpdateOutput}
          stateChannels={stateChannels}
        />
      )}
    </div>
  );
}
