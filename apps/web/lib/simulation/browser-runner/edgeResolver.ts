import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
} from "@workspace/canvas";
import type { BrowserAddLogFn } from "./types";

/**
 * Filter out non-flow canvas edges (reference edges and slot bindings like llm_in, tool_in, etc.)
 */
export function filterBrowserFlowEdges(edges: LangGraphCanvasEdge[]): LangGraphCanvasEdge[] {
  return edges.filter(
    (e) =>
      e.type !== "langgraph-reference" &&
      e.targetHandle !== "llm_in" &&
      e.targetHandle !== "tool_in" &&
      e.targetHandle !== "middleware_in" &&
      e.targetHandle !== "memory_in" &&
      e.targetHandle !== "state_in" &&
      e.sourceHandle !== "llm_out" &&
      e.sourceHandle !== "tool_out" &&
      e.sourceHandle !== "middleware_out" &&
      e.sourceHandle !== "memory_out" &&
      e.sourceHandle !== "state_out",
  );
}

export interface ResolveNextNodeParams {
  currentNodeId: string;
  outputDelta: Record<string, unknown>;
  flowEdges: LangGraphCanvasEdge[];
  nodes: LangGraphCanvasNode[];
  addLog?: BrowserAddLogFn;
}

export interface ResolveNextNodeResult {
  nextNodeId?: string;
  loopbackNodeId?: string;
}

/**
 * Determine the next node to execute based on router decisions or outgoing flow edges,
 * and dereference any loopback reference nodes (langgraph_agent_ref / langgraph_node_ref).
 */
export function resolveBrowserNextNode(params: ResolveNextNodeParams): ResolveNextNodeResult {
  const { currentNodeId, outputDelta, flowEdges, nodes, addLog } = params;

  const outgoing = flowEdges.filter((e) => e.source === currentNodeId);
  if (outgoing.length === 0) return { nextNodeId: undefined };

  const routerInfo = outputDelta.router as Record<string, unknown> | undefined;
  let nextNodeId = routerInfo?.targetNodeId
    ? (routerInfo.targetNodeId as string)
    : outgoing[0]?.target;

  let loopbackNodeId: string | undefined;

  // If target node is a loop-back / Agent Ref node, resolve back to the master referenced node
  if (nextNodeId) {
    const candidateNext = nodes.find((n) => n.id === nextNodeId);
    if (
      candidateNext?.type === "langgraph_agent_ref" ||
      candidateNext?.type === "langgraph_node_ref"
    ) {
      const refData = candidateNext.data as { agentRef?: string; nodeRef?: string; label?: string };
      const masterTargetId = refData?.agentRef || refData?.nodeRef;
      if (masterTargetId) {
        addLog?.(
          "step",
          `Looping back to node "${masterTargetId}" via loop reference "${refData.label || candidateNext.id}"`,
        );
        loopbackNodeId = candidateNext.id;
        nextNodeId = masterTargetId;
      }
    }
  }

  return { nextNodeId, loopbackNodeId };
}

/**
 * Attach generic connected tools and middleware metadata to output delta for any node
 */
export function attachConnectedToolsAndMiddleware(params: {
  node: LangGraphCanvasNode;
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
  outputDelta: Record<string, unknown>;
  addLog: BrowserAddLogFn;
}): void {
  const { node, nodes, edges, outputDelta, addLog } = params;

  const connectedTools = edges
    .filter((e) => e.target === node.id && (e.targetHandle === "tool_in" || e.targetHandle?.includes("tool")))
    .map((e) => {
      const tn = nodes.find((n) => n.id === e.source);
      const data = tn?.data as { name?: string; label?: string; source?: string } | undefined;
      return {
        id: tn?.id || e.source,
        name: data?.name || data?.label || "Tool",
        source: data?.source,
      };
    });

  const connectedMiddleware = edges
    .filter((e) => e.target === node.id && (e.targetHandle === "middleware_in" || e.targetHandle?.includes("middleware")))
    .map((e) => {
      const mn = nodes.find((n) => n.id === e.source);
      const data = mn?.data as { name?: string; label?: string; middlewareType?: string } | undefined;
      return {
        id: mn?.id || e.source,
        name: data?.name || data?.label || "Middleware",
        type: data?.middlewareType,
      };
    });

  if (connectedTools.length > 0) {
    outputDelta.tools = connectedTools;
    addLog("tool", `Connected tools (${connectedTools.length}): ${connectedTools.map((t) => t.name).join(", ")}`);
  }
  if (connectedMiddleware.length > 0) {
    outputDelta.middleware = connectedMiddleware;
    addLog("middleware", `Connected middleware (${connectedMiddleware.length}): ${connectedMiddleware.map((m) => m.name).join(", ")}`);
  }
}

