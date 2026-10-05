import { useState, useMemo, useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  type BackendNode,
  type LangGraphStateChannel,
  type LangGraphInputChannel,
  type LangGraphMemoryConfig,
  type LangGraphCustomReducer,
  type LangGraphCanvasNode,
  type LangGraphCanvasEdge,
} from "@workspace/canvas";
import { isReservedNodeId, NODE_ID_STATE_GLOBAL } from "../constants";

import { buildInitialNodes, buildInitialEdges } from "./utils/initializers";
import { useAgentResourceConnections } from "./useAgentResourceConnections";
import { useSelectedNodeState } from "./useSelectedNodeState";
import { useNodeFactory } from "./useNodeFactory";
import { useCanvasNodeSync } from "./useCanvasNodeSync";
import { useCanvasConnections } from "./useCanvasConnections";
import { useCanvasPersistence } from "./useCanvasPersistence";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

export interface UseLangGraphCanvasStateProps {
  node: BackendNode;
  updateNode: (id: string, changes: Partial<BackendNode>) => void;
  onClose: () => void;
}

export function useLangGraphCanvasState({
  node,
  updateNode,
  onClose,
}: UseLangGraphCanvasStateProps) {
  const data = node.data;

  const [inputChannels, setInputChannels] = useState<LangGraphInputChannel[]>(
    () =>
      (data.inputChannels || []).map((ch, idx) => ({
        ...ch,
        id:
          ch.id ||
          `input_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      })),
  );
  const [stateChannels, setStateChannels] = useState<LangGraphStateChannel[]>(
    () => {
      if (data.stateChannels && data.stateChannels.length > 0) {
        return data.stateChannels;
      }
      return [
        {
          key: "messages",
          type: "messages",
          reducer: "add_messages",
          defaultValue: [],
        },
      ];
    },
  );
  const [customReducers, setCustomReducers] = useState<LangGraphCustomReducer[]>(
    data.customReducers || [],
  );
  const [memoryConfig, setMemoryConfig] = useState<LangGraphMemoryConfig>(
    data.memoryConfig || {
      checkpointer: "memory",
      threadScope: "session",
      autoSummarize: true,
      maxWindowMessages: 10,
    },
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeSideTab, setActiveSideTab] = useState<
    "inspector" | "inputs" | "state" | "memory" | "testing"
  >("inspector");
  const [showCompileModal, setShowCompileModal] = useState(false);

  const { fitView: triggerFitView } = useReactFlow();

  // ── Build initial nodes & edges ──
  const initialNodes = useMemo(() => buildInitialNodes(data), []);
  const initialEdges = useMemo(() => buildInitialEdges(data, initialNodes), []);

  const [nodes, setNodes] = useState<LangGraphCanvasNode[]>(initialNodes);
  const [edges, setEdges] = useState<LangGraphCanvasEdge[]>(initialEdges);

  useEffect(() => {
    const timer = setTimeout(() => {
      triggerFitView({ padding: 0.35, duration: 200, maxZoom: 0.85 });
    }, 50);
    return () => clearTimeout(timer);
  }, [triggerFitView]);

  const handleAddChannel = useCallback(() => {
    const newChannel: LangGraphStateChannel = {
      key: "",
      type: "string",
      reducer: "replace",
      defaultValue: "",
    };
    setStateChannels((prev) => [...prev, newChannel]);
    setSelectedNodeId(NODE_ID_STATE_GLOBAL);
    setActiveSideTab("state");
  }, [setSelectedNodeId, setActiveSideTab]);

  const handleUpdateChannel = useCallback(
    (index: number, channelChanges: Partial<LangGraphStateChannel>) => {
      setStateChannels((prev) =>
        prev.map((c, i) => (i === index ? { ...c, ...channelChanges } : c)),
      );
    },
    [],
  );

  const handleDeleteChannel = useCallback((index: number) => {
    setStateChannels((prev) => {
      if (prev[index]?.key === "messages") return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDuplicateChannel = useCallback((index: number) => {
    setStateChannels((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const copy: LangGraphStateChannel = {
        ...target,
        key: target.key ? `${target.key}_copy` : "",
      };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }, []);

  const handleAddCustomReducer = useCallback((reducer: LangGraphCustomReducer) => {
    setCustomReducers((prev) => {
      if (prev.some((r) => r.name === reducer.name)) return prev;
      return [...prev, reducer];
    });
    if (reducer.targetField) {
      setStateChannels((prevChannels) =>
        prevChannels.map((c) =>
          c.key === reducer.targetField
            ? {
                ...c,
                reducer: reducer.name,
                customReducerCode: reducer.code,
              }
            : c,
        ),
      );
    }
  }, []);

  const handleUpdateCustomReducer = useCallback(
    (idOrName: string, changes: Partial<LangGraphCustomReducer>) => {
      setCustomReducers((prev) => {
        const target = prev.find(
          (r) => r.id === idOrName || r.name === idOrName,
        );
        if (!target) return prev;
        const oldName = target.name;
        const newName = changes.name ?? oldName;
        const newCode = changes.code ?? target.code;

        // If the reducer name, code, or targetField changed, sync channels
        setStateChannels((prevChannels) =>
          prevChannels.map((c) => {
            if (changes.targetField && c.key === changes.targetField) {
              return {
                ...c,
                reducer: newName,
                customReducerCode: newCode,
              };
            }
            if (c.reducer === oldName) {
              return {
                ...c,
                reducer: newName,
                customReducerCode: newCode,
              };
            }
            return c;
          }),
        );

        return prev.map((r) =>
          r.id === idOrName || r.name === idOrName ? { ...r, ...changes } : r,
        );
      });
    },
    [],
  );

  const handleDeleteCustomReducer = useCallback((idOrName: string) => {
    setCustomReducers((prev) =>
      prev.filter((r) => r.id !== idOrName && r.name !== idOrName),
    );
    setStateChannels((prev) =>
      prev.map((c) =>
        c.reducer === idOrName
          ? { ...c, reducer: "replace", customReducerCode: undefined }
          : c,
      ),
    );
  }, []);

  // ── Input channel CRUD handlers ──
  const handleAddInputChannel = useCallback(() => {
    const newChannel: LangGraphInputChannel = {
      id: `input_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      key: `var_${inputChannels.length + 1}`,
      type: "string",
      required: false,
      description: "",
      source: "custom",
    };
    setInputChannels((prev) => [...prev, newChannel]);
  }, [inputChannels.length]);

  const handleUpdateInputChannel = useCallback(
    (index: number, changes: Partial<LangGraphInputChannel>) => {
      setInputChannels((prev) =>
        prev.map((c, i) => (i === index ? { ...c, ...changes } : c)),
      );
    },
    [],
  );

  const handleDeleteInputChannel = useCallback((index: number) => {
    setInputChannels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSuggestedChannel = useCallback((channel: LangGraphInputChannel) => {
    setInputChannels((prev) => [
      ...prev,
      {
        ...channel,
        id:
          channel.id ||
          `input_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        source: channel.source || "request",
      },
    ]);
  }, []);

  const handleAutoMapStateChannels = useCallback(() => {
    setInputChannels((prev) => {
      const validStateKeys = new Set(
        stateChannels.map((s) => s.key?.trim()).filter(Boolean),
      );
      return prev.map((ch) => {
        if (ch.stateChannelKey && validStateKeys.has(ch.stateChannelKey)) {
          return ch;
        }
        if (validStateKeys.has(ch.key)) {
          return { ...ch, stateChannelKey: ch.key };
        }
        if (
          ["query", "prompt", "message", "user_message", "input"].includes(
            ch.key.toLowerCase(),
          ) &&
          validStateKeys.has("messages")
        ) {
          return { ...ch, stateChannelKey: "messages" };
        }
        return ch;
      });
    });
  }, [stateChannels]);

  const handleMapStateToInput = useCallback(
    (stateKey: string, inputChannelIdOrKey?: string) => {
      setInputChannels((prev) => {
        return prev.map((ch) => {
          const isTarget =
            Boolean(inputChannelIdOrKey) &&
            (ch.id === inputChannelIdOrKey || ch.key === inputChannelIdOrKey);
          if (isTarget) {
            return { ...ch, stateChannelKey: stateKey };
          }
          if (ch.stateChannelKey === stateKey && !isTarget) {
            return { ...ch, stateChannelKey: undefined };
          }
          return ch;
        });
      });
    },
    [],
  );

  // ── Derive suggested params from connected ServiceNode endpoints ──
  const allEdges = useBackendCanvasStore((s) => s.edges);
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);

  const suggestedParams = useMemo(() => {
    // Find edges pointing at this LangGraph node
    const incomingEdges = allEdges.filter((e) => e.target === node.id);
    const suggested: Array<{
      key: string;
      type: LangGraphInputChannel["type"];
      description?: string;
      required?: boolean;
    }> = [];
    const seen = new Set<string>();

    for (const edge of incomingEdges) {
      if (!edge.sourceHandle?.startsWith("endpoint-out-")) continue;
      const endpointId = edge.sourceHandle.replace("endpoint-out-", "");
      const ep = allEndpoints.find((e) => e.id === endpointId);
      if (!ep) continue;

      // Collect from params (legacy), queryParams, pathParams
      const paramSources = [
        ...(ep.params || []),
        ...(ep.queryParams || []),
        ...(ep.pathParams || []),
      ];
      for (const p of paramSources) {
        if (!p.name || seen.has(p.name)) continue;
        seen.add(p.name);
        suggested.push({
          key: p.name,
          type: (p.type === "number" ? "number" : p.type === "boolean" ? "boolean" : "string") as LangGraphInputChannel["type"],
          description: p.description,
          required: p.required,
        });
      }

      // Collect from requestBody fields
      const bodyFields = ep.requestBody?.fields || [];
      for (const f of bodyFields) {
        const fieldName = f.name;
        if (!fieldName || seen.has(fieldName)) continue;
        seen.add(fieldName);
        const resolvedType: LangGraphInputChannel["type"] =
          f.type === "number" ? "number"
          : f.type === "boolean" ? "boolean"
          : f.type === "object" ? "object"
          : f.type === "array" ? "array"
          : "string";
        suggested.push({
          key: fieldName,
          type: resolvedType,
          description: f.description,
          required: f.required,
        });
      }
    }
    return suggested;
  }, [allEdges, allEndpoints, node.id]);

  // Auto-seed inputChannels from suggestedParams when they are empty and suggestions exist
  useEffect(() => {
    if (inputChannels.length === 0 && suggestedParams.length > 0) {
      setInputChannels(
        suggestedParams.map((p) => ({
          key: p.key,
          type: p.type,
          required: p.required ?? true,
          description: p.description || "",
          source: "request" as const,
        })),
      );
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync node callbacks and internal attributes ──
  useCanvasNodeSync({
    nodes,
    setNodes,
    setEdges,
    inputChannels,
    stateChannels,
    customReducers,
    memoryConfig,
    setMemoryConfig,
    setSelectedNodeId,
    setActiveSideTab,
    handleAddChannel,
    handleUpdateChannel,
    handleDeleteChannel,
    handleDuplicateChannel,
    handleAddCustomReducer,
    handleUpdateCustomReducer,
    handleDeleteCustomReducer,
    handleAddInputChannel,
    handleAddSuggestedChannel,
    handleUpdateInputChannel,
    handleDeleteInputChannel,
    handleAutoMapStateChannels,
    handleMapStateToInput,
    suggestedParams,
  });

  // ── Connection handling hook ──
  const { onNodesChange, onEdgesChange, isValidConnection, onConnect } =
    useCanvasConnections({
      nodes,
      edges,
      setNodes,
      setEdges,
    });

  // ── Sub-hooks for focused responsibility areas ──
  const {
    selectedStepData,
    selectedLLMData,
    selectedToolData,
    selectedMiddlewareData,
    selectedAgentData,
    selectedMemoryData,
    selectedOutputData,
    selectedStartData,
    updateSelectedStep,
    updateSelectedLLM,
    updateSelectedTool,
    updateSelectedMiddleware,
    updateSelectedAgent,
    updateSelectedMemory,
    updateSelectedOutput,
  } = useSelectedNodeState({ nodes, selectedNodeId, setNodes });

  const { handleAddStep } = useNodeFactory({
    setNodes,
    setEdges,
    setSelectedNodeId,
    setActiveSideTab,
    stateChannels,
  });

  const {
    availableLLMNodes,
    availableToolNodes,
    availableMiddlewareNodes,
    availableMemoryNodes,
    masterToolNodes,
    masterMiddlewareNodes,
    handleSelectLLMForAgent,
    handleToggleToolForAgent,
    handleToggleMiddlewareForAgent,
    handleToggleMemoryForAgent,
    handleAddToolRefForAgent,
    handleRemoveToolRefForAgent,
    handleAddMiddlewareRefForAgent,
    handleRemoveMiddlewareRefForAgent,
  } = useAgentResourceConnections({ nodes, edges, setEdges, setNodes });

  // ── Persistence & Auto-Save ──
  const { saveStatus, handleSave } = useCanvasPersistence({
    node,
    updateNode,
    onClose,
    nodes,
    edges,
    inputChannels,
    stateChannels,
    customReducers,
    memoryConfig,
  });

  // ── Delete selected step ──
  const handleDeleteStep = () => {
    if (!selectedNodeId || isReservedNodeId(selectedNodeId)) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
  };

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId && !isReservedNodeId(selectedNodeId)) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
        ),
      );
      setSelectedNodeId(null);
    }
    setEdges((eds) => eds.filter((e) => !e.selected));
  }, [selectedNodeId]);

  return {
    nodes,
    edges,
    setEdges,
    inputChannels,
    setInputChannels,
    stateChannels,
    setStateChannels,
    memoryConfig,
    setMemoryConfig,
    selectedNodeId,
    setSelectedNodeId,
    activeSideTab,
    setActiveSideTab,
    selectedStepData,
    selectedLLMData,
    selectedToolData,
    selectedMiddlewareData,
    selectedAgentData,
    selectedMemoryData,
    selectedOutputData,
    selectedStartData,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    handleAddStep,
    updateSelectedStep,
    updateSelectedLLM,
    updateSelectedTool,
    updateSelectedMiddleware,
    updateSelectedAgent,
    updateSelectedMemory,
    updateSelectedOutput,
    customReducers,
    setCustomReducers,
    handleAddCustomReducer,
    handleUpdateCustomReducer,
    handleDeleteCustomReducer,
    handleAddChannel,
    handleUpdateChannel,
    handleDeleteChannel,
    handleDeleteStep,
    handleDeleteSelected,
    handleSave,
    saveStatus,
    availableLLMNodes,
    availableToolNodes,
    availableMiddlewareNodes,
    availableMemoryNodes,
    masterToolNodes,
    masterMiddlewareNodes,
    handleSelectLLMForAgent,
    handleToggleToolForAgent,
    handleToggleMiddlewareForAgent,
    handleToggleMemoryForAgent,
    handleAddToolRefForAgent,
    handleRemoveToolRefForAgent,
    handleAddMiddlewareRefForAgent,
    handleRemoveMiddlewareRefForAgent,
    showCompileModal,
    setShowCompileModal,
    suggestedParams,
  };
}
