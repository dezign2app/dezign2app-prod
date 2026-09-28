import { describe, it, expect } from "vitest";
import { renderPipeline, collectPipelineImports } from "../generators/routeGenerator/pipelineRenderer";
import { compileMonorepo } from "../compileMonorepo";
import { generateResponseInterface } from "../generators/typesGenerator/responseInference";
import { BackendNode, BackendEdge, Endpoint } from "@workspace/canvas/types";

describe("Storage Pipeline Step Compilation", () => {
  it("renders storage_operation step with sorted positional arguments and collects imports", () => {
    const endpoint: Endpoint = {
      id: "ep-upload-url",
      name: "/upload-ticket",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          storageNodeId: "storage-node-1",
          bucketId: "user-avatars",
          operationId: "storage-getUploadPresignedUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/storage/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: PresignedUrlOptions): Promise<string>",
          },
          inputBindings: [
            {
              argName: "key",
              source: { kind: "req_body", field: "filename" },
            },
            {
              argName: "bucketName",
              source: { kind: "inline", value: "user-avatars" },
            },
          ],
        },
        {
          id: "step-ret",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 200,
          inputBindings: [
            {
              argName: "url",
              source: { kind: "step_output", stepId: "step-storage-1" },
            },
          ],
        },
      ],
    };

    // 1. Check rendered code
    const lines = renderPipeline(endpoint.pipelineSteps!, "body");
    const fullCode = lines.join("\n");

    expect(fullCode).toContain('await getUploadPresignedUrl("user-avatars", String(body.filename || ""))');
    expect(fullCode).toContain("const uploadUrl =");

    // 2. Check imports
    const importsMap = collectPipelineImports(endpoint.pipelineSteps!);
    const storageImports = importsMap.get("@workspace/storage/operations");
    expect(storageImports).toBeDefined();
    expect(storageImports?.has("getUploadPresignedUrl")).toBe(true);
  });

  it("compiles getUploadPresignedUrl with unpacked option fields (contentType, expiresInSeconds) and filename mapping", () => {
    const endpoint: Endpoint = {
      id: "ep-upload-options",
      name: "/upload-avatar",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          storageNodeId: "storage-node-1",
          bucketId: "user-avatars",
          operationId: "storage-getUploadPresignedUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/storage/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: PresignedUrlOptions): Promise<string>",
          },
          inputBindings: [
            {
              argName: "bucketName",
              source: { kind: "inline", value: "user-avatars" },
            },
            {
              argName: "filename", // bound as filename alias
              source: { kind: "req_body", field: "filename" },
            },
            {
              argName: "contentType",
              source: { kind: "req_body", field: "contentType" },
            },
            {
              argName: "expiresInSeconds",
              source: { kind: "inline", value: 900 },
            },
          ],
        },
      ],
    };

    const lines = renderPipeline(endpoint.pipelineSteps!, "body");
    const fullCode = lines.join("\n");

    expect(fullCode).toContain("const uploadUrl = await getUploadPresignedUrl(");
    expect(fullCode).toContain('"user-avatars", String(body.filename || ""), {');
    expect(fullCode).toContain("contentType: body.contentType");
    expect(fullCode).toContain("expiresInSeconds: 900");
  });

  it("combines folder key and filename (e.g. key: 'profile', filename: 'body.filename')", () => {
    const endpoint: Endpoint = {
      id: "ep-upload-folder",
      name: "/upload-profile-image",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          storageNodeId: "storage-node-1",
          bucketId: "test-bucket",
          operationId: "storage-getUploadPresignedUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/storage/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: PresignedUrlOptions): Promise<string>",
          },
          inputBindings: [
            {
              argName: "bucketName",
              source: { kind: "env", field: "STORAGE_BUCKET_TEST" },
            },
            {
              argName: "key",
              source: { kind: "inline", value: "profile" },
            },
            {
              argName: "filename",
              source: { kind: "req_body", field: "filename" },
            },
            {
              argName: "options",
              source: { kind: "inline", value: "{}" },
            },
          ],
        },
      ],
    };

    const lines = renderPipeline(endpoint.pipelineSteps!, "body");
    const fullCode = lines.join("\n");

    expect(fullCode).toContain('await getUploadPresignedUrl(process.env.STORAGE_BUCKET_TEST, `profile/${String(body.filename || "")}`, {});');
  });

  it("compiles monorepo with service containing storage_operation and connects to @workspace/storage", () => {
    const nodes: BackendNode[] = [
      {
        id: "service-media",
        type: "service",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "Media Service",
          techStack: "express",
          endpoints: [
            {
              id: "ep-1",
              name: "/upload",
              type: "POST",
              pipelineSteps: [
                {
                  id: "step-store",
                  name: "Store Object",
                  type: "storage_operation",
                  enabled: true,
                  outputVariable: "uploaded",
                  storageNodeId: "storage-1",
                  bucketId: "media",
                  functionRef: {
                    name: "uploadObject",
                    importPath: "@workspace/storage/operations",
                  },
                  inputBindings: [
                    { argName: "bucketName", source: { kind: "inline", value: "media" } },
                    { argName: "key", source: { kind: "req_body", field: "filename" } },
                    { argName: "body", source: { kind: "req_body", field: "file" } },
                  ],
                },
                {
                  id: "step-ret",
                  name: "Return",
                  type: "return_response",
                  statusCode: 201,
                  inputBindings: [
                    { argName: "status", source: { kind: "inline", value: "ok" } },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: "storage-1",
        type: "storage",
        position: { x: 300, y: 0 },
        fractionalIndex: "a1",
        data: {
          label: "Storage",
          storageProvider: "s3",
          buckets: [{ id: "b-1", name: "media" }],
        },
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-1",
        type: "connection",
        fractionalIndex: "a0",
        source: "service-media",
        target: "storage-1",
        sourceHandle: "storage-target",
        targetHandle: "storage-target",
      },
    ];

    const monorepo = compileMonorepo(nodes, [], [], edges, [], "StoragePipelineProject");

    // Service package.json depends on @workspace/storage
    const srvPkg = monorepo.files.find((f) => f.filename === "apps/media-service/package.json");
    expect(srvPkg).toBeDefined();
    const parsedPkg = JSON.parse(srvPkg!.content);
    expect(parsedPkg.dependencies["@workspace/storage"]).toBe("workspace:*");

    // Service route imports and executes uploadObject
    const routeFile = monorepo.files.find((f) => f.filename.includes("apps/media-service/src/routes"));
    expect(routeFile).toBeDefined();
    expect(routeFile!.content).toContain("uploadObject");
    expect(routeFile!.content).toContain("@workspace/storage/operations");
  });

  it("safely resolves presigned URL step output when field is 'uploadUrl' or 'url' without generating uploadUrl.uploadUrl", () => {
    const endpoint: Endpoint = {
      id: "ep-upload-image",
      name: "/uploadImage",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload Presigned URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          storageNodeId: "storage-node-1",
          bucketId: "user-avatars",
          operationId: "storage-getUploadPresignedUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/storage/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: PresignedUrlOptions): Promise<string>",
          },
          inputBindings: [
            {
              argName: "key",
              source: { kind: "req_body", field: "filename" },
            },
            {
              argName: "bucketName",
              source: { kind: "inline", value: "user-avatars" },
            },
          ],
        },
        {
          id: "step-ret",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 201,
          inputBindings: [
            {
              argName: "field_1",
              source: { kind: "step_output", stepId: "step-storage-1", field: "uploadUrl" },
            },
          ],
        },
      ],
    };

    const lines = renderPipeline(endpoint.pipelineSteps!, "body");
    const fullCode = lines.join("\n");

    // Must NOT contain invalid uploadUrl.uploadUrl
    expect(fullCode).not.toContain("uploadUrl.uploadUrl");
    // Must map cleanly to field_1: uploadUrl
    expect(fullCode).toContain("field_1: uploadUrl");

    // Also verify TypeScript interface inference for @workspace/types
    const res = generateResponseInterface("PostUploadImageResponse", [], undefined, [], endpoint);
    expect(res.code).toContain("field_1: string;");
    expect(res.code).not.toContain("Record<string");
  });

  it("safely resolves presignedUrl, signedUrl, key, bucket, method, expiresInSeconds from getUploadPresignedUrl step", () => {
    const endpoint: Endpoint = {
      id: "ep-upload-ticket",
      name: "/uploadTicket",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload Presigned URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          storageNodeId: "storage-node-1",
          bucketId: "ticket-attachments",
          operationId: "storage-getUploadPresignedUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/storage/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: PresignedUrlOptions): Promise<string>",
          },
          inputBindings: [
            {
              argName: "key",
              source: { kind: "req_body", field: "filename" },
            },
            {
              argName: "bucketName",
              source: { kind: "inline", value: "ticket-attachments" },
            },
          ],
        },
        {
          id: "step-ret",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 200,
          inputBindings: [
            {
              argName: "presignedUrl",
              source: { kind: "step_output", stepId: "step-storage-1", field: "presignedUrl" },
            },
            {
              argName: "signedUrl",
              source: { kind: "step_output", stepId: "step-storage-1", field: "signedUrl" },
            },
            {
              argName: "fileKey",
              source: { kind: "step_output", stepId: "step-storage-1", field: "key" },
            },
            {
              argName: "targetBucket",
              source: { kind: "step_output", stepId: "step-storage-1", field: "bucket" },
            },
            {
              argName: "httpMethod",
              source: { kind: "step_output", stepId: "step-storage-1", field: "method" },
            },
            {
              argName: "ttlSeconds",
              source: { kind: "step_output", stepId: "step-storage-1", field: "expiresInSeconds" },
            },
          ],
        },
      ],
    };

    const lines = renderPipeline(endpoint.pipelineSteps!, "body");
    const fullCode = lines.join("\n");

    expect(fullCode).not.toContain("uploadUrl.presignedUrl");
    expect(fullCode).not.toContain("uploadUrl.signedUrl");
    expect(fullCode).toContain("presignedUrl: uploadUrl");
    expect(fullCode).toContain("signedUrl: uploadUrl");
    expect(fullCode).toContain("fileKey: String(body.filename || \"\")");
    expect(fullCode).toContain("targetBucket: \"ticket-attachments\"");
    expect(fullCode).toContain("httpMethod: \"PUT\"");
    expect(fullCode).toContain("ttlSeconds: 900");

    const res = generateResponseInterface("PostUploadTicketResponse", [], undefined, [], endpoint);
    expect(res.code).toContain("presignedUrl: string;");
    expect(res.code).toContain("signedUrl: string;");
    expect(res.code).toContain("fileKey: string;");
    expect(res.code).toContain("ttlSeconds: number;");
  });
});
