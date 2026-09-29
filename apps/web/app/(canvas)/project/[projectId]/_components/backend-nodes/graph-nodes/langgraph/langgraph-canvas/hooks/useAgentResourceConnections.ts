import { useMemo, useCallback } from "react";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphLLMNode,
  LangGraphLLMRefNode,
  ToolNode,
  LangGraphToolRefNode,
  MiddlewareNode,
  LangGraphMiddlewareRefNode,
  MemoryNode,
  LangGraphMemoryRefNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_LLM_REF,
  LANGGRAPH_CANVAS_NODE_TOOL,
  LANGGRAPH_CANVAS_NODE_TOOL_REF,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF,
  LANGGRAPH_CANVAS_NODE_MEMORY,
  LANGGRAPH_CANVAS_NODE_MEMORY_REF,
  LANGGRAPH_CANVAS_NODE_STEP,
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  HANDLE_LLM_IN,
  HANDLE_LLM_OUT,
  HANDLE_TOOL_IN,
  HANDLE_TOOL_OUT,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_MIDDLEWARE_OUT,
  HANDLE_MEMORY_IN,
  HANDLE_MEMORY_OUT,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
} from "../constants";

interface UseAgentResourceConnectionsProps {
  nodes: LangGraphCanvasNode[];
  setEdges: React.Dispatch<React.SetStateAction<LangGraphCanvasEdge[]>>;
  setNodes?: React.Dispatch<React.SetStateAction<LangGraphCanvasNode[]>>;
}

export function useAgentResourceConnections({
  nodes,
  setEdges,
  setNodes,
}: UseAgentResourceConnectionsProps) {
  const availableLLMNodes = useMemo(() => {
    const refs = nodes.filter(
      (n): n is LangGraphLLMRefNode => n.type === LANGGRAPH_CANVAS_NODE_LLM_REF,
    );
    const masters = nodes.filter(
      (n): n is LangGraphLLMNode => n.type === LANGGRAPH_CANVAS_NODE_LLM,
    );
    return [...refs, ...masters];
  }, [nodes]);

  const availableToolNodes = useMemo(() => {
    const refs = nodes.filter(
      (n): n is LangGraphToolRefNode => n.type === LANGGRAPH_CANVAS_NODE_TOOL_REF,
    );
    const masters = nodes.filter(
      (n): n is ToolNode => n.type === LANGGRAPH_CANVAS_NODE_TOOL,
    );
    return [...refs, ...masters];
  }, [nodes]);

  const availableMiddlewareNodes = useMemo(() => {
    const refs = nodes.filter(
      (n): n is LangGraphMiddlewareRefNode =>
        n.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF,
    );
    const masters = nodes.filter(
      (n): n is MiddlewareNode => n.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE,
    );
    return [...refs, ...masters];
  }, [nodes]);

  const availableMemoryNodes = useMemo(() => {
    const refs = nodes.filter(
      (n): n is LangGraphMemoryRefNode =>
        n.type === LANGGRAPH_CANVAS_NODE_MEMORY_REF,
    );
    const masters = nodes.filter(
      (n): n is MemoryNode => n.type === LANGGRAPH_CANVAS_NODE_MEMORY,
    );
    return [...refs, ...masters];
  }, [nodes]);

  const handleSelectLLMForAgent = useCallback(
    (agentId: string, llmId: string | null) => {
      setEdges((eds) => {
        const filtered = eds.filter(
          (e) => !(e.target === agentId && e.targetHandle === HANDLE_LLM_IN),
        );
        if (!llmId) return filtered;
        const newEdge: LangGraphCanvasEdge = {
          id: `xy-edge__${llmId}${HANDLE_LLM_OUT}-${agentId}${HANDLE_LLM_IN}`,
          source: llmId,
          sourceHandle: HANDLE_LLM_OUT,
          target: agentId,
          targetHandle: HANDLE_LLM_IN,
          animated: true,
          style: { stroke: "#38bdf8", strokeWidth: 2, strokeDasharray: "5 5" },
        };
        return [...filtered, newEdge];
      });

      // Tight coupling: update target node's llmConfig and modelConfig
      if (setNodes) {
        if (!llmId) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === agentId) {
                if (
                  n.type === LANGGRAPH_CANVAS_NODE_NODE ||
                  n.type === LANGGRAPH_CANVAS_NODE_AGENT
                ) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmConfig: {
                        ...(n.data.llmConfig || {}),
                        enabled: false,
                      },
                      modelConfig: undefined,
                    },
                  };
                }
                if (n.type === LANGGRAPH_CANVAS_NODE_STEP) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmConfig: {
                        ...(n.data.llmConfig || {}),
                        enabled: false,
                      },
                      modelConfig: undefined,
                    },
                  };
                }
              }
              return n;
            }),
          );
        } else {
          const srcNode = nodes.find((n) => n.id === llmId);
          let resolvedProvider: string | undefined;
          let resolvedModel: string | undefined;
          let resolvedTemp: number | undefined;

          if (srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM) {
            resolvedProvider = srcNode.data.provider;
            resolvedModel = srcNode.data.model;
            resolvedTemp = srcNode.data.temperature;
          } else if (srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM_REF) {
            const masterId = srcNode.data.llmRef;
            const master = nodes.find((n) => n.id === masterId);
            if (master?.type === LANGGRAPH_CANVAS_NODE_LLM) {
              resolvedProvider = master.data.provider;
              resolvedModel = master.data.model;
              resolvedTemp = master.data.temperature;
            }
          }

          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === agentId) {
                if (
                  n.type === LANGGRAPH_CANVAS_NODE_NODE ||
                  n.type === LANGGRAPH_CANVAS_NODE_AGENT
                ) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmConfig: {
                        ...(n.data.llmConfig || {}),
                        enabled: true,
                        provider:
                          resolvedProvider ||
                          n.data.llmConfig?.provider ||
                          DEFAULT_LLM_PROVIDER,
                        model:
                          resolvedModel ||
                          n.data.llmConfig?.model ||
                          DEFAULT_LLM_MODEL,
                        temperature:
                          resolvedTemp ?? n.data.llmConfig?.temperature,
                      },
                      modelConfig: {
                        provider: resolvedProvider || DEFAULT_LLM_PROVIDER,
                        model: resolvedModel || DEFAULT_LLM_MODEL,
                        temperature: resolvedTemp,
                      },
                    },
                  };
                }
                if (n.type === LANGGRAPH_CANVAS_NODE_STEP) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmConfig: {
                        ...(n.data.llmConfig || {}),
                        enabled: true,
                        provider:
                          resolvedProvider ||
                          n.data.llmConfig?.provider ||
                          DEFAULT_LLM_PROVIDER,
                        model:
                          resolvedModel ||
                          n.data.llmConfig?.model ||
                          DEFAULT_LLM_MODEL,
                        temperature:
                          resolvedTemp ?? n.data.llmConfig?.temperature,
                      },
                      modelConfig: {
                        provider: resolvedProvider || DEFAULT_LLM_PROVIDER,
                        model: resolvedModel || DEFAULT_LLM_MODEL,
                        temperature: resolvedTemp,
                      },
                    },
                  };
                }
              }
              return n;
            }),
          );
        }
      }
    },
    [nodes, setEdges, setNodes],
  );

  const handleToggleToolForAgent = useCallback(
    (agentId: string, toolId: string, connect: boolean) => {
      setEdges((eds) => {
        if (!connect) {
          return eds.filter(
            (e) =>
              !(
                e.source === toolId &&
                e.target === agentId &&
                e.targetHandle === HANDLE_TOOL_IN
              ),
          );
        }
        const existing = eds.find(
          (e) =>
            e.source === toolId &&
            e.target === agentId &&
            e.targetHandle === HANDLE_TOOL_IN,
        );
        if (existing) return eds;
        const newEdge: LangGraphCanvasEdge = {
          id: `xy-edge__${toolId}${HANDLE_TOOL_OUT}-${agentId}${HANDLE_TOOL_IN}`,
          source: toolId,
          sourceHandle: HANDLE_TOOL_OUT,
          target: agentId,
          targetHandle: HANDLE_TOOL_IN,
          animated: true,
          style: { stroke: "#10b981", strokeWidth: 2, strokeDasharray: "5 5" },
        };
        return [...eds, newEdge];
      });
    },
    [setEdges],
  );

  const handleToggleMiddlewareForAgent = useCallback(
    (agentId: string, mwId: string, connect: boolean) => {
      setEdges((eds) => {
        if (!connect) {
          return eds.filter(
            (e) =>
              !(
                e.source === mwId &&
                e.target === agentId &&
                e.targetHandle === HANDLE_MIDDLEWARE_IN
              ),
          );
        }
        const existing = eds.find(
          (e) =>
            e.source === mwId &&
            e.target === agentId &&
            e.targetHandle === HANDLE_MIDDLEWARE_IN,
        );
        if (existing) return eds;
        const newEdge: LangGraphCanvasEdge = {
          id: `xy-edge__${mwId}${HANDLE_MIDDLEWARE_OUT}-${agentId}${HANDLE_MIDDLEWARE_IN}`,
          source: mwId,
          sourceHandle: HANDLE_MIDDLEWARE_OUT,
          target: agentId,
          targetHandle: HANDLE_MIDDLEWARE_IN,
          animated: true,
          style: { stroke: "#a855f7", strokeWidth: 2, strokeDasharray: "5 5" },
        };
        return [...eds, newEdge];
      });
    },
    [setEdges],
  );

  const handleToggleMemoryForAgent = useCallback(
    (agentId: string, memId: string, connect: boolean) => {
      setEdges((eds) => {
        if (!connect) {
          return eds.filter(
            (e) =>
              !(
                e.source === memId &&
                e.target === agentId &&
                e.targetHandle === HANDLE_MEMORY_IN
              ),
          );
        }
        const existing = eds.find(
          (e) =>
            e.source === memId &&
            e.target === agentId &&
            e.targetHandle === HANDLE_MEMORY_IN,
        );
        if (existing) return eds;
        const newEdge: LangGraphCanvasEdge = {
          id: `xy-edge__${memId}${HANDLE_MEMORY_OUT}-${agentId}${HANDLE_MEMORY_IN}`,
          source: memId,
          sourceHandle: HANDLE_MEMORY_OUT,
          target: agentId,
          targetHandle: HANDLE_MEMORY_IN,
          animated: true,
          style: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "5 5" },
        };
        return [...eds, newEdge];
      });
    },
    [setEdges],
  );

  return {
    availableLLMNodes,
    availableToolNodes,
    availableMiddlewareNodes,
    availableMemoryNodes,
    handleSelectLLMForAgent,
    handleToggleToolForAgent,
    handleToggleMiddlewareForAgent,
    handleToggleMemoryForAgent,
  };
}
