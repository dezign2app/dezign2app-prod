import { describe, it, expect, beforeEach } from "vitest";
import {
  useBackendCanvasStore,
  EndpointWithNode,
  EventWithNode,
} from "@/lib/stores/backendCanvasStore";
import { BackendEdge, BackendNode } from "@/types/canvas";

describe("backendCanvasStore - Transformer state cleanup & synchronization", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-1");
  });

  it("cleans up transformer node targetEndpointIds and endpoint pipelineSteps when edge is deleted", () => {
    const store = useBackendCanvasStore.getState();

    const serviceNode: BackendNode = {
      id: "service-1",
      type: "service",
      position: { x: 0, y: 0 },
      data: { label: "User Service" },
      fractionalIndex: "a0",
    };

    const transformerNode: BackendNode = {
      id: "trans-1",
      type: "transformer",
      position: { x: 300, y: 0 },
      data: {
        label: "formatUser",
        functionName: "formatUser",
        targetServiceId: "service-1",
        targetEndpointIds: ["ep-1"],
        targetEndpointId: "ep-1",
      },
      fractionalIndex: "a1",
    };

    const edge: BackendEdge = {
      id: "edge-trans-ep1",
      source: "trans-1",
      target: "service-1",
      sourceHandle: "transformer-out",
      targetHandle: "endpoint-in-ep-1",
      type: "connection",
      fractionalIndex: "e0",
    };

    const endpoint: EndpointWithNode = {
      id: "ep-1",
      nodeId: "service-1",
      name: "getUser",
      type: "GET",
      pipelineSteps: [
        {
          id: "step-1",
          name: "formattedUser",
          type: "transform",
          enabled: true,
          transformerNodeId: "trans-1",
          functionRef: {
            name: "formatUser",
            importPath: "./transformers/formatUser",
          },
          inputBindings: [],
          outputVariable: "formattedUser",
        },
        {
          id: "return-response-step",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 200,
          inputBindings: [],
          outputVariable: "",
        },
      ],
    };

    store.setNodesAndEdges([serviceNode, transformerNode], [edge], [endpoint], [], [], "proj-1");

    // Delete the edge
    useBackendCanvasStore.getState().deleteEdge("edge-trans-ep1");

    const stateAfterEdgeDelete = useBackendCanvasStore.getState();

    // 1. Edge is deleted
    expect(stateAfterEdgeDelete.edges).toHaveLength(0);

    // 2. Transformer node targetEndpointIds is cleaned up
    const updatedTransNode = stateAfterEdgeDelete.nodes.find((n) => n.id === "trans-1");
    expect(updatedTransNode?.data?.targetEndpointIds).toEqual([]);
    expect(updatedTransNode?.data?.targetEndpointId).toBeUndefined();
    expect(updatedTransNode?.data?.targetServiceId).toBeUndefined();

    // 3. Endpoint pipelineSteps transform step is cleaned up
    const updatedEp = stateAfterEdgeDelete.endpoints.find((e) => e.id === "ep-1");
    expect(updatedEp?.pipelineSteps).toHaveLength(1);
    expect(updatedEp?.pipelineSteps?.[0]?.type).toBe("return_response");
  });

  it("cleans up endpoint and event pipelineSteps when transformer node is deleted", () => {
    const store = useBackendCanvasStore.getState();

    const serviceNode: BackendNode = {
      id: "service-1",
      type: "service",
      position: { x: 0, y: 0 },
      data: { label: "Order Service" },
      fractionalIndex: "a0",
    };

    const transformerNode: BackendNode = {
      id: "trans-2",
      type: "transformer",
      position: { x: 300, y: 0 },
      data: {
        label: "validateOrder",
        functionName: "validateOrder",
      },
      fractionalIndex: "a1",
    };

    const endpoint: EndpointWithNode = {
      id: "ep-2",
      nodeId: "service-1",
      name: "createOrder",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-1",
          name: "validatedOrder",
          type: "transform",
          enabled: true,
          transformerNodeId: "trans-2",
          functionRef: {
            name: "validateOrder",
            importPath: "./transformers/validateOrder",
          },
          inputBindings: [],
          outputVariable: "validatedOrder",
        },
      ],
    };

    const event: EventWithNode = {
      id: "ev-1",
      nodeId: "service-1",
      variant: "consume",
      name: "OrderCreatedConsumer",
      messagingResourceId: "orders",
      brokerNodeId: "kafka-1",
      pipelineSteps: [
        {
          id: "step-2",
          name: "validatedEvent",
          type: "transform",
          enabled: true,
          functionRef: {
            name: "validateOrder",
            importPath: "./transformers/validateOrder",
          },
          inputBindings: [],
          outputVariable: "validatedEvent",
        },
      ],
    };

    store.setNodesAndEdges([serviceNode, transformerNode], [], [endpoint], [event], [], "proj-1");

    // Delete the transformer node
    useBackendCanvasStore.getState().deleteNode("trans-2");

    const state = useBackendCanvasStore.getState();
    expect(state.nodes.find((n) => n.id === "trans-2")).toBeUndefined();

    const updatedEp = state.endpoints.find((e) => e.id === "ep-2");
    expect(updatedEp?.pipelineSteps).toEqual([]);

    const updatedEv = state.events.find((e) => e.id === "ev-1");
    expect(updatedEv?.pipelineSteps).toEqual([]);
  });

  it("synchronizes targetEndpointIds on onConnect for transformer to service handle", () => {
    const store = useBackendCanvasStore.getState();

    const serviceNode: BackendNode = {
      id: "service-1",
      type: "service",
      position: { x: 0, y: 0 },
      data: { label: "Payment Service" },
      fractionalIndex: "a0",
    };

    const transformerNode: BackendNode = {
      id: "trans-3",
      type: "transformer",
      position: { x: 300, y: 0 },
      data: {
        label: "parsePayment",
        functionName: "parsePayment",
      },
      fractionalIndex: "a1",
    };

    store.setNodesAndEdges([serviceNode, transformerNode], [], [], [], [], "proj-1");

    // Connect transformer -> endpoint-in-ep-checkout
    useBackendCanvasStore.getState().onConnect({
      source: "trans-3",
      target: "service-1",
      sourceHandle: "transformer-out",
      targetHandle: "endpoint-in-ep-checkout",
    });

    const updatedTrans = useBackendCanvasStore.getState().nodes.find((n) => n.id === "trans-3");
    expect(updatedTrans?.data?.targetServiceId).toBe("service-1");
    expect(updatedTrans?.data?.targetEndpointIds).toEqual(["ep-checkout"]);
    expect(updatedTrans?.data?.targetEndpointId).toBe("ep-checkout");
  });
});
