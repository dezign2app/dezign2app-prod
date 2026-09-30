import { describe, it, expect, vi } from "vitest";
import { performLangGraphLayout, isStateStoreNode, isMemoryNode } from "../langGraphLayout";
import type { LayoutNode, LayoutEdge, PositionNodeChange } from "../types";

describe("LangGraph Auto Layout - LangGraphCanvasMemoryNode alignment below StateStoreNode", () => {
  it("correctly identifies StateStoreNode and MemoryNode types", () => {
    expect(isStateStoreNode({ id: "STATE_GLOBAL", type: "state_global", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isStateStoreNode({ id: "custom-state", type: "state_store", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isStateStoreNode({ id: "STATE_GLOBAL", type: "STATE_GLOBAL", position: { x: 0, y: 0 }, data: {} })).toBe(true);

    expect(isMemoryNode({ id: "CHECKPOINTER", type: "langgraph_memory", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isMemoryNode({ id: "mem_1", type: "langgraph_memory", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isMemoryNode({ id: "mem_2", type: "memory", position: { x: 0, y: 0 }, data: {} })).toBe(true);
    expect(isMemoryNode({ id: "mem_ref_1", type: "langgraph_memory_ref", position: { x: 0, y: 0 }, data: {} })).toBe(false);
  });

  it("always aligns LangGraphCanvasMemoryNode directly below StateStoreNode in column 1", () => {
    const nodes: LayoutNode[] = [
      {
        id: "STATE_GLOBAL",
        type: "state_global",
        position: { x: 500, y: 200 },
        data: { label: "Global Graph State" },
      },
      {
        id: "CHECKPOINTER",
        type: "langgraph_memory",
        position: { x: 800, y: 400 },
        data: { label: "Graph Checkpointer", checkpointer: "postgres" },
      },
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "INPUT State" },
      },
      {
        id: "step_1",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Agent Step" },
      },
      {
        id: "END",
        type: "end",
        position: { x: 0, y: 0 },
        data: { label: "END State" },
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "START", target: "step_1" },
      { id: "e2", source: "step_1", target: "END" },
    ];

    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };
    const fitView = vi.fn();

    performLangGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
    });

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const statePos = posMap.get("STATE_GLOBAL")!;
    const memoryPos = posMap.get("CHECKPOINTER")!;

    expect(statePos).toBeDefined();
    expect(memoryPos).toBeDefined();

    // 1. Both nodes are in the first definition column (x = 60)
    expect(statePos.x).toBe(60);
    expect(memoryPos.x).toBe(60);

    // 2. Memory node is placed directly below the StateStoreNode
    expect(memoryPos.y).toBeGreaterThan(statePos.y);

    // 3. StateStoreNode is at startY (60)
    expect(statePos.y).toBe(60);

    // 4. Memory node is placed at startY + stateNodeHeight + nodeVertGap (28)
    // fallback height of state_global is 200, so memoryPos.y should be 60 + 200 + 28 = 288
    expect(memoryPos.y).toBe(statePos.y + 200 + 28);
  });

  it("keeps MemoryNode below StateStoreNode even when Tool, LLM, and Middleware nodes are present", () => {
    const nodes: LayoutNode[] = [
      {
        id: "STATE_GLOBAL",
        type: "state_global",
        position: { x: 0, y: 0 },
        data: { label: "Global Graph State" },
      },
      {
        id: "CHECKPOINTER",
        type: "langgraph_memory",
        position: { x: 0, y: 0 },
        data: { label: "Graph Checkpointer" },
      },
      {
        id: "tool_search",
        type: "langgraph_tool",
        position: { x: 0, y: 0 },
        data: { label: "Web Search Tool" },
      },
      {
        id: "llm_openai",
        type: "langgraph_llm",
        position: { x: 0, y: 0 },
        data: { label: "GPT-4o Mini" },
      },
      {
        id: "mw_logger",
        type: "langgraph_middleware",
        position: { x: 0, y: 0 },
        data: { label: "Logging Middleware" },
      },
      {
        id: "START",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "START" },
      },
      {
        id: "END",
        type: "end",
        position: { x: 0, y: 0 },
        data: { label: "END" },
      },
    ];

    const edges: LayoutEdge[] = [
      { id: "e1", source: "START", target: "END" },
    ];

    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };
    const fitView = vi.fn();

    performLangGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
    });

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const statePos = posMap.get("STATE_GLOBAL")!;
    const memoryPos = posMap.get("CHECKPOINTER")!;
    const toolPos = posMap.get("tool_search")!;
    const llmPos = posMap.get("llm_openai")!;
    const mwPos = posMap.get("mw_logger")!;

    // State & Memory share column 1 (x = 60)
    expect(statePos.x).toBe(60);
    expect(memoryPos.x).toBe(60);
    expect(memoryPos.y).toBeGreaterThan(statePos.y);

    // Tools, LLM, and Middleware are placed in separate columns to the right of State+Memory
    expect(toolPos.x).toBeGreaterThan(statePos.x);
    expect(llmPos.x).toBeGreaterThan(toolPos.x);
    expect(mwPos.x).toBeGreaterThan(llmPos.x);
  });

  it("handles multiple memory nodes aligned vertically below StateStoreNode", () => {
    const nodes: LayoutNode[] = [
      {
        id: "STATE_GLOBAL",
        type: "state_global",
        position: { x: 0, y: 0 },
        data: { label: "State" },
      },
      {
        id: "CHECKPOINTER",
        type: "langgraph_memory",
        position: { x: 0, y: 0 },
        data: { label: "Checkpointer" },
      },
      {
        id: "memory_custom",
        type: "langgraph_memory",
        position: { x: 0, y: 0 },
        data: { label: "Secondary Memory" },
      },
    ];

    const edges: LayoutEdge[] = [];

    let appliedChanges: PositionNodeChange[] = [];
    const onNodesChange = (changes: PositionNodeChange[]) => {
      appliedChanges = changes;
    };
    const fitView = vi.fn();

    performLangGraphLayout({
      nodes,
      edges,
      onNodesChange,
      fitView,
      direction: "LR",
    });

    const posMap = new Map(appliedChanges.map((c) => [c.id, c.position]));
    const statePos = posMap.get("STATE_GLOBAL")!;
    const mem1Pos = posMap.get("CHECKPOINTER")!;
    const mem2Pos = posMap.get("memory_custom")!;

    // All share column 1
    expect(statePos.x).toBe(60);
    expect(mem1Pos.x).toBe(60);
    expect(mem2Pos.x).toBe(60);

    // Both memory nodes are below StateStoreNode
    expect(mem1Pos.y).toBeGreaterThan(statePos.y);
    expect(mem2Pos.y).toBeGreaterThan(mem1Pos.y);
  });
});
