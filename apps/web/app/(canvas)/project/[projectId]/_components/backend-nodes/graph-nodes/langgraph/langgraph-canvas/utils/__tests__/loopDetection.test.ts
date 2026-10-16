import { describe, it, expect } from "vitest";
import { detectInfiniteLoops } from "../loopDetection";
import type { LangGraphCanvasNode, LangGraphCanvasEdge } from "@workspace/canvas";

describe("detectInfiniteLoops", () => {
  it("returns no warnings for a clean linear graph (START -> Agent -> END)", () => {
    const nodes = [
      { id: "START", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      { id: "agent_1", type: "langgraph_agent", position: { x: 100, y: 0 }, data: { label: "Chat Agent" } },
      { id: "END", type: "end", position: { x: 200, y: 0 }, data: { label: "END" } },
    ] as LangGraphCanvasNode[];

    const edges = [
      { id: "e1", source: "START", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "END" },
    ] as LangGraphCanvasEdge[];

    const warnings = detectInfiniteLoops({ nodes, edges });
    expect(warnings).toHaveLength(0);
  });

  it("detects a dead-end cycle when a loop has no path to END", () => {
    const nodes = [
      { id: "START", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      { id: "agent_1", type: "langgraph_agent", position: { x: 100, y: 0 }, data: { label: "Agent A" } },
      { id: "agent_ref_1", type: "langgraph_agent_ref", position: { x: 200, y: 0 }, data: { label: "Agent Ref", agentRef: "agent_1" } },
      { id: "END", type: "end", position: { x: 300, y: 0 }, data: { label: "END" } },
    ] as LangGraphCanvasNode[];

    // START -> Agent A -> AgentRef -> (loops back to Agent A), with no path to END
    const edges = [
      { id: "e1", source: "START", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "agent_ref_1" },
    ] as LangGraphCanvasEdge[];

    const warnings = detectInfiniteLoops({ nodes, edges });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.type).toBe("dead_end_cycle");
    expect(warnings[0]?.severity).toBe("error");
    expect(warnings[0]?.message).toContain("has no path to the END state");
  });

  it("detects an unconditional loop when cycle exists and cannot be exited conditionally", () => {
    const nodes = [
      { id: "START", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      { id: "agent_1", type: "langgraph_agent", position: { x: 100, y: 0 }, data: { label: "Agent A" } },
      { id: "agent_2", type: "langgraph_agent", position: { x: 200, y: 0 }, data: { label: "Agent B" } },
      { id: "agent_ref_1", type: "langgraph_agent_ref", position: { x: 300, y: 0 }, data: { label: "Agent A Ref", agentRef: "agent_1" } },
      { id: "END", type: "end", position: { x: 400, y: 0 }, data: { label: "END" } },
    ] as LangGraphCanvasNode[];

    // agent_1 -> agent_2 -> agent_ref_1 -> agent_1 (no branch out)
    const edges = [
      { id: "e1", source: "START", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "agent_2" },
      { id: "e3", source: "agent_2", target: "agent_ref_1" },
    ] as LangGraphCanvasEdge[];

    const warnings = detectInfiniteLoops({ nodes, edges });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.type).toBe("dead_end_cycle");
  });

  it("allows a controlled cycle when an agent or router in the cycle has a conditional exit to END", () => {
    const nodes = [
      { id: "START", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      {
        id: "agent_1",
        type: "langgraph_agent",
        position: { x: 100, y: 0 },
        data: {
          label: "Agent A",
          stepType: "router",
          routerConfig: { branches: [{ id: "b_loop" }, { id: "b_end" }] },
        },
      },
      { id: "agent_ref_1", type: "langgraph_agent_ref", position: { x: 200, y: 0 }, data: { label: "Agent Ref", agentRef: "agent_1" } },
      { id: "END", type: "end", position: { x: 300, y: 0 }, data: { label: "END" } },
    ] as LangGraphCanvasNode[];

    // Router branches: one loops back via Agent Ref, the other conditionally goes to END
    const edges = [
      { id: "e1", source: "START", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "agent_ref_1", sourceHandle: "branch_b_loop" },
      { id: "e3", source: "agent_1", target: "END", sourceHandle: "branch_b_end" },
    ] as LangGraphCanvasEdge[];

    const warnings = detectInfiniteLoops({ nodes, edges });
    expect(warnings).toHaveLength(0); // Valid controlled loop!
  });

  it("allows an agent loop when the agent has tools attached (ReAct pattern)", () => {
    const nodes = [
      { id: "START", type: "start", position: { x: 0, y: 0 }, data: { label: "START" } },
      {
        id: "agent_1",
        type: "langgraph_agent",
        position: { x: 100, y: 0 },
        data: {
          label: "Tool Agent",
          tools: ["calculator"],
        },
      },
      { id: "agent_ref_1", type: "langgraph_agent_ref", position: { x: 200, y: 0 }, data: { label: "Tool Agent Ref", agentRef: "agent_1" } },
      { id: "END", type: "end", position: { x: 300, y: 0 }, data: { label: "END" } },
    ] as LangGraphCanvasNode[];

    const edges = [
      { id: "e1", source: "START", target: "agent_1" },
      { id: "e2", source: "agent_1", target: "agent_ref_1" },
      { id: "e3", source: "agent_1", target: "END" },
    ] as LangGraphCanvasEdge[];

    const warnings = detectInfiniteLoops({ nodes, edges });
    expect(warnings).toHaveLength(0); // Valid ReAct tool pattern!
  });
});
