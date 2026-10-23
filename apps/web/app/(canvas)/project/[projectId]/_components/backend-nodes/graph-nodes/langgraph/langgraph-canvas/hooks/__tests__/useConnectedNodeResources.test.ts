import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  getConnectedNodeResources,
  useConnectedNodeResources,
  type MinimalCanvasEdge,
} from "../useConnectedNodeResources";
import {
  HANDLE_LLM_IN,
  HANDLE_TOOL_IN,
  HANDLE_MIDDLEWARE_IN,
  HANDLE_MEMORY_IN,
} from "../../constants";

describe("useConnectedNodeResources & getConnectedNodeResources", () => {
  it("returns empty/null resources when nodeId is null or undefined", () => {
    const res = getConnectedNodeResources(null, []);
    expect(res).toEqual({
      connectedLLMId: null,
      connectedToolIds: [],
      connectedMiddlewareIds: [],
      connectedMemoryIds: [],
      connectedToolsCount: 0,
      connectedMiddlewareCount: 0,
    });
  });

  it("extracts connected resources correctly for a given target node", () => {
    const edges: MinimalCanvasEdge[] = [
      { source: "llm_1", target: "node_agent_1", targetHandle: HANDLE_LLM_IN },
      { source: "tool_1", target: "node_agent_1", targetHandle: HANDLE_TOOL_IN },
      { source: "tool_2", target: "node_agent_1", targetHandle: HANDLE_TOOL_IN },
      { source: "mw_1", target: "node_agent_1", targetHandle: HANDLE_MIDDLEWARE_IN },
      { source: "mem_1", target: "node_agent_1", targetHandle: HANDLE_MEMORY_IN },
      // Edge for different node
      { source: "tool_3", target: "node_agent_2", targetHandle: HANDLE_TOOL_IN },
    ];

    const res = getConnectedNodeResources("node_agent_1", edges);
    expect(res.connectedLLMId).toBe("llm_1");
    expect(res.connectedToolIds).toEqual(["tool_1", "tool_2"]);
    expect(res.connectedMiddlewareIds).toEqual(["mw_1"]);
    expect(res.connectedMemoryIds).toEqual(["mem_1"]);
    expect(res.connectedToolsCount).toBe(2);
    expect(res.connectedMiddlewareCount).toBe(1);
  });

  it("works with renderHook reactive memoization", () => {
    const edges: MinimalCanvasEdge[] = [
      { source: "llm_abc", target: "my_agent", targetHandle: HANDLE_LLM_IN },
    ];

    const { result, rerender } = renderHook(
      ({ nodeId, edgesList }: { nodeId: string; edgesList: MinimalCanvasEdge[] }) =>
        useConnectedNodeResources(nodeId, edgesList),
      {
        initialProps: { nodeId: "my_agent", edgesList: edges },
      },
    );

    expect(result.current.connectedLLMId).toBe("llm_abc");
    expect(result.current.connectedToolIds).toEqual([]);

    // Update props
    rerender({
      nodeId: "my_agent",
      edgesList: [
        ...edges,
        { source: "tool_xyz", target: "my_agent", targetHandle: HANDLE_TOOL_IN },
      ],
    });

    expect(result.current.connectedToolIds).toEqual(["tool_xyz"]);
  });
});
