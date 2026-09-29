"use client";

import React, { useMemo, useState } from "react";
import {
  Network,
  Radio,
  Sparkles,
  Layers,
  RefreshCw,
  Trash2,
  Plus,
  Bot,
  AlertCircle,
  CheckCircle2,
  Flame,
  ArrowRight,
} from "lucide-react";
import { BackendNode } from "@workspace/canvas/types";
import { Button } from "@workspace/ui/components/button";
import { BufferedInput, LocalInput } from "./BufferedInput";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { Badge } from "@workspace/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { BindingSourceEditor } from "./BindingSourceEditor";
import { PipelineStepDraft, StepBinding, StepSource, AvailableSource } from "./types";

function stepSourceToAccessor(
  source: StepSource,
  availableSources?: AvailableSource[],
): string {
  if (source.kind === "req_body") {
    return source.field ? `body.${source.field}` : "body";
  }
  if (source.kind === "req_params") {
    return source.field ? `params.${source.field}` : "params";
  }
  if (source.kind === "req_query") {
    return source.field ? `query.${source.field}` : "query";
  }
  if (source.kind === "req_headers") {
    return source.field ? `headers.${source.field}` : "headers";
  }
  if (source.kind === "env") {
    return source.field ? `env.${source.field}` : "env";
  }
  if (source.kind === "step_output") {
    const matched = availableSources?.find(
      (s) => s.kind === "step_output" && s.stepId === source.stepId,
    );
    const varName = matched?.variableName || source.stepId;
    return source.field ? `${varName}.${source.field}` : varName;
  }
  if (source.kind === "inline") {
    return String(source.value ?? "");
  }
  return "";
}

function accessorToStepSource(
  accessor: string,
  availableSources?: AvailableSource[],
): StepSource {
  const trimmed = (accessor || "").trim();
  if (!trimmed) {
    return { kind: "req_body", field: "" };
  }
  if (trimmed.startsWith("body.") || trimmed === "body") {
    return { kind: "req_body", field: trimmed === "body" ? "" : trimmed.slice(5) };
  }
  if (trimmed.startsWith("event.") || trimmed === "event") {
    return { kind: "req_body", field: trimmed === "event" ? "" : trimmed.slice(6) };
  }
  if (trimmed.startsWith("params.") || trimmed === "params") {
    return { kind: "req_params", field: trimmed === "params" ? "" : trimmed.slice(7) };
  }
  if (trimmed.startsWith("query.") || trimmed === "query") {
    return { kind: "req_query", field: trimmed === "query" ? "" : trimmed.slice(6) };
  }
  if (trimmed.startsWith("headers.") || trimmed === "headers") {
    return { kind: "req_headers", field: trimmed === "headers" ? "" : trimmed.slice(8) };
  }
  const headerMatch = trimmed.match(/(?:req\.)?headers\[['"]([^'"]+)['"]\]/);
  if (headerMatch) {
    return { kind: "req_headers", field: headerMatch[1] };
  }
  if (trimmed.startsWith("env.") || trimmed.startsWith("process.env.")) {
    const field = trimmed.startsWith("process.env.") ? trimmed.slice(12) : trimmed.slice(4);
    return { kind: "env", field };
  }
  if (availableSources) {
    for (const src of availableSources) {
      if (src.kind === "step_output" && src.stepId) {
        const varName = src.variableName;
        if (varName && (trimmed === varName || trimmed.startsWith(`${varName}.`))) {
          const field = trimmed === varName ? "" : trimmed.slice(varName.length + 1);
          return { kind: "step_output", stepId: src.stepId, field };
        }
        if (trimmed === src.stepId || trimmed.startsWith(`${src.stepId}.`)) {
          const field = trimmed === src.stepId ? "" : trimmed.slice(src.stepId.length + 1);
          return { kind: "step_output", stepId: src.stepId, field };
        }
      }
    }
  }
  return { kind: "req_body", field: trimmed };
}

export interface LangGraphInvokeStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  availableSources?: AvailableSource[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
  children?: React.ReactNode;
}

export const LangGraphInvokeStepSection: React.FC<
  LangGraphInvokeStepSectionProps
> = ({ step, allNodes, availableSources = [], serviceNodeId, onChange, children }) => {
  const [newKey, setNewKey] = useState("");
  const [newCustomBinding, setNewCustomBinding] = useState<StepBinding>({
    argName: "",
    source: { kind: "req_body", field: "" },
  });

  // 1. Identify all LangGraph nodes on canvas
  const availableAgents = useMemo(() => {
    return allNodes.filter((n) => n.type === "langgraph");
  }, [allNodes]);

  // Selected agent node
  const selectedAgentNode = useMemo(() => {
    if (step.langGraphTargetNodeId) {
      const found = availableAgents.find(
        (n) => n.id === step.langGraphTargetNodeId,
      );
      if (found) return found;
    }
    return availableAgents[0];
  }, [availableAgents, step.langGraphTargetNodeId]);

  // Auto-set targetNodeId if not set yet
  React.useEffect(() => {
    if (!step.langGraphTargetNodeId && selectedAgentNode) {
      onChange({
        ...step,
        langGraphTargetNodeId: selectedAgentNode.id,
      });
    }
  }, [selectedAgentNode, step.langGraphTargetNodeId, step, onChange]);

  // State channels defined on selected agent node
  const stateChannels: Array<{ key: string; type: string }> = useMemo(() => {
    if (!selectedAgentNode?.data) return [{ key: "messages", type: "BaseMessage[]" }];
    const channels = selectedAgentNode.data.stateChannels;
    if (Array.isArray(channels) && channels.length > 0) {
      return channels;
    }
    return [{ key: "messages", type: "BaseMessage[]" }];
  }, [selectedAgentNode]);

  const mapping: Record<string, string> = useMemo(() => {
    return step.langGraphStateMapping || {};
  }, [step.langGraphStateMapping]);

  const isStreaming = step.langGraphStreamingEnabled ?? false;
  const streamingProtocol = step.langGraphStreamingProtocol || "sse";
  const outputMode = step.langGraphOutputMode || "full_state";
  const streamingFields = step.langGraphStreamingFields || [];
  const outputFields = step.langGraphOutputFields || [];

  // Handlers
  const handleSelectAgent = (nodeId: string) => {
    onChange({
      ...step,
      langGraphTargetNodeId: nodeId,
    });
  };

  const getBindingForChannel = (channelKey: string): StepBinding => {
    const existing = (step.inputBindings || []).find((b) => b.argName === channelKey);
    if (existing) return existing;
    const rawMapping = mapping[channelKey];
    if (rawMapping) {
      return {
        argName: channelKey,
        source: accessorToStepSource(rawMapping, availableSources),
      };
    }
    return {
      argName: channelKey,
      source: {
        kind: "req_body",
        field: channelKey === "messages" ? "message" : channelKey,
      },
    };
  };

  const handleBindingChange = (channelKey: string, updatedBinding: StepBinding) => {
    const currentBindings = step.inputBindings || [];
    const otherBindings = currentBindings.filter((b) => b.argName !== channelKey);
    const nextBindings = [...otherBindings, { ...updatedBinding, argName: channelKey }];

    const accessor = stepSourceToAccessor(updatedBinding.source, availableSources);
    const nextMapping = { ...mapping };
    if (accessor) {
      nextMapping[channelKey] = accessor;
    } else {
      delete nextMapping[channelKey];
    }

    onChange({
      ...step,
      inputBindings: nextBindings,
      langGraphStateMapping: nextMapping,
    });
  };

  const handleRemoveMapping = (stateKey: string) => {
    const nextBindings = (step.inputBindings || []).filter((b) => b.argName !== stateKey);
    const nextMapping = { ...mapping };
    delete nextMapping[stateKey];
    onChange({
      ...step,
      inputBindings: nextBindings,
      langGraphStateMapping: nextMapping,
    });
  };

  const handleAutoMap = () => {
    const newMapping: Record<string, string> = { ...mapping };
    const newBindings: StepBinding[] = [...(step.inputBindings || [])];

    stateChannels.forEach((ch) => {
      let matchedSource: StepSource | null = null;
      const keyLower = ch.key.toLowerCase();

      // Look for match in availableSources
      for (const src of availableSources) {
        if (src.kind === "inline") continue;
        const foundPath = src.paths.find((p) => {
          const pLower = p.path.toLowerCase();
          if (pLower === keyLower) return true;
          if (keyLower === "messages" && (pLower === "messages" || pLower === "message" || pLower === "prompt" || pLower === "query")) {
            return true;
          }
          return false;
        });
        if (foundPath) {
          if (src.kind === "step_output" && src.stepId) {
            matchedSource = { kind: "step_output", stepId: src.stepId, field: foundPath.path };
          } else if (
            src.kind === "req_body" ||
            src.kind === "req_params" ||
            src.kind === "req_query" ||
            src.kind === "req_headers" ||
            src.kind === "env"
          ) {
            matchedSource = { kind: src.kind, field: foundPath.path };
          }
          break;
        }
      }

      if (!matchedSource) {
        matchedSource = {
          kind: "req_body",
          field: ch.key === "messages" ? "message" : ch.key,
        };
      }

      const accessor = stepSourceToAccessor(matchedSource, availableSources);
      newMapping[ch.key] = accessor;

      const existingIdx = newBindings.findIndex((b) => b.argName === ch.key);
      const updatedB: StepBinding = { argName: ch.key, source: matchedSource };
      if (existingIdx >= 0) {
        newBindings[existingIdx] = updatedB;
      } else {
        newBindings.push(updatedB);
      }
    });

    onChange({
      ...step,
      inputBindings: newBindings,
      langGraphStateMapping: newMapping,
    });
  };

  const handleAddCustomField = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim();
    const bindingToAdd: StepBinding = {
      argName: key,
      source: newCustomBinding.source,
    };
    const nextBindings = [
      ...(step.inputBindings || []).filter((b) => b.argName !== key),
      bindingToAdd,
    ];
    const accessor = stepSourceToAccessor(bindingToAdd.source, availableSources);
    const nextMapping = {
      ...mapping,
      [key]: accessor || `body.${key}`,
    };

    onChange({
      ...step,
      inputBindings: nextBindings,
      langGraphStateMapping: nextMapping,
    });
    setNewKey("");
    setNewCustomBinding({
      argName: "",
      source: { kind: "req_body", field: "" },
    });
  };

  const handleToggleStreaming = (enabled: boolean) => {
    onChange({
      ...step,
      langGraphStreamingEnabled: enabled,
      langGraphStreamingProtocol: enabled ? streamingProtocol : undefined,
    });
  };

  const handleToggleStreamingField = (channelKey: string) => {
    const nextFields = streamingFields.includes(channelKey)
      ? streamingFields.filter((k) => k !== channelKey)
      : [...streamingFields, channelKey];
    onChange({
      ...step,
      langGraphStreamingFields: nextFields,
    });
  };

  const handleToggleOutputField = (channelKey: string) => {
    const nextFields = outputFields.includes(channelKey)
      ? outputFields.filter((k) => k !== channelKey)
      : [...outputFields, channelKey];
    onChange({
      ...step,
      langGraphOutputFields: nextFields,
    });
  };

  if (availableAgents.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold">No LangGraph Agent Found</span>
        </div>
        <p className="text-[11px] text-amber-300/80 leading-relaxed">
          There are no LangGraph agent nodes currently present on this canvas.
          Add a LangGraph node from the canvas sidebar to connect it to this
          pipeline step.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Target Agent Selector */}
      <div className="flex flex-col gap-2 p-3 bg-secondary/20 rounded-xl border border-border/50">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-primary" />
            Target LangGraph Agent
          </Label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {availableAgents.length} available
          </span>
        </div>
        <Select
          value={selectedAgentNode?.id || ""}
          onValueChange={handleSelectAgent}
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

      {/* State Channels Mapping */}
      <div className="flex flex-col gap-2.5 p-3.5 bg-secondary/15 rounded-xl border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <Label className="text-xs font-bold text-foreground">
              State Channel Payload Mapping
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoMap}
            className="h-6 text-[10px] font-semibold gap-1 px-2 border-border/60 hover:bg-secondary/40"
            title="Auto-map default payload fields"
          >
            <RefreshCw className="w-3 h-3 text-primary" />
            Auto-map
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Map request parameters or preceding step outputs into the agent state
          channels (e.g. `body.message`, `req.headers["x-user-id"]`, or
          `step_output`).
        </p>

        <div className="flex flex-col gap-2 mt-1">
          <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            <span>State Channel</span>
            <span></span>
            <span>Source & Field</span>
            <span className="w-6 text-right"></span>
          </div>

          {stateChannels.map((ch, idx) => {
            const binding = getBindingForChannel(ch.key);
            const isMapped = mapping[ch.key] !== undefined || (step.inputBindings || []).some((b) => b.argName === ch.key);

            return (
              <div
                key={ch.key ? `invoke-ch-${ch.key}-${idx}` : `invoke-ch-empty-${idx}`}
                className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/50 p-1.5 rounded-lg border border-border/40"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono font-bold text-purple-300 text-[11px] truncate bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                    {ch.key}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono truncate">
                    {ch.type}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
                <div className="min-w-0">
                  <BindingSourceEditor
                    binding={binding}
                    availableSources={availableSources}
                    serviceNodeId={serviceNodeId}
                    onChange={(updated) => handleBindingChange(ch.key, updated)}
                  />
                </div>
                <div className="flex justify-end">
                  {isMapped && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMapping(ch.key)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      title="Clear mapping"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Any custom mappings not in declared channels */}
          {Object.keys(mapping)
            .filter((k) => !stateChannels.some((ch) => ch.key === k))
            .map((k) => {
              const binding = getBindingForChannel(k);
              return (
                <div
                  key={`custom-${k}`}
                  className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/50 p-1.5 rounded-lg border border-border/40"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-primary text-[11px] truncate bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                      {k}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      (custom)
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
                  <div className="min-w-0">
                    <BindingSourceEditor
                      binding={binding}
                      availableSources={availableSources}
                      serviceNodeId={serviceNodeId}
                      onChange={(updated) => handleBindingChange(k, updated)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMapping(k)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      title="Remove custom mapping"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

          {/* Add custom state field */}
          <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center pt-2 border-t border-border/30">
            <div className="min-w-0">
              <LocalInput
                value={newKey}
                placeholder="Custom key"
                onChange={(e) => setNewKey(e.target.value)}
                className="h-7 text-xs font-mono bg-background/80"
              />
            </div>
            <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
            <div className="min-w-0">
              <BindingSourceEditor
                binding={newCustomBinding}
                availableSources={availableSources}
                serviceNodeId={serviceNodeId}
                onChange={setNewCustomBinding}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddCustomField}
                disabled={!newKey.trim()}
                className="h-7 w-7 text-primary border-border/60 hover:bg-primary/10 shrink-0"
                title="Add state mapping"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Streaming & Output Delivery Section */}
      <div className="flex flex-col gap-3 p-3.5 bg-secondary/15 rounded-xl border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio
              className={`w-3.5 h-3.5 ${
                isStreaming ? "text-purple-400 animate-pulse" : "text-muted-foreground"
              }`}
            />
            <Label className="text-xs font-bold text-foreground">
              Response Streaming (SSE)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              {isStreaming ? "Stream Active" : "Sync REST"}
            </span>
            <Switch
              checked={isStreaming}
              onCheckedChange={handleToggleStreaming}
            />
          </div>
        </div>

        {isStreaming ? (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">
                Delivery Protocol:
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={streamingProtocol === "sse" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphStreamingProtocol: "sse",
                    })
                  }
                  className="h-6 text-[10px] px-2.5"
                >
                  Server-Sent Events (SSE)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={streamingProtocol === "websocket" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphStreamingProtocol: "websocket",
                    })
                  }
                  className="h-6 text-[10px] px-2.5"
                >
                  WebSocket
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-[11px] font-medium text-foreground">
                Streamed State Channels
              </span>
              <p className="text-[10px] text-muted-foreground">
                Click to filter which channel tokens are forwarded to the client
                (empty = all tokens):
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {stateChannels.map((ch, idx) => {
                  const isSelected = streamingFields.includes(ch.key);
                  return (
                    <button
                      key={ch.key ? `stream-ch-${ch.key}-${idx}` : `stream-ch-empty-${idx}`}
                      type="button"
                      onClick={() => handleToggleStreamingField(ch.key)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                        isSelected
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold"
                          : "bg-background/80 text-muted-foreground border-border/40 hover:border-border"
                      }`}
                    >
                      {ch.key}
                      {isSelected && " ✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-200 text-[10px] mt-1">
              <Flame className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>
                Tokens will be streamed in real-time as the agent generates
                them (`graph.stream()`).
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-foreground">
                Output Mode
              </Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={outputMode === "full_state" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphOutputMode: "full_state",
                    })
                  }
                  className="h-6 text-[10px] px-2"
                >
                  Full State
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={outputMode === "last_message" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphOutputMode: "last_message",
                    })
                  }
                  className="h-6 text-[10px] px-2"
                >
                  Last Message
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={outputMode === "specific_fields" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphOutputMode: "specific_fields",
                    })
                  }
                  className="h-6 text-[10px] px-2"
                >
                  Specific Fields
                </Button>
              </div>
            </div>

            {outputMode === "specific_fields" && (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground">
                  Select state channels to include in step output:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {stateChannels.map((ch, idx) => {
                    const isSelected = outputFields.includes(ch.key);
                    return (
                      <button
                        key={ch.key ? `out-ch-${ch.key}-${idx}` : `out-ch-empty-${idx}`}
                        type="button"
                        onClick={() => handleToggleOutputField(ch.key)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                          isSelected
                            ? "bg-primary/20 text-primary border-primary/40 font-bold"
                            : "bg-background/80 text-muted-foreground border-border/40 hover:border-border"
                        }`}
                      >
                        {ch.key}
                        {isSelected && " ✓"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {children}
    </div>
  );
};
