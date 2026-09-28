import { describe, it, expect } from "vitest";
import { BackendNode, Endpoint, PipelineStep } from "@workspace/canvas/types";
import {
  collectReferencedEnvVars,
  cleanEnvVarName,
} from "../generators/routeGenerator/pipeline/envCollector";
import { renderPipeline } from "../generators/routeGenerator/pipeline";
import { generateEndpointRouteHandler } from "../generators/routeGenerator";
import { compileServiceNode } from "../compileServiceNode";

describe("compileServiceNode: env variable validation and type narrowing", () => {
  it("cleanEnvVarName strips process.env and template syntax properly", () => {
    expect(cleanEnvVarName("STORAGE_BUCKET_NAME")).toBe("STORAGE_BUCKET_NAME");
    expect(cleanEnvVarName("process.env.STORAGE_BUCKET_NAME")).toBe("STORAGE_BUCKET_NAME");
    expect(cleanEnvVarName("${process.env.API_KEY}")).toBe("API_KEY");
    expect(cleanEnvVarName('process.env["CUSTOM_KEY"]')).toBe("CUSTOM_KEY");
    expect(cleanEnvVarName("")).toBe("");
    expect(cleanEnvVarName(undefined)).toBe("");
  });

  it("collectReferencedEnvVars extracts and deduplicates env variables from pipeline steps", () => {
    const steps: PipelineStep[] = [
      {
        id: "step-1",
        name: "Upload Image",
        type: "storage_operation",
        enabled: true,
        inputBindings: [
          { argName: "bucketName", source: { kind: "env", field: "STORAGE_BUCKET_NAME" } },
          { argName: "key", source: { kind: "req_body", field: "filename" } },
        ],
      },
      {
        id: "step-2",
        name: "Charge Card",
        type: "transform",
        enabled: true,
        inputBindings: [
          { argName: "apiKey", source: { kind: "env", field: "STRIPE_SECRET_KEY" } },
          // duplicate reference to STORAGE_BUCKET_NAME should be deduped
          { argName: "bucket", source: { kind: "env", field: "process.env.STORAGE_BUCKET_NAME" } },
        ],
      },
      {
        id: "step-3",
        name: "Check Env Condition",
        type: "condition",
        enabled: true,
        conditionExpr: {
          left: { kind: "env", field: "FEATURE_FLAG_ENABLED" },
          operator: "eq",
          right: { kind: "inline", value: "true" },
        },
        thenSteps: [
          {
            id: "step-sub-1",
            name: "Sub Step",
            type: "transform",
            enabled: true,
            inputBindings: [
              { argName: "token", source: { kind: "env", field: "JWT_SECRET" } },
            ],
          },
        ],
      },
    ];

    const envVars = collectReferencedEnvVars(steps);
    expect(envVars).toEqual([
      "STORAGE_BUCKET_NAME",
      "STRIPE_SECRET_KEY",
      "FEATURE_FLAG_ENABLED",
      "JWT_SECRET",
    ]);
  });

  it("renderPipeline emits validation checks that throw if env vars do not exist", () => {
    const steps: PipelineStep[] = [
      {
        id: "step-storage-1",
        name: "Get Upload Presigned URL",
        type: "storage_operation",
        enabled: true,
        outputVariable: "uploadUrl",
        functionRef: {
          name: "getUploadPresignedUrl",
          importPath: "@workspace/storage/operations",
        },
        inputBindings: [
          { argName: "bucketName", source: { kind: "env", field: "STORAGE_BUCKET_NAME" } },
          { argName: "key", source: { kind: "req_body", field: "filename" } },
        ],
      },
    ];

    const lines = renderPipeline(steps, "body");
    const code = lines.join("\n");

    // Must check process.env.STORAGE_BUCKET_NAME and throw an error if not set
    expect(code).toContain("// Validate required environment variables");
    expect(code).toContain("if (!process.env.STORAGE_BUCKET_NAME) {");
    expect(code).toContain('throw new Error("Environment variable STORAGE_BUCKET_NAME is required but not set.");');

    // And use process.env.STORAGE_BUCKET_NAME without any type casting (no 'as string', 'as any', 'unknown')
    expect(code).toContain("getUploadPresignedUrl(process.env.STORAGE_BUCKET_NAME");
    expect(code).not.toContain("as any");
    expect(code).not.toContain("as unknown");
    expect(code).not.toContain("as string");
  });

  it("compileServiceNode generates route handler with env check and clean TypeScript typing", () => {
    const serviceNode: BackendNode = {
      id: "service-profile",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "profile",
        techStack: "express",
        envVars: [
          { id: "e1", name: "STORAGE_BUCKET_NAME" },
        ],
      },
    };

    const ep: Endpoint & { nodeId: string } = {
      id: "ep-upload-image",
      nodeId: "service-profile",
      name: "/upload-image",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-storage-1",
          name: "Get Upload Presigned URL",
          type: "storage_operation",
          enabled: true,
          outputVariable: "uploadUrl",
          functionRef: {
            name: "getUploadPresignedUrl",
            importPath: "@workspace/storage/operations",
            signature: "getUploadPresignedUrl(bucketName: string, key: string, options?: any): Promise<string>",
          },
          inputBindings: [
            { argName: "bucketName", source: { kind: "env", field: "STORAGE_BUCKET_NAME" } },
            { argName: "key", source: { kind: "req_body", field: "filename" } },
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
              argName: "uploadUrl",
              source: { kind: "step_output", stepId: "step-storage-1", field: "uploadUrl" },
            },
          ],
        },
      ],
    };

    const result = compileServiceNode(
      serviceNode,
      [ep],
      [],
      [serviceNode],
      [],
      [],
      [],
      [],
      "profile",
    );

    const routeFile = result.files.find((f) => f.filename === "src/routes/postUploadImage.ts");
    expect(routeFile).toBeDefined();
    const content = routeFile!.content;

    // Verify error throwing check
    expect(content).toContain("if (!process.env.STORAGE_BUCKET_NAME) {");
    expect(content).toContain('throw new Error("Environment variable STORAGE_BUCKET_NAME is required but not set.");');

    // Verify step invocation passing the narrowed variable
    expect(content).toContain("await getUploadPresignedUrl(process.env.STORAGE_BUCKET_NAME, String(body.filename || \"\"));");

    // Verify avoidance of any, unknown, or as xyz types
    expect(content).not.toContain("as any");
    expect(content).not.toContain("as unknown");
    expect(content).not.toContain("process.env.STORAGE_BUCKET_NAME as");
  });
});
