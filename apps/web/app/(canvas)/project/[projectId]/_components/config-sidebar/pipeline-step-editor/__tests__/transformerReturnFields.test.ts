import { describe, it, expect, vi } from "vitest";
import { getAvailableSources } from "../utils";
import { PipelineStepDraft } from "../types";
import { Endpoint, BackendNode } from "@workspace/canvas/types";
import { renderHook, act } from "@testing-library/react";
import { useStepRowState } from "../useStepRowState";

describe("pipeline-step-editor: transformer step return fields introspection", () => {
  const mockEndpoint: Endpoint = {
    id: "ep-test-1",
    name: "Test Endpoint",
    type: "POST",
    pathParams: [],
    queryParams: [],
    requestBody: { id: "rb-1", fields: [] },
  };

  it("extracts return schema fields (key, value, nested) from canvas transformer node and strips dummy result", () => {
    const transformerNode: BackendNode = {
      id: "node-transformer-1",
      type: "transformer",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "transform req to cache",
        functionName: "transformReqToCache",
        code: `export function transformReqToCache({ sender, message, conversation_id }) {
  return {
    key: conversation_id,
    value: { message, sender }
  };
}`,
        returnSchema: [
          { id: "p-1", name: "key", type: "string", required: true },
          {
            id: "p-2",
            name: "value",
            type: "TransformReqToCacheOutput",
            required: true,
            nestedFields: [
              { id: "p-2-1", name: "message", type: "string", required: true },
              { id: "p-2-2", name: "sender", type: "string", required: true },
            ],
          },
        ],
      },
    };

    // Step 1: Transformer step holding the initial dummy outputSchema
    const priorTransformStep: PipelineStepDraft = {
      id: "step-transform-1",
      name: "transformReqToCacheResult",
      type: "transform",
      enabled: true,
      outputVariable: "transformReqToCacheResult",
      transformerNodeId: "node-transformer-1",
      functionRef: {
        name: "transformReqToCache",
        importPath: "./transformers/transformReqToCache",
      },
      outputSchema: [{ name: "result", type: "string", required: true }],
    };

    const sources = getAvailableSources(
      mockEndpoint,
      [priorTransformStep],
      [transformerNode],
    );

    const stepSource = sources.find((s) => s.id === "step:step-transform-1");
    expect(stepSource).toBeDefined();

    const paths = stepSource?.paths.map((p) => p.path) || [];
    // Verify real returned fields are present
    expect(paths).toContain("key");
    expect(paths).toContain("value");
    expect(paths).toContain("value.message");
    expect(paths).toContain("value.sender");

    // Verify placeholder dummy 'result' was stripped
    expect(paths).not.toContain("result");
  });

  it("extracts return fields when step references transformer by functionRef name even if transformerNodeId differs", () => {
    const transformerNode: BackendNode = {
      id: "node-transformer-2",
      type: "transformer",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "buildUserCacheKey",
        functionName: "buildUserCacheKey",
        returnSchema: [
          { id: "p-cacheKey", name: "cacheKey", type: "string", required: true },
          { id: "p-ttl", name: "ttl", type: "number", required: true },
        ],
      },
    };

    const priorTransformStep: PipelineStepDraft = {
      id: "step-transform-2",
      name: "buildUserCacheKeyResult",
      type: "transform",
      enabled: true,
      outputVariable: "buildUserCacheKeyResult",
      functionRef: {
        name: "buildUserCacheKey",
        importPath: "./transformers/buildUserCacheKey",
      },
      outputSchema: [{ name: "result", type: "string", required: true }],
    };

    const sources = getAvailableSources(
      mockEndpoint,
      [priorTransformStep],
      [transformerNode],
    );

    const stepSource = sources.find((s) => s.id === "step:step-transform-2");
    const paths = stepSource?.paths.map((p) => p.path) || [];

    expect(paths).toContain("cacheKey");
    expect(paths).toContain("ttl");
    expect(paths).not.toContain("result");
  });

  it("dereferences transformer_ref nodes to find master transformer return schema", () => {
    const masterTransformerNode: BackendNode = {
      id: "master-transformer-1",
      type: "transformer",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "globalSanitize",
        functionName: "globalSanitize",
        scope: "global",
        returnSchema: [
          { id: "p-clean", name: "cleanData", type: "string", required: true },
          { id: "p-valid", name: "isValid", type: "boolean", required: true },
        ],
      },
    };

    const refNode: BackendNode = {
      id: "ref-transformer-1",
      type: "transformer_ref",
      position: { x: 0, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "globalSanitize (Ref)",
        transformerRef: "master-transformer-1",
      },
    };

    const priorTransformStep: PipelineStepDraft = {
      id: "step-transform-3",
      name: "globalSanitizeResult",
      type: "transform",
      enabled: true,
      outputVariable: "globalSanitizeResult",
      transformerNodeId: "ref-transformer-1",
      functionRef: {
        name: "globalSanitize",
        importPath: "@workspace/transformers",
      },
      outputSchema: [{ name: "result", type: "string", required: true }],
    };

    const sources = getAvailableSources(
      mockEndpoint,
      [priorTransformStep],
      [masterTransformerNode, refNode],
    );

    const stepSource = sources.find((s) => s.id === "step:step-transform-3");
    const paths = stepSource?.paths.map((p) => p.path) || [];

    expect(paths).toContain("cleanData");
    expect(paths).toContain("isValid");
    expect(paths).not.toContain("result");
  });

  it("auto-maps Redis argument 'key' to prior transformer step's 'key' field", () => {
    const transformerNode: BackendNode = {
      id: "node-transformer-1",
      type: "transformer",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "transformReqToCache",
        functionName: "transformReqToCache",
        returnSchema: [
          { id: "p-redis-key", name: "key", type: "string", required: true },
          { id: "p-redis-val", name: "value", type: "TransformReqToCacheOutput", required: true },
        ],
      },
    };

    const priorTransformStep: PipelineStepDraft = {
      id: "step-transform-1",
      name: "transformReqToCacheResult",
      type: "transform",
      enabled: true,
      outputVariable: "transformReqToCacheResult",
      transformerNodeId: "node-transformer-1",
      functionRef: {
        name: "transformReqToCache",
        importPath: "./transformers/transformReqToCache",
      },
      outputSchema: [{ name: "result", type: "string", required: true }],
    };

    const redisStep: PipelineStepDraft = {
      id: "step-redis-1",
      name: "appendConversationItemResult",
      type: "redis_operation",
      enabled: true,
      outputVariable: "appendConversationItemResult",
      operationId: "appendConversationItem",
      functionRef: {
        name: "appendConversationItem",
        importPath: "@workspace/redis/client",
      },
      inputBindings: [],
    };

    let updatedStep: PipelineStepDraft = redisStep;
    const onChange = vi.fn((u) => {
      updatedStep = u;
    });

    const { result } = renderHook(() =>
      useStepRowState({
        step: redisStep,
        index: 1,
        priorSteps: [priorTransformStep],
        endpoint: mockEndpoint,
        allNodes: [transformerNode],
        allEdges: [],
        onChange,
      }),
    );

    // Run auto-mapping on Redis step
    act(() => {
      result.current.handleAutoMapArguments();
    });

    const keyBinding = updatedStep.inputBindings?.find((b) => b.argName === "key");
    expect(keyBinding).toBeDefined();
    expect(keyBinding?.source.kind).toBe("step_output");
    if (keyBinding?.source.kind === "step_output") {
      expect(keyBinding.source.stepId).toBe("step-transform-1");
      expect(keyBinding.source.field).toBe("key");
    }
  });
});
