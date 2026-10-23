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
  type LangGraphToolRefNode,
  type MiddlewareNode,
  type OutputNode,
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
  LANGGRAPH_CANVAS_NODE_OUTPUT,
  LANGGRAPH_CANVAS_NODE_TRANSFORMER,
  LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF,
  LANGGRAPH_CANVAS_NODE_TYPES,
  LANGGRAPH_CANVAS_NODE_TYPES_REF,
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
  HANDLE_TRANSFORMER_IN,
  HANDLE_TRANSFORMER_OUT,
  HANDLE_TYPES_IN,
  HANDLE_TYPES_OUT,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
} from "../constants";

function isOutputNode(node: LangGraphCanvasNode): node is OutputNode {
  return node.type === LANGGRAPH_CANVAS_NODE_OUTPUT;
}

function isToolRefNode(node: LangGraphCanvasNode): node is LangGraphToolRefNode {
  return node.type === LANGGRAPH_CANVAS_NODE_TOOL_REF;
}

function isMiddlewareRefNode(
  node: LangGraphCanvasNode,
): node is LangGraphMiddlewareRefNode {
  return node.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF;
}

function isMiddlewareNode(node: LangGraphCanvasNode): node is MiddlewareNode {
  return node.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE;
}

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
    (changes: NodeChange<LangGraphCanvasNode>[]) => {
      // LangGraph canvas handles intentional node deletion directly via handleDeleteSelected / handleDeleteStep.
      // onNodesChange should never remove nodes while typing or from uncontrolled ReactFlow key events.
      const effectiveChanges = changes.filter((c) => c.type !== "remove");

      if (effectiveChanges.length === 0) return;

      setNodes((nds) => applyNodeChanges<LangGraphCanvasNode>(effectiveChanges, nds));
    },
    [setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Prevent accidental edge deletion when user is typing in an input/textarea/inspector
      const activeEl = typeof document !== "undefined" ? document.activeElement : null;
      const isTyping =
        activeEl instanceof HTMLElement &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.isContentEditable ||
          Boolean(
            activeEl.closest(
              "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox'], [data-inspector], .inspector-sidebar, .nodrag, .nowheel, .nopan, .nokey"
            )
          ));

      const effectiveChanges = isTyping
        ? changes.filter((c) => c.type !== "remove")
        : changes;

      const removedEdgeIds = new Set(
        effectiveChanges.filter((c) => c.type === "remove").map((c) => c.id),
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

          // Clear sourceStepId on Output nodes when their incoming step edge is removed
          const removedOutputEdges = removedEdges.filter((e) => {
            const targetNode = nodes.find((n) => n.id === e.target);
            return targetNode ? isOutputNode(targetNode) : false;
          });
          if (removedOutputEdges.length > 0) {
            const removedOutputTargetIds = new Set(removedOutputEdges.map((e) => e.target));
            setNodes((nds) =>
              nds.map((n) => {
                if (removedOutputTargetIds.has(n.id) && isOutputNode(n)) {
                  const hasRemaining = eds.some(
                    (e) => !removedEdgeIds.has(e.id) && e.target === n.id,
                  );
                  if (!hasRemaining) {
                    const updatedNode: OutputNode = {
                      ...n,
                      type: LANGGRAPH_CANVAS_NODE_OUTPUT,
                      data: {
                        ...n.data,
                        sourceStepId: undefined,
                      },
                    };
                    return updatedNode;
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
      const targetNode = nodes.find((n) => n.id === connection.target);

      const isAgentOrStepNode = (n?: LangGraphCanvasNode) =>
        n?.type === LANGGRAPH_CANVAS_NODE_NODE ||
        n?.type === LANGGRAPH_CANVAS_NODE_AGENT ||
        n?.type === LANGGRAPH_CANVAS_NODE_STEP;

      const isDirectMasterLLMAndAgent =
        (sourceNode?.type === LANGGRAPH_CANVAS_NODE_LLM &&
          isAgentOrStepNode(targetNode)) ||
        (isAgentOrStepNode(sourceNode) &&
          targetNode?.type === LANGGRAPH_CANVAS_NODE_LLM);

      if (isDirectMasterLLMAndAgent) {
        return true;
      }

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

      const isAgentOrStepTarget = isAgentOrStepNode(targetNode);

      // Only ToolRef nodes can connect to Agent/Step tool_in
      if (isAgentOrStepTarget && connection.targetHandle === HANDLE_TOOL_IN) {
        const isToolRefSource =
          sourceNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF ||
          Boolean(connection.source?.startsWith("tool_ref_"));
        if (!isToolRefSource) return false;

        // Restrict: Cannot attach the same master tool twice to the same agent
        if (edges) {
          const sourceMasterId =
            sourceNode && isToolRefNode(sourceNode)
              ? sourceNode.data.toolRef
              : sourceNode?.id;

          const alreadyAttached = edges.some((e) => {
            if (e.target !== connection.target || e.targetHandle !== HANDLE_TOOL_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode && isToolRefNode(existingNode)
                ? existingNode.data.toolRef
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
            sourceNode && isMiddlewareRefNode(sourceNode)
              ? sourceNode.data.middlewareRef
              : sourceNode?.id;

          const alreadyAttached = edges.some((e) => {
            if (e.target !== connection.target || e.targetHandle !== HANDLE_MIDDLEWARE_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode && isMiddlewareRefNode(existingNode)
                ? existingNode.data.middlewareRef
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

      const isTransformerSource =
        connection.sourceHandle === HANDLE_TRANSFORMER_OUT ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER ||
        sourceNode?.type === LANGGRAPH_CANVAS_NODE_TRANSFORMER_REF ||
        connection.source?.startsWith("transformer_") ||
        connection.source?.startsWith("transformer_ref_");
      const isTransformerTarget =
        connection.targetHandle === HANDLE_TRANSFORMER_IN;

      if (isTransformerSource && !isTransformerTarget) return false;
      if (isTransformerTarget && !isTransformerSource) return false;

      return true;
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => {
        if (!isValidConnection(params)) return eds;

        const srcNode = nodes.find((n) => n.id === params.source);
        const targetNode = nodes.find((n) => n.id === params.target);

        const isAgentOrStepNode = (n?: LangGraphCanvasNode) =>
          n?.type === LANGGRAPH_CANVAS_NODE_NODE ||
          n?.type === LANGGRAPH_CANVAS_NODE_AGENT ||
          n?.type === LANGGRAPH_CANVAS_NODE_STEP;

        // When a direct edge is drawn between Master LLM and Agent (in either direction),
        // automatically insert/connect an LLM ref node instead of connecting directly.
        const isDirectMasterLLMAndAgent =
          (srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM &&
            isAgentOrStepNode(targetNode)) ||
          (isAgentOrStepNode(srcNode) &&
            targetNode?.type === LANGGRAPH_CANVAS_NODE_LLM);

        if (isDirectMasterLLMAndAgent) {
          const masterLLMNode =
            srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM
              ? (srcNode as LangGraphLLMNode)
              : (targetNode as LangGraphLLMNode);
          const agentNode =
            srcNode?.type === LANGGRAPH_CANVAS_NODE_LLM
              ? targetNode!
              : srcNode!;

          // Find previously bound LLM edge targeting this agent
          const prevLlmEdge = eds.find(
            (e) =>
              e.target === agentNode.id && e.targetHandle === HANDLE_LLM_IN,
          );
          const prevLlmSourceId = prevLlmEdge?.source;
          const prevSourceNode = prevLlmSourceId
            ? nodes.find((n) => n.id === prevLlmSourceId)
            : null;

          const masterLabel =
            masterLLMNode.data.label || masterLLMNode.data.model || "LLM";
          const resolvedProvider =
            masterLLMNode.data.provider || DEFAULT_LLM_PROVIDER;
          const resolvedModel = masterLLMNode.data.model || DEFAULT_LLM_MODEL;
          const resolvedTemp = masterLLMNode.data.temperature;

          let actualRefId: string;

          if (prevSourceNode?.type === LANGGRAPH_CANVAS_NODE_LLM_REF) {
            // Update existing LLM Ref node to point to this master
            actualRefId = prevSourceNode.id;
            setNodes((nds) =>
              nds.map((n) => {
                if (
                  n.id === actualRefId &&
                  n.type === LANGGRAPH_CANVAS_NODE_LLM_REF
                ) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmRef: masterLLMNode.id,
                      label: `${masterLabel} (Ref)`,
                    },
                  };
                }
                if (n.id === agentNode.id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      llmConfig: {
                        ...(n.data.llmConfig || {}),
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
                    },
                  };
                }
                return n;
              }),
            );
          } else {
            // Create a new LLM Ref node for this agent
            actualRefId = `llm_ref_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
            const baseX = agentNode.position
              ? agentNode.position.x - 320
              : 200;
            const baseY = agentNode.position ? agentNode.position.y : 200;

            const newLLMRefNode: LangGraphLLMRefNode = {
              id: actualRefId,
              type: LANGGRAPH_CANVAS_NODE_LLM_REF,
              position: { x: baseX, y: baseY },
              data: {
                label: `${masterLabel} (Ref)`,
                refId: actualRefId,
                llmRef: masterLLMNode.id,
                onDeleteLLMRef: () => {
                  setNodes((all) => all.filter((n) => n.id !== actualRefId));
                  setEdges((allEds) =>
                    allEds.filter(
                      (e) =>
                        e.source !== actualRefId && e.target !== actualRefId,
                    ),
                  );
                },
              },
            };

            setNodes((nds) => {
              const filtered =
                prevLlmSourceId && prevLlmSourceId.startsWith("llm_ref")
                  ? nds.filter((n) => n.id !== prevLlmSourceId)
                  : nds;

              return [
                ...filtered.map((n) => {
                  if (n.id === agentNode.id) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        llmConfig: {
                          ...(n.data.llmConfig || {}),
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
                      },
                    };
                  }
                  return n;
                }),
                newLLMRefNode,
              ];
            });
          }

          // Filter out existing LLM edge targeting this agent (and any direct edge)
          const filteredEds = eds.filter(
            (e) =>
              !(e.target === agentNode.id && e.targetHandle === HANDLE_LLM_IN) &&
              !(
                (e.source === masterLLMNode.id && e.target === agentNode.id) ||
                (e.source === agentNode.id && e.target === masterLLMNode.id)
              ),
          );

          const newEdge: LangGraphCanvasEdge = {
            id: `xy-edge__${actualRefId}${HANDLE_LLM_OUT}-${agentNode.id}${HANDLE_LLM_IN}`,
            source: actualRefId,
            sourceHandle: HANDLE_LLM_OUT,
            target: agentNode.id,
            targetHandle: HANDLE_LLM_IN,
            animated: true,
            style: { stroke: "#38bdf8", strokeWidth: 2, strokeDasharray: "4 4" },
          };

          return [...filteredEds, newEdge];
        }

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
            srcNode && isToolRefNode(srcNode)
              ? srcNode.data.toolRef
              : srcNode?.id;

          const alreadyAttached = eds.some((e) => {
            if (e.target !== params.target || e.targetHandle !== HANDLE_TOOL_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode && isToolRefNode(existingNode)
                ? existingNode.data.toolRef
                : existingNode?.id;
            return existingMasterId === srcMasterId;
          });

          if (alreadyAttached) return eds;
        }

        if (isMiddleware) {
          const srcNode = nodes.find((n) => n.id === params.source);
          const srcMasterId =
            srcNode && isMiddlewareRefNode(srcNode)
              ? srcNode.data.middlewareRef
              : srcNode?.id;

          const alreadyAttached = eds.some((e) => {
            if (e.target !== params.target || e.targetHandle !== HANDLE_MIDDLEWARE_IN) return false;
            const existingNode = nodes.find((n) => n.id === e.source);
            const existingMasterId =
              existingNode && isMiddlewareRefNode(existingNode)
                ? existingNode.data.middlewareRef
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
        const isTransformer =
          params.sourceHandle === HANDLE_TRANSFORMER_OUT ||
          params.targetHandle === HANDLE_TRANSFORMER_IN ||
          Boolean(
            params.source?.startsWith("transformer_") ||
            params.source?.startsWith("transformer_ref_"),
          );
        const isTypes =
          params.sourceHandle === HANDLE_TYPES_OUT ||
          params.targetHandle === HANDLE_TYPES_IN ||
          Boolean(
            params.source?.startsWith("types_") ||
            params.source?.startsWith("types_ref_"),
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
                  : isTransformer
                    ? HANDLE_TRANSFORMER_OUT
                    : isTypes
                      ? HANDLE_TYPES_OUT
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
                  : isTransformer
                    ? HANDLE_TRANSFORMER_IN
                    : isTypes
                      ? HANDLE_TYPES_IN
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
              : isTransformer
                ? { stroke: "#a855f7", strokeWidth: 2, strokeDasharray: "4 4" }
                : isTypes
                  ? { stroke: "#06b6d4", strokeWidth: 2, strokeDasharray: "4 4" }
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

        if (isTypes) {
          if (srcNode?.type === LANGGRAPH_CANVAS_NODE_TYPES) {
            setNodes((nds) =>
              nds.map((n) => {
                if (
                  n.id === params.target &&
                  n.type === LANGGRAPH_CANVAS_NODE_TYPES_REF
                ) {
                  const masterLabel = srcNode.data.label || "Custom Types";
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      typesRef: srcNode.id,
                      label: `${masterLabel} (Ref)`,
                    },
                  };
                }
                return n;
              }),
            );
          }
        }

        // Auto-set sourceStepId when a step/agent/node connects to an Output node
        if (targetNode && isOutputNode(targetNode)) {
          const isFlowSource =
            srcNode?.type === LANGGRAPH_CANVAS_NODE_STEP ||
            srcNode?.type === LANGGRAPH_CANVAS_NODE_NODE ||
            srcNode?.type === LANGGRAPH_CANVAS_NODE_AGENT;
          if (isFlowSource && params.source) {
            const flowSourceId: string = params.source;
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === params.target && isOutputNode(n)) {
                  const updatedNode: OutputNode = {
                    ...n,
                    type: LANGGRAPH_CANVAS_NODE_OUTPUT,
                    data: {
                      ...n.data,
                      sourceStepId: flowSourceId,
                    },
                  };
                  return updatedNode;
                }
                return n;
              }),
            );
          }
        }
        if (
          (isLLM && targetNode?.type === LANGGRAPH_CANVAS_NODE_LLM_REF) ||
          (isTool && targetNode?.type === LANGGRAPH_CANVAS_NODE_TOOL_REF) ||
          (isMiddleware && targetNode?.type === LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF) ||
          (isTypes && targetNode?.type === LANGGRAPH_CANVAS_NODE_TYPES_REF)
        ) {
          // Reference edge is automatically managed by the Ref node's effect
          return eds;
        }

        let edgeSource = params.source;
        if (
          isMiddleware &&
          srcNode &&
          isMiddlewareNode(srcNode) &&
          targetNode &&
          targetNode.type !== LANGGRAPH_CANVAS_NODE_MIDDLEWARE_REF
        ) {
          const refId = `mw_ref_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
          const masterLabel =
            srcNode.data.name || srcNode.data.label || "Middleware";
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
