import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendEdge, BackendNode } from "@/types/canvas";

describe("backendCanvasStore - Rapid sync & edge deletion resilience", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-1");
  });

  it("preserves pending operations when setNodesAndEdges is called during hydration", () => {
    const store = useBackendCanvasStore.getState();

    // Initial state with 2 edges
    const nodeA: BackendNode = {
      id: "node-a",
      type: "service",
      position: { x: 0, y: 0 },
      data: { label: "Service A" },
      fractionalIndex: "a0",
    };
    const nodeB: BackendNode = {
      id: "node-b",
      type: "service",
      position: { x: 200, y: 0 },
      data: { label: "Service B" },
      fractionalIndex: "a1",
    };
    const edge1: BackendEdge = {
      id: "edge-1",
      source: "node-a",
      target: "node-b",
      type: "connection",
      fractionalIndex: "e0",
    };
    const edge2: BackendEdge = {
      id: "edge-2",
      source: "node-a",
      target: "node-b",
      type: "connection",
      fractionalIndex: "e1",
    };

    store.setNodesAndEdges([nodeA, nodeB], [edge1, edge2], [], [], [], "proj-1");

    // Rapidly delete edge 1 and edge 2
    useBackendCanvasStore.getState().deleteEdge("edge-1");
    useBackendCanvasStore.getState().deleteEdge("edge-2");

    const stateAfterDeletions = useBackendCanvasStore.getState();
    expect(stateAfterDeletions.edges).toHaveLength(0);
    expect(stateAfterDeletions.pendingEdgeRemovals).toEqual(["edge-1", "edge-2"]);

    // Simulate Convex query update returning edge-2 (e.g. edge-1 synced first)
    useBackendCanvasStore
      .getState()
      .setNodesAndEdges([nodeA, nodeB], [], [], [], [], "proj-1");

    // Pending edge removals MUST NOT be wiped
    const stateAfterQueryUpdate = useBackendCanvasStore.getState();
    expect(stateAfterQueryUpdate.pendingEdgeRemovals).toEqual(["edge-1", "edge-2"]);

    // clearPending only removes the edge that finished syncing
    useBackendCanvasStore.getState().clearPending([], [], [], ["edge-1"]);

    const stateAfterFirstSync = useBackendCanvasStore.getState();
    expect(stateAfterFirstSync.pendingEdgeRemovals).toEqual(["edge-2"]);

    // second sync clears edge-2
    useBackendCanvasStore.getState().clearPending([], [], [], ["edge-2"]);

    const stateAfterSecondSync = useBackendCanvasStore.getState();
    expect(stateAfterSecondSync.pendingEdgeRemovals).toEqual([]);
  });

  it("removes deleted edges from pendingEdgeUpserts so deleted edges are not re-upserted", () => {
    const store = useBackendCanvasStore.getState();

    const nodeA: BackendNode = {
      id: "node-a",
      type: "service",
      position: { x: 0, y: 0 },
      data: { label: "Service A" },
      fractionalIndex: "a0",
    };
    const nodeB: BackendNode = {
      id: "node-b",
      type: "service",
      position: { x: 200, y: 0 },
      data: { label: "Service B" },
      fractionalIndex: "a1",
    };

    store.setNodesAndEdges([nodeA, nodeB], [], [], [], [], "proj-1");

    // Add edge
    useBackendCanvasStore.getState().addEdge({
      id: "edge-temp",
      source: "node-a",
      target: "node-b",
      type: "connection",
    });

    expect(useBackendCanvasStore.getState().pendingEdgeUpserts).toHaveLength(1);

    // Delete edge before sync
    useBackendCanvasStore.getState().deleteEdge("edge-temp");

    const state = useBackendCanvasStore.getState();
    expect(state.edges).toHaveLength(0);
    expect(state.pendingEdgeUpserts).toHaveLength(0);
    expect(state.pendingEdgeRemovals).toContain("edge-temp");
  });
});
