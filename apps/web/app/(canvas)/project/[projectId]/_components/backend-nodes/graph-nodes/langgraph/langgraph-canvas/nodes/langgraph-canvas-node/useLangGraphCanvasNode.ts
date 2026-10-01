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
  DEFAULT_EVENT_STREAM_SIGNATURE,
  DEFAULT_STREAM_TRANSFORMERS,
  DEFAULT_SELECTED_STREAM_EVENTS,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
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

  const llmConfig = {
    enabled:
      data.llmConfig?.enabled !== undefined
        ? data.llmConfig.enabled
        : data.modelConfig !== undefined
          ? true
          : true,
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
    eventSignature: DEFAULT_EVENT_STREAM_SIGNATURE,
    customTransformers: DEFAULT_STREAM_TRANSFORMERS,
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
      // Disconnect any existing LLM edge targeting this node
      setEdges((eds) =>
        eds.filter(
          (e) => !(e.target === id && e.targetHandle === HANDLE_LLM_IN),
        ),
      );
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

    // Check if there is an available LLM Ref or master LLM node on canvas to auto-connect (prioritizing LLM Ref nodes)
    const allNodes = getNodes();
    const llmRefNodes = allNodes.filter(
      (n): n is LangGraphLLMRefNode => n.type === LANGGRAPH_CANVAS_NODE_LLM_REF,
    );
    const unboundLLMRef = llmRefNodes.find(
      (ref) =>
        !currentEdges.some(
          (e) => e.source === ref.id && e.sourceHandle === HANDLE_LLM_OUT,
        ),
    );
    const availableLLM =
      unboundLLMRef ||
      llmRefNodes[0] ||
      allNodes.find(
        (n): n is LangGraphLLMNode => n.type === LANGGRAPH_CANVAS_NODE_LLM,
      );

    if (availableLLM) {
      const newEdge: Edge = {
        id: `xy-edge__${availableLLM.id}${HANDLE_LLM_OUT}-${id}${HANDLE_LLM_IN}`,
        source: availableLLM.id,
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

      let resolvedProvider: string | undefined;
      let resolvedModel: string | undefined;
      let resolvedTemp: number | undefined;

      if (availableLLM.type === LANGGRAPH_CANVAS_NODE_LLM) {
        resolvedProvider = availableLLM.data.provider;
        resolvedModel = availableLLM.data.model;
        resolvedTemp = availableLLM.data.temperature;
      } else if (availableLLM.type === LANGGRAPH_CANVAS_NODE_LLM_REF) {
        const masterId = availableLLM.data.llmRef;
        const master = allNodes.find((n) => n.id === masterId);
        if (master?.type === LANGGRAPH_CANVAS_NODE_LLM) {
          resolvedProvider = master.data.provider;
          resolvedModel = master.data.model;
          resolvedTemp = master.data.temperature;
        }
      }

      updateAgentData({
        llmConfig: {
          ...llmConfig,
          enabled: true,
          provider:
            resolvedProvider || llmConfig.provider || DEFAULT_LLM_PROVIDER,
          model: resolvedModel || llmConfig.model || DEFAULT_LLM_MODEL,
          temperature: resolvedTemp ?? llmConfig.temperature,
        },
        modelConfig: {
          provider: resolvedProvider || DEFAULT_LLM_PROVIDER,
          model: resolvedModel || DEFAULT_LLM_MODEL,
          temperature: resolvedTemp ?? DEFAULT_LLM_TEMPERATURE,
        },
      });
      return;
    }

    // No LLM on canvas yet, enable with default config
    updateAgentData({
      llmConfig: {
        ...llmConfig,
        enabled: true,
      },
      modelConfig: data.modelConfig || {
        provider: DEFAULT_LLM_PROVIDER,
        model: DEFAULT_LLM_MODEL,
        temperature: DEFAULT_LLM_TEMPERATURE,
      },
    });
  };

  const updateStreamConfig = (changes: Partial<LangGraphAgentStreamConfig>) => {
    const updated: LangGraphAgentStreamConfig = {
      version: "v3",
      selectedEvents: DEFAULT_SELECTED_STREAM_EVENTS,
      eventSignature: DEFAULT_EVENT_STREAM_SIGNATURE,
      customTransformers: DEFAULT_STREAM_TRANSFORMERS,
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
