import React, { useState, useRef } from "react";
import { FileJson, Shield, Radio, ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import { Label } from "@workspace/ui/components/label";
import type {
  AgentNodeData,
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  ToolNode,
  LangGraphToolRefNode,
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
  LangGraphAgentResponseFormatConfig,
  LangGraphCanvasNode,
  LangGraphNodePipelineStep,
  LangGraphStateChannel,
} from "@workspace/canvas";

import { AgentAttachedComponentsSection } from "./AgentAttachedComponentsSection";
import { AgentMiddlewareSection } from "./AgentMiddlewareSection";
import { AgentStructuredOutputSection } from "./AgentStructuredOutputSection";
import { AgentEventStreamingSection } from "./AgentEventStreamingSection";
import {
  AgentPromptVariablePicker,
  PromptActiveVariablesBar,
} from "./AgentPromptVariablePicker";
import {
  DEFAULT_SELECTED_STREAM_EVENTS,
  DEFAULT_STREAM_ENVELOPE,
  DEFAULT_STREAM_TRANSFORMER_MODE,
} from "../../../constants";
import { LocalTextarea } from "../../../../../common";

interface AgentLlmStepContentProps {
  selectedAgentData: AgentNodeData;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  step?: LangGraphNodePipelineStep;
  onUpdateStep?: (updatedStep: LangGraphNodePipelineStep) => void;
  priorSteps?: LangGraphNodePipelineStep[];
  allPipelineSteps?: LangGraphNodePipelineStep[];
  stateChannels?: LangGraphStateChannel[];
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
  rfConfig: LangGraphAgentResponseFormatConfig;
  updateResponseFormat: (changes: Partial<LangGraphAgentResponseFormatConfig>) => void;
  isMiddlewareEnabled: boolean;
  handleToggleMiddlewareConfig: (enabled: boolean) => void;
}

export function AgentLlmStepContent({
  selectedAgentData,
  onUpdateAgent,
  step,
  onUpdateStep,
  priorSteps = [],
  allPipelineSteps = [],
  stateChannels = [],
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
  rfConfig,
  updateResponseFormat,
  isMiddlewareEnabled,
  handleToggleMiddlewareConfig,
}: AgentLlmStepContentProps) {
  const [isLlmStructuredOpen, setIsLlmStructuredOpen] = useState(
    Boolean(rfConfig.enabled),
  );
  const [isLlmMiddlewareOpen, setIsLlmMiddlewareOpen] = useState(
    isMiddlewareEnabled || connectedMiddlewareIds.length > 0,
  );
  const [isLlmStreamingOpen, setIsLlmStreamingOpen] = useState(
    Boolean(selectedAgentData.streamConfig?.enabled),
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (token: string) => {
    const textarea = textareaRef.current;
    const currentPrompt = selectedAgentData.systemPrompt || "";
    let nextPrompt = "";
    let nextPos = 0;

    if (textarea) {
      const start = textarea.selectionStart ?? currentPrompt.length;
      const end = textarea.selectionEnd ?? currentPrompt.length;
      nextPrompt =
        currentPrompt.slice(0, start) + token + currentPrompt.slice(end);
      nextPos = start + token.length;

      // Dispatch native input event to ensure LocalTextarea updates immediately
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(textarea, nextPrompt);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else {
      nextPrompt = currentPrompt
        ? `${currentPrompt.trimEnd()} ${token}`
        : token;
      nextPos = nextPrompt.length;
    }

    onUpdateAgent({ systemPrompt: nextPrompt });

    if (step && onUpdateStep) {
      onUpdateStep({ ...step, systemPrompt: nextPrompt });
    }

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(nextPos, nextPos);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1. Identity & System Instructions */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold text-foreground">
              System Prompt
            </Label>
            {selectedAgentData.systemPrompt && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {selectedAgentData.systemPrompt.length} chars
              </span>
            )}
          </div>
        </div>

        {/* Cascading Variable Picker: Select Step/State -> Select Field -> Add Button */}
        <AgentPromptVariablePicker
          stateChannels={stateChannels}
          priorSteps={priorSteps}
          nodes={nodes}
          onInsertVariable={handleInsertVariable}
          currentPrompt={selectedAgentData.systemPrompt}
        />

        <LocalTextarea
          ref={textareaRef}
          value={selectedAgentData.systemPrompt || ""}
          onChange={(e) => {
            const nextVal = e.target.value;
            onUpdateAgent({ systemPrompt: nextVal });
            if (step && onUpdateStep) {
              onUpdateStep({ ...step, systemPrompt: nextVal });
            }
          }}
          className="text-xs min-h-[90px] resize-y bg-background/50 font-mono leading-relaxed"
          placeholder="System instructions / prompt for this agent node... (use ${state.msg} or ${step1Result.field1} to interpolate variables)"
        />

        {/* Active Variables in Prompt Indicator */}
        <PromptActiveVariablesBar currentPrompt={selectedAgentData.systemPrompt} />
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
}
