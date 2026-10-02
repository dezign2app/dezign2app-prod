import React, { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import type {
  LangGraphStateChannel,
  LangGraphInputChannel,
  LangGraphMemoryConfig,
  LangGraphCustomReducer,
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
  masterToolNodes?: ToolNode[];
  masterMiddlewareNodes?: MiddlewareNode[];
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
  inputChannels?: LangGraphInputChannel[];
  setInputChannels?: React.Dispatch<
    React.SetStateAction<LangGraphInputChannel[]>
  >;
  stateChannels: LangGraphStateChannel[];
  setStateChannels?: React.Dispatch<
    React.SetStateAction<LangGraphStateChannel[]>
  >;
  customReducers?: LangGraphCustomReducer[];
  onAddCustomReducer?: (reducer: LangGraphCustomReducer) => void;
  onUpdateCustomReducer?: (
    idOrName: string,
    changes: Partial<LangGraphCustomReducer>,
  ) => void;
  onDeleteCustomReducer?: (idOrName: string) => void;
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
  masterToolNodes,
  masterMiddlewareNodes,
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
  setStateChannels,
  customReducers,
  onAddCustomReducer,
  onUpdateCustomReducer,
  onDeleteCustomReducer,
  inputChannels = [],
  setInputChannels,
  memoryConfig,
  setMemoryConfig,
  suggestedParams,
  nodes = [],
  edges = [],
  graphLabel,
}: InspectorSidebarProps) {
  const [width, setWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dezign2app_lg_inspector_width");
      if (saved) {
        const num = Number(saved);
        if (
          !isNaN(num) &&
          num >= Math.round(window.innerWidth * 0.2) &&
          num <= Math.round(window.innerWidth * 0.5)
        ) {
          return num;
        }
      }
      return Math.max(480, Math.min(840, Math.round(window.innerWidth * 0.28)));
    }
    return 520;
  });
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
        const minW = Math.max(340, Math.round(window.innerWidth * 0.18));
        const maxW = Math.min(1100, Math.round(window.innerWidth * 0.48));
        const newWidth = Math.min(Math.max(startWidth + deltaX, minW), maxW);
        setWidth(newWidth);
        if (typeof window !== "undefined") {
          localStorage.setItem("dezign2app_lg_inspector_width", String(newWidth));
        }
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const isStateSelected =
    selectedNodeId === "STATE_GLOBAL" || (Boolean(selectedNodeId) && activeSideTab === "state");
  const isInputsSelected =
    Boolean(selectedNodeId) && activeSideTab === "inputs";
  const isTestingSelected =
    Boolean(selectedNodeId) && activeSideTab === "testing";
  const isMemorySelected =
    selectedNodeId === "CHECKPOINTER" ||
    selectedNodeId === "MEMORY" ||
    (Boolean(selectedNodeId) && activeSideTab === "memory");
  const isStartSelected =
    selectedNodeId === "START" ||
    Boolean(selectedStartData) ||
    ((isInputsSelected || isTestingSelected) && Boolean(selectedNodeId));

  const hasSelectedNode = Boolean(
    selectedNodeId &&
      (selectedStepData ||
        selectedLLMData ||
        selectedToolData ||
        selectedMiddlewareData ||
        selectedAgentData ||
        selectedMemoryData ||
        selectedOutputData ||
        selectedStartData ||
        isStateSelected ||
        isStartSelected ||
        isMemorySelected),
  );

  if (!hasSelectedNode) return null;

  return (
    <div
      style={{ width: `${width}px` }}
      className={`relative shrink-0 h-full flex flex-col ${
        isResizing ? "select-none" : ""
      }`}
    >
      {/* Resize handle — sits on the very left edge of the outer shell */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/40 transition-colors z-30 ${
          isResizing ? "bg-primary" : "bg-transparent"
        }`}
        onMouseDown={startResizing}
        title="Drag left/right to resize inspector"
      />

      {/* Close button — anchored to the left of the resize handle, bleeds outside overflow-hidden */}
      {onClose && (
        <button
          type="button"
          className="absolute top-3.5 -left-3.5 w-7 h-7 rounded-full bg-card hover:bg-destructive/15 text-muted-foreground hover:text-destructive border border-border shadow-md flex items-center justify-center transition-all cursor-pointer z-50 hover:scale-110 active:scale-95"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          title="Close sidebar (Esc)"
          aria-label="Close inspector sidebar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Inner content — overflow-hidden for scroll containment */}
      <div
        className="border-l border-border bg-card flex flex-col h-full min-h-0 overflow-hidden w-full"
        onWheel={(e) => e.stopPropagation()}
      >

      {isStateSelected && setStateChannels ? (
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
          <StateTabContent
            stateChannels={stateChannels}
            setStateChannels={setStateChannels}
            customReducers={customReducers}
            onAddCustomReducer={onAddCustomReducer}
            onUpdateCustomReducer={onUpdateCustomReducer}
            onDeleteCustomReducer={onDeleteCustomReducer}
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
            onClose={onClose}
          />
        </div>
      ) : isMemorySelected && setMemoryConfig && memoryConfig ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <MemoryTabContent
            memoryConfig={memoryConfig}
            setMemoryConfig={setMemoryConfig}
            onClose={onClose}
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
          masterToolNodes={masterToolNodes}
          masterMiddlewareNodes={masterMiddlewareNodes}
          nodes={nodes}
          connectedRoutes={connectedRoutes}
          connectedLLMId={connectedLLMId}
          connectedToolIds={connectedToolIds}
          connectedMiddlewareIds={connectedMiddlewareIds}
          connectedMemoryIds={connectedMemoryIds}
          onSelectLLM={onSelectLLM}
          onToggleTool={onToggleTool}
          onAddToolRef={onAddToolRef}
          onRemoveToolRef={onRemoveToolRef}
          onToggleMiddleware={onToggleMiddleware}
          onAddMiddlewareRef={onAddMiddlewareRef}
          onRemoveMiddlewareRef={onRemoveMiddlewareRef}
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
          customReducers={customReducers}
          onClose={onClose}
        />
      )}
      </div>
    </div>
  );
}
