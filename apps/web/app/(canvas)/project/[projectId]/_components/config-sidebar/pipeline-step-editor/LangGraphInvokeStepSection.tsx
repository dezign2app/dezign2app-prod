"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import {
  BackendNode,
  BackendEdge,
  KafkaTopic,
  RedisStream,
  Endpoint,
  Parameter,
  LangGraphInputChannel,
  LangGraphMessagesConfig,
} from "@workspace/canvas/types";
import { checkCheckpointerTablesStatus } from "../../backend-nodes/graph-nodes/langgraph/langgraph-canvas/utils/checkpointerTables";
import { PipelineStepDraft, StepBinding, StepSource, AvailableSource, LangGraphStreamMode } from "./types";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { ensurePageRefConnection } from "./utils";
import { ensureWsPackageInService } from "@/lib/stores/backendCanvas/packageTypesSync";
import {
  stepSourceToAccessor,
  accessorToStepSource,
  isDedicatedChannel,
  AgentSelectorSection,
  SessionThreadIdSection,
  ConversationMessagesSection,
  StateChannelPayloadSection,
  StreamingAndOutputSection,
  DeclaredChannel,
} from "./langgraph-invoke";

export { stepSourceToAccessor, accessorToStepSource, isDedicatedChannel };

export interface LangGraphInvokeStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges?: BackendEdge[];
  availableSources?: AvailableSource[];
  serviceNodeId?: string;
  onChange: (updated: PipelineStepDraft) => void;
  endpoint?: Endpoint;
  onEndpointChange?: (changes: Partial<Endpoint>) => void;
  children?: React.ReactNode;
}

export const LangGraphInvokeStepSection: React.FC<
  LangGraphInvokeStepSectionProps
> = ({
  step,
  allNodes,
  allEdges = [],
  availableSources = [],
  serviceNodeId,
  onChange,
  endpoint,
  onEndpointChange,
  children,
}) => {
  const params = useParams();
  const rawProjectId = params?.projectId;
  const projectId =
    typeof rawProjectId === "string"
      ? rawProjectId
      : Array.isArray(rawProjectId)
        ? rawProjectId[0]
        : "";

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

  // 1b. Target Web Page & Push to Client (PageRef) Node resolution
  const allWebPages = useMemo(() => {
    return allNodes.filter((n) => n.type === "webPage");
  }, [allNodes]);

  // Detect which WebPage node invokes/connects to this endpoint
  const invokingPage = useMemo(() => {
    if (!serviceNodeId) return undefined;
    const epId = endpoint?.id;

    // 1. Direct edge from a webPage to this service/endpoint
    for (const edge of allEdges) {
      const isSrcPage = allNodes.some((n) => n.id === edge.source && n.type === "webPage");
      const isTgtPage = allNodes.some((n) => n.id === edge.target && n.type === "webPage");
      if (!isSrcPage && !isTgtPage) continue;

      const pageId = isSrcPage ? edge.source : edge.target;
      const otherId = isSrcPage ? edge.target : edge.source;
      const otherHandle = isSrcPage ? (edge.targetHandle || "") : (edge.sourceHandle || "");

      if (otherId === serviceNodeId) {
        if (
          epId &&
          (otherHandle.includes(epId) ||
            otherHandle === `endpoint-in-${epId}` ||
            otherHandle === `endpoint-out-${epId}` ||
            otherHandle === `endpoints-in-${epId}` ||
            otherHandle === `routeEndpoints-in-${epId}`)
        ) {
          return allNodes.find((n) => n.id === pageId && n.type === "webPage");
        }
      }
    }

    // 2. Section actionSteps inside webPages targeting this endpoint
    for (const node of allNodes) {
      if (node.type !== "webPage") continue;
      const sections = (node.data?.sections || []) as any[];
      for (const sec of sections) {
        const actions = sec.actions || [];
        for (const act of actions) {
          const steps = act.actionSteps || [];
          for (const s of steps) {
            if (
              (epId && s.endpointId === epId) ||
              (s.serviceNodeId === serviceNodeId && (!s.endpointId || s.endpointId === epId))
            ) {
              return node;
            }
          }
        }
      }
    }

    // 3. Fallback: Any direct edge between webPage and serviceNodeId
    for (const edge of allEdges) {
      if (edge.source === serviceNodeId) {
        const p = allNodes.find((n) => n.id === edge.target && n.type === "webPage");
        if (p) return p;
      } else if (edge.target === serviceNodeId) {
        const p = allNodes.find((n) => n.id === edge.source && n.type === "webPage");
        if (p) return p;
      }
    }

    return undefined;
  }, [allEdges, allNodes, endpoint, serviceNodeId]);

  // Default target page: the invoking page, or root page, or first webPage
  const defaultTargetPage = useMemo(() => {
    return (
      invokingPage ||
      allWebPages.find((p) => p.data?.isRoot === true || p.data?.label === "/") ||
      allWebPages[0]
    );
  }, [invokingPage, allWebPages]);

  const selectedTargetPageId =
    step.clientDeliveryTargetPageId || defaultTargetPage?.id || "";

  // Connected push to client (page_ref) node on canvas
  const connectedPageRefNode = useMemo(() => {
    if (!serviceNodeId) return undefined;
    const epId = endpoint?.id;
    for (const edge of allEdges) {
      const isSrc = edge.source === serviceNodeId;
      const isTgt = edge.target === serviceNodeId;
      if (!isSrc && !isTgt) continue;

      const otherId = isSrc ? edge.target : edge.source;
      const handle = isSrc ? (edge.sourceHandle || "") : (edge.targetHandle || "");

      const matchesHandle = epId ? (!handle || handle.includes(epId)) : true;
      if (matchesHandle) {
        const candidate = allNodes.find((n) => n.id === otherId && n.type === "page_ref");
        if (candidate) return candidate;
      }
    }
    if (step.clientDeliveryPageRefNodeId) {
      const byId = allNodes.find(
        (n) => n.id === step.clientDeliveryPageRefNodeId && n.type === "page_ref",
      );
      if (byId) return byId;
    }
    return undefined;
  }, [allEdges, allNodes, endpoint, serviceNodeId, step.clientDeliveryPageRefNodeId]);

  const ssePageRefNode = connectedPageRefNode;

  const handleConnectPushToClientNode = useCallback(
    (targetPageIdToConnect?: string) => {
      if (!serviceNodeId) return;
      const targetPageId =
        targetPageIdToConnect || selectedTargetPageId || defaultTargetPage?.id;
      if (!targetPageId) return;

      const conn = ensurePageRefConnection({
        targetPageId,
        pageRefNodeId: step.clientDeliveryPageRefNodeId,
        serviceNodeId,
        endpointId: endpoint?.id,
        stepId: step.id,
      });

      if (conn?.pageRefNodeId) {
        onChange({
          ...step,
          clientDeliveryTargetPageId: conn.targetPageId || targetPageId,
          clientDeliveryPageRefNodeId: conn.pageRefNodeId,
        });
      }
    },
    [
      serviceNodeId,
      selectedTargetPageId,
      defaultTargetPage,
      step,
      endpoint,
      onChange,
    ],
  );

  // Auto-connect push to client (page_ref) node when streaming is enabled
  useEffect(() => {
    if (!step.langGraphStreamingEnabled || !serviceNodeId) return;
    const proto = step.langGraphStreamingProtocol || "sse";
    if (proto === "sse" || proto === "websocket") {
      const targetPageId = step.clientDeliveryTargetPageId || defaultTargetPage?.id;
      if (targetPageId && (!step.clientDeliveryPageRefNodeId || !connectedPageRefNode)) {
        const conn = ensurePageRefConnection({
          targetPageId,
          pageRefNodeId: step.clientDeliveryPageRefNodeId,
          serviceNodeId,
          endpointId: endpoint?.id,
          stepId: step.id,
        });
        if (
          conn?.pageRefNodeId &&
          (conn.pageRefNodeId !== step.clientDeliveryPageRefNodeId ||
            conn.targetPageId !== step.clientDeliveryTargetPageId)
        ) {
          onChange({
            ...step,
            clientDeliveryTargetPageId: conn.targetPageId || targetPageId,
            clientDeliveryPageRefNodeId: conn.pageRefNodeId,
          });
        }
      }
    }
  }, [
    step.langGraphStreamingEnabled,
    step.langGraphStreamingProtocol,
    step.clientDeliveryTargetPageId,
    step.clientDeliveryPageRefNodeId,
    connectedPageRefNode,
    defaultTargetPage,
    serviceNodeId,
    endpoint,
    step,
    onChange,
  ]);

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
  useEffect(() => {
    if (!step.langGraphTargetNodeId && selectedAgentNode) {
      onChange({
        ...step,
        langGraphTargetNodeId: selectedAgentNode.id,
      });
    }
  }, [selectedAgentNode, step.langGraphTargetNodeId, step, onChange]);

  // Input channels defined on selected agent node (the explicit public API contract)
  const inputChannels: LangGraphInputChannel[] = useMemo(() => {
    if (!selectedAgentNode?.data?.inputChannels) return [];
    if (Array.isArray(selectedAgentNode.data.inputChannels)) {
      return selectedAgentNode.data.inputChannels;
    }
    return [];
  }, [selectedAgentNode]);

  // State channels defined on selected agent node
  const stateChannels: Array<{ key: string; type: string }> = useMemo(() => {
    if (!selectedAgentNode?.data) return [{ key: "messages", type: "BaseMessage[]" }];
    const channels = selectedAgentNode.data.stateChannels;
    if (Array.isArray(channels) && channels.length > 0) {
      return channels;
    }
    return [{ key: "messages", type: "BaseMessage[]" }];
  }, [selectedAgentNode]);

  const hasDedicatedMessages = Boolean(step.langGraphMessagesConfig);

  // Combined declared channels for mapping: prioritizing inputChannels, plus unmapped state channels.
  // Note: thread_id and messages/message have dedicated cards above when active, so they are excluded here.
  const declaredChannels = useMemo<DeclaredChannel[]>(() => {
    const list: DeclaredChannel[] = [];
    const seen = new Set<string>();

    for (const inCh of inputChannels) {
      if (inCh.key && !isDedicatedChannel(inCh.key, inCh.stateChannelKey, hasDedicatedMessages)) {
        list.push({
          key: inCh.key,
          type: inCh.type || "string",
          isInputChannel: true,
          required: inCh.required,
          description: inCh.description,
          stateChannelKey: inCh.stateChannelKey,
        });
        seen.add(inCh.key);
        if (inCh.stateChannelKey) {
          for (const sk of inCh.stateChannelKey.split(",")) {
            seen.add(sk.trim());
          }
        }
      }
    }

    for (const stCh of stateChannels) {
      if (
        stCh.key &&
        !isDedicatedChannel(stCh.key, undefined, hasDedicatedMessages) &&
        !seen.has(stCh.key)
      ) {
        list.push({
          key: stCh.key,
          type: stCh.type || "unknown",
          isInputChannel: false,
        });
        seen.add(stCh.key);
      }
    }

    if (list.length === 0 && !hasDedicatedMessages) {
      list.push({
        key: "messages",
        type: "BaseMessage[]",
        isInputChannel: false,
      });
    }

    return list;
  }, [inputChannels, stateChannels, hasDedicatedMessages]);

  const rawMemoryConfig = selectedAgentNode?.data?.memoryConfig;
  const memoryConfig = rawMemoryConfig ?? {
    checkpointer: "memory",
    enabled: true,
  };
  const hasMemory = useMemo(() => {
    if (rawMemoryConfig && rawMemoryConfig.enabled === false) return false;
    return Boolean(memoryConfig.checkpointer);
  }, [rawMemoryConfig, memoryConfig]);

  const checkpointerTablesStatus = useMemo(() => {
    if (!selectedAgentNode || !hasMemory) return null;
    const mem = selectedAgentNode.data?.memoryConfig;
    const checkpointerType = mem?.checkpointer || "memory";
    if (checkpointerType === "memory") return null;
    return checkCheckpointerTablesStatus(
      allNodes,
      allEdges,
      mem?.enabled !== false,
      checkpointerType,
      mem?.checkpointerNodeId,
    );
  }, [selectedAgentNode, hasMemory, allNodes, allEdges]);

  const checkpointerWarning = useMemo(() => {
    if (!checkpointerTablesStatus) return null;
    if (checkpointerTablesStatus.isMissingStorage) {
      const type =
        selectedAgentNode?.data?.memoryConfig?.checkpointer === "postgres"
          ? "PostgreSQL database"
          : "Redis instance";
      return `No connected ${type} found in SchemaView. Please create a database/Redis node in SchemaView to store conversation checkpoints.`;
    }
    if (!checkpointerTablesStatus.areTablesCreated) {
      return `${checkpointerTablesStatus.missingCount} checkpointer ${
        checkpointerTablesStatus.missingCount === 1 ? "table is" : "tables are"
      } missing in SchemaView. Configure them in LangGraph Studio to enable persistence.`;
    }
    return null;
  }, [checkpointerTablesStatus, selectedAgentNode]);

  // Check if the endpoint request contract already declares a thread_id field
  const endpointHasThreadId = useMemo(() => {
    if (!endpoint) return true;

    // If the user has already explicitly mapped thread_id to any contract field
    // (regardless of its name, e.g. path param "id"), suppress the warning —
    // there is nothing actionable to add.
    if (step.langGraphThreadIdSource) {
      const src = accessorToStepSource(step.langGraphThreadIdSource, availableSources);
      if (src.kind === "req_params" && src.field) {
        const exists = (endpoint.pathParams || []).some((p: Parameter) => p.name === src.field);
        if (exists) return true;
      }
      if (src.kind === "req_body" && src.field) {
        const exists = (endpoint.requestBody?.fields || []).some(
          (f: Parameter) => f.name === src.field,
        );
        if (exists) return true;
      }
      if (src.kind === "req_query" && src.field) {
        const exists = (endpoint.queryParams || []).some(
          (q: Parameter) => q.name === src.field,
        );
        if (exists) return true;
      }
      if (src.kind === "req_headers" && src.field) {
        const exists = (endpoint.headers || []).some(
          (h: Parameter) => h.name === src.field,
        );
        if (exists) return true;
      }
    }

    // Fallback: check for canonical thread_id field names across all contract sections
    const bodyFields = endpoint.requestBody?.fields || [];
    const hasInBody = bodyFields.some(
      (f: Parameter) =>
        f.name?.toLowerCase() === "thread_id" ||
        f.name?.toLowerCase() === "threadid" ||
        f.name?.toLowerCase() === "sessionid" ||
        f.name?.toLowerCase() === "session_id",
    );
    if (hasInBody) return true;
    const headers = endpoint.headers || [];
    const hasInHeaders = headers.some(
      (h: Parameter) =>
        h.name?.toLowerCase() === "x-thread-id" ||
        h.name?.toLowerCase() === "thread_id",
    );
    if (hasInHeaders) return true;
    const queryParams = endpoint.queryParams || [];
    const hasInQuery = queryParams.some(
      (q: Parameter) =>
        q.name?.toLowerCase() === "thread_id" ||
        q.name?.toLowerCase() === "threadid",
    );
    if (hasInQuery) return true;
    const pathParams = endpoint.pathParams || [];
    const hasInPath = pathParams.some(
      (p: Parameter) =>
        p.name?.toLowerCase() === "thread_id" ||
        p.name?.toLowerCase() === "threadid",
    );
    return hasInPath;
  }, [endpoint, step.langGraphThreadIdSource, availableSources]);

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
    const nextBindings: StepBinding[] =
      fieldKey === "langGraphThreadIdSource"
        ? otherBindings.filter((b) => b.argName !== "thread_id" && b.argName !== "threadId")
        : [...otherBindings, { argName, source: updated.source }];
    const accessor = stepSourceToAccessor(updated.source, availableSources);
    onChange({
      ...step,
      inputBindings: nextBindings,
      [fieldKey]: accessor,
    });
    syncAgentInputChannels(
      nextBindings,
      mapping,
      fieldKey === "langGraphThreadIdSource" ? accessor : undefined,
    );
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
    const nextBindings = currentBindings.filter(
      (b) =>
        b.argName !== argName &&
        (fieldKey !== "langGraphThreadIdSource" ||
          (b.argName !== "thread_id" && b.argName !== "threadId")),
    );
    const nextStep = { ...step, inputBindings: nextBindings };
    delete nextStep[fieldKey];
    onChange(nextStep);
    syncAgentInputChannels(
      nextBindings,
      mapping,
      fieldKey === "langGraphThreadIdSource" ? undefined : step.langGraphThreadIdSource,
    );
  };

  const handleAddThreadIdToRequestBody = () => {
    if (!endpoint || !onEndpointChange) return;
    const currentFields = endpoint.requestBody?.fields || [];
    const newField: Parameter = {
      id: `param_thread_id_${Date.now()}`,
      name: "thread_id",
      key: "thread_id",
      type: "string",
      required: false,
      description: "Conversation session thread ID for LangGraph checkpointer memory",
      defaultValue: "",
      value: "",
    };
    onEndpointChange({
      requestBody: {
        ...(endpoint.requestBody || { id: `req_${endpoint.id}` }),
        fields: [...currentFields, newField],
      },
    });
    handleArgBindingChange(
      "thread_id",
      {
        argName: "thread_id",
        source: { kind: "req_body", field: "thread_id" },
      },
      "langGraphThreadIdSource",
    );
  };

  const handleUseHeaderThreadId = () => {
    if (endpoint && onEndpointChange) {
      const currentHeaders = endpoint.headers || [];
      if (!currentHeaders.some((h: Parameter) => h.name?.toLowerCase() === "x-thread-id")) {
        const newHeader: Parameter = {
          id: `hdr_thread_id_${Date.now()}`,
          name: "x-thread-id",
          key: "x-thread-id",
          type: "string",
          required: false,
          description: "Session thread ID header",
          defaultValue: "",
          value: "",
        };
        onEndpointChange({
          headers: [...currentHeaders, newHeader],
        });
      }
    }
    handleArgBindingChange(
      "thread_id",
      {
        argName: "thread_id",
        source: { kind: "req_headers", field: "x-thread-id" },
      },
      "langGraphThreadIdSource",
    );
  };

  const mapping: Record<string, string> = useMemo(() => {
    return step.langGraphStateMapping || {};
  }, [step.langGraphStateMapping]);

  const isChannelMapped = (chOrKey: { key: string; stateChannelKey?: string } | string) => {
    const key = typeof chOrKey === "string" ? chOrKey : chOrKey.key;
    const stateKey = typeof chOrKey === "object" ? chOrKey.stateChannelKey : undefined;

    const keysToCheck = [key];
    if (stateKey) {
      for (const sk of stateKey.split(",")) {
        keysToCheck.push(sk.trim());
      }
    }

    return keysToCheck.some((k) => {
      const hasInMapping = k in mapping && mapping[k] !== undefined && mapping[k] !== "";
      const hasInBindings = (step.inputBindings || []).some((b) => b.argName === k);
      return hasInMapping || hasInBindings;
    });
  };

  const mappedDeclaredChannels = useMemo(() => {
    return declaredChannels.filter((ch) => isChannelMapped(ch));
  }, [declaredChannels, mapping, step.inputBindings, step.langGraphMessagesConfig]);

  const customKeys = useMemo(() => {
    const keysFromMapping = Object.keys(mapping).filter((k) => Boolean(mapping[k]));
    const keysFromBindings = (step.inputBindings || []).map((b) => b.argName).filter(Boolean);
    const allKeys = Array.from(new Set([...keysFromMapping, ...keysFromBindings]));
    return allKeys.filter(
      (k) =>
        !isDedicatedChannel(k, undefined, hasDedicatedMessages) &&
        !declaredChannels.some((ch) => ch.key === k || ch.stateChannelKey === k),
    );
  }, [mapping, step.inputBindings, declaredChannels, hasDedicatedMessages]);

  const unmappedDeclaredChannels = useMemo(() => {
    return declaredChannels.filter(
      (ch) =>
        ch.key.toLowerCase() !== "messages" &&
        (!ch.stateChannelKey ||
          !ch.stateChannelKey
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .includes("messages")) &&
        !isChannelMapped(ch),
    );
  }, [declaredChannels, mapping, step.inputBindings, step.langGraphMessagesConfig]);

  const isStreaming = step.langGraphStreamingEnabled ?? false;
  const streamingProtocol = step.langGraphStreamingProtocol || "sse";
  const outputMode = step.langGraphOutputMode || "full_state";
  const streamingFields = step.langGraphStreamingFields || [];
  const outputFields = step.langGraphOutputFields || [];

  const handleSelectAgent = (nodeId: string) => {
    onChange({
      ...step,
      langGraphTargetNodeId: nodeId,
    });
  };

  const getBindingForChannel = (
    chOrKey: { key: string; stateChannelKey?: string } | string,
  ): StepBinding => {
    const channelKey = typeof chOrKey === "string" ? chOrKey : chOrKey.key;
    const stateKey = typeof chOrKey === "object" ? chOrKey.stateChannelKey : undefined;

    const existing = (step.inputBindings || []).find(
      (b) =>
        b.argName === channelKey ||
        (stateKey && b.argName === stateKey),
    );
    if (existing) return existing;

    const rawMapping =
      mapping[channelKey] ||
      (stateKey ? mapping[stateKey] : undefined);

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

  const syncAgentInputChannels = useCallback(
    (
      bindings: StepBinding[],
      mappingRecord: Record<string, string>,
      threadIdSource?: string,
    ) => {
      if (!selectedAgentNode) return;
      const store = useBackendCanvasStore.getState();
      const currentChannels: LangGraphInputChannel[] =
        selectedAgentNode.data?.inputChannels &&
        Array.isArray(selectedAgentNode.data.inputChannels)
          ? [...selectedAgentNode.data.inputChannels]
          : [];

      const customChannels = currentChannels.filter((c) => c.source === "custom");
      const newRequestChannels: LangGraphInputChannel[] = [];
      const seen = new Set<string>();

      const resolveFieldType = (fieldName: string): LangGraphInputChannel["type"] => {
        const epField = endpoint?.requestBody?.fields?.find((f) => f.name === fieldName);
        if (epField?.type === "number") return "number";
        if (epField?.type === "boolean") return "boolean";
        if (epField?.type === "object") return "object";
        if (epField?.type === "array") return "array";
        return "string";
      };

      for (const b of bindings) {
        if (!b.argName) continue;
        // thread_id is configurable.thread_id (checkpointer config), NOT a state channel — skip it
        if (b.argName === "thread_id" || b.argName === "threadId") continue;

        let fieldKey = "";
        if ("field" in b.source && b.source.field) {
          fieldKey = b.source.field;
        } else {
          fieldKey = b.argName;
        }

        if (!fieldKey) continue;

        const existing = newRequestChannels.find((c) => c.key === fieldKey);
        if (existing) {
          const currentMapped = existing.stateChannelKey
            ? existing.stateChannelKey.split(",").map((s) => s.trim())
            : [];
          if (!currentMapped.includes(b.argName)) {
            currentMapped.push(b.argName);
            existing.stateChannelKey = currentMapped.join(",");
          }
        } else {
          newRequestChannels.push({
            id: `input_${fieldKey}_${Date.now()}`,
            key: fieldKey,
            type: resolveFieldType(fieldKey),
            source: "request",
            required: true,
            stateChannelKey: b.argName,
          });
          seen.add(fieldKey);
        }
      }

      const updatedChannels = [...newRequestChannels, ...customChannels];

      store.updateNode(selectedAgentNode.id, {
        data: {
          ...selectedAgentNode.data,
          inputChannels: updatedChannels,
        },
      });
    },
    [selectedAgentNode, endpoint],
  );

  useEffect(() => {
    if (
      selectedAgentNode &&
      (!selectedAgentNode.data?.inputChannels || selectedAgentNode.data.inputChannels.length === 0) &&
      ((step.inputBindings && step.inputBindings.length > 0) ||
        (step.langGraphStateMapping && Object.keys(step.langGraphStateMapping).length > 0))
    ) {
      syncAgentInputChannels(step.inputBindings || [], mapping, step.langGraphThreadIdSource);
    }
  }, [selectedAgentNode?.id]);

  // Self-healing sanitizer: thread_id is configurable.thread_id (checkpointer config)
  // belonging strictly to the dedicated Session Thread ID section (langGraphThreadIdSource).
  // It must NEVER be treated as a state channel payload or stored in langGraphStateMapping/inputBindings.
  // If legacy data contains thread_id/threadId in mapping or bindings, sanitize it on mount/load
  // and migrate the source to langGraphThreadIdSource if not already configured.
  useEffect(() => {
    const rawMapping = step.langGraphStateMapping;
    const hasThreadInMapping =
      rawMapping && (Boolean(rawMapping.thread_id) || Boolean(rawMapping.threadId));
    const currentBindings = step.inputBindings || [];
    const threadBinding = currentBindings.find(
      (b) => b.argName === "thread_id" || b.argName === "threadId",
    );

    if (hasThreadInMapping || threadBinding) {
      const nextMapping = rawMapping ? { ...rawMapping } : {};
      const legacyAccessor = nextMapping.thread_id || nextMapping.threadId;
      delete nextMapping.thread_id;
      delete nextMapping.threadId;

      const nextBindings = currentBindings.filter(
        (b) => b.argName !== "thread_id" && b.argName !== "threadId",
      );

      let nextThreadIdSource = step.langGraphThreadIdSource;
      if (!nextThreadIdSource) {
        if (threadBinding && threadBinding.source) {
          nextThreadIdSource = stepSourceToAccessor(threadBinding.source, availableSources);
        } else if (legacyAccessor) {
          nextThreadIdSource = legacyAccessor;
        }
      }

      onChange({
        ...step,
        inputBindings: nextBindings,
        langGraphStateMapping: nextMapping,
        ...(nextThreadIdSource ? { langGraphThreadIdSource: nextThreadIdSource } : {}),
      });
      syncAgentInputChannels(nextBindings, nextMapping, nextThreadIdSource);
    }
  }, [step.id, step.langGraphStateMapping, step.inputBindings, step.langGraphThreadIdSource]);

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
    syncAgentInputChannels(nextBindings, nextMapping);
  };

  const getArgBinding = (
    argName: string,
    fieldValue: string | undefined,
    fallbackAccessor: string,
  ): StepBinding => {
    if (argName !== "thread_id" && argName !== "threadId") {
      const existing = (step.inputBindings || []).find((b) => b.argName === argName);
      if (existing) return existing;
    }
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

  const handleRemoveMapping = (stateKey: string) => {
    const nextMapping = { ...mapping };
    const keysToDelete = new Set<string>([stateKey]);
    if (stateKey === "message") keysToDelete.add("messages");
    if (stateKey === "messages") keysToDelete.add("message");

    const matchedDeclared = declaredChannels.find(
      (ch) => ch.key === stateKey || ch.stateChannelKey === stateKey,
    );
    if (matchedDeclared) {
      keysToDelete.add(matchedDeclared.key);
      if (matchedDeclared.stateChannelKey) {
        for (const sk of matchedDeclared.stateChannelKey.split(",")) {
          keysToDelete.add(sk.trim());
        }
      }
    }

    for (const k of keysToDelete) {
      delete nextMapping[k];
    }

    const currentBindings = step.inputBindings || [];
    const existingKeys = new Set(currentBindings.map((b) => b.argName));
    const backfilledBindings: StepBinding[] = [...currentBindings];

    for (const [k, rawMap] of Object.entries(nextMapping)) {
      if (!existingKeys.has(k) && !keysToDelete.has(k)) {
        backfilledBindings.push({
          argName: k,
          source: accessorToStepSource(rawMap, availableSources),
        });
      }
    }

    const nextBindings = backfilledBindings.filter((b) => !keysToDelete.has(b.argName));

    if (
      selectedAgentNode?.data?.inputChannels &&
      Array.isArray(selectedAgentNode.data.inputChannels)
    ) {
      const store = useBackendCanvasStore.getState();
      const updatedChannels = selectedAgentNode.data.inputChannels.filter(
        (c) =>
          !keysToDelete.has(c.key) &&
          (!c.stateChannelKey ||
            !c.stateChannelKey.split(",").some((sk) => keysToDelete.has(sk.trim()))),
      );
      if (updatedChannels.length !== selectedAgentNode.data.inputChannels.length) {
        store.updateNode(selectedAgentNode.id, {
          data: {
            ...selectedAgentNode.data,
            inputChannels: updatedChannels,
          },
        });
      }
    }

    onChange({
      ...step,
      inputBindings: nextBindings,
      langGraphStateMapping: nextMapping,
    });
    syncAgentInputChannels(nextBindings, nextMapping);
  };

  // ─── Messages Config State & Handlers ─────────────────────────────────────────
  const effectiveMessagesMode: "single" | "bulk" = step.langGraphMessagesConfig?.mode || "single";

  const userMessageBinding = useMemo<StepBinding>(() => {
    const srcStr =
      step.langGraphMessagesConfig?.userMessageSource ||
      (mapping.messages && !mapping.messages.includes(".messages") ? mapping.messages : "body.message");
    return {
      argName: "user_message",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, mapping.messages, availableSources]);

  const hasSystemPrompt = useMemo(() => {
    return (
      typeof step.langGraphMessagesConfig?.systemMessageSource === "string" &&
      step.langGraphMessagesConfig.systemMessageSource.trim().length > 0
    );
  }, [step.langGraphMessagesConfig]);

  const hasAiMessage = useMemo(() => {
    return (
      typeof step.langGraphMessagesConfig?.aiMessageSource === "string" &&
      step.langGraphMessagesConfig.aiMessageSource.trim().length > 0
    );
  }, [step.langGraphMessagesConfig]);

  const systemMessageBinding = useMemo<StepBinding>(() => {
    const srcStr = step.langGraphMessagesConfig?.systemMessageSource || "";
    return {
      argName: "system_prompt",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, availableSources]);

  const aiMessageBinding = useMemo<StepBinding>(() => {
    const srcStr = step.langGraphMessagesConfig?.aiMessageSource || "";
    return {
      argName: "ai_message",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, availableSources]);

  const bulkMessagesBinding = useMemo<StepBinding>(() => {
    const srcStr =
      step.langGraphMessagesConfig?.bulkMessagesSource ||
      (mapping.messages && mapping.messages.includes(".messages") ? mapping.messages : "body.messages");
    return {
      argName: "messages",
      source: accessorToStepSource(srcStr, availableSources),
    };
  }, [step.langGraphMessagesConfig, mapping.messages, availableSources]);

  const handleMessagesModeChange = (mode: "single" | "bulk") => {
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode,
      userMessageSource: currentCfg.userMessageSource || mapping.messages || "body.message",
      bulkMessagesSource: currentCfg.bulkMessagesSource || "body.messages",
    };
    const nextMapping = { ...mapping };
    nextMapping.messages =
      mode === "bulk"
        ? nextCfg.bulkMessagesSource || "body.messages"
        : nextCfg.userMessageSource || "body.message";

    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
      langGraphStateMapping: nextMapping,
    });
  };

  const handleUserMessageBindingChange = (updated: StepBinding) => {
    const accessor = stepSourceToAccessor(updated.source, availableSources);
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      userMessageSource: accessor,
    };
    const nextMapping = { ...mapping, messages: accessor };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
      langGraphStateMapping: nextMapping,
    });
  };

  const handleSystemMessageBindingChange = (updated: StepBinding) => {
    const accessor = stepSourceToAccessor(updated.source, availableSources);
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      systemMessageSource: accessor,
    };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  };

  const handleAddSystemPrompt = () => {
    const currentCfg = step.langGraphMessagesConfig || {};
    let defaultSource = "body.systemPrompt";
    for (const src of availableSources) {
      if (src.kind === "req_body") {
        const p = src.paths.find((item) =>
          /system|instruction|prompt/i.test(item.path) && !/message|chat/i.test(item.path),
        );
        if (p) {
          defaultSource = `body.${p.path}`;
          break;
        }
      }
    }
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      systemMessageSource: defaultSource,
    };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  };

  const handleRemoveSystemPrompt = () => {
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = { ...currentCfg };
    delete nextCfg.systemMessageSource;
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  };

  const handleAddAiMessage = () => {
    const currentCfg = step.langGraphMessagesConfig || {};
    let defaultSource = "body.aiMessage";
    for (const src of availableSources) {
      if (src.kind === "req_body") {
        const p = src.paths.find((item) =>
          /ai|assistant|context/i.test(item.path) && !/system|user/i.test(item.path),
        );
        if (p) {
          defaultSource = `body.${p.path}`;
          break;
        }
      }
    }
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      aiMessageSource: defaultSource,
    };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  };

  const handleRemoveAiMessage = () => {
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = { ...currentCfg };
    delete nextCfg.aiMessageSource;
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  };

  const handleAiMessageBindingChange = (updated: StepBinding) => {
    const accessor = stepSourceToAccessor(updated.source, availableSources);
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: currentCfg.mode || "single",
      aiMessageSource: accessor,
    };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
    });
  };

  const handleBulkMessagesBindingChange = (updated: StepBinding) => {
    const accessor = stepSourceToAccessor(updated.source, availableSources);
    const currentCfg = step.langGraphMessagesConfig || {};
    const nextCfg: LangGraphMessagesConfig = {
      ...currentCfg,
      mode: "bulk",
      bulkMessagesSource: accessor,
    };
    const nextMapping = { ...mapping, messages: accessor };
    onChange({
      ...step,
      langGraphMessagesConfig: nextCfg,
      langGraphStateMapping: nextMapping,
    });
  };

  const handleAddChannel = (channelKey: string) => {
    if (channelKey === "thread_id" || channelKey === "threadId") return;
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
          src.kind === "auth" ||
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
    syncAgentInputChannels(nextBindings, nextMapping);
  };

  const handleAutoMap = () => {
    const newMapping: Record<string, string> = { ...mapping };
    delete newMapping.thread_id;
    delete newMapping.threadId;
    const newBindings: StepBinding[] = (step.inputBindings || []).filter(
      (b) => b.argName !== "thread_id" && b.argName !== "threadId",
    );

    // Auto-map conversation messages channel if present on agent
    if (
      stateChannels.some((c) => c.key === "messages") ||
      inputChannels.some((c) => c.key === "messages")
    ) {
      newMapping.messages = "body.message";
      if (!newBindings.some((b) => b.argName === "messages")) {
        newBindings.push({
          argName: "messages",
          source: { kind: "req_body", field: "message" },
        });
      }
    }

    declaredChannels.forEach((ch) => {
      let matchedSource: StepSource | null = null;
      const keyLower = ch.key.toLowerCase();

      // Look for match in availableSources
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
            src.kind === "auth" ||
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
            src.kind === "auth" ||
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
    syncAgentInputChannels(newBindings, newMapping, nextThreadIdSource);
  };

  const handleAddCustomField = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim();
    if (key === "thread_id" || key === "threadId") {
      const accessor = stepSourceToAccessor(newCustomBinding.source, availableSources);
      onChange({
        ...step,
        langGraphThreadIdSource: accessor || "body.thread_id",
      });
      setNewKey("");
      return;
    }
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
    syncAgentInputChannels(nextBindings, nextMapping);
    setNewKey("");
    setNewCustomBinding({
      argName: "",
      source: { kind: "req_body", field: "" },
    });
  };

  const handleToggleStreaming = (enabled: boolean) => {
    let nextStep: PipelineStepDraft = {
      ...step,
      langGraphStreamingEnabled: enabled,
      langGraphStreamingProtocol: enabled ? streamingProtocol : undefined,
    };
    const proto = nextStep.langGraphStreamingProtocol || streamingProtocol || "sse";
    if (enabled && serviceNodeId && proto === "websocket") {
      ensureWsPackageInService({ serviceNodeId });
    }
    if (enabled && serviceNodeId && (proto === "sse" || proto === "websocket")) {
      const targetPageId = nextStep.clientDeliveryTargetPageId || defaultTargetPage?.id;
      if (targetPageId) {
        const conn = ensurePageRefConnection({
          targetPageId,
          pageRefNodeId: nextStep.clientDeliveryPageRefNodeId,
          serviceNodeId,
          endpointId: endpoint?.id,
          stepId: step.id,
        });
        if (conn?.pageRefNodeId) {
          nextStep = {
            ...nextStep,
            clientDeliveryTargetPageId: conn.targetPageId || targetPageId,
            clientDeliveryPageRefNodeId: conn.pageRefNodeId,
          };
        }
      }
    }
    onChange(nextStep);
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
      <AgentSelectorSection
        availableAgents={availableAgents}
        selectedAgentNode={selectedAgentNode}
        inputChannels={inputChannels}
        stateChannels={stateChannels}
        projectId={projectId}
        onSelectAgent={handleSelectAgent}
        onOpenStudio={() => {
          if (selectedAgentNode) {
            syncAgentInputChannels(
              step.inputBindings || [],
              mapping,
              step.langGraphThreadIdSource,
            );
            window.open(`/project/${projectId}/langgraph/${selectedAgentNode.id}`, "_blank");
          }
        }}
      />

      {/* Memory Checkpointer Thread ID Section */}
      <SessionThreadIdSection
        hasMemory={hasMemory}
        selectedAgentNode={selectedAgentNode}
        checkpointerWarning={checkpointerWarning}
        threadIdSource={step.langGraphThreadIdSource}
        threadBinding={getArgBinding("thread_id", step.langGraphThreadIdSource, "body.thread_id")}
        availableSources={availableSources}
        serviceNodeId={serviceNodeId}
        endpointHasThreadId={endpointHasThreadId}
        canEditEndpoint={Boolean(onEndpointChange)}
        projectId={projectId}
        onThreadBindingChange={(updated) =>
          handleArgBindingChange("thread_id", updated, "langGraphThreadIdSource")
        }
        onAddThreadIdToRequestBody={handleAddThreadIdToRequestBody}
        onUseHeaderThreadId={handleUseHeaderThreadId}
      />

      {/* Dedicated Conversation & Messages Input Section */}
      <ConversationMessagesSection
        effectiveMessagesMode={effectiveMessagesMode}
        userMessageBinding={userMessageBinding}
        systemMessageBinding={systemMessageBinding}
        aiMessageBinding={aiMessageBinding}
        bulkMessagesBinding={bulkMessagesBinding}
        hasSystemPrompt={hasSystemPrompt}
        hasAiMessage={hasAiMessage}
        availableSources={availableSources}
        serviceNodeId={serviceNodeId}
        onMessagesModeChange={handleMessagesModeChange}
        onUserMessageBindingChange={handleUserMessageBindingChange}
        onSystemMessageBindingChange={handleSystemMessageBindingChange}
        onAiMessageBindingChange={handleAiMessageBindingChange}
        onBulkMessagesBindingChange={handleBulkMessagesBindingChange}
        onAddSystemPrompt={handleAddSystemPrompt}
        onRemoveSystemPrompt={handleRemoveSystemPrompt}
        onAddAiMessage={handleAddAiMessage}
        onRemoveAiMessage={handleRemoveAiMessage}
      />

      {/* State Channels Mapping */}
      <StateChannelPayloadSection
        mappedDeclaredChannels={mappedDeclaredChannels}
        customKeys={customKeys}
        unmappedDeclaredChannels={unmappedDeclaredChannels}
        hasMemory={hasMemory}
        availableSources={availableSources}
        serviceNodeId={serviceNodeId}
        getBindingForChannel={getBindingForChannel}
        onBindingChange={handleBindingChange}
        onRemoveMapping={handleRemoveMapping}
        onAutoMap={handleAutoMap}
        onAddChannel={handleAddChannel}
        newKey={newKey}
        onNewKeyChange={setNewKey}
        newCustomBinding={newCustomBinding}
        onNewCustomBindingChange={setNewCustomBinding}
        onAddCustomField={handleAddCustomField}
      />

      {/* Streaming & Output Delivery Section */}
      <StreamingAndOutputSection
        isStreaming={isStreaming}
        streamingProtocol={streamingProtocol}
        outputMode={outputMode}
        streamingFields={streamingFields}
        outputFields={outputFields}
        stateChannels={stateChannels}
        kafkaBrokerNodes={kafkaBrokerNodes}
        selectedKafkaBrokerNode={selectedKafkaBrokerNode}
        availableKafkaTopics={availableKafkaTopics}
        kafkaTopic={step.langGraphStreamingKafkaTopic}
        kafkaKeyBinding={getArgBinding(
          "partition_key",
          step.langGraphStreamingKafkaKey,
          step.langGraphThreadIdSource || "body.thread_id",
        )}
        hasCustomKafkaKey={Boolean(
          step.langGraphStreamingKafkaKey ||
            (step.inputBindings || []).some((b) => b.argName === "partition_key"),
        )}
        redisNodes={redisNodes}
        selectedRedisNode={selectedRedisNode}
        availableRedisStreams={availableRedisStreams}
        redisStreamKey={step.langGraphStreamingRedisKey}
        redisStreamKeyBinding={getArgBinding(
          "stream_key",
          step.langGraphStreamingRedisKey,
          step.langGraphThreadIdSource
            ? `stream:agent:\${${step.langGraphThreadIdSource}}`
            : "stream:agent:default",
        )}
        hasCustomRedisStreamKey={Boolean(
          step.langGraphStreamingRedisKey ||
            (step.inputBindings || []).some((b) => b.argName === "stream_key"),
        )}
        roomBinding={getArgBinding(
          "room_id",
          step.langGraphStreamingRoom,
          step.langGraphThreadIdSource || "body.thread_id",
        )}
        hasCustomRoom={Boolean(
          step.langGraphStreamingRoom ||
            (step.inputBindings || []).some((b) => b.argName === "room_id"),
        )}
        threadIdSource={step.langGraphThreadIdSource}
        availableSources={availableSources}
        serviceNodeId={serviceNodeId}
        streamModes={
          step.langGraphStreamModes && step.langGraphStreamModes.length > 0
            ? step.langGraphStreamModes
            : ["messages"]
        }
        includeReasoning={step.langGraphStreamIncludeReasoning !== false}
        includeSubgraphs={Boolean(step.langGraphStreamSubgraphs)}
        ssePageRefNode={ssePageRefNode}
        allWebPages={allWebPages}
        invokingPage={invokingPage}
        selectedTargetPageId={selectedTargetPageId}
        connectedPageRefNode={connectedPageRefNode}
        onTargetPageChange={(newPageId) => handleConnectPushToClientNode(newPageId)}
        onConnectPushToClient={() => handleConnectPushToClientNode()}
        onToggleStreaming={handleToggleStreaming}
        onProtocolChange={(proto) => {
          onChange({
            ...step,
            langGraphStreamingProtocol: proto,
          });
          if (proto === "websocket" && serviceNodeId) {
            ensureWsPackageInService({ serviceNodeId });
          }
        }}
        onToggleStreamMode={(mode) => {
          const current: LangGraphStreamMode[] =
            step.langGraphStreamModes && step.langGraphStreamModes.length > 0
              ? [...step.langGraphStreamModes]
              : ["messages"];
          const exists = current.includes(mode);
          let next: LangGraphStreamMode[];
          if (exists) {
            next = current.filter((m) => m !== mode);
            if (next.length === 0) next = ["messages"];
          } else {
            next = [...current, mode];
          }
          onChange({
            ...step,
            langGraphStreamModes: next,
          });
        }}
        onToggleIncludeReasoning={(enabled) =>
          onChange({
            ...step,
            langGraphStreamIncludeReasoning: enabled,
          })
        }
        onToggleIncludeSubgraphs={(enabled) =>
          onChange({
            ...step,
            langGraphStreamSubgraphs: enabled,
          })
        }
        onKafkaBrokerChange={(brokerId, firstTopic) => {
          onChange({
            ...step,
            langGraphStreamingKafkaNodeId: brokerId,
            langGraphStreamingKafkaTopic: firstTopic || step.langGraphStreamingKafkaTopic || "",
          });
        }}
        onKafkaTopicChange={(topic) =>
          onChange({
            ...step,
            langGraphStreamingKafkaTopic: topic,
          })
        }
        onRedisNodeChange={(redisId, firstStream) => {
          onChange({
            ...step,
            langGraphStreamingRedisNodeId: redisId,
            langGraphStreamingRedisKey: firstStream || step.langGraphStreamingRedisKey || "",
          });
        }}
        onRedisKeyChange={(key) =>
          onChange({
            ...step,
            langGraphStreamingRedisKey: key,
          })
        }
        onOutputModeChange={(mode) =>
          onChange({
            ...step,
            langGraphOutputMode: mode,
          })
        }
        onToggleStreamingField={handleToggleStreamingField}
        onToggleOutputField={handleToggleOutputField}
        onRoomBindingChange={(updated) =>
          handleArgBindingChange("room_id", updated, "langGraphStreamingRoom")
        }
        onResetRoomBinding={() => handleResetArgBinding("room_id", "langGraphStreamingRoom")}
        onKafkaKeyBindingChange={(updated) =>
          handleArgBindingChange("partition_key", updated, "langGraphStreamingKafkaKey")
        }
        onResetKafkaKeyBinding={() =>
          handleResetArgBinding("partition_key", "langGraphStreamingKafkaKey")
        }
        onRedisKeyBindingChange={(updated) =>
          handleArgBindingChange("stream_key", updated, "langGraphStreamingRedisKey")
        }
        onResetRedisKeyBinding={() =>
          handleResetArgBinding("stream_key", "langGraphStreamingRedisKey")
        }
      />

      {children}
    </div>
  );
};
