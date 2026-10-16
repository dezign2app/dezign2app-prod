import { describe, it, expect, vi } from "vitest";
import { executeBrowserLangGraph } from "../browserLangGraphRunner";
import type { LangGraphCanvasNode, LangGraphCanvasEdge, LangGraphStateChannel } from "@workspace/canvas";

// Mock indexedDB checkpointer
vi.mock("../indexedDBCheckpointer", () => ({
  saveBrowserCheckpoint: vi.fn().mockResolvedValue(undefined),
  getLatestBrowserCheckpoint: vi.fn().mockResolvedValue(null),
}));

describe("browserLangGraphRunner: Infinite Loop Guard", () => {
  it("flags an infinite loop when steps exceed safety limit without reaching END", async () => {
    // START -> Agent A -> AgentRef (loops back to Agent A)
    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "step_a",
        type: "step",
        position: { x: 100, y: 0 },
        data: {
          label: "Step A",
          stepId: "step_a",
          stepType: "custom_code",
          customCode: { body: "return { count: (state.count || 0) + 1 };" },
        },
      },
      {
        id: "ref_a",
        type: "langgraph_node_ref",
        position: { x: 200, y: 0 },
        data: {
          label: "Step A Ref",
          refId: "step_a",
          nodeRef: "step_a",
        },
      },
    ];

    const edges: LangGraphCanvasEdge[] = [
      { id: "e1", source: "START", target: "step_a" },
      { id: "e2", source: "step_a", target: "ref_a" },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
      { key: "count", type: "number", reducer: "replace", defaultValue: 0 },
    ];

    const result = await executeBrowserLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: { count: 0, messages: [{ role: "user", content: "hello" }] },
      threadId: "test-infinite-loop-thread",
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("Infinite loop detected");
    expect(result.trace.some((t) => t.status === "failed")).toBe(true);
    // Should NOT falsely report END as reached
    expect(result.visitedNodes[result.visitedNodes.length - 1]).not.toBe("END");
  });
});
