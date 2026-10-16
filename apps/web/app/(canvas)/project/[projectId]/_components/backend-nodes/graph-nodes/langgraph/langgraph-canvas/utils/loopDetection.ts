import type { LangGraphCanvasNode, LangGraphCanvasEdge } from "@workspace/canvas";

export interface LoopWarning {
  id: string;
  type: "dead_end_cycle" | "unconditional_cycle" | "self_loop";
  cycleNodeIds: string[];
  cycleLabels: string[];
  message: string;
  severity: "error" | "warning";
}

export interface DetectInfiniteLoopsOptions {
  nodes: LangGraphCanvasNode[];
  edges: LangGraphCanvasEdge[];
}

/**
 * Identifies infinite loops in a LangGraph canvas graph:
 * 1. Dead-end cycles: Loops from which no node can reach the END state.
 * 2. Unconditional cycles: Loops where every edge is default/unconditional with no conditional router to exit.
 * 3. Unconditional self-loops: A node with an unconditional edge back to itself.
 */
export function detectInfiniteLoops({
  nodes,
  edges,
}: DetectInfiniteLoopsOptions): LoopWarning[] {
  if (!nodes || nodes.length === 0 || !edges || edges.length === 0) {
    return [];
  }

  // 1. Filter to execution flow edges only (ignore resource links like llm_in, tool_in, memory_in, reference)
  const flowEdges = edges.filter(
    (e) =>
      e.type !== "langgraph-reference" &&
      e.targetHandle !== "llm_in" &&
      e.targetHandle !== "tool_in" &&
      e.targetHandle !== "middleware_in" &&
      e.targetHandle !== "memory_in" &&
      e.sourceHandle !== "llm_out" &&
      e.sourceHandle !== "tool_out" &&
      e.sourceHandle !== "middleware_out" &&
      e.sourceHandle !== "memory_out",
  );

  const nodeMap = new Map<string, LangGraphCanvasNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  // Helper to get friendly node label
  const getNodeLabel = (id: string): string => {
    if (id === "START") return "START";
    if (id === "END") return "END";
    const node = nodeMap.get(id);
    if (!node) return id;
    const data = node.data as { label?: string; name?: string } | undefined;
    return data?.label || data?.name || id;
  };

  // Helper to resolve an AgentRef or NodeRef to its master node
  const getMasterTargetId = (nodeId: string): string | null => {
    const node = nodeMap.get(nodeId);
    if (!node) return null;
    if (
      node.type === "langgraph_agent_ref" ||
      node.type === "langgraph_node_ref"
    ) {
      const data = node.data as { agentRef?: string; nodeRef?: string } | undefined;
      return data?.agentRef || data?.nodeRef || null;
    }
    return null;
  };

  // 2. Build forward adjacency list and record edge conditionality
  // u -> Array<{ target: string; isConditional: boolean; edgeId: string; viaRef?: string }>
  interface OutgoingEdge {
    target: string;
    isConditional: boolean;
    edgeId: string;
    refNodeId?: string;
  }

  const forwardAdj = new Map<string, OutgoingEdge[]>();
  const reverseAdj = new Map<string, string[]>();

  for (const n of nodes) {
    forwardAdj.set(n.id, []);
    reverseAdj.set(n.id, []);
  }
  if (!forwardAdj.has("START")) forwardAdj.set("START", []);
  if (!forwardAdj.has("END")) forwardAdj.set("END", []);
  if (!reverseAdj.has("START")) reverseAdj.set("START", []);
  if (!reverseAdj.has("END")) reverseAdj.set("END", []);

  for (const edge of flowEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // Determine if this edge is conditional
    const sourceData = sourceNode?.data as {
      stepType?: string;
      routerConfig?: { branches?: unknown[] };
    } | undefined;
    const isRouterSource =
      sourceData?.stepType === "router" ||
      Boolean(sourceData?.routerConfig?.branches && sourceData.routerConfig.branches.length > 0);
    const hasBranchHandle = Boolean(
      edge.sourceHandle &&
        (edge.sourceHandle.startsWith("branch_") || edge.sourceHandle === "conditional"),
    );
    const edgeData = edge.data as { condition?: unknown; isDefault?: boolean } | undefined;
    const isConditional =
      Boolean(edgeData?.condition) ||
      isRouterSource ||
      hasBranchHandle;

    // Check if target is an AgentRef/NodeRef node that redirects
    const masterTarget = getMasterTargetId(edge.target);
    if (masterTarget && nodeMap.has(masterTarget)) {
      // Connect to the ref node AND route to the master target
      const list = forwardAdj.get(edge.source) || [];
      list.push({
        target: masterTarget,
        isConditional,
        edgeId: edge.id,
        refNodeId: edge.target,
      });
      forwardAdj.set(edge.source, list);

      // Reverse adjacency for reachability
      const revList = reverseAdj.get(masterTarget) || [];
      revList.push(edge.source);
      reverseAdj.set(masterTarget, revList);
      if (edge.target) {
        const revRefList = reverseAdj.get(edge.target) || [];
        revRefList.push(edge.source);
        reverseAdj.set(edge.target, revRefList);
      }
    } else {
      const list = forwardAdj.get(edge.source) || [];
      list.push({
        target: edge.target,
        isConditional,
        edgeId: edge.id,
      });
      forwardAdj.set(edge.source, list);

      const revList = reverseAdj.get(edge.target) || [];
      revList.push(edge.source);
      reverseAdj.set(edge.target, revList);
    }
  }

  // 3. Reverse BFS from all END states to identify all nodes that can reach END
  const endNodes = nodes.filter(
    (n) => n.id === "END" || n.type === "end" || n.id.startsWith("end_"),
  );
  const endNodeIds = new Set<string>(endNodes.map((n) => n.id));
  endNodeIds.add("END");

  const canReachEnd = new Set<string>();
  const queue: string[] = Array.from(endNodeIds);
  for (const id of queue) {
    canReachEnd.add(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const incoming = reverseAdj.get(current) || [];
    for (const prev of incoming) {
      if (!canReachEnd.has(prev)) {
        canReachEnd.add(prev);
        queue.push(prev);
      }
    }
  }

  // 4. Find all elementary cycles using DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const pathStack: { node: string; refNodeId?: string }[] = [];
  const rawCycles: { path: string[]; refs: (string | undefined)[] }[] = [];

  const dfs = (u: string) => {
    visited.add(u);
    recStack.add(u);

    const outgoing = forwardAdj.get(u) || [];
    for (const edge of outgoing) {
      const v = edge.target;
      pathStack.push({ node: v, refNodeId: edge.refNodeId });

      if (!visited.has(v)) {
        dfs(v);
      } else if (recStack.has(v)) {
        // Back edge detected: extract cycle
        const cycleStartIndex = pathStack.findIndex((item) => item.node === v);
        if (cycleStartIndex !== -1) {
          const cycleSlice = pathStack.slice(cycleStartIndex);
          const path = [v, ...cycleSlice.map((item) => item.node)];
          const refs = cycleSlice.map((item) => item.refNodeId);
          rawCycles.push({ path, refs });
        }
      }

      pathStack.pop();
    }

    recStack.delete(u);
  };

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      pathStack.push({ node: n.id });
      dfs(n.id);
      pathStack.pop();
    }
  }

  // 5. Canonicalize and analyze cycles
  const warnings: LoopWarning[] = [];
  const seenCycleKeys = new Set<string>();

  for (const cycle of rawCycles) {
    // Unique node IDs in the cycle (excluding the repeated tail)
    const uniqueNodes = Array.from(new Set(cycle.path.slice(0, -1)));
    if (uniqueNodes.length === 0) continue;

    // Canonical key: rotate to start with smallest ID to deduplicate identical cycles
    const minNode = [...uniqueNodes].sort()[0];
    if (!minNode) continue;
    const minIndex = uniqueNodes.indexOf(minNode);
    const canonicalCycle = [
      ...uniqueNodes.slice(minIndex),
      ...uniqueNodes.slice(0, minIndex),
    ];
    const canonicalKey = canonicalCycle.join("->");

    if (seenCycleKeys.has(canonicalKey)) continue;
    seenCycleKeys.add(canonicalKey);

    // Build human-friendly label sequence including any AgentRef intermediary
    const displayLabels: string[] = [];
    const displayIds: string[] = [];

    for (let i = 0; i < uniqueNodes.length; i++) {
      const curr = uniqueNodes[i];
      if (!curr) continue;
      displayIds.push(curr);
      displayLabels.push(getNodeLabel(curr));

      // Check if this transition went through an AgentRef node
      const refId = cycle.refs[i];
      if (refId && refId !== curr && nodeMap.has(refId)) {
        displayIds.push(refId);
        displayLabels.push(getNodeLabel(refId));
      }
    }
    // Append the cycle loop-back label
    if (displayLabels.length > 0 && displayLabels[0]) {
      displayLabels.push(displayLabels[0]);
    }

    // Check A: Does ANY node in this cycle have a path to END?
    const cycleCanReachEnd = uniqueNodes.some((id) => canReachEnd.has(id));

    if (!cycleCanReachEnd) {
      warnings.push({
        id: `dead_end_${canonicalKey}`,
        type: "dead_end_cycle",
        cycleNodeIds: displayIds,
        cycleLabels: displayLabels,
        message: `Infinite loop detected: Cycle [${displayLabels.join(" → ")}] has no path to the END state.`,
        severity: "error",
      });
      continue;
    }

    // Check B: Does the cycle have any conditional exit path?
    // A cycle has a safe exit if at least one node in the cycle has an outgoing edge
    // that is conditional or branches outside the cycle towards END.
    let hasConditionalExit = false;

    for (const nodeId of uniqueNodes) {
      const outgoing = forwardAdj.get(nodeId) || [];
      const node = nodeMap.get(nodeId);
      const data = node?.data as {
        stepType?: string;
        routerConfig?: { branches?: unknown[] };
        tools?: unknown[];
      } | undefined;

      // An agent or LLM step with attached tools is naturally conditional in LangGraph
      // (the LLM decides whether to call a tool or finish)
      const hasToolExit = Boolean(data?.tools && data.tools.length > 0);
      if (hasToolExit) {
        hasConditionalExit = true;
        break;
      }

      // Check if there's an outgoing edge pointing outside the cycle towards END
      for (const edge of outgoing) {
        if (!uniqueNodes.includes(edge.target) && canReachEnd.has(edge.target)) {
          // If the node has multiple outgoing edges, or this edge is conditional, it's a valid exit!
          if (edge.isConditional || outgoing.length > 1) {
            hasConditionalExit = true;
            break;
          }
        }
      }

      if (hasConditionalExit) break;
    }

    if (!hasConditionalExit) {
      warnings.push({
        id: `unconditional_${canonicalKey}`,
        type: "unconditional_cycle",
        cycleNodeIds: displayIds,
        cycleLabels: displayLabels,
        message: `Unconditional loop detected: Cycle [${displayLabels.join(" → ")}] has no conditional router or branch to exit. It will loop indefinitely until recursion limit.`,
        severity: "warning",
      });
    }
  }

  return warnings;
}
