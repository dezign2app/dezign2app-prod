import { END } from "@langchain/langgraph";
import type { LangGraphCanvasNode, LangGraphCanvasEdge } from "@workspace/canvas";

export function filterFlowEdges(edges: LangGraphCanvasEdge[]): LangGraphCanvasEdge[] {
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

export function createTargetNodeResolver(
  nodes: LangGraphCanvasNode[],
  executableNodes: LangGraphCanvasNode[],
): (rawTargetId: string | undefined) => string | typeof END {
  return (rawTargetId: string | undefined): string | typeof END => {
    if (!rawTargetId || rawTargetId === "END" || rawTargetId.startsWith("end_")) {
      return END;
    }

    let currentId = rawTargetId;
    const visitedRefs = new Set<string>();

    while (currentId && !visitedRefs.has(currentId)) {
      visitedRefs.add(currentId);
      const targetNode = nodes.find((n) => n.id === currentId);
      if (!targetNode) break;

      if (
        targetNode.type === "langgraph_agent_ref" ||
        targetNode.type === "langgraph_node_ref"
      ) {
        const refData = targetNode.data as { agentRef?: string; nodeRef?: string } | undefined;
        const masterId = refData?.agentRef || refData?.nodeRef;
        if (masterId) {
          if (masterId === "END" || masterId.startsWith("end_")) {
            return END;
          }
          currentId = masterId;
          continue;
        }
      }
      break;
    }

    if (currentId === "END" || currentId.startsWith("end_")) {
      return END;
    }

    // Ensure the target is actually an executable node in builder
    const isTargetExecutable = executableNodes.some((n) => n.id === currentId);
    if (!isTargetExecutable) {
      console.warn(`[serverLangGraphRunner] Target node "${currentId}" is not executable. Falling back to END.`);
      return END;
    }

    return currentId;
  };
}
