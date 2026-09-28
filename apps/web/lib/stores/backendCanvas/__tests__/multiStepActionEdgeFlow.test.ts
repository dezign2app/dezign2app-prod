import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode, BackendEdge } from "@/types/canvas";

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
});
