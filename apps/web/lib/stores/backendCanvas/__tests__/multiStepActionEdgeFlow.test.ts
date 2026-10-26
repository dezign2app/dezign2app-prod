import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode, BackendEdge, FrontendActionStepDraft } from "@/types/canvas";

describe("Multi-step Action Edge Flow (Numbered Topology)", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-multistep-test");
  });

  const setupTestCanvas = () => {
    const webPageNode: BackendNode = {
      id: "page-1",
      type: "webPage",
      position: { x: 50, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Upload Page",
        path: "/upload",
        sections: [
          {
            id: "sec-1",
            name: "Main",
            renderMode: "client",
            actions: [
              {
                id: "act-upload-1",
                name: "uploadFile",
                event: "click",
              },
            ],
            stateObjects: [],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "service-1",
      type: "service",
      position: { x: 800, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "UploadService",
        endpoints: [
          {
            id: "ep-presign",
            name: "presign-upload",
            type: "POST",
            pipelineSteps: [
              {
                id: "step-return",
                name: "Return Response",
                type: "return_response",
                enabled: true,
              },
            ],
          },
        ],
      },
    };

    const storageRefNode: BackendNode = {
      id: "storage-ref-1",
      type: "StorageBucketRefNode",
      position: { x: 500, y: 300 },
      fractionalIndex: "a2",
      data: {
        label: "photos",
        storageNodeId: "storage-node-1",
        bucketId: "photos",
        bucketName: "photos",
        storageProvider: "s3",
        storageOperations: [
          {
            id: "op-presign",
            name: "getUploadPresignedUrl",
            kind: "presign_upload",
            label: "Presigned Upload URL",
          },
        ],
      },
    };

    const store = useBackendCanvasStore.getState();
    store.addNode(webPageNode);
    store.addNode(serviceNode);
    store.addNode(storageRefNode);

    return { webPageNode, serviceNode, storageRefNode };
  };

  it("assigns step 1 to the first outgoing edge from an action handle", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Step 1: Connect webpage action -> service endpoint
    store.onConnect({
      source: "page-1",
      target: "service-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-presign",
    });

    const edges = useBackendCanvasStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]?.data?.label).toBe("1");
    expect(edges[0]?.data?.sequenceOrder).toBe(1);
  });

  it("assigns step 2 to the second outgoing edge from the same action handle", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Step 1: WebPage action -> Service endpoint
    store.onConnect({
      source: "page-1",
      target: "service-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-presign",
    });

    // Step 2: WebPage action -> StorageBucketRefNode
    store.onConnect({
      source: "page-1",
      target: "storage-ref-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "func-in-getUploadPresignedUrl",
    });

    const edges = useBackendCanvasStore.getState().edges;
    expect(edges).toHaveLength(2);

    const edge1 = edges.find((e) => e.target === "service-1");
    const edge2 = edges.find((e) => e.target === "storage-ref-1");

    expect(edge1?.data?.label).toBe("1");
    expect(edge1?.data?.sequenceOrder).toBe(1);

    expect(edge2?.data?.label).toBe("2");
    expect(edge2?.data?.sequenceOrder).toBe(2);
    expect((edge2?.data as any)?.isStorageOperationBinding).toBe(true);

    // Verify storageOperationBinding is created on the action
    const pageNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === "page-1");
    const action = pageNode?.data?.sections?.[0]?.actions?.[0];
    expect(action?.storageOperationBinding).toBeDefined();
    expect(action?.storageOperationBinding?.operationName).toBe(
      "getUploadPresignedUrl",
    );
    expect(action?.storageOperationBinding?.bucketId).toBe("photos");
  });

  it("renumbers remaining action edges when an earlier step edge is deleted", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Connect Step 1
    store.onConnect({
      source: "page-1",
      target: "service-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-presign",
    });

    // Connect Step 2
    store.onConnect({
      source: "page-1",
      target: "storage-ref-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "func-in-getUploadPresignedUrl",
    });

    let edges = useBackendCanvasStore.getState().edges;
    const edge1 = edges.find((e) => e.target === "service-1")!;
    const edge2 = edges.find((e) => e.target === "storage-ref-1")!;

    expect(edge1.data?.sequenceOrder).toBe(1);
    expect(edge2.data?.sequenceOrder).toBe(2);

    // Delete Step 1
    useBackendCanvasStore.getState().deleteEdge(edge1.id);

    edges = useBackendCanvasStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]?.id).toBe(edge2.id);
    // Edge 2 should have been automatically renumbered to step 1
    expect(edges[0]?.data?.label).toBe("1");
    expect(edges[0]?.data?.sequenceOrder).toBe(1);
  });

  it("configures api_call request step in actionSteps when edge is drawn, and deletes it when edge is deleted", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // 1. Draw edge from WebPage action to Service endpoint
    store.onConnect({
      source: "page-1",
      target: "service-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-presign",
    });

    const edge = useBackendCanvasStore.getState().edges[0];
    expect(edge).toBeDefined();

    // Verify actionSteps was configured with an api_call step
    let pageNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === "page-1");
    let action = pageNode?.data?.sections?.[0]?.actions?.[0];
    expect(action?.actionSteps).toBeDefined();
    expect(action?.actionSteps).toHaveLength(1);

    const step = action?.actionSteps?.[0];
    expect(step?.type).toBe("api_call");
    expect(step?.edgeId).toBe(edge!.id);
    expect(step?.serviceNodeId).toBe("service-1");
    expect(step?.endpointId).toBe("ep-presign");
    expect(step?.order).toBe(1);

    // 2. Delete the edge from canvas
    store.deleteEdge(edge!.id);

    // Verify request step was automatically deleted
    pageNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === "page-1");
    action = pageNode?.data?.sections?.[0]?.actions?.[0];
    expect(action?.actionSteps).toHaveLength(0);
  });

  it("automatically configures auth header in requestBindings on protected route when edge is drawn", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Connect WebApp (Private Section) -> WebPage
    const webAppNode: BackendNode = {
      id: "webapp-1",
      type: "webApp",
      position: { x: -200, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "web",
      },
    };
    store.addNode(webAppNode);

    store.addEdge({
      id: "edge-webapp-private",
      source: "webapp-1",
      target: "page-1",
      sourceHandle: "private-in",
      targetHandle: "page-in",
      type: "connection",
    });

    // Draw edge from WebPage action to Service endpoint
    store.onConnect({
      source: "page-1",
      target: "service-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-presign",
    });

    const pageNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === "page-1");
    const action = pageNode?.data?.sections?.[0]?.actions?.[0];
    const step = action?.actionSteps?.[0];

    expect(step).toBeDefined();
    expect(step?.type).toBe("api_call");

    // Verify Authorization header was automatically configured in requestBindings
    const authBinding = step?.requestBindings?.find(
      (b) => b.slot === "header" && b.targetField.toLowerCase() === "authorization",
    );
    expect(authBinding).toBeDefined();
    expect(authBinding?.source.kind).toBe("auth_token");
    if (authBinding?.source.kind === "auth_token") {
      expect(authBinding.source.tokenType).toBe("session");
    }
  });

  it("configures api_call request step in actionSteps when action already has a state_mutation step", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Pre-populate action with an existing state_mutation step
    const pageNodeBefore = store.nodes.find((n) => n.id === "page-1")!;
    const existingMutationStep: FrontendActionStepDraft = {
      id: "step-mutation-1",
      order: 1,
      type: "state_mutation",
      name: "Mutate AppStore",
      stateTargetKind: "store",
      stateStoreNodeId: "store-1",
      stateKey: "message",
      stateActionName: "append",
      stateUpdateType: "append",
    };

    const currentSections = pageNodeBefore.data?.sections ?? [];
    store.updateNode("page-1", {
      data: {
        ...pageNodeBefore.data,
        sections: currentSections.map((sec) => ({
          ...sec,
          actions: (sec.actions ?? []).map((act) =>
            act.id === "act-upload-1"
              ? { ...act, actionSteps: [existingMutationStep] }
              : act,
          ),
        })),
      },
    });

    // Draw edge from WebPage action to Service endpoint
    store.onConnect({
      source: "page-1",
      target: "service-1",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-presign",
    });

    const pageNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === "page-1");
    const action = pageNode?.data?.sections?.[0]?.actions?.[0];

    expect(action?.actionSteps).toBeDefined();
    expect(action?.actionSteps).toHaveLength(2);
    expect(action?.actionSteps?.[0]?.type).toBe("state_mutation");
    expect(action?.actionSteps?.[1]?.type).toBe("api_call");
    expect(action?.actionSteps?.[1]?.order).toBe(2);
    expect(action?.actionSteps?.[1]?.serviceNodeId).toBe("service-1");
    expect(action?.actionSteps?.[1]?.endpointId).toBe("ep-presign");

    // The edge sequence order should be 2
    const edge = useBackendCanvasStore.getState().edges.find((e) => e.target === "service-1");
    expect(edge?.data?.sequenceOrder).toBe(2);
    expect(edge?.data?.label).toBe("2");

    // pendingEdgeUpserts should also have sequenceOrder 2
    const pendingUpsert = useBackendCanvasStore.getState().pendingEdgeUpserts.find((e) => e.id === edge?.id);
    expect(pendingUpsert?.data?.sequenceOrder).toBe(2);
    expect(pendingUpsert?.data?.label).toBe("2");
  });

  it("configures api_call request step when endpoint is defined inside routeGroups", () => {
    setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Add service node with routeGroups
    const groupServiceNode: BackendNode = {
      id: "service-grouped",
      type: "service",
      position: { x: 800, y: 300 },
      fractionalIndex: "a4",
      data: {
        label: "Grouped Service",
        routeGroups: [
          {
            id: "rg-users",
            name: "Users Group",
            basePath: "/users",
            endpoints: [
              {
                id: "ep-grouped-create",
                name: "/users/create",
                type: "POST",
                summary: "Create a new user in group",
              },
            ],
          },
        ],
      },
    };
    store.addNode(groupServiceNode);

    // Connect from WebPage action to grouped endpoint handle
    store.onConnect({
      source: "page-1",
      target: "service-grouped",
      sourceHandle: "events-act-upload-1",
      targetHandle: "endpoint-in-ep-grouped-create",
    });

    const pageNode = useBackendCanvasStore.getState().nodes.find((n) => n.id === "page-1");
    const action = pageNode?.data?.sections?.[0]?.actions?.[0];

    expect(action?.actionSteps).toBeDefined();
    expect(action?.actionSteps).toHaveLength(1);
    expect(action?.actionSteps?.[0]?.type).toBe("api_call");
    expect(action?.actionSteps?.[0]?.serviceNodeId).toBe("service-grouped");
    expect(action?.actionSteps?.[0]?.endpointId).toBe("ep-grouped-create");
  });
});

