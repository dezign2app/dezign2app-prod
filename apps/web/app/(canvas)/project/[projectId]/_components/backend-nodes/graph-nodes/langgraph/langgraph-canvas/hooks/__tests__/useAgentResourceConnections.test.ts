import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentResourceConnections } from "../useAgentResourceConnections";
import { useCanvasConnections } from "../useCanvasConnections";
import type {
  LangGraphCanvasNode,
  LangGraphCanvasEdge,
  LangGraphLLMNode,
  CanvasNode,
} from "@workspace/canvas";
import {
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_LLM_REF,
  LANGGRAPH_CANVAS_NODE_NODE,
  HANDLE_LLM_IN,
  HANDLE_LLM_OUT,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
} from "../../constants";

describe("LLM Ref Node Attachment Behavior", () => {
  const masterLLM: LangGraphLLMNode = {
    id: "llm_master_1",
    type: LANGGRAPH_CANVAS_NODE_LLM,
    position: { x: 100, y: 100 },
    data: {
      label: "GPT-4o Master",
      llmId: "llm_master_1",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      apiKeyHeader: "OPENAI_API_KEY",
      temperature: 0.7,
    },
  };

  const agentNode: CanvasNode = {
    id: "agent_node_1",
    type: LANGGRAPH_CANVAS_NODE_NODE,
    position: { x: 500, y: 100 },
    data: {
      name: "Agent 1",
      label: "Agent 1",
      subType: "agent",
      llmConfig: {
        enabled: false,
        provider: DEFAULT_LLM_PROVIDER,
        model: DEFAULT_LLM_MODEL,
      },
    },
  };

  it("creates an LLM ref node and connects it when a master LLM is selected for an agent", () => {
    let nodes: LangGraphCanvasNode[] = [masterLLM, agentNode];
    let edges: LangGraphCanvasEdge[] = [];

    const setNodes = vi.fn((updater) => {
      nodes = typeof updater === "function" ? updater(nodes) : updater;
    });
    const setEdges = vi.fn((updater) => {
      edges = typeof updater === "function" ? updater(edges) : updater;
    });

    const { result } = renderHook(() =>
      useAgentResourceConnections({
        nodes,
        edges,
        setEdges,
        setNodes,
      }),
    );

    act(() => {
      result.current.handleSelectLLMForAgent("agent_node_1", "llm_master_1");
    });

    // An LLM Ref node should have been created
    const refNode = nodes.find(
      (n) =>
        n.type === LANGGRAPH_CANVAS_NODE_LLM_REF &&
        (n.data as { llmRef?: string }).llmRef === "llm_master_1",
    );
    expect(refNode).toBeDefined();
    expect(refNode?.id).toMatch(/^llm_ref_/);
    expect((refNode?.data as { label?: string }).label).toBe("GPT-4o Master (Ref)");

    // An edge should connect refNode to agent_node_1
    const edge = edges.find(
      (e) =>
        e.source === refNode?.id &&
        e.target === "agent_node_1" &&
        e.targetHandle === HANDLE_LLM_IN,
    );
    expect(edge).toBeDefined();
    expect(edge?.sourceHandle).toBe(HANDLE_LLM_OUT);

    // Agent node llmConfig should be enabled with resolved modelConfig
    const updatedAgent = nodes.find((n) => n.id === "agent_node_1") as CanvasNode;
    expect(updatedAgent.data.llmConfig?.enabled).toBe(true);
    expect(updatedAgent.data.modelConfig?.model).toBe("gpt-4o");
    expect(updatedAgent.data.modelConfig?.provider).toBe("openai");
  });

  it("disconnects and removes the LLM ref node when unbinding LLM", () => {
    const refNode: LangGraphCanvasNode = {
      id: "llm_ref_test",
      type: LANGGRAPH_CANVAS_NODE_LLM_REF,
      position: { x: 200, y: 100 },
      data: {
        label: "GPT-4o Master (Ref)",
        refId: "llm_ref_test",
        llmRef: "llm_master_1",
      },
    };

    const edge: LangGraphCanvasEdge = {
      id: "xy-edge__llm_ref_test-agent_node_1",
      source: "llm_ref_test",
      sourceHandle: HANDLE_LLM_OUT,
      target: "agent_node_1",
      targetHandle: HANDLE_LLM_IN,
    };

    let nodes: LangGraphCanvasNode[] = [masterLLM, refNode, agentNode];
    let edges: LangGraphCanvasEdge[] = [edge];

    const setNodes = vi.fn((updater) => {
      nodes = typeof updater === "function" ? updater(nodes) : updater;
    });
    const setEdges = vi.fn((updater) => {
      edges = typeof updater === "function" ? updater(edges) : updater;
    });

    const { result } = renderHook(() =>
      useAgentResourceConnections({
        nodes,
        edges,
        setEdges,
        setNodes,
      }),
    );

    act(() => {
      result.current.handleSelectLLMForAgent("agent_node_1", null);
    });

    // Edge should be removed
    expect(edges).toHaveLength(0);

    // Ref node should be cleaned up from nodes
    const foundRef = nodes.find((n) => n.id === "llm_ref_test");
    expect(foundRef).toBeUndefined();

    // Agent node llmConfig should be disabled
    const updatedAgent = nodes.find((n) => n.id === "agent_node_1") as CanvasNode;
    expect(updatedAgent.data.llmConfig?.enabled).toBe(false);
    expect(updatedAgent.data.modelConfig).toBeUndefined();
  });

  it("automatically generates an LLM Ref node when dragging connection from Master LLM to Agent Node", () => {
    let nodes: LangGraphCanvasNode[] = [masterLLM, agentNode];
    let edges: LangGraphCanvasEdge[] = [];

    const setNodes = vi.fn((updater) => {
      nodes = typeof updater === "function" ? updater(nodes) : updater;
    });
    const setEdges = vi.fn((updater) => {
      edges = typeof updater === "function" ? updater(edges) : updater;
    });

    const { result } = renderHook(() =>
      useCanvasConnections({
        nodes,
        edges,
        setNodes,
        setEdges,
      }),
    );

    act(() => {
      result.current.onConnect({
        source: "llm_master_1",
        sourceHandle: HANDLE_LLM_OUT,
        target: "agent_node_1",
        targetHandle: HANDLE_LLM_IN,
      });
    });

    // Should create an LLM Ref node
    const refNode = nodes.find(
      (n) =>
        n.type === LANGGRAPH_CANVAS_NODE_LLM_REF &&
        (n.data as { llmRef?: string }).llmRef === "llm_master_1",
    );
    expect(refNode).toBeDefined();

    // The edge source should point to the generated ref node, not the master
    expect(edges.length).toBeGreaterThan(0);
    const connectingEdge = edges[0];
    expect(connectingEdge?.source).toBe(refNode?.id);
    expect(connectingEdge?.target).toBe("agent_node_1");
  });
});
