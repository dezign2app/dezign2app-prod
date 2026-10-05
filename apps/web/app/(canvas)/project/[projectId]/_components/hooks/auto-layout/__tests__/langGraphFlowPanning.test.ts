import { describe, it, expect, vi } from "vitest";
import {
  performLangGraphLayout,
  getLangGraphFlowNodes,
  isStartNode,
  isEndNode,
} from "../langGraphLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("LangGraph Auto Layout - Flow-focused Panning (START to END)", () => {
  it("identifies START and END nodes properly", () => {
    expect(isStartNode({ id: "START", type: "start", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isStartNode({ id: "custom_start", type: "start", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isStartNode({ id: "step_1", type: "step", position: { x: 0, y: 0 }, data: { stepType: "start" } })).toBe(true);
    expect(isStartNode({ id: "step_1", type: "step", position: { x: 0, y: 0 }, data: {} })).toBe(false);

    expect(isEndNode({ id: "END", type: "end", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isEndNode({ id: "end_output", type: "custom", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isEndNode({ id: "custom_end", type: "end", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isEndNode({ id: "step_1", type: "step", position: { x: 0, y: 0 }, data: { stepType: "end" } })).toBe(true);
    expect(isEndNode({ id: "step_1", type: "step", position: { x: 0, y: 0 }, data: {} })).toBe(false);
  });

  it("extracts flow nodes from START to END while ignoring state, memory, tools, and disconnected nodes", () => {
    const nodes: LayoutNode[] = [
      {
        id: "STATE_GLOBAL",
        type: "state_global",
        position: { x: 60, y: 60 },
        data: { label: "State Store" },
      },
      {
        id: "CHECKPOINTER",
        type: "langgraph_memory",
        position: { x: 60, y: 288 },
        data: { label: "Postgres Checkpointer" },
      },
      {
        id: "tool_search",
        type: "langgraph_tool",
        position: { x: 300, y: 60 },
        data: { label: "Tavily Search" },
      },
      {
        id: "llm_openai",
        type: "langgraph_llm",
        position: { x: 600, y: 60 },
        data: { label: "OpenAI GPT-4o" },
      },
      {
        id: "START",
        type: "start",
        position: { x: 800, y: 200 },
        data: { label: "START" },
      },
      {
        id: "step_agent",
        type: "step",
        position: { x: 1000, y: 200 },
        data: { label: "Agent Step" },
      },
      {
        id: "step_action",
        type: "step",
        position: { x: 1200, y: 200 },
        data: { label: "Action Step" },
      },
      {
        id: "END",
        type: "end",
        position: { x: 1400, y: 200 },
        data: { label: "END" },
      },
      {
        id: "step_disconnected",
        type: "step",
        position: { x: 2000, y: 500 },
        data: { label: "Dangling Unconnected Step" },
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "START", target: "step_agent" },
      { id: "e2", source: "step_agent", target: "step_action" },
      { id: "e3", source: "step_action", target: "END" },
      // Reference edge to tool (should not be considered a flow edge)
      { id: "e_ref", source: "tool_search", target: "step_agent", type: "langgraph-reference" },
    ];

    const flowNodes = getLangGraphFlowNodes(nodes, edges);
    const flowNodeIds = flowNodes.map((n) => n.id);

    // Should include all flow nodes from START to END
    expect(flowNodeIds).toContain("START");
    expect(flowNodeIds).toContain("step_agent");
    expect(flowNodeIds).toContain("step_action");
    expect(flowNodeIds).toContain("END");

    // Must ignore definition nodes (state, memory, tools, llm)
    expect(flowNodeIds).not.toContain("STATE_GLOBAL");
    expect(flowNodeIds).not.toContain("CHECKPOINTER");
    expect(flowNodeIds).not.toContain("tool_search");
    expect(flowNodeIds).not.toContain("llm_openai");

    // Must ignore disconnected nodes
    expect(flowNodeIds).not.toContain("step_disconnected");
  });

  it("passes only the flow nodes from START to END to fitView during performLangGraphLayout", () => {
    const nodes: LayoutNode[] = [
      {
        id: "STATE_GLOBAL",
        type: "state_global",
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: "tool_1",
        type: "langgraph_tool",
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: "step_main",
        type: "step",
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: "END",
        type: "end",
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: "orphan_node",
        type: "step",
        position: { x: 0, y: 0 },
        data: {},
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "START", target: "step_main" },
      { id: "e2", source: "step_main", target: "END" },
    ];

    vi.useFakeTimers();
    const fitView = vi.fn();
    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };

    performLangGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
    });

    // Run the setTimeout in performLangGraphLayout
    vi.runAllTimers();
    vi.useRealTimers();

    expect(fitView).toHaveBeenCalledTimes(1);
    const fitViewArgs = fitView.mock?.calls?.[0]?.[0];

    expect(fitViewArgs).toBeDefined();
    expect(fitViewArgs.nodes).toBeDefined();

    const targetedIds = fitViewArgs.nodes.map((n: { id: string }) => n.id);
    expect(targetedIds).toEqual(["START", "step_main", "END"]);
    expect(targetedIds).not.toContain("STATE_GLOBAL");
    expect(targetedIds).not.toContain("tool_1");
    expect(targetedIds).not.toContain("orphan_node");
  });

  it("handles cyclical graphs (agent-tool loop) correctly", () => {
    const nodes: LayoutNode[] = [
      { id: "STATE_GLOBAL", type: "state_global", position: { x: 0, y: 0 }, data: {} },
      { id: "START", type: "start", position: { x: 0, y: 0 }, data: {} },
      { id: "agent", type: "step", position: { x: 0, y: 0 }, data: {} },
      { id: "tool_step", type: "step", position: { x: 0, y: 0 }, data: {} },
      { id: "END", type: "end", position: { x: 0, y: 0 }, data: {} },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "START", target: "agent" },
      { id: "e2", source: "agent", target: "tool_step" },
      { id: "e3", source: "tool_step", target: "agent" },
      { id: "e4", source: "agent", target: "END" },
    ];

    const flowNodes = getLangGraphFlowNodes(nodes, edges);
    const flowNodeIds = flowNodes.map((n) => n.id);

    expect(flowNodeIds).toEqual(["START", "agent", "tool_step", "END"]);
    expect(flowNodeIds).not.toContain("STATE_GLOBAL");
  });
});
