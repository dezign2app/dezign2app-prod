import { useState, useEffect } from "react";
import { useReactFlow, NodeProps, type Edge } from "@xyflow/react";
import type {
  CanvasNode,
  LangGraphCanvasNodeUnion,
  LangGraphAgentStreamConfig,
  LangGraphAgentResponseFormatConfig,
  UseLangGraphCanvasNodeReturn,
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  LangGraphStateReducerRefNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_LLM_REF,
  LANGGRAPH_CANVAS_NODE_STATE_REDUCER_REF,
  HANDLE_LLM_IN,
  HANDLE_LLM_OUT,
  HANDLE_TOOL_IN,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_STATE_IN,
  HANDLE_STATE_OUT,
  DEFAULT_STREAM_ENVELOPE,
  DEFAULT_STREAM_TRANSFORMER_MODE,
  DEFAULT_SELECTED_STREAM_EVENTS,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_API_KEY_ENV,
  LLM_PROVIDER_PRESETS,
  LLM_PROVIDERS,
} from "../../constants";

function isStateReducerRefNode(
  node: LangGraphCanvasNodeUnion | undefined,
): node is LangGraphStateReducerRefNode {
  return node?.type === LANGGRAPH_CANVAS_NODE_STATE_REDUCER_REF;
}

export function useLangGraphCanvasNode({
  id,
  data,
}: NodeProps<CanvasNode>): UseLangGraphCanvasNodeReturn {
  const { setNodes, getNodes, getEdges, setEdges } = useReactFlow<LangGraphCanvasNodeUnion>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(data.name || "Node");
  const [isExpanded, setIsExpanded] = useState(data.isExpanded ?? false);

  useEffect(() => {
    setNameValue(data.name || "Node");
  }, [data.name]);

  useEffect(() => {
    if (data.isExpanded !== undefined) {
      setIsExpanded(data.isExpanded);
    }
  }, [data.isExpanded]);

  const updateAgentData = (changes: Partial<typeof data>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id &&
        (n.type === LANGGRAPH_CANVAS_NODE_NODE ||
          n.type === LANGGRAPH_CANVAS_NODE_AGENT)
          ? { ...n, data: { ...n.data, ...changes } }
          : n,
      ),
    );
  };

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    updateAgentData({ isExpanded: next });
  };

  const handleDelete = () => {
    if (data.onDeleteAgent) {
      data.onDeleteAgent();
    } else {
      setNodes((nds) => nds.filter((n) => n.id !== id));
    }
  };

  const edges = getEdges();

  const boundLLMs = edges.filter(
    (e) => e.target === id && e.targetHandle === HANDLE_LLM_IN,
  );
  const boundTools = edges.filter(
    (e) => e.target === id && e.targetHandle === HANDLE_TOOL_IN,
  );
  const boundMiddlewares = edges.filter(
    (e) => e.target === id && e.targetHandle === HANDLE_MIDDLEWARE_IN,
  );
  const boundStateReducers = edges.filter(
    (e) =>
      e.target === id &&
      (e.targetHandle === HANDLE_STATE_IN || e.sourceHandle === HANDLE_STATE_OUT),
  );

  const isLlmEnabled =
    data.llmConfig?.enabled !== undefined
      ? Boolean(data.llmConfig.enabled)
      : boundLLMs.length > 0
        ? true
        : false;

  const llmConfig = {
    enabled: isLlmEnabled,
    provider:
      data.llmConfig?.provider ||
      data.modelConfig?.provider ||
      DEFAULT_LLM_PROVIDER,
    model:
      data.llmConfig?.model || data.modelConfig?.model || DEFAULT_LLM_MODEL,
    temperature:
      data.llmConfig?.temperature ??
      data.modelConfig?.temperature ??
      DEFAULT_LLM_TEMPERATURE,
  };

  const streamConfig: LangGraphAgentStreamConfig = data.streamConfig || {
    enabled: false,
    version: "v3",
    selectedEvents: DEFAULT_SELECTED_STREAM_EVENTS,
    envelope: DEFAULT_STREAM_ENVELOPE,
    transformer: {
      mode: DEFAULT_STREAM_TRANSFORMER_MODE,
    },
  };

  const responseFormat: LangGraphAgentResponseFormatConfig =
    data.responseFormat || {
      enabled: false,
      strategy: "auto",
      schemaType: "json_schema",
      schemaJson: "",
      handleErrorMode: "default",
    };

  const allNodes = getNodes();
  const connectedStateUpdates = boundStateReducers.map((edge) => {
    const srcNode = allNodes.find((n) => n.id === edge.source);
    if (isStateReducerRefNode(srcNode)) {
      return {
        channelKey: srcNode.data.targetChannelKey || "messages",
        mode: srcNode.data.mode || "append",
        value: srcNode.data.customValue,
      };
    }
    return {
      channelKey: "messages",
      mode: "append",
      value: undefined,
    };
  });

  const stateUpdates =
    connectedStateUpdates.length > 0
      ? connectedStateUpdates
      : data.stateUpdates || [];
  const availableFields = (data.availableStateChannels || []).map((c) => c.key);

  const handleToggleLLMConfig = (enabled: boolean) => {
    if (!enabled) {
      const currentEdges = getEdges();
      const boundLlmEdge = currentEdges.find(
        (e) => e.target === id && e.targetHandle === HANDLE_LLM_IN,
      );
      const boundLlmSourceId = boundLlmEdge?.source;

      // Disconnect any existing LLM edge targeting this node
      setEdges((eds) =>
        eds.filter(
          (e) => !(e.target === id && e.targetHandle === HANDLE_LLM_IN),
        ),
      );

      // If the bound node was an LLM Ref node, remove it from the canvas
      if (boundLlmSourceId && boundLlmSourceId.startsWith("llm_ref")) {
        setNodes((nds) => nds.filter((n) => n.id !== boundLlmSourceId));
      }

      updateAgentData({
        llmConfig: {
          ...llmConfig,
          enabled: false,
        },
        modelConfig: undefined,
      });
      return;
    }

    // When enabling, check if there's an existing bound edge
    const currentEdges = getEdges();
    const hasBound = currentEdges.some(
      (e) => e.target === id && e.targetHandle === HANDLE_LLM_IN,
    );

    if (hasBound) {
      updateAgentData({
        llmConfig: {
          ...llmConfig,
          enabled: true,
        },
        modelConfig: data.modelConfig || {
          provider: llmConfig.provider || DEFAULT_LLM_PROVIDER,
          model: llmConfig.model || DEFAULT_LLM_MODEL,
          temperature: llmConfig.temperature ?? DEFAULT_LLM_TEMPERATURE,
        },
      });
      return;
    }

    // Check if there is an available master LLM node on canvas
    const allNodes = getNodes();
    let masterLLM = allNodes.find(
      (n): n is LangGraphLLMNode => n.type === LANGGRAPH_CANVAS_NODE_LLM,
    );

    const agentNode = allNodes.find((n) => n.id === id);
    const agentX = agentNode?.position?.x ?? 400;
    const agentY = agentNode?.position?.y ?? 200;
    const newNodesToAdd: LangGraphCanvasNodeUnion[] = [];

    let masterId: string;
    let masterLabel: string;
    let resolvedProvider: string = DEFAULT_LLM_PROVIDER;
    let resolvedModel: string = DEFAULT_LLM_MODEL;
    let resolvedTemp: number = DEFAULT_LLM_TEMPERATURE;

    if (!masterLLM) {
      masterId = `llm_${Date.now().toString(36).slice(-4)}`;
      masterLabel = "LLM";
      const defaultPreset =
        LLM_PROVIDER_PRESETS[DEFAULT_LLM_PROVIDER] ??
        LLM_PROVIDER_PRESETS[LLM_PROVIDERS.CUSTOM];
      masterLLM = {
        id: masterId,
        type: LANGGRAPH_CANVAS_NODE_LLM,
        position: {
          x: agentX - 340,
          y: Math.max(40, agentY - 220),
        },
        data: {
          label: "LLM",
          llmId: masterId,
          provider: DEFAULT_LLM_PROVIDER,
          baseUrl: defaultPreset?.defaultUrl ?? DEFAULT_LLM_BASE_URL,
          model: defaultPreset?.defaultModel ?? DEFAULT_LLM_MODEL,
          apiKeyHeader:
            defaultPreset?.defaultApiKeyEnv ?? DEFAULT_LLM_API_KEY_ENV,
          temperature: DEFAULT_LLM_TEMPERATURE,
        },
      };
      newNodesToAdd.push(masterLLM);
    } else {
      masterId = masterLLM.id;
      masterLabel = masterLLM.data.label || masterLLM.data.model || "LLM";
      resolvedProvider = masterLLM.data.provider || DEFAULT_LLM_PROVIDER;
      resolvedModel = masterLLM.data.model || DEFAULT_LLM_MODEL;
      resolvedTemp = masterLLM.data.temperature ?? DEFAULT_LLM_TEMPERATURE;
    }

    // Create the LLM Ref node pointing to master LLM
    const refId = `llm_ref_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
    const newLLMRefNode: LangGraphLLMRefNode = {
      id: refId,
      type: LANGGRAPH_CANVAS_NODE_LLM_REF,
      position: {
        x: agentX - 320,
        y: agentY,
      },
      data: {
        label: `${masterLabel} (Ref)`,
        refId,
        llmRef: masterId,
        onDeleteLLMRef: () => {
          setNodes((all) => all.filter((n) => n.id !== refId));
          setEdges((eds) =>
            eds.filter((e) => e.source !== refId && e.target !== refId),
          );
        },
      },
    };
    newNodesToAdd.push(newLLMRefNode);

    // Add nodes to canvas
    setNodes((nds) => [...nds, ...newNodesToAdd]);

    // Connect the LLM Ref node to this agent node with an edge
    const newEdge: Edge = {
      id: `xy-edge__${refId}${HANDLE_LLM_OUT}-${id}${HANDLE_LLM_IN}`,
      source: refId,
      sourceHandle: HANDLE_LLM_OUT,
      target: id,
      targetHandle: HANDLE_LLM_IN,
      animated: true,
      style: { stroke: "#38bdf8", strokeWidth: 2, strokeDasharray: "5 5" },
    };
    setEdges((eds) => [
      ...eds.filter(
        (e) => !(e.target === id && e.targetHandle === HANDLE_LLM_IN),
      ),
      newEdge,
    ]);

    updateAgentData({
      llmConfig: {
        ...llmConfig,
        enabled: true,
        provider: resolvedProvider,
        model: resolvedModel,
        temperature: resolvedTemp,
      },
      modelConfig: {
        provider: resolvedProvider,
        model: resolvedModel,
        temperature: resolvedTemp,
      },
    });
  };

  const updateStreamConfig = (changes: Partial<LangGraphAgentStreamConfig>) => {
    const updated: LangGraphAgentStreamConfig = {
      version: "v3",
      selectedEvents: DEFAULT_SELECTED_STREAM_EVENTS,
      envelope: DEFAULT_STREAM_ENVELOPE,
      transformer: {
        mode: DEFAULT_STREAM_TRANSFORMER_MODE,
      },
      ...streamConfig,
      ...changes,
    };
    updateAgentData({ streamConfig: updated });
  };

  const updateResponseFormat = (
    changes: Partial<LangGraphAgentResponseFormatConfig>,
  ) => {
    const updated: LangGraphAgentResponseFormatConfig = {
      enabled: false,
      strategy: "auto",
      schemaType: "json_schema",
      schemaJson: "",
      handleErrorMode: "default",
      ...responseFormat,
      ...changes,
    };
    updateAgentData({ responseFormat: updated });
  };

  const handleToggleStreaming = (enabled: boolean) => {
    updateStreamConfig({ enabled });
  };

  const handleToggleResponseFormat = (enabled: boolean) => {
    updateResponseFormat({ enabled });
  };

  const handleToggleEvent = (eventId: string) => {
    const currentEvents =
      streamConfig.selectedEvents || DEFAULT_SELECTED_STREAM_EVENTS;
    const isSelected = currentEvents.includes(eventId);
    const updated = isSelected
      ? currentEvents.filter((ev) => ev !== eventId)
      : [...currentEvents, eventId];
    updateStreamConfig({ selectedEvents: updated });
  };

  const handleNameSave = () => {
    setIsEditingName(false);
    let trimmed = nameValue.trim();
    if (!trimmed) trimmed = "Node";
    setNameValue(trimmed);
    if (trimmed !== data.name) {
      updateAgentData({ name: trimmed });
    }
  };

  return {
    isEditingName,
    setIsEditingName,
    nameValue,
    setNameValue,
    isExpanded,
    toggleExpand,
    handleDelete,
    handleNameSave,
    boundLLMs,
    boundTools,
    boundMiddlewares,
    boundStateReducers,
    llmConfig,
    streamConfig,
    responseFormat,
    stateUpdates,
    availableFields,
    updateAgentData,
    handleToggleLLMConfig,
    handleToggleStreaming,
    handleToggleResponseFormat,
    handleToggleEvent,
  };
}
