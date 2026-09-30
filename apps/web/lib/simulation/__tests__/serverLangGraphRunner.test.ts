import { describe, it, expect } from "vitest";
import { executeServerLangGraph, clearServerThread } from "../serverLangGraphRunner";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphStateChannel,
  StepNodeData,
} from "@workspace/canvas";

describe("executeServerLangGraph: Official @langchain/langgraph StateGraph Execution", () => {
  it("compiles and executes a custom code step and updates StateGraph state", async () => {
    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "step_calc",
        type: "step",
        position: { x: 200, y: 0 },
        data: {
          label: "Calculator Step",
          stepId: "step_calc",
          stepType: "custom_code",
          customCode: {
            body: "return { count: (state.count || 0) + 10, processed: true };",
          },
        },
      },
      {
        id: "END",
        type: "end",
        position: { x: 400, y: 0 },
        data: { label: "END" },
      },
    ];

    const edges: LangGraphCanvasEdge[] = [
      {
        id: "e1",
        source: "START",
        target: "step_calc",
      },
      {
        id: "e2",
        source: "step_calc",
        target: "END",
      },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "count", type: "number", reducer: "replace", defaultValue: 0 },
      { key: "processed", type: "boolean", reducer: "replace", defaultValue: false },
    ];

    const result = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: { count: 5 },
      threadId: "test-thread-calc",
    });

    expect(result.error).toBeUndefined();
    expect(result.visitedNodes).toEqual(["START", "step_calc", "END"]);
    expect(result.finalState.count).toBe(15);
    expect(result.finalState.processed).toBe(true);
    expect(result.trace.length).toBeGreaterThanOrEqual(3);
  });

  it("handles multi-turn conversation memory with official StateGraph MemorySaver", async () => {
    const threadId = `test-thread-mem-${Date.now()}`;
    clearServerThread(threadId);

    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "step_append",
        type: "step",
        position: { x: 200, y: 0 },
        data: {
          label: "Log Appender",
          stepId: "step_append",
          stepType: "custom_code",
          customCode: {
            body: "return { logs: ['entry_' + (state.stepCount || 0)], stepCount: (state.stepCount || 0) + 1 };",
          },
        },
      },
      {
        id: "END",
        type: "end",
        position: { x: 400, y: 0 },
        data: { label: "END" },
      },
    ];

    const edges: LangGraphCanvasEdge[] = [
      { id: "e1", source: "START", target: "step_append" },
      { id: "e2", source: "step_append", target: "END" },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "logs", type: "array", reducer: "append", defaultValue: [] },
      { key: "stepCount", type: "number", reducer: "replace", defaultValue: 0 },
    ];

    // Turn 1
    const res1 = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: {},
      threadId,
    });

    expect(res1.error).toBeUndefined();
    expect(res1.finalState.stepCount).toBe(1);
    expect(res1.finalState.logs).toEqual(["entry_0"]);

    // Turn 2 in the same thread: Checkpointer must preserve and accumulate previous state!
    const res2 = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: {},
      threadId,
    });

    expect(res2.error).toBeUndefined();
    expect(res2.finalState.stepCount).toBe(2);
    expect(res2.finalState.logs).toEqual(["entry_0", "entry_1"]);

    clearServerThread(threadId);
  });
});
