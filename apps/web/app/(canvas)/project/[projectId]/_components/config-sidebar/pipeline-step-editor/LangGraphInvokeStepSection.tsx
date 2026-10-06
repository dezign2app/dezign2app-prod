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
  Database,
  Key,
} from "lucide-react";
import { BackendNode, KafkaTopic, RedisStream } from "@workspace/canvas/types";
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
    return source.value !== undefined && source.value !== "" ? String(source.value) : "inline:";
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
  if (
    trimmed === "env" ||
    trimmed === "process.env" ||
    trimmed.startsWith("env.") ||
    trimmed.startsWith("process.env.")
  ) {
    const field = trimmed.startsWith("process.env.")
      ? trimmed.slice(12)
      : trimmed.startsWith("env.")
      ? trimmed.slice(4)
      : "";
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
  if (
    trimmed.startsWith("`") ||
    trimmed.startsWith('"') ||
    trimmed.startsWith("'") ||
    trimmed.includes("${") ||
    trimmed.startsWith("inline:")
  ) {
    const val = trimmed.startsWith("inline:") ? trimmed.slice(7).trim() : trimmed;
    return { kind: "inline", value: val };
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

  // 1. Kafka Broker Nodes & Selected Broker
  const kafkaBrokerNodes = useMemo(() => {
    return allNodes.filter((n) => n.type === "kafka" || n.type === "eventstream");
  }, [allNodes]);

  const selectedKafkaBrokerNode = useMemo(() => {
    if (step.langGraphStreamingKafkaNodeId) {
      const found = kafkaBrokerNodes.find((n) => n.id === step.langGraphStreamingKafkaNodeId);
      if (found) return found;
    }
    return kafkaBrokerNodes[0];
  }, [kafkaBrokerNodes, step.langGraphStreamingKafkaNodeId]);

  // Extract Kafka topics available on the selected Kafka broker
  const availableKafkaTopics = useMemo(() => {
    if (!selectedKafkaBrokerNode?.data?.topics) return [];
    const topics: string[] = [];
    selectedKafkaBrokerNode.data.topics.forEach((t: KafkaTopic) => {
      const name = t.name || t.id;
      if (name && !topics.includes(name)) topics.push(name);
    });
    return topics;
  }, [selectedKafkaBrokerNode]);

  // 2. Redis Nodes & Selected Redis Node
  const redisNodes = useMemo(() => {
    return allNodes.filter(
      (n) => n.type === "redis-streams" || n.type === "redis-pubsub" || n.type === "redis-cache",
    );
  }, [allNodes]);

  const selectedRedisNode = useMemo(() => {
    if (step.langGraphStreamingRedisNodeId) {
      const found = redisNodes.find((n) => n.id === step.langGraphStreamingRedisNodeId);
      if (found) return found;
    }
    return redisNodes[0];
  }, [redisNodes, step.langGraphStreamingRedisNodeId]);

  // Extract Redis streams available on the selected Redis node
  const availableRedisStreams = useMemo(() => {
    if (!selectedRedisNode?.data?.streams) return [];
    const streams: string[] = [];
    selectedRedisNode.data.streams.forEach((s: RedisStream) => {
      const name = s.name || s.id;
      if (name && !streams.includes(name)) streams.push(name);
    });
    return streams;
  }, [selectedRedisNode]);

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

  const rawMemoryConfig = selectedAgentNode?.data?.memoryConfig;
  const memoryConfig = rawMemoryConfig ?? {
    checkpointer: "memory",
    enabled: true,
  };
  const hasMemory = useMemo(() => {
    if (rawMemoryConfig && rawMemoryConfig.enabled === false) return false;
    return Boolean(memoryConfig.checkpointer);
  }, [rawMemoryConfig, memoryConfig]);

  const mapping: Record<string, string> = useMemo(() => {
    return step.langGraphStateMapping || {};
  }, [step.langGraphStateMapping]);

  const isChannelMapped = (key: string) => {
    const hasInMapping = key in mapping && mapping[key] !== undefined && mapping[key] !== "";
    const hasInBindings = (step.inputBindings || []).some((b) => b.argName === key);
    return hasInMapping || hasInBindings;
  };

  const mappedDeclaredChannels = useMemo(() => {
    return stateChannels.filter((ch) => isChannelMapped(ch.key));
  }, [stateChannels, mapping, step.inputBindings]);

  const customKeys = useMemo(() => {
    const keysFromMapping = Object.keys(mapping).filter((k) => Boolean(mapping[k]));
    const keysFromBindings = (step.inputBindings || []).map((b) => b.argName).filter(Boolean);
    const allKeys = Array.from(new Set([...keysFromMapping, ...keysFromBindings]));
    return allKeys.filter((k) => !stateChannels.some((ch) => ch.key === k));
  }, [mapping, step.inputBindings, stateChannels]);

  const unmappedDeclaredChannels = useMemo(() => {
    return stateChannels.filter((ch) => !isChannelMapped(ch.key));
  }, [stateChannels, mapping, step.inputBindings]);

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
    const existingKeys = new Set(currentBindings.map((b) => b.argName));
    const backfilledBindings: StepBinding[] = [...currentBindings];

    for (const [k, rawMap] of Object.entries(mapping)) {
      if (k !== channelKey && !existingKeys.has(k)) {
        backfilledBindings.push({
          argName: k,
          source: accessorToStepSource(rawMap, availableSources),
        });
      }
    }

    const otherBindings = backfilledBindings.filter((b) => b.argName !== channelKey);
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

  const getArgBinding = (
    argName: string,
    fieldValue: string | undefined,
    fallbackAccessor: string,
  ): StepBinding => {
    const existing = (step.inputBindings || []).find((b) => b.argName === argName);
    if (existing) return existing;
    if (fieldValue !== undefined && fieldValue !== "") {
      return {
        argName,
        source: accessorToStepSource(fieldValue, availableSources),
      };
    }
    return {
      argName,
      source: accessorToStepSource(fallbackAccessor, availableSources),
    };
  };

  const handleArgBindingChange = (
    argName: string,
    updated: StepBinding,
    fieldKey:
      | "langGraphStreamingKafkaKey"
      | "langGraphStreamingRoom"
      | "langGraphStreamingRedisKey"
      | "langGraphThreadIdSource",
  ) => {
    const currentBindings = step.inputBindings || [];
    const otherBindings = currentBindings.filter((b) => b.argName !== argName);
    const nextBindings: StepBinding[] = [
      ...otherBindings,
      { argName, source: updated.source },
    ];
    const accessor = stepSourceToAccessor(updated.source, availableSources);
    onChange({
      ...step,
      inputBindings: nextBindings,
      [fieldKey]: accessor,
    });
  };

  const handleResetArgBinding = (
    argName: string,
    fieldKey:
      | "langGraphStreamingKafkaKey"
      | "langGraphStreamingRoom"
      | "langGraphStreamingRedisKey"
      | "langGraphThreadIdSource",
  ) => {
    const currentBindings = step.inputBindings || [];
    const nextBindings = currentBindings.filter((b) => b.argName !== argName);
    const nextStep = { ...step, inputBindings: nextBindings };
    delete nextStep[fieldKey];
    onChange(nextStep);
  };

  const handleRemoveMapping = (stateKey: string) => {
    const nextMapping = { ...mapping };
    delete nextMapping[stateKey];

    const currentBindings = step.inputBindings || [];
    const existingKeys = new Set(currentBindings.map((b) => b.argName));
    const backfilledBindings: StepBinding[] = [...currentBindings];

    for (const [k, rawMap] of Object.entries(nextMapping)) {
      if (!existingKeys.has(k)) {
        backfilledBindings.push({
          argName: k,
          source: accessorToStepSource(rawMap, availableSources),
        });
      }
    }

    const nextBindings = backfilledBindings.filter((b) => b.argName !== stateKey);

    onChange({
      ...step,
      inputBindings: nextBindings,
      langGraphStateMapping: nextMapping,
    });
  };

  const handleAddChannel = (channelKey: string) => {
    let matchedSource: StepSource | null = null;
    const keyLower = channelKey.toLowerCase();

    for (const src of availableSources) {
      if (src.kind === "inline") continue;
      const foundPath = src.paths.find((p) => {
        const pLower = p.path.toLowerCase();
        if (pLower === keyLower) return true;
        if (
          keyLower === "messages" &&
          (pLower === "messages" || pLower === "message" || pLower === "prompt" || pLower === "query")
        ) {
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
        field: channelKey === "messages" ? "message" : channelKey,
      };
    }

    const accessor = stepSourceToAccessor(matchedSource, availableSources);
    const nextMapping = {
      ...mapping,
      [channelKey]: accessor || `body.${channelKey}`,
    };

    const bindingToAdd: StepBinding = {
      argName: channelKey,
      source: matchedSource,
    };

    const currentBindings = step.inputBindings || [];
    const existingKeys = new Set(currentBindings.map((b) => b.argName));
    const backfilledBindings: StepBinding[] = [...currentBindings];
    for (const [k, rawMap] of Object.entries(mapping)) {
      if (k !== channelKey && !existingKeys.has(k)) {
        backfilledBindings.push({
          argName: k,
          source: accessorToStepSource(rawMap, availableSources),
        });
      }
    }

    const nextBindings = [
      ...backfilledBindings.filter((b) => b.argName !== channelKey),
      bindingToAdd,
    ];

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

    let nextThreadIdSource = step.langGraphThreadIdSource;
    if (hasMemory && !nextThreadIdSource) {
      let matchedThreadSource: StepSource | null = null;
      for (const src of availableSources) {
        if (src.kind === "inline") continue;
        const found = src.paths.find((p) => {
          const l = p.path.toLowerCase();
          return (
            l === "thread_id" ||
            l === "threadid" ||
            l === "x-thread-id" ||
            l === "conversation_id" ||
            l === "session_id"
          );
        });
        if (found) {
          if (src.kind === "step_output" && src.stepId) {
            matchedThreadSource = {
              kind: "step_output",
              stepId: src.stepId,
              field: found.path,
            };
          } else if (
            src.kind === "req_body" ||
            src.kind === "req_params" ||
            src.kind === "req_query" ||
            src.kind === "req_headers" ||
            src.kind === "env"
          ) {
            matchedThreadSource = { kind: src.kind, field: found.path };
          }
          break;
        }
      }
      if (matchedThreadSource) {
        nextThreadIdSource = stepSourceToAccessor(
          matchedThreadSource,
          availableSources,
        );
      } else {
        nextThreadIdSource = "body.thread_id";
      }
    }

    onChange({
      ...step,
      inputBindings: newBindings,
      langGraphStateMapping: newMapping,
      ...(hasMemory && nextThreadIdSource
        ? { langGraphThreadIdSource: nextThreadIdSource }
        : {}),
    });
  };

  const handleAddCustomField = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim();
    const bindingToAdd: StepBinding = {
      argName: key,
      source: newCustomBinding.source,
    };

    const currentBindings = step.inputBindings || [];
    const existingKeys = new Set(currentBindings.map((b) => b.argName));
    const backfilledBindings: StepBinding[] = [...currentBindings];
    for (const [k, rawMap] of Object.entries(mapping)) {
      if (k !== key && !existingKeys.has(k)) {
        backfilledBindings.push({
          argName: k,
          source: accessorToStepSource(rawMap, availableSources),
        });
      }
    }

    const nextBindings = [
      ...backfilledBindings.filter((b) => b.argName !== key),
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

      {/* Memory Checkpointer Thread ID Section */}
      {hasMemory && (
        <div className="flex flex-col gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <Label className="text-xs font-bold text-foreground">
                Session Thread ID (Checkpointer Memory)
              </Label>
            </div>
            <Badge
              variant="outline"
              className="text-[9px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/15"
            >
              {selectedAgentNode?.data?.memoryConfig?.checkpointer || "memory"} checkpointer
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            LangGraph automatically queries the checkpointer database to retrieve the full chat history for this <code className="font-mono text-emerald-400">thread_id</code>. Only the new user message needs to be mapped into state channels.
          </p>

          <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-2 rounded-lg border border-emerald-500/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono font-bold text-emerald-400 text-[11px] truncate bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                thread_id
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">string</span>
            </div>
            <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
            <div className="min-w-0">
              <BindingSourceEditor
                binding={getArgBinding("thread_id", step.langGraphThreadIdSource, "body.thread_id")}
                availableSources={availableSources}
                serviceNodeId={serviceNodeId}
                onChange={(updated) =>
                  handleArgBindingChange("thread_id", updated, "langGraphThreadIdSource")
                }
              />
            </div>
            <div className="w-6" />
          </div>

          {!step.langGraphThreadIdSource && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Defaults to <code className="font-mono font-bold">body.thread_id</code>. Provide a session/thread ID so the agent can resume conversation context.</span>
            </div>
          )}
        </div>
      )}

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
          {(mappedDeclaredChannels.length > 0 || customKeys.length > 0) && (
            <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
              <span>State Channel</span>
              <span></span>
              <span>Source & Field</span>
              <span className="w-6 text-right"></span>
            </div>
          )}

          {mappedDeclaredChannels.map((ch, idx) => {
            const binding = getBindingForChannel(ch.key);

            return (
              <div
                key={`mapped-ch-${ch.key}-${idx}`}
                className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/50 p-1.5 rounded-lg border border-border/40"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-purple-300 text-[11px] truncate bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                      {ch.key}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono truncate">
                      {ch.type}
                    </span>
                  </div>
                  {ch.key === "messages" && hasMemory && (
                    <span className="text-[8.5px] text-emerald-400/90 font-sans mt-0.5 leading-tight truncate">
                      new input only (history from DB)
                    </span>
                  )}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveMapping(ch.key)}
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    title="Remove mapping"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Any custom mappings not in declared channels */}
          {customKeys.map((k) => {
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

          {mappedDeclaredChannels.length === 0 && customKeys.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/40 p-3 text-center bg-background/30">
              <p className="text-[11px] text-muted-foreground">
                No payload channels mapped yet. The agent will run with its default state.
              </p>
              <p
                className="text-[10px] text-primary/70 mt-1 cursor-pointer hover:underline"
                onClick={handleAutoMap}
              >
                Click here to auto-map all available state channels.
              </p>
            </div>
          )}

          {/* Unmapped state channels quick-add chips */}
          {unmappedDeclaredChannels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-1 border-t border-border/20 text-xs">
              <span className="text-[10px] text-muted-foreground font-medium">
                Available channels:
              </span>
              {unmappedDeclaredChannels.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => handleAddChannel(ch.key)}
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/40 transition-colors"
                  title={`Map channel: ${ch.key} (${ch.type})`}
                >
                  <Plus className="w-3 h-3 text-purple-400" />
                  <span>{ch.key}</span>
                  <span className="text-[9px] text-muted-foreground font-sans">
                    ({ch.type})
                  </span>
                </button>
              ))}
            </div>
          )}

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
              Real-time Response Streaming
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
            <div className="flex flex-col gap-1.5 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium">
                Delivery Protocol & Destination:
              </span>
              <div className="flex flex-wrap gap-1">
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
                  Direct SSE
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
                <Button
                  type="button"
                  size="sm"
                  variant={streamingProtocol === "kafka" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphStreamingProtocol: "kafka",
                    })
                  }
                  className="h-6 text-[10px] px-2.5"
                >
                  Kafka Topic
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={streamingProtocol === "redis_stream" ? "default" : "outline"}
                  onClick={() =>
                    onChange({
                      ...step,
                      langGraphStreamingProtocol: "redis_stream",
                    })
                  }
                  className="h-6 text-[10px] px-2.5"
                >
                  Redis Stream
                </Button>
              </div>
            </div>

            {/* Protocol-Specific Config */}
            {streamingProtocol === "websocket" && (
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-background/50 border border-border/40">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Radio className="w-3 h-3 text-sky-400" />
                    <span>WebSocket Room / Channel Mapping</span>
                  </Label>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    wsBroadcast Room
                  </span>
                </div>

                <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                  <span>Target Key</span>
                  <span></span>
                  <span>Source & Field</span>
                  <span className="w-6 text-right"></span>
                </div>

                <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-1.5 rounded-lg border border-sky-500/20">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-sky-400 text-[11px] truncate bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                      room_id
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">string</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
                  <div className="min-w-0">
                    <BindingSourceEditor
                      binding={getArgBinding(
                        "room_id",
                        step.langGraphStreamingRoom,
                        step.langGraphThreadIdSource || "body.thread_id",
                      )}
                      availableSources={availableSources}
                      serviceNodeId={serviceNodeId}
                      onChange={(updated) =>
                        handleArgBindingChange("room_id", updated, "langGraphStreamingRoom")
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    {step.langGraphStreamingRoom || (step.inputBindings || []).some((b) => b.argName === "room_id") ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResetArgBinding("room_id", "langGraphStreamingRoom")}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Reset to default (thread_id)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <div className="w-6" />
                    )}
                  </div>
                </div>

                <p className="text-[9.5px] text-muted-foreground leading-tight">
                  Tokens are broadcasted to connected clients in this room. {step.langGraphStreamingRoom ? `Custom room: ${step.langGraphStreamingRoom}` : `Defaults to ${step.langGraphThreadIdSource || "body.thread_id"}`}.
                </p>
              </div>
            )}

            {streamingProtocol === "kafka" && (
              <div className="flex flex-col gap-2.5 p-2.5 rounded-lg bg-background/50 border border-border/40">
                <div className="grid grid-cols-2 gap-2">
                  {/* Kafka Broker Node Selector */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3 h-3 text-amber-400" />
                      <span>Kafka Broker Node</span>
                    </Label>
                    {kafkaBrokerNodes.length > 0 ? (
                      <Select
                        value={selectedKafkaBrokerNode?.id || "__none__"}
                        onValueChange={(val) => {
                          const broker = kafkaBrokerNodes.find((n) => n.id === val);
                          const firstTopic = broker?.data?.topics?.[0]?.name || broker?.data?.topics?.[0]?.id || "";
                          onChange({
                            ...step,
                            langGraphStreamingKafkaNodeId: val,
                            langGraphStreamingKafkaTopic: firstTopic || step.langGraphStreamingKafkaTopic || "",
                          });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs bg-background">
                          <SelectValue placeholder="Select Kafka Broker" />
                        </SelectTrigger>
                        <SelectContent>
                          {kafkaBrokerNodes.map((b) => (
                            <SelectItem key={b.id} value={b.id} className="text-xs">
                              {b.data?.label || b.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic py-1">
                        No Kafka broker node on canvas
                      </span>
                    )}
                  </div>

                  {/* Kafka Topic Selector */}
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Radio className="w-3 h-3 text-purple-400" />
                      <span>Target Topic</span>
                    </Label>
                    {availableKafkaTopics.length > 0 ? (
                      <Select
                        value={step.langGraphStreamingKafkaTopic || availableKafkaTopics[0]}
                        onValueChange={(val) =>
                          onChange({
                            ...step,
                            langGraphStreamingKafkaTopic: val,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs bg-background">
                          <SelectValue placeholder="Select Topic" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableKafkaTopics.map((top) => (
                            <SelectItem key={top} value={top} className="text-xs">
                              {top}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <LocalInput
                        value={step.langGraphStreamingKafkaTopic || ""}
                        onChange={(e) =>
                          onChange({
                            ...step,
                            langGraphStreamingKafkaTopic: e.target.value,
                          })
                        }
                        placeholder="agent-response-tokens"
                        className="h-7 text-xs bg-background"
                      />
                    )}
                  </div>
                </div>

                {/* Partition Key Field Mapping */}
                <div className="flex flex-col gap-1.5 mt-0.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Key className="w-3 h-3 text-amber-400" />
                      <span>Partition Key Mapping (ensures in-order delivery)</span>
                    </Label>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      Kafka Record Key
                    </span>
                  </div>

                  <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    <span>Target Key</span>
                    <span></span>
                    <span>Source & Field</span>
                    <span className="w-6 text-right"></span>
                  </div>

                  <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-1.5 rounded-lg border border-amber-500/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-amber-400 text-[11px] truncate bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        partition_key
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">string</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
                    <div className="min-w-0">
                      <BindingSourceEditor
                        binding={getArgBinding(
                          "partition_key",
                          step.langGraphStreamingKafkaKey,
                          step.langGraphThreadIdSource || "body.thread_id",
                        )}
                        availableSources={availableSources}
                        serviceNodeId={serviceNodeId}
                        onChange={(updated) =>
                          handleArgBindingChange(
                            "partition_key",
                            updated,
                            "langGraphStreamingKafkaKey",
                          )
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      {step.langGraphStreamingKafkaKey || (step.inputBindings || []).some((b) => b.argName === "partition_key") ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleResetArgBinding(
                              "partition_key",
                              "langGraphStreamingKafkaKey",
                            )
                          }
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          title="Reset to default (thread_id)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <div className="w-6" />
                      )}
                    </div>
                  </div>

                  <p className="text-[9.5px] text-muted-foreground leading-tight">
                    Tokens published with this key route to the same Kafka partition, guaranteeing ordering for consumers. {step.langGraphStreamingKafkaKey ? `Custom key: ${step.langGraphStreamingKafkaKey}` : `Defaults to ${step.langGraphThreadIdSource || "body.thread_id"}`}.
                  </p>
                </div>
              </div>
            )}

            {streamingProtocol === "redis_stream" && (
              <div className="flex flex-col gap-2.5 p-2.5 rounded-lg bg-background/50 border border-border/40">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Database className="w-3 h-3 text-red-400" />
                    <span>Redis Node</span>
                  </Label>
                  {redisNodes.length > 0 ? (
                    <Select
                      value={selectedRedisNode?.id || "__none__"}
                      onValueChange={(val) => {
                        const rNode = redisNodes.find((n) => n.id === val);
                        const firstStream = rNode?.data?.streams?.[0]?.name || rNode?.data?.streams?.[0]?.id || "";
                        onChange({
                          ...step,
                          langGraphStreamingRedisNodeId: val,
                          langGraphStreamingRedisKey: firstStream || step.langGraphStreamingRedisKey || "",
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-background">
                        <SelectValue placeholder="Select Redis Node" />
                      </SelectTrigger>
                      <SelectContent>
                        {redisNodes.map((rn) => (
                          <SelectItem key={rn.id} value={rn.id} className="text-xs">
                            {rn.data?.label || rn.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic py-1">
                      No Redis node on canvas
                    </span>
                  )}
                </div>

                {/* Declared Redis streams quick-picker chips if node has streams */}
                {availableRedisStreams.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9.5px] text-muted-foreground">Declared streams:</span>
                    {availableRedisStreams.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...step,
                            langGraphStreamingRedisKey: st,
                          })
                        }
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                          step.langGraphStreamingRedisKey === st
                            ? "border-red-500/60 bg-red-500/20 text-red-300 font-bold"
                            : "border-border/60 bg-background/60 text-muted-foreground hover:bg-secondary/40"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}

                {/* Redis Stream Key Field Mapping */}
                <div className="flex flex-col gap-1.5 mt-0.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Radio className="w-3 h-3 text-red-400" />
                      <span>Stream Key Mapping (XADD destination)</span>
                    </Label>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      Redis Stream Key
                    </span>
                  </div>

                  <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    <span>Target Key</span>
                    <span></span>
                    <span>Source & Field</span>
                    <span className="w-6 text-right"></span>
                  </div>

                  <div className="grid grid-cols-[140px_auto_1fr_auto] gap-2 items-center text-xs bg-background/60 p-1.5 rounded-lg border border-red-500/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-red-400 text-[11px] truncate bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                        stream_key
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">string</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
                    <div className="min-w-0">
                      <BindingSourceEditor
                        binding={getArgBinding(
                          "stream_key",
                          step.langGraphStreamingRedisKey,
                          step.langGraphThreadIdSource
                            ? `stream:agent:\${${step.langGraphThreadIdSource}}`
                            : "stream:agent:default",
                        )}
                        availableSources={availableSources}
                        serviceNodeId={serviceNodeId}
                        onChange={(updated) =>
                          handleArgBindingChange(
                            "stream_key",
                            updated,
                            "langGraphStreamingRedisKey",
                          )
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      {step.langGraphStreamingRedisKey || (step.inputBindings || []).some((b) => b.argName === "stream_key") ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleResetArgBinding(
                              "stream_key",
                              "langGraphStreamingRedisKey",
                            )
                          }
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          title="Reset to default stream key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <div className="w-6" />
                      )}
                    </div>
                  </div>

                  <p className="text-[9.5px] text-muted-foreground leading-tight">
                    Tokens are pushed to this Redis stream via XADD. {step.langGraphStreamingRedisKey ? `Custom stream: ${step.langGraphStreamingRedisKey}` : `Defaults to stream:agent:\${${step.langGraphThreadIdSource || "body.thread_id"}}`}.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-1">
              <span className="text-[11px] font-medium text-foreground">
                Streamed State Channels
              </span>
              <p className="text-[10px] text-muted-foreground">
                Click to filter which channel tokens are forwarded (empty = all tokens):
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
                {streamingProtocol === "sse" &&
                  "Tokens will stream in real-time to the caller over HTTP SSE (`res.write()`)."}
                {streamingProtocol === "websocket" &&
                  "Tokens will broadcast in real-time to connected WebSocket clients (`wsBroadcast()`)."}
                {streamingProtocol === "kafka" &&
                  "Tokens will stream in real-time to the Kafka topic (`publishKafkaEvent()`)."}
                {streamingProtocol === "redis_stream" &&
                  "Tokens will append in real-time to the Redis stream (`redis.xadd()`)."}
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
