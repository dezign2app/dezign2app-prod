import { describe, it, expect } from "vitest";
import type { BackendEdge, BackendNode, Endpoint } from "@workspace/canvas";
import type { ActionStepItem } from "../../TargetEndpointSection";
import type {
  FrontendActionStepDraft,
  FrontendRequestFieldBinding,
} from "../types";
import { deriveStepsFromEdges, getActionFlowRuntime } from "../utils";

describe("Frontend Action Flow: deriveStepsFromEdges", () => {
  const dummyEdge1: BackendEdge = {
    id: "edge-web-to-service-1",
    source: "web-page-1",
    target: "service-node-1",
    sourceHandle: "events-action-1",
    targetHandle: "func-in-ep-presign",
    type: "connection",
    data: { sequenceOrder: 1, label: "1" },
    fractionalIndex:"a1",
  };

  const dummyEdge2: BackendEdge = {
    id: "edge-web-to-storage-2",
    source: "web-page-1",
    target: "storage-ref-1",
    sourceHandle: "events-action-1",
    targetHandle: "func-in-uploadObject",
    type: "connection",
    data: {
      sequenceOrder: 2,
      label: "2",
      operationName: "uploadObject",
      bucketId: "media-bucket",
    },
    fractionalIndex:"a0",
  };

  const serviceNode: BackendNode = {
    id: "service-node-1",
    type: "service",
    position: { x: 300, y: 100 },
    fractionalIndex: "a0",
    data: { label: "Upload Service" },
  };

  const storageRefNode: BackendNode = {
    id: "storage-ref-1",
    type: "storage_operation_ref",
    position: { x: 300, y: 300 },
    fractionalIndex: "a1",
    data: { label: "Media Bucket Ref", bucketId: "media-bucket" },
  };

  const presignEndpoint: Endpoint = {
    id: "ep-presign",
    name: "/api/files/presign",
    type: "POST",
  };

  const canvasSteps: ActionStepItem[] = [
    {
      step: 1,
      label: "1",
      edgeId: dummyEdge1.id,
      targetNodeId: serviceNode.id,
      targetNode: serviceNode,
      endpointId: presignEndpoint.id,
      endpoint: presignEndpoint,
      edge: dummyEdge1,
    },
    {
      step: 2,
      label: "2",
      edgeId: dummyEdge2.id,
      targetNodeId: storageRefNode.id,
      targetNode: storageRefNode,
      isStorageRef: true,
      operationName: "uploadObject",
      bucketName: "media-bucket",
      edge: dummyEdge2,
    },
  ];

  it("should derive new drafts from canvas steps with sensible defaults", () => {
    const drafts = deriveStepsFromEdges(canvasSteps);

    expect(drafts).toHaveLength(2);
    const draft1 = drafts[0];
    const draft2 = drafts[1];
    expect(draft1).toBeDefined();
    expect(draft2).toBeDefined();
    if (!draft1 || !draft2) return;

    // Step 1: API Call
    expect(draft1.id).toBe("edge-web-to-service-1");
    expect(draft1.order).toBe(1);
    expect(draft1.type).toBe("api_call");
    expect(draft1.serviceNodeId).toBe("service-node-1");
    expect(draft1.endpointId).toBe("ep-presign");
    expect(draft1.requestBindings).toEqual([]);

    // Step 2: Storage PUT
    expect(draft2.id).toBe("edge-web-to-storage-2");
    expect(draft2.order).toBe(2);
    expect(draft2.type).toBe("storage_put");
    expect(draft2.storageRefNodeId).toBe("storage-ref-1");
    // Auto-defaults presignedUrlSource to Step 1
    expect(draft2.presignedUrlSource).toEqual({
      stepId: "edge-web-to-service-1",
      fieldPath: "presignedUrl",
    });
    expect(draft2.fileSource).toEqual({
      kind: "user_input",
      key: "file",
    });
    expect(draft2.contentType).toBe("application/octet-stream");
  });

  it("should preserve existing saved bindings and custom configurations", () => {
    const existingBinding: FrontendRequestFieldBinding = {
      id: "bind-1",
      targetField: "fileKey",
      source: { kind: "state_var", stateKey: "userFileKey" },
    };

    const existingDrafts: FrontendActionStepDraft[] = [
      {
        id: "edge-web-to-service-1",
        order: 1,
        type: "api_call",
        serviceNodeId: "service-node-1",
        endpointId: "ep-presign",
        requestBindings: [existingBinding],
      },
      {
        id: "edge-web-to-storage-2",
        order: 2,
        type: "storage_put",
        storageRefNodeId: "storage-ref-1",
        presignedUrlSource: {
          stepId: "edge-web-to-service-1",
          fieldPath: "data.uploadUrl",
        },
        fileSource: {
          kind: "state_var",
          key: "cachedBlob",
        },
        contentType: "image/png",
      },
    ];

    const derived = deriveStepsFromEdges(canvasSteps, existingDrafts);

    expect(derived).toHaveLength(2);
    const draft1 = derived[0];
    const draft2 = derived[1];
    expect(draft1).toBeDefined();
    expect(draft2).toBeDefined();
    if (!draft1 || !draft2) return;

    expect(draft1.requestBindings).toEqual([existingBinding]);
    expect(draft2.presignedUrlSource?.fieldPath).toBe("data.uploadUrl");
    expect(draft2.fileSource).toEqual({
      kind: "state_var",
      key: "cachedBlob",
    });
    expect(draft2.contentType).toBe("image/png");
  });

  it("should renumber orders and remove deleted edges", () => {
    // Only Step 2 remains in canvas (edge 1 was deleted)
    const step2 = canvasSteps[1];
    expect(step2).toBeDefined();
    if (!step2) return;

    const singleStep: ActionStepItem[] = [
      {
        ...step2,
        step: 1,
        label: "1",
      },
    ];

    const existingDrafts: FrontendActionStepDraft[] = [
      {
        id: "edge-web-to-service-1",
        order: 1,
        type: "api_call",
        serviceNodeId: "service-node-1",
      },
      {
        id: "edge-web-to-storage-2",
        order: 2,
        type: "storage_put",
        storageRefNodeId: "storage-ref-1",
        contentType: "image/jpeg",
      },
    ];

    const derived = deriveStepsFromEdges(singleStep, existingDrafts);

    expect(derived).toHaveLength(1);
    const draft1 = derived[0];
    expect(draft1).toBeDefined();
    if (!draft1) return;

    expect(draft1.id).toBe("edge-web-to-storage-2");
    expect(draft1.order).toBe(1);
    expect(draft1.contentType).toBe("image/jpeg");
  });

  it("should generate a clear runtime execution plan", () => {
    const drafts = deriveStepsFromEdges(canvasSteps);
    const plan = getActionFlowRuntime(
      { id: "act-upload", name: "Submit Avatar" },
      canvasSteps,
      drafts,
    );

    expect(plan).toContain("Runtime execution plan for: Submit Avatar");
    expect(plan).toContain("Step 1: [API CALL] POST /api/files/presign (Upload Service)");
    expect(plan).toContain("Step 2: [STORAGE PUT] -> media-bucket (uploadObject)");
    expect(plan).toContain("URL: Step 1.presignedUrl");
  });
});
