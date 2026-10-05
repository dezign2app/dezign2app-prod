import { useCallback } from "react";
import {
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import {
  type LangGraphCanvasNode,
  type LangGraphCanvasEdge,
  type StepNode,
  type LangGraphRouterBranch,
  type LangGraphLLMRefNode,
  type LangGraphMiddlewareRefNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_STEP,
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_AGENT,
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_LLM_REF,
  LANGGRAPH_CANVAS_NODE_TOOL,
  LANGGRAPH_CANVAS_NODE_TOOL_REF,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE,
  LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF,
  LANGGRAPH_CANVAS_NODE_MEMORY,
  LANGGRAPH_CANVAS_NODE_MEMORY_REF,
  LANGGRAPH_CANVAS_NODE_STATE_REDUCER_REF,
  HANDLE_LLM_IN,
  HANDLE_LLM_OUT,
  HANDLE_TOOL_IN,
  HANDLE_TOOL_OUT,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_MIDDLEWARE_OUT,
  HANDLE_MEMORY_IN,
  HANDLE_MEMORY_OUT,
  HANDLE_STATE_IN,
  HANDLE_STATE_OUT,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
} from "../constants";

interface UseCanvasConnectionsProps {
  nodes: LangGraphCanvasNode[];
  edges?: LangGraphCanvasEdge[];
  setNodes: React.Dispatch<React.SetStateAction<LangGraphCanvasNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<LangGraphCanvasEdge[]>>;
}

export function useCanvasConnections({
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseCanvasConnectionsProps) {
  const onNodesChange = useCallback(
    (changes: NodeChange<LangGraphCanvasNode>[]) =>
      setNodes((nds) => applyNodeChanges<LangGraphCanvasNode>(changes, nds)),
    [setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removedEdgeIds = new Set(
        changes.filter((c) => c.type === "remove").map((c) => c.id),
      );

      if (removedEdgeIds.size > 0) {
        setEdges((eds) => {
          const removedEdges = eds.filter((e) => removedEdgeIds.has(e.id));
          const removedLlmTargets = removedEdges
            .filter((e) => e.targetHandle === HANDLE_LLM_IN)
            .map((e) => e.target);

          if (removedLlmTargets.length > 0) {
            setNodes((nds) =>
              nds.map((n) => {
                if (removedLlmTargets.includes(n.id)) {
                  const hasRemaining = eds.some(
                    (e) =>
                      !removedEdgeIds.has(e.id) &&
                      e.target === n.id &&
                      e.targetHandle === HANDLE_LLM_IN,
                  );
                  if (!hasRemaining) {
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
                }
                return n;
              }),
            );
          }

          const removedMwTargets = removedEdges
            .filter((e) => e.targetHandle === HANDLE_MIDDLEWARE_IN)
            .map((e) => e.target);

          if (removedMwTargets.length > 0) {
            setNodes((nds) =>
              nds.map((n) => {
                if (removedMwTargets.includes(n.id)) {
                  const hasRemaining = eds.some(
                    (e) =>
                      !removedEdgeIds.has(e.id) &&
                      e.target === n.id &&
                      e.targetHandle === HANDLE_MIDDLEWARE_IN,
                  );
                  if (!hasRemaining) {
                    if (
                      n.type === LANGGRAPH_CANVAS_NODE_NODE ||
                      n.type === LANGGRAPH_CANVAS_NODE_AGENT
                    ) {
                      return {
                        ...n,
                        data: {
                          ...n.data,
                          middlewareConfig: {
                            ...(n.data.middlewareConfig || {}),
                            enabled: false,
                          },
                        },
                      };
                    }
                    if (n.type === LANGGRAPH_CANVAS_NODE_STEP) {
                      return {
                        ...n,
                        data: {
                          ...n.data,
                          middlewareConfig: {
                            ...(n.data.middlewareConfig || {}),
                            enabled: false,
                          },
                        },
                      };
                    }
                  }
                }
                return n;
              }),
            );
          }

          return applyEdgeChanges(changes, eds);
        });
        return;
      }

      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges, setNodes],
  );

  const isValidConnection = useCallback(
    (connection: Connection): boolean => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const isLLMSource =
        connection.sourceHandle === HANDLE_LLM_OUT ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_LLM ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_LLM_REF ||
        connection.source?.startsWith("llm_") ||
        connection.source?.startsWith("llm_ref_");
      const isLLMTarget = connection.targetHandle === HANDLE_LLM_IN;

      const isToolSource =
        connection.sourceHandle === HANDLE_TOOL_OUT ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_TOOL ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF ||
        connection.source?.startsWith("tool_") ||
        connection.source?.startsWith("tool_ref_");
      const isToolTarget = connection.targetHandle === HANDLE_TOOL_IN;

      const isMiddlewareSource =
        connection.sourceHandle === HANDLE_MIDDLEWARE_OUT ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF ||
        connection.source?.startsWith("mw_") ||
        connection.source?.startsWith("mw_ref_");
      const isMiddlewareTarget =
        connection.targetHandle === HANDLE_MIDDLEWARE_IN;

      const isMemorySource =
        connection.sourceHandle === HANDLE_MEMORY_OUT ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_MEMORY ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_MEMORY_REF ||
        connection.source?.startsWith("mem_") ||
        connection.source?.startsWith("mem_ref_") ||
        connection.source?.startsWith("db_");
      const isMemoryTarget = connection.targetHandle === HANDLE_MEMORY_IN;

      if (isLLMSource && !isLLMTarget) return false;
      if (isLLMTarget && !isLLMSource) return false;

      const targetNode = nodes.find((n) => n.id === connection.target);
      const isAgentOrStepTarget =
        targetNode?.type === LANGGRAPH_CANVAS_NODE_NODE ||
        targetNode?.type === LANGGRAPH_CANVAS_NODE_AGENT ||
        targetNode?.type === LANGGRAPH_CANVAS_NODE_STEP;

      // Only ToolRef nodes can connect to Agent/Step tool_in
      if (isAgentOrStepTarget && connection.targetHandle === HANDLE_TOOL_IN) {
        const isToolRefSource =
          sourceNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF ||
          Boolean(connection.source?.startsWith("tool_ref_"));
        if (!isToolRefSource) return false;

        // Restrict: Cannot attach the same master tool twice to the same agent
        if (edges) {
          const sourceMasterId =
            sourceNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF
              ? (sourceNode.data as { toolRef?: string })?.toolRef
              : sourceNode?.id;

          const alreadyAttached = edges.some((e) => {
            if (e.target !== connection.target || e.targetHandle !== HANDLE_TOOL_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF
                ? (existingNode.data as { toolRef?: string })?.toolRef
                : existingNode?.id;
            return existingMasterId === sourceMasterId;
          });

          if (alreadyAttached) return false;
        }
      }

      // Only MiddlewareRef nodes can connect to Agent/Step middleware_in
      if (
        isAgentOrStepTarget &&
        connection.targetHandle === HANDLE_MIDDLEWARE_IN
      ) {
        const isMiddlewareRefSource =
          sourceNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF ||
          sourceNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE ||
          Boolean(connection.source?.startsWith("mw_"));
        if (!isMiddlewareRefSource) return false;

        // Restrict: Cannot attach the same master middleware twice to the same agent
        if (edges) {
          const sourceMasterId =
            sourceNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF
              ? (sourceNode.data as { middlewareRef?: string })?.middlewareRef
              : sourceNode?.id;

          const alreadyAttached = edges.some((e) => {
            if (e.target !== connection.target || e.targetHandle !== HANDLE_MIDDLEWARE_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF
                ? (existingNode.data as { middlewareRef?: string })?.middlewareRef
                : existingNode?.id;
            return existingMasterId === sourceMasterId;
          });

          if (alreadyAttached) return false;
        }
      }

      if (isToolSource && !isToolTarget) return false;
      if (isToolTarget && !isToolSource) return false;

      if (isMiddlewareSource && !isMiddlewareTarget) return false;
      if (isMiddlewareTarget && !isMiddlewareSource) return false;

      if (isMemorySource && !isMemoryTarget) return false;
      if (isMemoryTarget && !isMemorySource) return false;

      const isStateReducerSource =
        connection.sourceHandle === HANDLE_STATE_OUT ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_STATE_REDUCER_REF ||
        connection.source?.startsWith("state_ref_") ||
        connection.source?.startsWith("reducer_ref_");
      const isStateReducerTarget = connection.targetHandle === HANDLE_STATE_IN;

      if (isStateReducerSource && !isStateReducerTarget) return false;
      if (isStateReducerTarget && !isStateReducerSource) return false;

      return true;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => {
        if (!isValidConnection(params)) return eds;

        const isLLM =
          params.sourceHandle === HANDLE_LLM_OUT ||
          params.targetHandle === HANDLE_LLM_IN ||
          Boolean(params.source?.startsWith("llm_"));
        const isTool =
          params.sourceHandle === HANDLE_TOOL_OUT ||
          params.targetHandle === HANDLE_TOOL_IN ||
          Boolean(params.source?.startsWith("tool_"));
        const isMiddleware =
          params.sourceHandle === HANDLE_MIDDLEWARE_OUT ||
          params.targetHandle === HANDLE_MIDDLEWARE_IN ||
          Boolean(params.source?.startsWith("mw_"));

        if (isTool) {
          const srcNode = nodes.find((n) => n.id === params.source);
          const srcMasterId =
            srcNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF
              ? (srcNode.data as { toolRef?: string })?.toolRef
              : srcNode?.id;

          const alreadyAttached = eds.some((e) => {
            if (e.target !== params.target || e.targetHandle !== HANDLE_TOOL_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF
                ? (existingNode.data as { toolRef?: string })?.toolRef
                : existingNode?.id;
            return existingMasterId === srcMasterId;
          });

          if (alreadyAttached) return eds;
        }

        if (isMiddleware) {
          const srcNode = nodes.find((n) => n.id === params.source);
          const srcMasterId =
            srcNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF
              ? (srcNode.data as { middlewareRef?: string })?.middlewareRef
              : srcNode?.id;

          const alreadyAttached = eds.some((e) => {
            if (e.target !== params.target || e.targetHandle !== HANDLE_MIDDLEWARE_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF
                ? (existingNode.data as { middlewareRef?: string })?.middlewareRef
                : existingNode?.id;
            return existingMasterId === srcMasterId;
          });

          if (alreadyAttached) return eds;
        }
        const isMemory =
          params.sourceHandle === HANDLE_MEMORY_OUT ||
          params.targetHandle === HANDLE_MEMORY_IN ||
          Boolean(
            params.source?.startsWith("mem_") ||
            params.source?.startsWith("db_"),
          );
        const isStateReducer =
          params.sourceHandle === HANDLE_STATE_OUT ||
          params.targetHandle === HANDLE_STATE_IN ||
          Boolean(
            params.source?.startsWith("state_ref_") ||
            params.source?.startsWith("reducer_ref_"),
          );

        const sourceNode = nodes.find(
          (n): n is StepNode =>
            n.id === params.source && n.type === LANGGRAPH_CANVAS_NODE_STEP,
        );
        const routerBranch = sourceNode?.data?.routerConfig?.branches?.find(
          (b: LangGraphRouterBranch) => b.id === params.sourceHandle,
        );

        const sourceHandle = isLLM
          ? HANDLE_LLM_OUT
          : isTool
            ? HANDLE_TOOL_OUT
            : isMiddleware
              ? HANDLE_MIDDLEWARE_OUT
              : isMemory
                ? HANDLE_MEMORY_OUT
                : isStateReducer
                  ? HANDLE_STATE_OUT
                  : params.sourceHandle;
        const targetHandle = isLLM
          ? HANDLE_LLM_IN
          : isTool
            ? HANDLE_TOOL_IN
            : isMiddleware
              ? HANDLE_MIDDLEWARE_IN
              : isMemory
                ? HANDLE_MEMORY_IN
                : isStateReducer
                  ? HANDLE_STATE_IN
                  : params.targetHandle;

        const fieldStr = routerBranch?.field
          ? routerBranch.field.startsWith("state.")
            ? routerBranch.field
            : `state.${routerBranch.field}`
          : "state";
        const label = routerBranch
          ? routerBranch.label ||
            (routerBranch.isDefault
              ? "Default"
              : `${fieldStr} ${routerBranch.operator} '${routerBranch.value ?? ""}'`)
          : undefined;

        const style = isLLM
          ? { stroke: "#38bdf8", strokeWidth: 2, strokeDasharray: "4 4" }
          : isTool
            ? { stroke: "#10b981", strokeWidth: 2, strokeDasharray: "4 4" }
            : isMiddleware
              ? { stroke: "#a855f7", strokeWidth: 2, strokeDasharray: "4 4" }
              : isMemory
                ? { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "4 4" }
                : isStateReducer
                  ? { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "4 4" }
                  : routerBranch
                    ? { stroke: "#38bdf8", strokeWidth: 2 }
                    : { stroke: "#a1a1aa", strokeWidth: 2 };

        const labelStyle = routerBranch
          ? { fill: "#bae6fd", fontSize: 10, fontWeight: "bold" }
          : undefined;

        const labelBgStyle = routerBranch
          ? { fill: "#0c4a6e", rx: 4, ry: 4 }
          : undefined;

        const srcNode = nodes.find((n) => n.id === params.source);

        // Auto-enable LLM execution on target node (tight coupling)
        if (isLLM) {
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
              if (n.id === params.target) {
                if (
                  n.type === LANGGRAPH_CANVAS_NODE_LLM_REF &&
                  srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM
                ) {
                  const masterLabel = srcNode.data.label || "LLM";
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmRef: srcNode.id,
                      label: `${masterLabel} (Ref)`,
                    },
                  };
                }

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

        if (isTool) {
          if (srcNode?.type === LANGGRAPH_CANVAS_NODE_TOOL) {
            setNodes((nds) =>
              nds.map((n) => {
                if (
                  n.id === params.target &&
                  n.type === LANGGRAPH_CANVAS_NODE_TOOL_REF
                ) {
                  const masterLabel =
                    srcNode.data.name || srcNode.data.label || "Tool";
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      toolRef: srcNode.id,
                      label: `${masterLabel} (Ref)`,
                    },
                  };
                }
                return n;
              }),
            );
          }
        }

        if (isMiddleware) {
          setNodes((nds) =>
            nds.map((n) => {
              if (
                n.id === params.target &&
                (n.type === LANGGRAPH_CANVAS_NODE_NODE ||
                  n.type === LANGGRAPH_CANVAS_NODE_AGENT)
              ) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    middlewareConfig: {
                      ...(n.data.middlewareConfig || {}),
                      enabled: true,
                    },
                  },
                };
              }
              if (
                n.id === params.target &&
                n.type === LANGGRAPH_CANVAS_NODE_STEP
              ) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    middlewareConfig: {
                      ...(n.data.middlewareConfig || {}),
                      enabled: true,
                    },
                  },
                };
              }
              return n;
            }),
          );
        }

        const targetNode = nodes.find((n) => n.id === params.target);
        if (
          (isLLM && targetNode?.type === LANGGRAPH_CANVAS_NODE_LLM_REF) ||
          (isTool && targetNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF) ||
          (isMiddleware && targetNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF)
        ) {
          // Reference edge is automatically managed by the Ref node's effect
          return eds;
        }

        let edgeSource = params.source;
        if (
          isLLM &&
          srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM &&
          targetNode &&
          targetNode.type !== LANGGRAPH_CANVAS_NODE_LLM_REF
        ) {
          const refId = `llm_ref_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
          const masterLabel = srcNode.data.label || srcNode.data.model || "LLM";
          const newLLMRefNode: LangGraphLLMRefNode = {
            id: refId,
            type: LANGGRAPH_CANVAS_NODE_LLM_REF,
            position: {
              x: targetNode.position.x - 320,
              y: targetNode.position.y,
            },
            data: {
              label: `${masterLabel} (Ref)`,
              refId,
              llmRef: srcNode.id,
              onDeleteLLMRef: () => {
                setNodes((all) => all.filter((n) => n.id !== refId));
                setEdges((allEds) =>
                  allEds.filter(
                    (e) => e.source !== refId && e.target !== refId,
                  ),
                );
              },
            },
          };
          setNodes((nds) => [...nds, newLLMRefNode]);
          edgeSource = refId;
        } else if (
          isMiddleware &&
          srcNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE &&
          targetNode &&
          targetNode.type !== LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF
        ) {
          const refId = `mw_ref_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
          const masterLabel =
            (srcNode.data as { name?: string; label?: string }).name ||
            (srcNode.data as { label?: string }).label ||
            "Middleware";
          const newMwRefNode: LangGraphMiddlewareRefNode = {
            id: refId,
            type: LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF,
            position: {
              x: targetNode.position.x - 320,
              y: targetNode.position.y + 160,
            },
            data: {
              label: `${masterLabel} (Ref)`,
              refId,
              middlewareRef: srcNode.id,
              onDeleteMiddlewareRef: () => {
                setNodes((all) => all.filter((n) => n.id !== refId));
                setEdges((allEds) =>
                  allEds.filter(
                    (e) => e.source !== refId && e.target !== refId,
                  ),
                );
              },
            },
          };
          setNodes((nds) => [...nds, newMwRefNode]);
          edgeSource = refId;
        }

        const filteredEds = isLLM
          ? eds.filter(
              (e) =>
                !(e.target === params.target && e.targetHandle === HANDLE_LLM_IN),
            )
          : eds;

        return addEdge(
          {
            ...params,
            source: edgeSource,
            sourceHandle,
            targetHandle,
            animated: true,
            ...(label ? { label, labelStyle, labelBgStyle } : {}),
            style,
          },
          filteredEds,
        );
      }),
    [nodes, isValidConnection, setEdges, setNodes],
  );

  return {
    onNodesChange,
    onEdgesChange,
    isValidConnection,
    onConnect,
  };
}
