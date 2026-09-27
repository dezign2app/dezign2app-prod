import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, ReusableFunction } from "@workspace/canvas/types";
import { generateEndpointRouteHandler } from "../generators/routeGenerator/endpointHandlerGenerator";
import { generatePageAndComponentFiles } from "../webClients/nextjs/v16/pageFileGenerator";
import { resolvePagesInfo } from "../webClients/nextjs/v16/pageResolver";

describe("StorageRef Node Integration: WebPage Action & Service Endpoint", () => {
  const storageFunctions: ReusableFunction[] = [
    {
      name: "getUploadPresignedUrl",
      importPath: "@workspace/storage/operations",
      signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: any): Promise<string>",
      targetName: "storage",
      kind: "custom",
    },
    {
      name: "STORAGE_BUCKETS",
      importPath: "@workspace/storage/operations",
      signature: "const STORAGE_BUCKETS: Record<string, string>",
      targetName: "storage",
      kind: "custom",
    },
  ];

  it("generates presign-URL upload handler in service endpoint when connected to StorageRef node", () => {
    const storageRefNode: BackendNode = {
      id: "storage-ref-1",
      type: "StorageBucketRefNode",
      position: { x: 400, y: 100 },
      fractionalIndex: "a2",
      data: {
        label: "user-media",
        storageNodeId: "storage-node-1",
        bucketId: "user-media",
        bucketName: "user-media",
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

    const serviceNode: BackendNode = {
      id: "service-profile",
      type: "service",
      position: { x: 800, y: 100 },
      fractionalIndex: "a3",
      data: {
        label: "profile-service",
        endpoints: [
          {
            id: "ep-upload-img",
            name: "upload-image",
            type: "POST",
          },
        ],
      },
    };

    const ep: Endpoint & { nodeId: string } = {
      id: "ep-upload-img",
      nodeId: "service-profile",
      name: "upload-image",
      type: "POST",
    };

    const edgeRefToSvc: BackendEdge = {
      id: "edge-ref-svc",
      source: storageRefNode.id,
      sourceHandle: "func-out-getUploadPresignedUrl",
      target: serviceNode.id,
      targetHandle: "endpoint-in-ep-upload-img",
      type: "connection",
      fractionalIndex: "e1",
    };

    const allNodes: BackendNode[] = [storageRefNode, serviceNode];
    const allEdges: BackendEdge[] = [edgeRefToSvc];
    const allEndpoints = [ep];

    const result = generateEndpointRouteHandler({
      ep,
      index: 0,
      serviceName: "profile-service",
      pascalServiceName: "ProfileService",
      serviceFolderName: "profile_service",
      serviceNode,
      allNodes,
      allEdges,
      allEndpoints,
      dbFunctions: [],
      kafkaFunctions: [],
      storageFunctions,
      nodePublishedEvents: [],
      usedFileNames: new Set(),
    });

    expect(result.file.content).toContain('await import("@workspace/storage/operations")');
    expect(result.file.content).toContain("getUploadPresignedUrl");
    expect(result.file.content).toContain("fileName");
    expect(result.file.content).toContain("fileType");
    expect(result.file.content).toContain("res.status(200).json({ signedUrl, key: objectKey })");
  });

  it("generates file input component with size & MIME constraints when WebPage action is connected to StorageRef", () => {
    const webPageNode: BackendNode = {
      id: "page-profile",
      type: "webPage",
      position: { x: 50, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Profile",
        path: "/profile",
        sections: [
          {
            id: "sec-main",
            name: "Main",
            renderMode: "client",
            actions: [
              {
                id: "act-upload",
                name: "Upload Image",
                event: "click",
              },
            ],
            stateObjects: [],
          },
        ],
      },
    };

    const storageNode: BackendNode = {
      id: "storage-node-1",
      type: "storage",
      position: { x: 300, y: 500 },
      fractionalIndex: "a1",
      data: {
        label: "Storage",
        storageProvider: "s3",
        buckets: [
          {
            id: "b-avatars",
            name: "user-avatars",
            kind: "bucket",
            maxFileSize: "5MB",
            allowedExtensions: "image/jpeg,image/png",
          },
        ],
      },
    };

    const storageRefNode: BackendNode = {
      id: "storage-ref-1",
      type: "StorageBucketRefNode",
      position: { x: 400, y: 100 },
      fractionalIndex: "a2",
      data: {
        label: "user-avatars",
        storageNodeId: "storage-node-1",
        bucketId: "b-avatars",
        bucketName: "user-avatars",
        storageProvider: "s3",
      },
    };

    const serviceNode: BackendNode = {
      id: "service-profile",
      type: "service",
      position: { x: 800, y: 100 },
      fractionalIndex: "a3",
      data: {
        label: "ProfileService",
        port: 8080,
        endpoints: [
          {
            id: "ep-upload",
            name: "upload-image",
            type: "POST",
          },
        ],
      },
    };

    const ep: Endpoint & { nodeId: string } = {
      id: "ep-upload",
      nodeId: "service-profile",
      name: "upload-image",
      type: "POST",
    };

    // Edges:
    // WebPage action -> StorageRef
    const edgePageToRef: BackendEdge = {
      id: "edge-page-ref",
      source: webPageNode.id,
      sourceHandle: "events-act-upload",
      target: storageRefNode.id,
      targetHandle: "storage-ref-header",
      type: "connection",
      fractionalIndex: "e0",
    };
    // StorageRef -> Service endpoint
    const edgeRefToSvc: BackendEdge = {
      id: "edge-ref-svc",
      source: storageRefNode.id,
      sourceHandle: "func-out-getUploadPresignedUrl",
      target: serviceNode.id,
      targetHandle: "endpoint-in-ep-upload",
      type: "connection",
      fractionalIndex: "e1",
    };

    const allNodes: BackendNode[] = [webPageNode, storageNode, storageRefNode, serviceNode];
    const allEdges: BackendEdge[] = [edgePageToRef, edgeRefToSvc];
    const allEndpoints = [ep];

    const pagesInfo = resolvePagesInfo(
      [webPageNode],
      allNodes,
      allEdges,
      "web-app",
      undefined,
      undefined,
      allEndpoints,
      [],
    );

    const result = generatePageAndComponentFiles({
      webClientNodes: [webPageNode],
      pagesInfo,
      allNodes,
      allEdges,
      endpoints: allEndpoints,
    });

    const uploadActionFile = result.pageFiles.find(
      (f) => f.filename.includes("UploadImage") || f.filename.includes("Upload"),
    );

    expect(uploadActionFile).toBeDefined();
    const content = uploadActionFile!.content;

    // Verify constraints from bucket config
    expect(content).toContain("MAX_FILE_SIZE_MB = 5");
    expect(content).toContain('ACCEPTED_TYPES: string = "image/jpeg,image/png"');

    // Verify file input element
    expect(content).toContain("<input");
    expect(content).toContain('type="file"');
    expect(content).toContain('accept="image/jpeg,image/png"');

    // Verify validation & inline warning
    expect(content).toContain("Unsupported type:");
    expect(content).toContain("File too large");

    // Verify 2-step direct upload flow (presign + fetch PUT)
    expect(content).toContain('method: "PUT"');
    expect(content).toContain("onTrigger?.(");
  });
});
