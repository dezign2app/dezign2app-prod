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

    const memoryConfig = { enabled: true, checkpointer: "memory" as const };

    // Turn 1
    const res1 = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: {},
      threadId,
      memoryConfig,
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
      memoryConfig,
    });

    expect(res2.error).toBeUndefined();
    expect(res2.finalState.stepCount).toBe(2);
    expect(res2.finalState.logs).toEqual(["entry_0", "entry_1"]);

    clearServerThread(threadId);
  });

  it("compiles and executes graphs containing an AgentRef loop node (e.g. Router -> AgentRef -> Master Agent)", async () => {
    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "agent_node",
        type: "step",
        position: { x: 150, y: 0 },
        data: {
          label: "Agent Node",
          stepId: "agent_node",
          stepType: "custom_code",
          customCode: {
            body: "return { count: (state.count || 0) + 1 };",
          },
        },
      },
      {
        id: "router_node",
        type: "step",
        position: { x: 300, y: 0 },
        data: {
          label: "Conditional Router",
          stepId: "router_node",
          stepType: "router",
          routerConfig: {
            branches: [
              { id: "branch_agent", label: "Loop to Agent", field: "count", operator: "eq", value: "1" },
              { id: "branch_end", label: "Exit to END", field: "count", operator: "gte", value: "2" },
            ],
          },
        },
      },
      {
        id: "agent_ref_1",
        type: "langgraph_agent_ref",
        position: { x: 450, y: 100 },
        data: {
          label: "Agent Node Ref",
          refId: "agent_node",
          agentRef: "agent_node",
        },
      },
      {
        id: "END",
        type: "end",
        position: { x: 600, y: 0 },
        data: { label: "END" },
      },
    ];

    const edges: LangGraphCanvasEdge[] = [
      { id: "e1", source: "START", target: "agent_node" },
      { id: "e2", source: "agent_node", target: "router_node" },
      { id: "e3", source: "router_node", target: "agent_ref_1", sourceHandle: "branch_agent" },
      { id: "e4", source: "router_node", target: "END", sourceHandle: "branch_end" },
      // Reference edge between master node and ref node (present on real canvas)
      { id: "edge-agent-ref-link-agent_node-agent_ref_1", source: "agent_node", target: "agent_ref_1", type: "langgraph-reference" },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "count", type: "number", reducer: "replace", defaultValue: 0 },
    ];

    const result = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: { count: 0 },
      threadId: "test-thread-agent-ref",
    });

    expect(result.error).toBeUndefined();
    expect(result.finalState.count).toBe(2);
    expect(result.visitedNodes).toContain("agent_ref_1");
    expect(result.visitedNodes[result.visitedNodes.length - 1]).toBe("END");
  });

  it("executes an AgentNode (langgraph_node) with llmConfig.enabled = false as a state mutator without requiring prompt messages", async () => {
    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "node_counter",
        type: "langgraph_node",
        position: { x: 200, y: 0 },
        data: {
          label: "Counter Node",
          name: "Node",
          llmConfig: {
            enabled: false,
          },
          stateUpdates: [
            {
              channelKey: "count",
              source: "expression",
              value: "state.count + 1",
            },
          ],
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
      { id: "e1", source: "START", target: "node_counter" },
      { id: "e2", source: "node_counter", target: "END" },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "count", type: "number", reducer: "replace", defaultValue: 0 },
    ];

    const result = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: { count: 10 },
      threadId: "test-thread-agent-no-llm",
    });

    expect(result.error).toBeUndefined();
    expect(result.visitedNodes).toEqual(["START", "node_counter", "END"]);
    expect(result.finalState.count).toBe(11);
  });

  it("executes a reusable TransformerNode connected to a StepNode via edge", async () => {
    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "step_transform",
        type: "step",
        position: { x: 200, y: 0 },
        data: {
          label: "Data Transformer Step",
          stepId: "step_transform",
          stepType: "transformer",
          stateUpdates: [
            {
              channelKey: "summary",
              value: "summary",
            },
          ],
        },
      },
      {
        id: "transformer_calc",
        type: "transformer",
        position: { x: 200, y: 200 },
        data: {
          label: "ScoreSummarizer",
          functionName: "scoreSummarizer",
          scope: "global",
          inputSchema: [
            { id: "p1", name: "score", type: "number", required: true },
          ],
          code: `
            return {
              summary: "Score is " + (inputs.score || state.score) + " points",
              passed: (inputs.score || state.score) >= 50,
            };
          `,
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
      { id: "e1", source: "START", target: "step_transform" },
      { id: "e2", source: "step_transform", target: "END" },
      {
        id: "e-tr",
        source: "transformer_calc",
        target: "step_transform",
        sourceHandle: "transformer-out",
        targetHandle: "transformer_in",
      },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "score", type: "number", reducer: "replace", defaultValue: 0 },
      { key: "summary", type: "string", reducer: "replace", defaultValue: "" },
      { key: "passed", type: "boolean", reducer: "replace", defaultValue: false },
    ];

    const result = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: { score: 75 },
      threadId: "test-thread-reusable-transformer",
    });

    expect(result.error).toBeUndefined();
    expect(result.visitedNodes).toEqual(["START", "step_transform", "END"]);
    expect(result.finalState.summary).toBe("Score is 75 points");
    expect(result.finalState.passed).toBe(true);
  });

  it("maps output of above steps to below steps using inputBindings in pipelineSteps (similar to PipelineStepEditor)", async () => {
    const nodes: LangGraphCanvasNode[] = [
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "step_multi",
        type: "step",
        position: { x: 200, y: 0 },
        data: {
          label: "Multi Step Pipeline",
          stepId: "step_multi",
          stepType: "transformer",
          pipelineSteps: [
            // Above step 0: extracts & prepares user payload
            {
              id: "step_extract",
              name: "Extract User",
              type: "transform",
              outputVariable: "extractedUser",
              customCode: `
                return {
                  userId: "usr_99",
                  score: (state.rawScore || 0) * 2,
                  tier: "VIP",
                };
              `,
            },
            // Below step 1: maps output of above step 0 (extractedUser.score and extractedUser.tier)
            {
              id: "step_enrich",
              name: "Enrich & Format",
              type: "transform",
              outputVariable: "enrichedResult",
              inputBindings: [
                {
                  argName: "userScore",
                  source: {
                    kind: "step_output",
                    stepId: "extractedUser",
                    field: "score",
                  },
                },
                {
                  argName: "userTier",
                  source: {
                    kind: "step_output",
                    stepId: "step_extract",
                    field: "tier",
                  },
                },
                {
                  argName: "envPrefix",
                  source: {
                    kind: "inline",
                    value: "STATUS",
                  },
                },
              ],
              customCode: `
                // Inputs destructured into local scope: userScore, userTier, envPrefix
                return {
                  badge: envPrefix + ": " + userTier + " with score " + userScore,
                  eligible: userScore >= 100,
                };
              `,
            },
          ],
          stateUpdates: [
            {
              channelKey: "summary",
              value: "enrichedResult.badge",
            },
          ],
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
      { id: "e1", source: "START", target: "step_multi" },
      { id: "e2", source: "step_multi", target: "END" },
    ];

    const stateChannels: LangGraphStateChannel[] = [
      { key: "rawScore", type: "number", reducer: "replace", defaultValue: 0 },
      { key: "summary", type: "string", reducer: "replace", defaultValue: "" },
      { key: "eligible", type: "boolean", reducer: "replace", defaultValue: false },
    ];

    const result = await executeServerLangGraph({
      nodes,
      edges,
      stateChannels,
      inputChannels: [],
      inputValues: { rawScore: 60 },
      threadId: "test-thread-pipeline-steps-mapping",
    });

    expect(result.error).toBeUndefined();
    expect(result.visitedNodes).toEqual(["START", "step_multi", "END"]);
    expect(result.finalState.summary).toBe("STATUS: VIP with score 120");
    expect(result.finalState.eligible).toBe(true);
  });
});

