import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasConnections } from "../useCanvasConnections";
import type { LangGraphCanvasNode, CanvasNode } from "@workspace/canvas";
import { LANGGRAPH_CANVAS_NODE_NODE, DEFAULT_LLM_PROVIDER, DEFAULT_LLM_MODEL } from "../../constants";

describe("useCanvasConnections node deletion prevention", () => {
  const testNode: CanvasNode = {
    id: "step_node_1",
    type: LANGGRAPH_CANVAS_NODE_NODE,
    position: { x: 100, y: 100 },
    data: {
      name: "Step 1",
      label: "Step 1",
      subType: "agent",
      llmConfig: {
        enabled: false,
        provider: DEFAULT_LLM_PROVIDER,
        model: DEFAULT_LLM_MODEL,
      },
    },
  };

  it("does not delete nodes when onNodesChange receives a remove change", () => {
    let currentNodes: LangGraphCanvasNode[] = [testNode];
    const setNodes = vi.fn((updater) => {
      if (typeof updater === "function") {
        currentNodes = updater(currentNodes);
      } else {
        currentNodes = updater;
      }
    });
    const setEdges = vi.fn();

    const { result } = renderHook(() =>
      useCanvasConnections({
        nodes: currentNodes,
        edges: [],
        setNodes,
        setEdges,
      }),
    );

    act(() => {
      result.current.onNodesChange([{ type: "remove", id: "step_node_1" }]);
    });

    // setNodes should not even be called when only remove changes are passed
    expect(setNodes).not.toHaveBeenCalled();
    expect(currentNodes).toHaveLength(1);
    const firstNode = currentNodes[0];
    if (!firstNode) {
      throw new Error("Expected firstNode to be defined");
    }
    expect(firstNode.id).toBe("step_node_1");
  });

  it("still applies legitimate node position changes", () => {
    let currentNodes: LangGraphCanvasNode[] = [testNode];
    const setNodes = vi.fn((updater) => {
      if (typeof updater === "function") {
        currentNodes = updater(currentNodes);
      } else {
        currentNodes = updater;
      }
    });
    const setEdges = vi.fn();

    const { result } = renderHook(() =>
      useCanvasConnections({
        nodes: currentNodes,
        edges: [],
        setNodes,
        setEdges,
      }),
    );

    act(() => {
      result.current.onNodesChange([
        {
          type: "position",
          id: "step_node_1",
          position: { x: 250, y: 350 },
        },
      ]);
    });

    expect(setNodes).toHaveBeenCalled();
    const updatedNode = currentNodes[0];
    if (!updatedNode) {
      throw new Error("Expected updatedNode to be defined");
    }
    expect(updatedNode.position).toEqual({ x: 250, y: 350 });
  });
});
