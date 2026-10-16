import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Bot,
  Zap,
  FileJson,
  Radio,
  ChevronDown,
  ChevronRight,
  Trash2,
  ChevronsUpDown,
  ChevronsDownUp,
  Terminal,
  Wrench,
  Shield,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import { LocalInput, LocalTextarea } from "../../../../common";
import type {
  AgentNodeData,
  LangGraphNodeStepType,
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

import { AgentAttachedComponentsSection } from "./agent-inspector/AgentAttachedComponentsSection";
import { AgentMiddlewareSection } from "./agent-inspector/AgentMiddlewareSection";
import {
  AgentStructuredOutputSection,
  parseSchemaJsonToFields,
} from "./agent-inspector/AgentStructuredOutputSection";
import { AgentEventStreamingSection } from "./agent-inspector/AgentEventStreamingSection";
import { AgentStateUpdatesSection } from "./agent-inspector/AgentStateUpdatesSection";
import {
  DEFAULT_SELECTED_STREAM_EVENTS,
  DEFAULT_STREAM_ENVELOPE,
  DEFAULT_STREAM_TRANSFORMER_MODE,
} from "../../constants";

// ─────────────────────────────────────────────────────────────────────────────
// Step Metadata Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface LangGraphStepMeta {
  type: LangGraphNodeStepType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  badgeBg: string;
  description: string;
}

export const LANGGRAPH_STEP_META: Record<LangGraphNodeStepType, LangGraphStepMeta> = {
  state_updates: {
    type: "state_updates",
    label: "State Updates",
    icon: Zap,
    color: "text-amber-400",
    borderColor: "border-amber-500/40",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    description: "Commit returned channels, reducers, and expressions to graph state",
  },
  llm_call: {
    type: "llm_call",
    label: "LLM Agent",
    icon: Bot,
    color: "text-sky-400",
    borderColor: "border-sky-500/40",
    badgeBg: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    description: "Model, prompt, tools, structured output, middleware & streaming",
  },
  custom_code: {
    type: "custom_code",
    label: "Custom Code",
    icon: Terminal,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/40",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    description: "Inline TypeScript logic: (state, clone) => Partial<State>",
  },
  streaming: {
    type: "streaming",
    label: "Event Streaming",
    icon: Radio,
    color: "text-cyan-400",
    borderColor: "border-cyan-500/40",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    description: "SSE token streaming presets and custom event deltas",
  },
  // Legacy / fallback if previously saved in nodeSteps
  tools: {
    type: "tools",
    label: "Attach Tools",
    icon: Wrench,
    color: "text-teal-400",
    borderColor: "border-teal-500/40",
    badgeBg: "bg-teal-500/10 text-teal-300 border-teal-500/25",
    description: "Connect canvas tool references, MCP endpoints, and functions",
  },
  structured_output: {
    type: "structured_output",
    label: "Structured Output",
    icon: FileJson,
    color: "text-fuchsia-400",
    borderColor: "border-fuchsia-500/40",
    badgeBg: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/25",
    description: "JSON Schema response enforcement and formatting",
  },
  middleware: {
    type: "middleware",
    label: "Middleware Pipeline",
    icon: Shield,
    color: "text-purple-400",
    borderColor: "border-purple-500/40",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    description: "Guardrails, Human-in-the-Loop approvals, and rate limiting",
  },
};

/**
 * Primary Addable Node Execution Steps
 * (Tools, Structured Output, Middleware, and Event Streaming are grouped inside LLM Agent;
 *  State Updates is the pinned terminal return step)
 */
export const ADDABLE_LANGGRAPH_STEP_TYPES: readonly LangGraphNodeStepType[] = [
  "llm_call",
  "custom_code",
];

// ─────────────────────────────────────────────────────────────────────────────
// Initial Step Derivation for Backwards Compatibility
// ─────────────────────────────────────────────────────────────────────────────

function deriveInitialPipelineSteps(
  data: AgentNodeData,
  connectedLLMId?: string | null,
  connectedToolIds?: string[],
  connectedMiddlewareIds?: string[],
): LangGraphNodePipelineStep[] {
  // If user already saved pipelineSteps, return them directly
  if (data.pipelineSteps && data.pipelineSteps.length > 0) {
    return data.pipelineSteps;
  }

  // If user saved legacy nodeSteps, normalize and map to pipeline steps with stable IDs
  if (data.nodeSteps && data.nodeSteps.length > 0) {
    const steps: LangGraphNodePipelineStep[] = [];
    let codeIndex = 0;
    let llmIndex = 0;
    for (let i = 0; i < data.nodeSteps.length; i++) {
      const s = data.nodeSteps[i];
      if (s === "custom_code") {
        codeIndex++;
        steps.push({
          id: `step_code_${codeIndex}`,
          type: "custom_code",
          label:
            codeIndex === 1 && !steps.some((st) => st.type === "llm_call")
              ? "Pre-processing"
              : `Custom Code ${codeIndex}`,
          customCode: data.customCode || {
            body: "// TypeScript logic: (state, clone) => Partial<State>\nreturn {\n  // mutate channels\n};\n",
          },
        });
      } else if (
        s === "llm_call" ||
        s === "tools" ||
        s === "structured_output" ||
        s === "middleware" ||
        s === "streaming"
      ) {
        if (!steps.some((st) => st.type === "llm_call")) {
          llmIndex++;
          steps.push({
            id: `step_llm_${llmIndex}`,
            type: "llm_call",
            label: "LLM Agent",
          });
        }
      }
    }
    if (steps.length > 0) {
      return steps;
    }
  }

  // Otherwise infer initial steps from node properties
  const steps: LangGraphNodePipelineStep[] = [];
  const hasLLM = Boolean(connectedLLMId || data.llmConfig?.enabled);
  const hasPrompt = Boolean(data.systemPrompt && data.systemPrompt.trim().length > 0);
  const hasTools = Boolean(
    (connectedToolIds && connectedToolIds.length > 0) ||
      (data.tools && data.tools.length > 0),
  );
  const hasStructured = Boolean(data.responseFormat?.enabled);
  const hasMiddleware = Boolean(
    data.middlewareConfig?.enabled ||
      (connectedMiddlewareIds && connectedMiddlewareIds.length > 0),
  );
  const hasStreaming = Boolean(data.streamConfig?.enabled);

  if (
    hasLLM ||
    hasPrompt ||
    hasTools ||
    hasStructured ||
    hasMiddleware ||
    hasStreaming
  ) {
    steps.push({
      id: "step_llm_1",
      type: "llm_call",
      label: "LLM Agent",
    });
  }

  if (data.customCode?.body && data.customCode.body.trim().length > 0) {
    steps.push({
      id: "step_code_1",
      type: "custom_code",
      label: steps.length > 0 ? "Post-processing" : "Custom Code",
      customCode: data.customCode,
    });
  }

  return steps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Props
// ─────────────────────────────────────────────────────────────────────────────

interface AgentNodeInspectorProps {
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
  const rfConfig: LangGraphAgentResponseFormatConfig =
    selectedAgentData.responseFormat || {
      enabled: false,
      strategy: "auto",
      schemaType: "json_schema",
      schemaJson: "",
      handleErrorMode: "default",
    };

  const streamConfig = selectedAgentData.streamConfig || {
    enabled: false,
    version: "v3",
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

  // ─── Sub-section Expand States for LLM Step ────────────────────────────────
  const [isLlmStructuredOpen, setIsLlmStructuredOpen] = useState(
    Boolean(rfConfig.enabled),
  );
  const [isLlmMiddlewareOpen, setIsLlmMiddlewareOpen] = useState(
    isMiddlewareEnabled || connectedMiddlewareIds.length > 0,
  );
  const [isLlmStreamingOpen, setIsLlmStreamingOpen] = useState(
    Boolean(selectedAgentData.streamConfig?.enabled),
  );

  // ─── Pinned Terminal State Updates Config ──────────────────────────────────
  const isStateUpdatesEnabled =
    selectedAgentData.stateUpdatesConfig?.enabled !== false;

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

  const [isStateUpdatesOpen, setIsStateUpdatesOpen] = useState(true);

  // ─── Active Steps State Management ─────────────────────────────────────────

  const initialPipelineSteps = useMemo(() => {
    return deriveInitialPipelineSteps(
      selectedAgentData,
      connectedLLMId,
      connectedToolIds,
      connectedMiddlewareIds,
    );
  }, [
    selectedAgentData,
    connectedLLMId,
    connectedToolIds,
    connectedMiddlewareIds,
  ]);

  const [activePipelineSteps, setActivePipelineSteps] =
    useState<LangGraphNodePipelineStep[]>(initialPipelineSteps);

  useEffect(() => {
    setActivePipelineSteps(initialPipelineSteps);
  }, [initialPipelineSteps]);

  // Expanded state per step instance ID
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    initialPipelineSteps.forEach((s) => {
      init[s.id] = true;
    });
    return init;
  });

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    activePipelineSteps.forEach((s) => {
      next[s.id] = true;
    });
    setExpandedSteps(next);
  }, [activePipelineSteps]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSteps({});
  }, []);

  // ─── Step Operations: Add, Delete, Move, Update ───────────────────────────

  const handleAddStep = useCallback(
    (type: LangGraphNodeStepType) => {
      const newStepId = `${type === "custom_code" ? "code" : "llm"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      let defaultLabel = type === "custom_code" ? "Custom Code" : "LLM Agent";
      if (type === "custom_code") {
        const hasLLM = activePipelineSteps.some((s) => s.type === "llm_call");
        const existingCodeCount = activePipelineSteps.filter(
          (s) => s.type === "custom_code",
        ).length;
        if (!hasLLM && existingCodeCount === 0) {
          defaultLabel = "Pre-processing";
        } else if (hasLLM && existingCodeCount === 0) {
          defaultLabel = "Post-processing";
        } else {
          defaultLabel = `Custom Code ${existingCodeCount + 1}`;
        }
      } else if (type === "llm_call") {
        const existingLlmCount = activePipelineSteps.filter(
          (s) => s.type === "llm_call",
        ).length;
        if (existingLlmCount > 0) {
          defaultLabel = `LLM Agent ${existingLlmCount + 1}`;
        }
      }

      const newStep: LangGraphNodePipelineStep = {
        id: newStepId,
        type,
        label: defaultLabel,
        ...(type === "custom_code"
          ? {
              customCode: {
                body: "// TypeScript logic: (state, clone) => Partial<State>\nreturn {\n  // mutate channels\n};\n",
              },
            }
          : {
              llmConfig: { enabled: true },
            }),
      };

      const nextSteps = [...activePipelineSteps, newStep];
      setActivePipelineSteps(nextSteps);
      setExpandedSteps((prev) => ({ ...prev, [newStepId]: true }));

      const updates: Partial<AgentNodeData> = {
        pipelineSteps: nextSteps,
        nodeSteps: nextSteps.map((s) => s.type),
      };

      if (type === "custom_code" && !selectedAgentData.customCode?.body) {
        updates.customCode = newStep.customCode;
      } else if (type === "llm_call") {
        updates.llmConfig = {
          ...(selectedAgentData.llmConfig || {}),
          enabled: true,
        };
      }

      onUpdateAgent(updates);
    },
    [activePipelineSteps, onUpdateAgent, selectedAgentData],
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const nextSteps = activePipelineSteps.filter((s) => s.id !== stepId);
      setActivePipelineSteps(nextSteps);

      const updates: Partial<AgentNodeData> = {
        pipelineSteps: nextSteps,
        nodeSteps: nextSteps.map((s) => s.type),
      };

      const remainingCodeSteps = nextSteps.filter((s) => s.type === "custom_code");
      if (remainingCodeSteps.length === 0) {
        updates.customCode = { body: "" };
      } else if (remainingCodeSteps[0]?.customCode) {
        updates.customCode = remainingCodeSteps[0].customCode;
      }

      const remainingLlmSteps = nextSteps.filter((s) => s.type === "llm_call");
      if (remainingLlmSteps.length === 0) {
        updates.llmConfig = {
          ...(selectedAgentData.llmConfig || {}),
          enabled: false,
        };
        updates.responseFormat = {
          ...(selectedAgentData.responseFormat || rfConfig),
          enabled: false,
        };
        updates.middlewareConfig = {
          ...(selectedAgentData.middlewareConfig || {}),
          enabled: false,
        };
        onSelectLLM?.(null);
      }

      onUpdateAgent(updates);
    },
    [activePipelineSteps, onSelectLLM, onUpdateAgent, selectedAgentData, rfConfig],
  );

  const handleMoveStep = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= activePipelineSteps.length) return;
      const copy = [...activePipelineSteps];
      const item = copy[fromIndex];
      if (!item) return;
      copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      setActivePipelineSteps(copy);
      onUpdateAgent({
        pipelineSteps: copy,
        nodeSteps: copy.map((s) => s.type),
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      if (result.destination.index === result.source.index) return;
      handleMoveStep(result.source.index, result.destination.index);
    },
    [handleMoveStep],
  );

  const handleUpdateStepCode = useCallback(
    (stepId: string, body: string) => {
      const next = activePipelineSteps.map((s) =>
        s.id === stepId ? { ...s, customCode: { body } } : s,
      );
      setActivePipelineSteps(next);
      const firstCode = next.find((s) => s.type === "custom_code");
      onUpdateAgent({
        pipelineSteps: next,
        nodeSteps: next.map((s) => s.type),
        ...(firstCode?.customCode ? { customCode: firstCode.customCode } : {}),
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

  const handleUpdateStepLabel = useCallback(
    (stepId: string, label: string) => {
      const next = activePipelineSteps.map((s) =>
        s.id === stepId ? { ...s, label } : s,
      );
      setActivePipelineSteps(next);
      onUpdateAgent({
        pipelineSteps: next,
      });
    },
    [activePipelineSteps, onUpdateAgent],
  );

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

  const stateUpdates = selectedAgentData.stateUpdates || [];

  const schemaFields = useMemo(() => {
    if (!rfConfig.enabled || !rfConfig.schemaJson?.trim()) return [];
    return parseSchemaJsonToFields(rfConfig.schemaJson).fields;
  }, [rfConfig.enabled, rfConfig.schemaJson]);

  const allOpen =
    activePipelineSteps.length > 0 &&
    activePipelineSteps.every((s) => expandedSteps[s.id]);

  const renderStepSummary = (step: LangGraphNodePipelineStep): React.ReactNode => {
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
          parts.push(`${schemaFields.length} schema fields`);
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
          step.customCode?.body?.trim() ??
          selectedAgentData.customCode?.body?.trim();
        return (
          <span className="text-emerald-300/90 font-mono truncate">
            {body
              ? `${body.slice(0, 36).replace(/[\r\n]+/g, " ")}...`
              : "(state, clone) => Partial<State>"}
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
      default:
        return null;
    }
  };

  // ─── Step Content Renderer ─────────────────────────────────────────────────

  const renderStepContent = (step: LangGraphNodePipelineStep) => {
    switch (step.type) {
      case "state_updates":
        return (
          <AgentStateUpdatesSection
            embedded
            selectedAgentData={selectedAgentData}
            onUpdateAgent={onUpdateAgent}
            stateChannels={stateChannels}
            customReducers={customReducers}
          />
        );

      case "llm_call":
        return (
          <div className="flex flex-col gap-3.5">
            {/* 1. Identity & System Instructions */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  System Prompt
                </Label>
                {selectedAgentData.systemPrompt && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {selectedAgentData.systemPrompt.length} chars
                  </span>
                )}
              </div>
              <LocalTextarea
                value={selectedAgentData.systemPrompt || ""}
                onChange={(e) => onUpdateAgent({ systemPrompt: e.target.value })}
                className="text-xs min-h-[90px] resize-y bg-background/50 font-mono leading-relaxed"
                placeholder="System instructions / prompt for this agent node..."
              />
            </div>

            {/* 2. Model & Tool Attachments (LLM Binding + Function Calling) */}
            <AgentAttachedComponentsSection
              embedded
              hideMiddleware
              availableLLMNodes={availableLLMNodes}
              availableToolNodes={availableToolNodes}
              availableMiddlewareNodes={availableMiddlewareNodes}
              masterToolNodes={masterToolNodes}
              masterMiddlewareNodes={masterMiddlewareNodes}
              nodes={nodes}
              agentId={selectedAgentData.agentId || selectedAgentData.id || ""}
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
            />

            {/* 3. Sub-section: Structured Output (JSON Schema) */}
            <div className="rounded-lg border border-border/50 bg-secondary/15 overflow-hidden">
              <div
                className="flex items-center justify-between px-2.5 py-2 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
                onClick={() => setIsLlmStructuredOpen((prev) => !prev)}
              >
                <div className="flex items-center gap-2">
                  <FileJson className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Structured Output
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    (JSON Schema)
                  </span>
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Switch
                    checked={Boolean(rfConfig.enabled)}
                    onCheckedChange={(enabled) => {
                      updateResponseFormat({ enabled });
                      if (enabled) {
                        setIsLlmStructuredOpen(true);
                      }
                    }}
                    className="scale-80"
                    title="Toggle Structured Output ON/OFF"
                  />
                  <button
                    type="button"
                    onClick={() => setIsLlmStructuredOpen((prev) => !prev)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {isLlmStructuredOpen ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              {isLlmStructuredOpen && (
                <div className="p-2.5 border-t border-border/40 bg-background/20">
                  <AgentStructuredOutputSection
                    embedded
                    hideHeader
                    key={
                      selectedAgentData.agentId ||
                      selectedAgentData.id ||
                      "agent-structured-output"
                    }
                    rfConfig={rfConfig}
                    updateResponseFormat={updateResponseFormat}
                  />
                </div>
              )}
            </div>

            {/* 4. Sub-section: Middleware Pipeline (Guardrails & HITL) */}
            <div className="rounded-lg border border-border/50 bg-secondary/15 overflow-hidden">
              <div
                className="flex items-center justify-between px-2.5 py-2 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
                onClick={() => setIsLlmMiddlewareOpen((prev) => !prev)}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Middleware Pipeline
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    (Guardrails &amp; HITL)
                  </span>
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Switch
                    checked={isMiddlewareEnabled}
                    onCheckedChange={(enabled) => {
                      handleToggleMiddlewareConfig(enabled);
                      if (enabled) {
                        setIsLlmMiddlewareOpen(true);
                      }
                    }}
                    className="scale-80"
                    title="Toggle Middleware Pipeline ON/OFF"
                  />
                  <button
                    type="button"
                    onClick={() => setIsLlmMiddlewareOpen((prev) => !prev)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {isLlmMiddlewareOpen ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              {isLlmMiddlewareOpen && (
                <div className="p-2.5 border-t border-border/40 bg-background/20">
                  <AgentMiddlewareSection
                    agentId={selectedAgentData.agentId || selectedAgentData.id || ""}
                    isEnabled={isMiddlewareEnabled}
                    onToggleEnabled={handleToggleMiddlewareConfig}
                    connectedMiddlewareIds={connectedMiddlewareIds}
                    availableMiddlewareNodes={availableMiddlewareNodes}
                    masterMiddlewareNodes={masterMiddlewareNodes}
                    nodes={nodes}
                    onAddMiddlewareRef={onAddMiddlewareRef}
                    onRemoveMiddlewareRef={onRemoveMiddlewareRef}
                    onToggleMiddleware={onToggleMiddleware}
                  />
                </div>
              )}
            </div>

            {/* 5. Sub-section: Event Streaming (SSE & Token Streams) */}
            <div className="rounded-lg border border-border/50 bg-secondary/15 overflow-hidden">
              <div
                className="flex items-center justify-between px-2.5 py-2 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
                onClick={() => setIsLlmStreamingOpen((prev) => !prev)}
              >
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Event Streaming
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    (SSE &amp; Token Streams)
                  </span>
                </div>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Switch
                    checked={Boolean(selectedAgentData.streamConfig?.enabled)}
                    onCheckedChange={(enabled) => {
                      onUpdateAgent({
                        streamConfig: {
                          ...(selectedAgentData.streamConfig || {
                            version: "v3",
                            selectedEvents: DEFAULT_SELECTED_STREAM_EVENTS,
                            envelope: DEFAULT_STREAM_ENVELOPE,
                            transformer: {
                              mode: DEFAULT_STREAM_TRANSFORMER_MODE,
                            },
                          }),
                          enabled,
                        },
                      });
                      if (enabled) {
                        setIsLlmStreamingOpen(true);
                      }
                    }}
                    className="scale-80"
                    title="Toggle Event Streaming ON/OFF"
                  />
                  <button
                    type="button"
                    onClick={() => setIsLlmStreamingOpen((prev) => !prev)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {isLlmStreamingOpen ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              {isLlmStreamingOpen && (
                <div className="p-2.5 border-t border-border/40 bg-background/20">
                  <AgentEventStreamingSection
                    embedded
                    hideHeader
                    selectedAgentData={selectedAgentData}
                    onUpdateAgent={onUpdateAgent}
                  />
                </div>
              )}
            </div>
          </div>
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
              value={step.customCode?.body ?? (selectedAgentData.customCode?.body || "")}
              onChange={(e) => handleUpdateStepCode(step.id, e.target.value)}
              className="text-xs min-h-[120px] font-mono bg-background/60 border border-border/60 rounded-md p-2.5 resize-y leading-relaxed"
              placeholder={`// Example: mutate or compute fields on state\nreturn {\n  count: (state.count || 0) + 1,\n  timestamp: Date.now()\n};`}
            />
            <p className="text-[10px] text-muted-foreground/70">
              Return an object with modified state channels, or mutate cloned state directly.
            </p>
          </div>
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
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── Top Pipeline Header (Pipeline Step Editor Style) ─────────────────── */}
      <div className="flex flex-col gap-2 p-3 bg-secondary/20 rounded-xl border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30 text-purple-400 shadow-xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <LocalInput
                  value={selectedAgentData.name || ""}
                  onChange={(e) => onUpdateAgent({ name: e.target.value })}
                  placeholder="Node Name"
                  className="h-6 text-xs font-bold text-foreground font-mono bg-background/40 border border-border/40 focus:border-purple-400 px-1.5 py-0 max-w-[170px] truncate rounded"
                  title="Edit Node Name"
                />
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 border-purple-500/30 text-purple-400 font-mono shrink-0"
                >
                  LangGraph Node
                </Badge>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                {selectedAgentData.agentId || selectedAgentData.id || "agent_node"} •{" "}
                {activePipelineSteps.length} {activePipelineSteps.length === 1 ? "Step" : "Steps"} Configured
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {activePipelineSteps.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                onClick={allOpen ? handleCollapseAll : handleExpandAll}
                title={allOpen ? "Collapse All Steps" : "Expand All Steps"}
              >
                {allOpen ? (
                  <>
                    <ChevronsDownUp className="w-3 h-3" /> Collapse
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="w-3 h-3" /> Expand
                  </>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              onClick={onDeleteAgent}
              title="Delete Agent Node"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Stepper Navigation Pills */}
        <div className="flex items-center gap-1 pt-1.5 border-t border-border/30 overflow-x-auto hide-scrollbar text-[10px] font-mono select-none">
          {activePipelineSteps.map((step, index) => {
            const meta = LANGGRAPH_STEP_META[step.type];
            const isExpanded = Boolean(expandedSteps[step.id]);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => toggleStep(step.id)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer shrink-0 ${
                  isExpanded
                    ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                    : "bg-background/40 hover:bg-secondary/40 text-muted-foreground border border-border/40"
                }`}
                title={`Toggle ${step.label || meta?.label || step.type}`}
              >
                <span className="w-3.5 text-center font-bold">{index + 1}</span>
                <span className="truncate max-w-[90px]">{step.label || meta?.label || step.type}</span>
              </button>
            );
          })}
          {/* Pinned Terminal Step: State Updates */}
          <button
            type="button"
            onClick={() => setIsStateUpdatesOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer shrink-0 border ${
              isStateUpdatesOpen
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold"
                : "bg-background/40 hover:bg-secondary/40 text-muted-foreground border-border/40"
            }`}
            title="Toggle Pinned Terminal Return: State Updates"
          >
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span>State Updates</span>
            <span className="text-[9px] opacity-75 font-mono">
              ({isStateUpdatesEnabled ? `${(selectedAgentData.stateUpdates || []).length}` : "off"})
            </span>
          </button>
        </div>
      </div>

      {/* ─── Dynamic Steps List (Draggable & Reorderable) ──────────────────────── */}
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
                  const meta = LANGGRAPH_STEP_META[step.type];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const isExpanded = Boolean(expandedSteps[step.id]);
                  const isFirst = index === 0;
                  const isLast = index === activePipelineSteps.length - 1;

                  return (
                    <Draggable
                      key={step.id}
                      draggableId={step.id}
                      index={index}
                    >
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
                            onClick={() => toggleStep(step.id)}
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
                                  onChange={(e) =>
                                    handleUpdateStepLabel(step.id, e.target.value)
                                  }
                                  placeholder={meta.label}
                                  className="h-5 text-[11px] font-medium text-foreground bg-transparent hover:bg-background/50 focus:bg-background border border-transparent hover:border-border/40 focus:border-primary/50 px-1 py-0 rounded truncate"
                                  title="Click to rename step"
                                />
                              </div>

                              {/* Summary / Preview */}
                              <div className="text-[11px] min-w-0 flex-1 truncate font-mono">
                                {renderStepSummary(step)}
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
                                onClick={() => handleMoveStep(index, index - 1)}
                                title="Move Step Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isLast}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
                                onClick={() => handleMoveStep(index, index + 1)}
                                title="Move Step Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDeleteStep(step.id)}
                                title={`Delete ${step.label || meta.label}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => toggleStep(step.id)}
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
                              {renderStepContent(step)}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* ─── Add Step Toolbar (Execution Steps) ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Add Execution Step
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {activePipelineSteps.length} {activePipelineSteps.length === 1 ? "Step" : "Steps"} Configured
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ADDABLE_LANGGRAPH_STEP_TYPES.map((type) => {
            const meta = LANGGRAPH_STEP_META[type];
            const Icon = meta.icon;
            const count = activePipelineSteps.filter((s) => s.type === type).length;

            return (
              <button
                key={type}
                type="button"
                onClick={() => handleAddStep(type)}
                className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md border transition-all duration-150 shadow-xs cursor-pointer bg-secondary/40 hover:bg-secondary border-border/60 text-foreground/85 hover:text-foreground active:scale-95 hover:border-border"
                title={meta.description}
              >
                <Plus className="w-2.5 h-2.5 text-muted-foreground/80 shrink-0" />
                <Icon className={`w-3 h-3 ${meta.color} shrink-0`} />
                <span>+ Add {meta.label}</span>
                {count > 0 && (
                  <span className="text-[9px] px-1 py-0 rounded bg-secondary/80 font-mono text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Pinned Final Step: Node Output / State Updates (Terminal Return) ─── */}
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
            onClick={() => setIsStateUpdatesOpen((prev) => !prev)}
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
                onCheckedChange={handleToggleStateUpdatesEnabled}
                className="scale-85"
                title="Toggle State Updates ON/OFF (Node return value)"
              />
              <button
                type="button"
                onClick={() => setIsStateUpdatesOpen((prev) => !prev)}
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
    </div>
  );
}
