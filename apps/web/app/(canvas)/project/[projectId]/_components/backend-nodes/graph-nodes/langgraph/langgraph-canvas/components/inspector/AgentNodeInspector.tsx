import React, { useState, useMemo } from "react";
import {
  Bot,
  Cpu,
  Zap,
  FileJson,
  Radio,
  ChevronDown,
  ChevronRight,
  Trash2,
  ChevronsUpDown,
  ChevronsDownUp,
  Sparkles,
  Layers,
  Wrench,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Switch } from "@workspace/ui/components/switch";
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
} from "@workspace/canvas";

import { AgentIdentitySection } from "./agent-inspector/AgentIdentitySection";
import { AgentAttachedComponentsSection } from "./agent-inspector/AgentAttachedComponentsSection";
import { AgentMiddlewareSection } from "./agent-inspector/AgentMiddlewareSection";
import { AgentStructuredOutputSection } from "./agent-inspector/AgentStructuredOutputSection";
import { AgentEventStreamingSection } from "./agent-inspector/AgentEventStreamingSection";
import { AgentStateUpdatesSection } from "./agent-inspector/AgentStateUpdatesSection";
import { parseSchemaJsonToFields } from "./agent-inspector/AgentStructuredOutputSection";

interface AgentNodeInspectorProps {
  selectedAgentData: AgentNodeData;
  onDeleteAgent: () => void;
  onUpdateAgent: (changes: Partial<AgentNodeData>) => void;
  availableLLMNodes?: (LangGraphLLMNode | LangGraphLLMRefNode)[];
  availableToolNodes?: (ToolNode | LangGraphToolRefNode)[];
  availableMiddlewareNodes?: (MiddlewareNode | LangGraphMiddlewareRefNode)[];
  masterToolNodes?: ToolNode[];
  masterMiddlewareNodes?: MiddlewareNode[];
  nodes?: (import("@workspace/canvas").LangGraphCanvasNode)[];
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

  const isMiddlewareEnabled = Boolean(
    selectedAgentData.middlewareConfig?.enabled ??
      (connectedMiddlewareIds.length > 0),
  );

  const handleToggleMiddlewareConfig = (enabled: boolean) => {
    onUpdateAgent({
      middlewareConfig: {
        ...(selectedAgentData.middlewareConfig || {}),
        enabled,
      },
    });
    if (enabled) {
      setExpandedSteps((prev) => ({ ...prev, 3: true }));
    }
  };

  // Step accordion states (Default: steps 1, 2, 4 open; 3, 4, 6 open if enabled)
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: isMiddlewareEnabled,
    4: Boolean(rfConfig.enabled),
    5: true,
    6: streamConfig.enabled !== false,
  });

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const handleExpandAll = () => {
    setExpandedSteps({
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
    });
  };

  const handleCollapseAll = () => {
    setExpandedSteps({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
    });
  };

  // Summaries
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

  const allOpen = Object.values(expandedSteps).every(Boolean);

  return (
    <div className="flex flex-col gap-3.5">
      {/* ─── Top Pipeline Header (Step Editor Style) ─────────────────────────── */}
      <div className="flex flex-col gap-2 p-3 bg-secondary/20 rounded-xl border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/30 text-purple-400 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground font-mono truncate max-w-[160px]">
                  {selectedAgentData.name || selectedAgentData.label || "AI Agent"}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 border-purple-500/30 text-purple-400 font-mono"
                >
                  Agent Pipeline
                </Badge>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {selectedAgentData.agentId || selectedAgentData.id || "agent_node"} • 6 Configuration Steps
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
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
          {[
            { num: 1, label: "Identity", active: true },
            {
              num: 2,
              label: "Model & Tools",
              active: Boolean(connectedLLMId) || connectedToolIds.length > 0,
            },
            {
              num: 3,
              label: "Middleware",
              active: isMiddlewareEnabled || connectedMiddlewareIds.length > 0,
            },
            { num: 4, label: "Schema", active: Boolean(rfConfig.enabled) },
            { num: 5, label: "State", active: stateUpdates.length > 0 },
            { num: 6, label: "Streaming", active: streamConfig.enabled !== false },
          ].map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => toggleStep(item.num)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                expandedSteps[item.num]
                  ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                  : "bg-background/40 hover:bg-secondary/40 text-muted-foreground border border-border/40"
              }`}
            >
              <span className="w-3.5 text-center font-bold">{item.num}</span>
              <span className="truncate">{item.label}</span>
              {item.active && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Step 1: Agent Identity & System Instructions ─────────────────────── */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden ${
          expandedSteps[1]
            ? "border-purple-500/40 bg-card/60 shadow-xs"
            : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          onClick={() => toggleStep(1)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold shrink-0 bg-purple-500/10 border border-purple-500/30 text-purple-300">
              1
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 bg-purple-500/10 text-purple-300 border-purple-500/25">
              <Bot className="w-3 h-3 text-purple-400" /> Identity & Prompt
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {selectedAgentData.name || "search_assistant"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedAgentData.systemPrompt && (
              <span className="text-[9px] text-muted-foreground/70 font-mono hidden sm:inline">
                {selectedAgentData.systemPrompt.length} chars
              </span>
            )}
            {expandedSteps[1] ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {expandedSteps[1] && (
          <div className="border-t border-border/40 p-3 bg-background/30">
            <AgentIdentitySection
              hideHeader
              selectedAgentData={selectedAgentData}
              onDeleteAgent={onDeleteAgent}
              onUpdateAgent={onUpdateAgent}
            />
          </div>
        )}
      </div>

      {/* ─── Step 2: Attached Model, Tools & Middleware ───────────────────────── */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden ${
          expandedSteps[2]
            ? "border-sky-500/40 bg-card/60 shadow-xs"
            : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          onClick={() => toggleStep(2)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold shrink-0 bg-sky-500/10 border border-sky-500/30 text-sky-300">
              2
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 bg-sky-500/10 text-sky-300 border-sky-500/25">
              <Cpu className="w-3 h-3 text-sky-400" /> Model & Tools
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {connectedLLMName} • {connectedToolIds.length} tool refs{connectedMiddlewareIds.length > 0 ? ` • ${connectedMiddlewareIds.length} mw` : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {connectedToolIds.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1 py-0 h-4 bg-emerald-500/15 text-emerald-300 border-0 font-mono"
              >
                {connectedToolIds.length} tools
              </Badge>
            )}
            {connectedMiddlewareIds.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1 py-0 h-4 bg-purple-500/15 text-purple-300 border-0 font-mono"
              >
                {connectedMiddlewareIds.length} mw
              </Badge>
            )}
            {expandedSteps[2] ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {expandedSteps[2] && (
          <div className="border-t border-border/40 p-3 bg-background/30">
            <AgentAttachedComponentsSection
              embedded
              hideMiddleware
              availableLLMNodes={availableLLMNodes}
              availableToolNodes={availableToolNodes}
              availableMiddlewareNodes={availableMiddlewareNodes}
              masterToolNodes={masterToolNodes}
              masterMiddlewareNodes={masterMiddlewareNodes}
              nodes={nodes}
              agentId={
                selectedAgentData.agentId ||
                selectedAgentData.id ||
                ""
              }
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
          </div>
        )}
      </div>

      {/* ─── Step 3: Middleware Pipeline ────────────────────────────────────────── */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden ${
          expandedSteps[3]
            ? "border-purple-500/40 bg-card/60 shadow-xs"
            : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          onClick={() => toggleStep(3)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold shrink-0 bg-purple-500/10 border border-purple-500/30 text-purple-300">
              3
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 bg-purple-500/10 text-purple-300 border-purple-500/25">
              <Shield className="w-3 h-3 text-purple-400" /> Middleware Pipeline
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {isMiddlewareEnabled
                ? connectedMiddlewareIds.length > 0
                  ? `${connectedMiddlewareIds.length} active refs`
                  : "Active (0 attached)"
                : "Disabled"}
            </span>
          </div>

          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={isMiddlewareEnabled}
              onCheckedChange={handleToggleMiddlewareConfig}
              className="scale-90"
              title="Toggle Middleware Pipeline ON/OFF"
            />
            <button
              type="button"
              onClick={() => toggleStep(3)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {expandedSteps[3] ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {expandedSteps[3] && (
          <div className="border-t border-border/40 p-3 bg-background/30">
            <AgentMiddlewareSection
              agentId={
                selectedAgentData.agentId ||
                selectedAgentData.id ||
                ""
              }
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

      {/* ─── Step 4: Structured Output (JSON Schema) ───────────────────────────── */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden ${
          expandedSteps[4]
            ? "border-fuchsia-500/40 bg-card/60 shadow-xs"
            : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          onClick={() => toggleStep(4)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold shrink-0 bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300">
              4
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/25">
              <FileJson className="w-3 h-3 text-fuchsia-400" /> Structured Output
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {rfConfig.enabled
                ? `${schemaFields.length} schema fields`
                : "Disabled"}
            </span>
          </div>

          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={Boolean(rfConfig.enabled)}
              onCheckedChange={(enabled) => {
                updateResponseFormat({ enabled });
                if (enabled) {
                  setExpandedSteps((prev) => ({ ...prev, 4: true }));
                }
              }}
              className="scale-90"
              title="Toggle Structured Output ON/OFF"
            />
            <button
              type="button"
              onClick={() => toggleStep(4)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {expandedSteps[4] ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {expandedSteps[4] && (
          <div className="border-t border-border/40 p-3 bg-background/30">
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

      {/* ─── Step 5: Graph State Updates & Reducers ────────────────────────────── */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden ${
          expandedSteps[5]
            ? "border-amber-500/40 bg-card/60 shadow-xs"
            : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          onClick={() => toggleStep(5)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold shrink-0 bg-amber-500/10 border border-amber-500/30 text-amber-300">
              5
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 bg-amber-500/10 text-amber-300 border-amber-500/25">
              <Zap className="w-3 h-3 text-amber-400" /> State Updates
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {stateUpdates.length > 0
                ? `${stateUpdates.length} channels mapped`
                : "Default messages flow"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {stateUpdates.length > 0 && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1 py-0 h-4 bg-amber-500/15 text-amber-300 border-0"
              >
                {stateUpdates.length} updates
              </Badge>
            )}
            {expandedSteps[5] ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {expandedSteps[5] && (
          <div className="border-t border-border/40 p-3 bg-background/30">
            <AgentStateUpdatesSection
              embedded
              selectedAgentData={selectedAgentData}
              onUpdateAgent={onUpdateAgent}
              stateChannels={stateChannels}
              customReducers={customReducers}
            />
          </div>
        )}
      </div>

      {/* ─── Step 6: Event Streaming & Client Delivery ─────────────────────────── */}
      <div
        className={`rounded-xl border transition-all duration-150 overflow-hidden ${
          expandedSteps[6]
            ? "border-cyan-500/40 bg-card/60 shadow-xs"
            : "border-border/60 bg-card/30 hover:border-border/80 hover:bg-card/45"
        }`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          onClick={() => toggleStep(6)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold shrink-0 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              6
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 bg-cyan-500/10 text-cyan-300 border-cyan-500/25">
              <Radio className="w-3 h-3 text-cyan-400" /> Event Streaming
            </span>
            <span className="text-[11px] text-muted-foreground truncate font-mono">
              {streamConfig.enabled !== false ? "v3 Active (Standard SSE)" : "Disabled"}
            </span>
          </div>

          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={streamConfig.enabled !== false}
              onCheckedChange={(enabled) => {
                onUpdateAgent({
                  streamConfig: {
                    ...streamConfig,
                    enabled,
                  },
                });
                if (enabled) {
                  setExpandedSteps((prev) => ({ ...prev, 6: true }));
                }
              }}
              className="scale-90"
              title="Toggle Event Streaming ON/OFF"
            />
            <button
              type="button"
              onClick={() => toggleStep(6)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {expandedSteps[6] ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {expandedSteps[6] && (
          <div className="border-t border-border/40 p-3 bg-background/30">
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
