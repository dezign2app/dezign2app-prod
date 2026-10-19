import React, { useState, useMemo, useCallback } from "react";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { Bot } from "lucide-react";
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
  LangGraphCustomReducer,
  LangGraphCanvasNode,
} from "@workspace/canvas";

import {
  LANGGRAPH_STEP_META,
  ADDABLE_LANGGRAPH_STEP_TYPES,
  deriveInitialPipelineSteps,
  type LangGraphStepMeta,
  useAgentPipelineSteps,
  AgentPipelineHeader,
  AgentStepCard,
  AgentAddStepToolbar,
  AgentTerminalStateUpdates,
  parseSchemaJsonToFields,
} from "./agent-inspector";

// Re-export step types and metadata for backward compatibility
export {
  LANGGRAPH_STEP_META,
  ADDABLE_LANGGRAPH_STEP_TYPES,
  deriveInitialPipelineSteps,
  type LangGraphStepMeta,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentNodeInspectorProps {
  selectedAgentData: AgentNodeData;
  onDeleteAgent: () => void;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  masterToolNodes?: ToolNode[];
  masterMiddlewareNodes?: MiddlewareNode[];
  nodes?: LangGraphCanvasNode[];
  connectedLLMId?: string | null;
  connectedToolIds?: string[];
  connectedMiddlewareIds?: string[];
  onAddToolRef?: (masterToolId: string) => void;
  onRemoveToolRef?: (toolRefId: string) => void;
  onAddMiddlewareRef?: (masterMwId: string) => void;
  onRemoveMiddlewareRef?: (mwRefId: string) => void;
  onSelectLLM?: (llmId: string | null) => void;
  onToggleTool?: (toolId: string, connect: boolean) => void;
  onToggleMiddleware?: (mwId: string, connect: boolean) => void;
  stateChannels?: LangGraphStateChannel[];
  customReducers?: LangGraphCustomReducer[];
}

export function AgentNodeInspector({
  selectedAgentData,
  onDeleteAgent,
  onUpdateAgent,
  availableLLMNodes = [],
  availableToolNodes = [],
  availableMiddlewareNodes = [],
  masterToolNodes = [],
  masterMiddlewareNodes = [],
  nodes = [],
  connectedLLMId = null,
  connectedToolIds = [],
  connectedMiddlewareIds = [],
  onAddToolRef,
  onRemoveToolRef,
  onAddMiddlewareRef,
  onRemoveMiddlewareRef,
  onSelectLLM,
  onToggleTool,
  onToggleMiddleware,
  stateChannels = [],
  customReducers = [],
}: AgentNodeInspectorProps) {
  // ─── Response Format & Streaming Configurations ────────────────────────────
  const rfConfig: LangGraphAgentResponseFormatConfig =
    selectedAgentData.responseFormat || {
      enabled: false,
      strategy: "auto",
      schemaType: "json_schema",
      schemaJson: "",
      handleErrorMode: "default",
    };

  const updateResponseFormat = useCallback(
    (changes: Partial<LangGraphAgentResponseFormatConfig>) => {
      onUpdateAgent({
        responseFormat: {
          ...rfConfig,
          ...changes,
        },
      });
    },
    [onUpdateAgent, rfConfig],
  );

  const isMiddlewareEnabled = Boolean(
    selectedAgentData.middlewareConfig?.enabled ??
      (connectedMiddlewareIds.length > 0),
  );

  const handleToggleMiddlewareConfig = useCallback(
    (enabled: boolean) => {
      onUpdateAgent({
        middlewareConfig: {
          ...(selectedAgentData.middlewareConfig || {}),
          enabled,
        },
      });
    },
    [onUpdateAgent, selectedAgentData.middlewareConfig],
  );

  // ─── Pinned Terminal State Updates Config ──────────────────────────────────
  const isStateUpdatesEnabled =
    selectedAgentData.stateUpdatesConfig?.enabled !== false;
  const [isStateUpdatesOpen, setIsStateUpdatesOpen] = useState(true);

  const handleToggleStateUpdatesEnabled = useCallback(
    (enabled: boolean) => {
      onUpdateAgent({
        stateUpdatesConfig: {
          ...(selectedAgentData.stateUpdatesConfig || {}),
          enabled,
        },
      });
      if (enabled) {
        setIsStateUpdatesOpen(true);
      }
    },
    [onUpdateAgent, selectedAgentData.stateUpdatesConfig],
  );

  // ─── Pipeline Steps Management Hook ────────────────────────────────────────
  const {
    activePipelineSteps,
    expandedSteps,
    allOpen,
    toggleStep,
    handleExpandAll,
    handleCollapseAll,
    handleAddStep,
    handleDeleteStep,
    handleMoveStep,
    handleDragEnd,
    handleUpdateStepCode,
    handleUpdateStepLabel,
  } = useAgentPipelineSteps({
    selectedAgentData,
    onUpdateAgent,
    connectedLLMId,
    connectedToolIds,
    connectedMiddlewareIds,
    rfConfig,
    onSelectLLM,
  });

  // ─── Summary Formatter Helpers ─────────────────────────────────────────────
  const connectedLLM = availableLLMNodes.find((l) => l.id === connectedLLMId);
  let connectedLLMName = connectedLLMId ? "Bound LLM" : "No LLM Bound";
  if (connectedLLM) {
    if (connectedLLM.type === "langgraph_llm") {
      connectedLLMName =
        connectedLLM.data.model || connectedLLM.data.label || connectedLLMName;
    } else if (connectedLLM.type === "langgraph_llm_ref") {
      connectedLLMName = connectedLLM.data.label || connectedLLMName;
    }
  }

  const schemaFields = useMemo(() => {
    if (!rfConfig.enabled || !rfConfig.schemaJson?.trim()) return [];
    return parseSchemaJsonToFields(rfConfig.schemaJson).fields;
  }, [rfConfig.enabled, rfConfig.schemaJson]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── Top Pipeline Header ────────────────────────────────────────────── */}
      <AgentPipelineHeader
        selectedAgentData={selectedAgentData}
        onUpdateAgent={onUpdateAgent}
        onDeleteAgent={onDeleteAgent}
        activePipelineSteps={activePipelineSteps}
        expandedSteps={expandedSteps}
        onToggleStep={toggleStep}
        allOpen={allOpen}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        isStateUpdatesOpen={isStateUpdatesOpen}
        onToggleStateUpdates={() => setIsStateUpdatesOpen((prev) => !prev)}
        isStateUpdatesEnabled={isStateUpdatesEnabled}
      />

      {/* ─── Dynamic Steps List (Draggable & Reorderable) ──────────────────── */}
      {activePipelineSteps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 p-6 text-center bg-card/20 flex flex-col items-center justify-center gap-1.5">
          <div className="p-2.5 rounded-full bg-secondary/30 text-muted-foreground mb-1">
            <Bot className="w-5 h-5 opacity-50" />
          </div>
          <p className="text-xs font-medium text-foreground/80">
            No execution steps configured for this node yet
          </p>
          <p className="text-[11px] text-muted-foreground/60 max-w-[280px]">
            Add custom code (pre/post-processing) or an LLM agent from the toolbar below.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="langgraph-node-pipeline-steps">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-2 rounded-xl transition-colors ${
                  snapshot.isDraggingOver ? "bg-accent/15 p-1 -m-1" : ""
                }`}
              >
                {activePipelineSteps.map((step, index) => {
                  const isFirst = index === 0;
                  const isLast = index === activePipelineSteps.length - 1;
                  const isExpanded = Boolean(expandedSteps[step.id]);
                  const priorSteps = index > 0 ? activePipelineSteps.slice(0, index) : [];

                  return (
                    <AgentStepCard
                      key={step.id}
                      step={step}
                      index={index}
                      isFirst={isFirst}
                      isLast={isLast}
                      isExpanded={isExpanded}
                      onToggle={() => toggleStep(step.id)}
                      onMoveUp={() => handleMoveStep(index, index - 1)}
                      onMoveDown={() => handleMoveStep(index, index + 1)}
                      onDelete={() => handleDeleteStep(step.id)}
                      onUpdateLabel={(label) => handleUpdateStepLabel(step.id, label)}
                      onUpdateCode={(body) => handleUpdateStepCode(step.id, body)}
                      onUpdateStep={(updatedStep) => {
                        const next = activePipelineSteps.map((s) =>
                          s.id === step.id ? updatedStep : s,
                        );
                        onUpdateAgent({
                          pipelineSteps: next,
                          nodeSteps: next.map((st) => st.type),
                        });
                      }}
                      priorSteps={priorSteps}
                      selectedAgentData={selectedAgentData}
                      onUpdateAgent={onUpdateAgent}
                      availableLLMNodes={availableLLMNodes}
                      availableToolNodes={availableToolNodes}
                      availableMiddlewareNodes={availableMiddlewareNodes}
                      masterToolNodes={masterToolNodes}
                      masterMiddlewareNodes={masterMiddlewareNodes}
                      nodes={nodes}
                      connectedLLMId={connectedLLMId}
                      connectedToolIds={connectedToolIds}
                      connectedMiddlewareIds={connectedMiddlewareIds}
                      onAddToolRef={onAddToolRef}
                      onRemoveToolRef={onRemoveToolRef}
                      onAddMiddlewareRef={onAddMiddlewareRef}
                      onRemoveMiddlewareRef={onRemoveMiddlewareRef}
                      onSelectLLM={onSelectLLM}
                      onToggleTool={onToggleTool}
                      onToggleMiddleware={onToggleMiddleware}
                      stateChannels={stateChannels}
                      customReducers={customReducers}
                      rfConfig={rfConfig}
                      updateResponseFormat={updateResponseFormat}
                      isMiddlewareEnabled={isMiddlewareEnabled}
                      handleToggleMiddlewareConfig={handleToggleMiddlewareConfig}
                      connectedLLMName={connectedLLMName}
                      schemaFieldsCount={schemaFields.length}
                    />
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* ─── Add Step Toolbar ──────────────────────────────────────────────── */}
      <AgentAddStepToolbar
        stepCount={activePipelineSteps.length}
        activePipelineSteps={activePipelineSteps}
        onAddStep={handleAddStep}
      />

      {/* ─── Pinned Final Step: Node Output / State Updates ────────────────── */}
      <AgentTerminalStateUpdates
        selectedAgentData={selectedAgentData}
        onUpdateAgent={onUpdateAgent}
        isStateUpdatesOpen={isStateUpdatesOpen}
        onToggleOpen={() => setIsStateUpdatesOpen((prev) => !prev)}
        isStateUpdatesEnabled={isStateUpdatesEnabled}
        onToggleEnabled={handleToggleStateUpdatesEnabled}
        stateChannels={stateChannels}
        customReducers={customReducers}
        nodes={nodes}
      />
    </div>
  );
}
