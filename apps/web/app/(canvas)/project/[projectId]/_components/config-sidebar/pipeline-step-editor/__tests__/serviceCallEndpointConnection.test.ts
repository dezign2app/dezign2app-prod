import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";
import type { EndpointWithNode } from "@workspace/canvas";
import { getConnectedServiceCallsForEndpoint } from "@/lib/utils/pipelineValidation";
import {
  ensureServiceCallConnection,
  cleanupServiceCallConnection,
} from "../reference-connections/serviceCallConnection";

describe("pipeline-step-editor: Inter-Service Endpoint Connection and Step Synchronization", () => {
  const callerServiceId = "service-orders";
  const callerEndpointId = "ep-create-order";
  const calleeServiceId = "service-users";
  const calleeEndpointId = "ep-get-user";

  const callerServiceNode: BackendNode = {
    id: callerServiceId,
    type: "service",
    position: { x: 100, y: 100 },
    fractionalIndex: "a0",
    data: {
      label: "Orders Service",
      serviceFolder: "orders",
    },
  };

  const calleeServiceNode: BackendNode = {
    id: calleeServiceId,
    type: "service",
    position: { x: 500, y: 100 },
    fractionalIndex: "a1",
    data: {
      label: "Users Service",
      serviceFolder: "users",
    },
  };

  const callerEndpoint: EndpointWithNode = {
    id: callerEndpointId,
    nodeId: callerServiceId,
    name: "Create Order",
    type: "POST",
    pipelineSteps: [
      {
        id: "return-step",
        name: "Return Response",
        type: "return_response",
        enabled: true,
        statusCode: 201,
        inputBindings: [],
        outputVariable: "",
      },
    ],
  };

  const calleeEndpoint: EndpointWithNode = {
    id: calleeEndpointId,
    nodeId: calleeServiceId,
    name: "Get User",
    type: "GET",
    pipelineSteps: [
      {
        id: "return-step-callee",
        name: "Return Response",
        type: "return_response",
        enabled: true,
        statusCode: 200,
        inputBindings: [],
        outputVariable: "",
      },
    ],
  };

  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-service-call-test");
    useBackendCanvasStore
      .getState()
      .setNodesAndEdges(
        [callerServiceNode, calleeServiceNode],
        [],
        [callerEndpoint, calleeEndpoint],
        [],
        [],
        "proj-service-call-test",
      );
  });

  it("auto-adds service_call step to caller endpoint pipelineSteps before return_response when edge is drawn", () => {
    useBackendCanvasStore.getState().onConnect({
      source: callerServiceId,
      target: calleeServiceId,
      sourceHandle: `endpoint-out-${callerEndpointId}`,
      targetHandle: `endpoint-in-${calleeEndpointId}`,
    });

    const state = useBackendCanvasStore.getState();
    const updatedCallerEp = state.endpoints.find((e) => e.id === callerEndpointId);

    expect(updatedCallerEp?.pipelineSteps).toHaveLength(2);
    const serviceCallStep = updatedCallerEp?.pipelineSteps?.[0];
    expect(serviceCallStep?.type).toBe("service_call");
    expect(serviceCallStep?.databaseId).toBe(calleeServiceId);
    expect(serviceCallStep?.tableNodeId).toBe(calleeEndpointId);
    expect(serviceCallStep?.functionRef?.name).toBe("callUsersServiceGetUser");
    expect(serviceCallStep?.functionRef?.path).toBe("@workspace/services/users");
    expect(serviceCallStep?.outputVariable).toBe("getUserResult");
    expect(serviceCallStep?.enabled).toBe(true);

    // return_response must remain at the end
    expect(updatedCallerEp?.pipelineSteps?.[1]?.type).toBe("return_response");

    // Canvas edge should be enriched with service call metadata
    const edge = state.edges.find(
      (e) => e.source === callerServiceId && e.target === calleeServiceId,
    );
    expect(edge).toBeDefined();
    expect(edge?.data?.isServiceCall).toBe(true);
    expect(edge?.data?.targetServiceId).toBe(calleeServiceId);
    expect(edge?.data?.targetEndpointId).toBe(calleeEndpointId);
  });

  it("deduplicates service_call steps when drawing connection again", () => {
    // Connect first time
    useBackendCanvasStore.getState().onConnect({
      source: callerServiceId,
      target: calleeServiceId,
      sourceHandle: `endpoint-out-${callerEndpointId}`,
      targetHandle: `endpoint-in-${calleeEndpointId}`,
    });

    // Connect second time
    useBackendCanvasStore.getState().onConnect({
      source: callerServiceId,
      target: calleeServiceId,
      sourceHandle: `endpoint-out-${callerEndpointId}`,
      targetHandle: `endpoint-in-${calleeEndpointId}`,
    });

    const state = useBackendCanvasStore.getState();
    const updatedCallerEp = state.endpoints.find((e) => e.id === callerEndpointId);

    const callSteps = updatedCallerEp?.pipelineSteps?.filter(
      (s) => s.type === "service_call",
    );
    expect(callSteps).toHaveLength(1);
  });

  it("removes service_call step when the connecting inter-service edge is deleted", () => {
    // 1. Connect
    useBackendCanvasStore.getState().onConnect({
      source: callerServiceId,
      target: calleeServiceId,
      sourceHandle: `endpoint-out-${callerEndpointId}`,
      targetHandle: `endpoint-in-${calleeEndpointId}`,
    });

    const stateAfterConnect = useBackendCanvasStore.getState();
    const addedEdge = stateAfterConnect.edges.find(
      (e) => e.source === callerServiceId && e.target === calleeServiceId,
    );
    expect(addedEdge).toBeDefined();

    // 2. Delete edge
    useBackendCanvasStore.getState().deleteEdge(addedEdge!.id);

    const stateAfterDelete = useBackendCanvasStore.getState();
    const updatedCallerEp = stateAfterDelete.endpoints.find((e) => e.id === callerEndpointId);

    // service_call step should be removed, return_response preserved
    expect(updatedCallerEp?.pipelineSteps).toHaveLength(1);
    expect(updatedCallerEp?.pipelineSteps?.[0]?.type).toBe("return_response");
  });

  it("removes service_call step when the callee service node itself is deleted", () => {
    // 1. Connect
    useBackendCanvasStore.getState().onConnect({
      source: callerServiceId,
      target: calleeServiceId,
      sourceHandle: `endpoint-out-${callerEndpointId}`,
      targetHandle: `endpoint-in-${calleeEndpointId}`,
    });

    expect(
      useBackendCanvasStore.getState().endpoints.find((e) => e.id === callerEndpointId)
        ?.pipelineSteps,
    ).toHaveLength(2);

    // 2. Delete callee service node
    useBackendCanvasStore.getState().deleteNode(calleeServiceId);

    const stateAfterDelete = useBackendCanvasStore.getState();
    const updatedCallerEp = stateAfterDelete.endpoints.find((e) => e.id === callerEndpointId);

    expect(updatedCallerEp?.pipelineSteps).toHaveLength(1);
    expect(updatedCallerEp?.pipelineSteps?.[0]?.type).toBe("return_response");
  });

  it("getConnectedServiceCallsForEndpoint correctly detects connected callee service and endpoint", () => {
    const edges = [
      {
        id: "edge-service-call-1",
        source: callerServiceId,
        target: calleeServiceId,
        sourceHandle: `endpoint-out-${callerEndpointId}`,
        targetHandle: `endpoint-in-${calleeEndpointId}`,
        data: {
          isServiceCall: true,
          targetServiceId: calleeServiceId,
          targetEndpointId: calleeEndpointId,
        },
      },
    ];

    const connectedCalls = getConnectedServiceCallsForEndpoint(
      callerEndpointId,
      callerServiceId,
      [callerServiceNode, calleeServiceNode],
      edges as any,
      [callerEndpoint, calleeEndpoint],
    );

    expect(connectedCalls).toHaveLength(1);
    expect(connectedCalls[0]?.targetServiceId).toBe(calleeServiceId);
    expect(connectedCalls[0]?.targetServiceName).toBe("Users Service");
    expect(connectedCalls[0]?.targetEndpointId).toBe(calleeEndpointId);
    expect(connectedCalls[0]?.targetEndpointName).toBe("Get User");
    expect(connectedCalls[0]?.targetEndpointMethod).toBe("GET");
  });

  it("ensureServiceCallConnection and cleanupServiceCallConnection manage canvas edges", () => {
    // 1. Ensure connection
    const edgeId = ensureServiceCallConnection({
      serviceNodeId: callerServiceId,
      endpointId: callerEndpointId,
      targetServiceId: calleeServiceId,
      targetEndpointId: calleeEndpointId,
    });

    expect(edgeId).toBeDefined();
    let state = useBackendCanvasStore.getState();
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]?.source).toBe(callerServiceId);
    expect(state.edges[0]?.target).toBe(calleeServiceId);
    expect(state.edges[0]?.data?.isServiceCall).toBe(true);

    // Re-call returns existing edge ID
    const reId = ensureServiceCallConnection({
      serviceNodeId: callerServiceId,
      endpointId: callerEndpointId,
      targetServiceId: calleeServiceId,
      targetEndpointId: calleeEndpointId,
    });
    expect(reId).toBe(edgeId);

    // 2. Cleanup connection with no remaining steps deletes edge
    cleanupServiceCallConnection({
      serviceNodeId: callerServiceId,
      endpointId: callerEndpointId,
      targetServiceId: calleeServiceId,
      targetEndpointId: calleeEndpointId,
      remainingSteps: [],
    });

    state = useBackendCanvasStore.getState();
    expect(state.edges).toHaveLength(0);
  });
});
