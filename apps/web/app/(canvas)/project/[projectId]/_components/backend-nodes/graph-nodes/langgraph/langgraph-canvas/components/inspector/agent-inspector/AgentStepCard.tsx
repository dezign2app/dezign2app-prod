import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { LocalInput, LocalTextarea } from "../../../../../common";
import type {
  AgentNodeData,
  LangGraphNodePipelineStep,
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

import { LANGGRAPH_STEP_META, isGenericPipelineStep } from "./stepTypes";
import { toCamelCase } from "./AgentPromptVariablePicker";
import { AgentLlmStepContent } from "./AgentLlmStepContent";
import { AgentTransformerStepSection } from "./AgentTransformerStepSection";
import { AgentStateUpdatesSection } from "./AgentStateUpdatesSection";
import { AgentEventStreamingSection } from "./AgentEventStreamingSection";
import { AgentGenericPipelineStepContent } from "./AgentGenericPipelineStepContent";

interface AgentStepCardProps {
  step: LangGraphNodePipelineStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdateLabel: (label: string) => void;
  onUpdateCode: (body: string) => void;
  onUpdateStep: (updatedStep: LangGraphNodePipelineStep) => void;
  priorSteps: LangGraphNodePipelineStep[];
  selectedAgentData: AgentNodeData;
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
  rfConfig: LangGraphAgentResponseFormatConfig;
  updateResponseFormat: (changes: Partial<LangGraphAgentResponseFormatConfig>) => void;
  isMiddlewareEnabled: boolean;
  handleToggleMiddlewareConfig: (enabled: boolean) => void;
  connectedLLMName: string;
  schemaFieldsCount: number;
}

export function AgentStepCard({
  step,
  index,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdateLabel,
  onUpdateCode,
  onUpdateStep,
  priorSteps,
  selectedAgentData,
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
  rfConfig,
  updateResponseFormat,
  isMiddlewareEnabled,
  handleToggleMiddlewareConfig,
  connectedLLMName,
  schemaFieldsCount,
}: AgentStepCardProps) {
  const meta = LANGGRAPH_STEP_META[step.type];
  if (!meta) return null;
  const Icon = meta.icon;

  const stateUpdates = selectedAgentData.stateUpdates || [];
  const streamConfig = selectedAgentData.streamConfig || { enabled: false, version: "v3" };

  const renderStepSummary = (): React.ReactNode => {
    switch (step.type) {
      case "state_updates": {
        const first = stateUpdates[0];
        if (!first) {
          return <span className="text-muted-foreground/60 italic">0 updates configured</span>;
        }
        if (stateUpdates.length === 1) {
          const detail =
            first.source === "structured_field"
              ? `structured.${first.schemaField || first.value || ""}`
              : first.value || "mapped";
          return (
            <span className="text-amber-300 font-mono truncate">
              {first.channelKey} &larr; {detail}
            </span>
          );
        }
        return (
          <span className="text-amber-300/90 font-mono truncate">
            {stateUpdates.length} channels ({stateUpdates.map((u) => u.channelKey).join(", ")})
          </span>
        );
      }
      case "llm_call": {
        const parts: string[] = [connectedLLMName];
        if (connectedToolIds.length > 0) {
          parts.push(`${connectedToolIds.length} tools`);
        }
        if (rfConfig.enabled) {
          parts.push(`${schemaFieldsCount} schema fields`);
        }
        if (isMiddlewareEnabled) {
          parts.push("middleware");
        }
        return (
          <span className="text-sky-300/90 font-mono truncate">
            {parts.join(" • ")}
          </span>
        );
      }
      case "custom_code": {
        const body =
          step.customCode?.trim() ??
          selectedAgentData.customCode?.body?.trim();
        return (
          <span className="text-emerald-300/90 font-mono truncate">
            {body
              ? `${body.slice(0, 36).replace(/[\r\n]+/g, " ")}...`
              : "(state, clone) => Partial<State>"}
          </span>
        );
      }
      case "transformer":
      case "transform": {
        const name =
          step.functionRef?.name ||
          step.transformerRef ||
          step.label ||
          "Transformer";
        const outVar = step.outputVariable ? ` &rarr; ${step.outputVariable}` : "";
        const bindingsCount = step.inputBindings?.length || 0;
        return (
          <span className="text-purple-300/90 font-mono truncate">
            {name}
            {outVar} {bindingsCount > 0 ? `(${bindingsCount} in)` : ""}
          </span>
        );
      }
      case "streaming": {
        return (
          <span className="text-cyan-300/90 font-mono truncate">
            {streamConfig.enabled !== false
              ? `${streamConfig.version || "v3"} Active (Standard SSE)`
              : "Disabled"}
          </span>
        );
      }
      case "db_operation": {
        const opName = step.operationId || step.functionRef?.name || "DB Query";
        const outVar = step.outputVariable ? ` → ${step.outputVariable}` : "";
        return (
          <span className="text-emerald-300/90 font-mono truncate">
            {opName}
            {outVar}
          </span>
        );
      }
      case "redis_operation": {
        const op = step.operationId || "cache";
        const outVar = step.outputVariable ? ` → ${step.outputVariable}` : "";
        return (
          <span className="text-red-300/90 font-mono truncate">
            redis.{op}
            {outVar}
          </span>
        );
      }
      case "storage_operation": {
        const op = step.operationId || "storage";
        const outVar = step.outputVariable ? ` → ${step.outputVariable}` : "";
        return (
          <span className="text-amber-300/90 font-mono truncate">
            storage.{op}
            {outVar}
          </span>
        );
      }
      case "kafka_publish": {
        const topic = step.messagingResourceId || step.operationId || "event";
        return (
          <span className="text-orange-300/90 font-mono truncate">
            kafka.publish({topic})
          </span>
        );
      }
      case "external_call": {
        const target = step.functionRef?.name || step.externalEndpointId || "HTTP Request";
        const outVar = step.outputVariable ? ` → ${step.outputVariable}` : "";
        return (
          <span className="text-emerald-300/90 font-mono truncate">
            api.{target}
            {outVar}
          </span>
        );
      }
      case "service_call": {
        const service = step.serviceId || "service";
        const outVar = step.outputVariable ? ` → ${step.outputVariable}` : "";
        return (
          <span className="text-blue-300/90 font-mono truncate">
            {service}.call()
            {outVar}
          </span>
        );
      }
      case "variable": {
        const op = step.variableOperation || "declare";
        const varName = step.outputVariable || "var";
        return (
          <span className="text-blue-300/90 font-mono truncate">
            {op === "declare" ? `${step.declarationKind || "const"} ${varName}` : `${varName} = ...`}
          </span>
        );
      }
      case "condition": {
        return (
          <span className="text-yellow-300/90 font-mono truncate">
            if / else branch
          </span>
        );
      }
      case "try_catch": {
        return (
          <span className="text-rose-300/90 font-mono truncate">
            try / catch block
          </span>
        );
      }
      case "switch": {
        return (
          <span className="text-indigo-300/90 font-mono truncate">
            switch case
          </span>
        );
      }
      case "parallel": {
        return (
          <span className="text-violet-300/90 font-mono truncate">
            Promise.all
          </span>
        );
      }
      case "loop": {
        return (
          <span className="text-pink-300/90 font-mono truncate">
            loop ({step.loopKind || "for_each"})
          </span>
        );
      }
      case "push_to_client": {
        return (
          <span className="text-cyan-300/90 font-mono truncate">
            push({step.pushProtocol || "sse"})
          </span>
        );
      }
      default:
        return null;
    }
  };

  const renderStepContent = () => {
    switch (step.type) {
      case "state_updates":
        return (
          <AgentStateUpdatesSection
            embedded
            selectedAgentData={selectedAgentData}
            onUpdateAgent={onUpdateAgent}
            stateChannels={stateChannels}
            customReducers={customReducers}
            nodes={nodes}
          />
        );

      case "llm_call":
        return (
          <AgentLlmStepContent
            step={step}
            onUpdateStep={onUpdateStep}
            priorSteps={priorSteps}
            allPipelineSteps={selectedAgentData.pipelineSteps}
            stateChannels={stateChannels}
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
            rfConfig={rfConfig}
            updateResponseFormat={updateResponseFormat}
            isMiddlewareEnabled={isMiddlewareEnabled}
            handleToggleMiddlewareConfig={handleToggleMiddlewareConfig}
          />
        );

      case "custom_code":
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Custom TypeScript Code ({step.label || "Custom Code"})
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                (state, clone) =&gt; Partial&lt;State&gt;
              </span>
            </div>
            <LocalTextarea
              value={typeof step.customCode === "string" ? step.customCode : ""}
              onChange={(e) => onUpdateCode(e.target.value)}
              className="text-xs min-h-[120px] font-mono bg-background/60 border border-border/60 rounded-md p-2.5 resize-y leading-relaxed"
              placeholder={`// Example: mutate or compute fields on state\nreturn {\n  count: (state.count || 0) + 1,\n  timestamp: Date.now()\n};`}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Return an object with modified state channels, or mutate cloned state directly.
            </p>
          </div>
        );

      case "transformer":
      case "transform":
        return (
          <AgentTransformerStepSection
            step={step}
            priorSteps={priorSteps}
            stateChannels={stateChannels}
            nodes={nodes}
            onUpdateStep={onUpdateStep}
            selectedAgentData={selectedAgentData}
          />
        );

      case "streaming":
        return (
          <AgentEventStreamingSection
            embedded
            hideHeader
            selectedAgentData={selectedAgentData}
            onUpdateAgent={onUpdateAgent}
          />
        );

      default:
        if (isGenericPipelineStep(step)) {
          return (
            <AgentGenericPipelineStepContent
              step={step}
              index={index}
              priorSteps={priorSteps.filter(isGenericPipelineStep)}
              allSteps={selectedAgentData.pipelineSteps?.filter(isGenericPipelineStep)}
              stateChannels={stateChannels}
              onUpdateStep={onUpdateStep}
            />
          );
        }
        return null;
    }
  };

  return (
    <Draggable draggableId={step.id} index={index}>
      {(dragProvided) => (
        <div
          ref={dragProvided.innerRef}
          {...dragProvided.draggableProps}
          className={`rounded-xl border transition-all duration-150 overflow-hidden ${
            isExpanded
              ? `${meta.borderColor} bg-card/60 shadow-xs`
              : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
          }`}
        >
          {/* Step Header */}
          <div
            className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer select-none"
            onClick={onToggle}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {/* Grip Handle for Drag */}
              <div
                {...dragProvided.dragHandleProps}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted/40 shrink-0"
                title="Drag to reorder"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5 shrink-0" />
              </div>

              {/* Step Index Badge */}
              <span className="flex items-center justify-center w-4 h-4 rounded font-mono text-[10px] font-bold shrink-0 bg-secondary/50 text-muted-foreground border border-border/40">
                {index + 1}
              </span>

              {/* Step Type Badge */}
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${meta.badgeBg}`}
              >
                <Icon className={`w-3 h-3 ${meta.color}`} />
                {meta.label}
              </span>

              {/* Step Custom Label (Inline Renaming) */}
              <div
                className="flex items-center min-w-0 max-w-[140px]"
                onClick={(e) => e.stopPropagation()}
              >
                <LocalInput
                  value={step.label || ""}
                  onChange={(e) => onUpdateLabel(e.target.value)}
                  onBlur={(e) => {
                    const cc = toCamelCase(e.target.value);
                    if (cc && cc !== step.label) {
                      onUpdateLabel(cc);
                    }
                  }}
                  placeholder={toCamelCase(meta.label) || meta.label}
                  className="h-5 text-[11px] font-medium text-foreground bg-transparent hover:bg-background/50 focus:bg-background border border-transparent hover:border-border/40 focus:border-primary/50 px-1 py-0 rounded truncate"
                  title="Click to rename step"
                />
              </div>

              {/* Summary / Preview */}
              <div className="text-[11px] min-w-0 flex-1 truncate font-mono">
                {renderStepSummary()}
              </div>
            </div>

            {/* Header Actions: Move Up, Move Down, Delete, Expand Chevron */}
            <div
              className="flex items-center gap-0.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                disabled={isFirst}
                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                onClick={onMoveUp}
                title="Move Step Up"
              >
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isLast}
                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                onClick={onMoveDown}
                title="Move Step Down"
              >
                <ArrowDown className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={onDelete}
                title={`Delete ${step.label || meta.label}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={onToggle}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Step Expanded Content */}
          {isExpanded && (
            <div className="border-t border-border/40 p-3 bg-background/30">
              {renderStepContent()}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
