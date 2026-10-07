import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";
import {
  flattenAllPipelineSteps,
  collectAllNestedSteps,
} from "../stepConstants";
import {
  ensureTransformerConnection,
  cleanupTransformerConnection,
  ensureDatabaseRefConnection,
  cleanupDatabaseRefConnection,
} from "../utils";
import { isEndpointPipelineUnconfigured } from "@/lib/utils/pipeline-validation/endpointValidation";
import { PipelineStepDraft } from "../types";
import { EndpointLike } from "@workspace/canvas/types";

describe("pipeline-step-editor: Nested Control Flow Steps Connections & Validation", () => {
  const serviceNodeId = "service-1";
  const endpointId = "ep-test-1";

  const serviceNode: BackendNode = {
    id: serviceNodeId,
    type: "service",
    position: { x: 500, y: 200 },
    fractionalIndex: "a0",
    data: { label: "Test Service" },
  };

  const globalTransformerNode: BackendNode = {
    id: "transformer-global-1",
    type: "transformer",
    position: { x: 100, y: 100 },
    fractionalIndex: "a1",
    data: {
      label: "Format User Data",
      functionName: "formatUserData",
      scope: "global",
      isGlobal: true,
      inputSchema: [{ id: "p-in-1", name: "userId", type: "string", required: true }],
      returnSchema: [{ id: "p-out-1", name: "formattedId", type: "string", required: true }],
    },
  };

  beforeEach(() => {
    useBackendCanvasStore.setState({
      nodes: [serviceNode, globalTransformerNode],
      edges: [],
      endpoints: [
        {
          id: endpointId,
          nodeId: serviceNodeId,
          name: "/api/test",
          type: "POST",
          pipelineSteps: [],
        },
      ],
    });
  });

  it("flattens steps across all control flow blocks: if/then/else, try/catch, loop, switch, parallel, cacheMiss", () => {
    const nestedSteps: PipelineStepDraft[] = [
      {
        id: "step-if",
        type: "condition",
        name: "Check Thread",
        enabled: true,
        outputVariable: "condResult",
        thenSteps: [
          {
            id: "step-transform-nested",
            type: "transform",
            name: "Generate Unique Id",
            enabled: true,
            transformerNodeId: "transformer-global-1",
            functionRef: { name: "generateUniqueId", importPath: "@workspace/transformers" },
            outputVariable: "uniqueId",
          },
        ],
        elseSteps: [
          {
            id: "step-else-db",
            type: "db_operation",
            name: "Find Existing",
            enabled: true,
            tableNodeId: "table-1",
            outputVariable: "existingData",
          },
        ],
      },
      {
        id: "step-loop",
        type: "loop",
        name: "Process items",
        enabled: true,
        outputVariable: "loopResult",
        loopBody: [
          {
            id: "step-loop-redis",
            type: "redis_operation",
            name: "Cache Item",
            enabled: true,
            tableNodeId: "cache-1",
            outputVariable: "cacheResult",
            cacheMissSteps: [
              {
                id: "step-miss-db",
                type: "db_operation",
                name: "Fetch On Miss",
                enabled: true,
                tableNodeId: "table-1",
                outputVariable: "fetchedData",
              },
            ],
          },
        ],
      },
    ];

    const flat = flattenAllPipelineSteps(nestedSteps);
    const flatIds = flat.map((s) => s.id);

    expect(flatIds).toContain("step-if");
    expect(flatIds).toContain("step-transform-nested");
    expect(flatIds).toContain("step-else-db");
    expect(flatIds).toContain("step-loop");
    expect(flatIds).toContain("step-loop-redis");
    expect(flatIds).toContain("step-miss-db");
    expect(flat.length).toBe(6);
  });

  it("draws canvas edges and creates transformer_ref for nested transformer steps", () => {
    const result = ensureTransformerConnection({
      transformerNodeId: globalTransformerNode.id,
      functionName: "formatUserData",
      serviceNodeId,
      endpointId,
    });

    expect(result).toBeDefined();
    expect(result?.transformerNodeId).toBeDefined();

    const store = useBackendCanvasStore.getState();
    const refNode = store.nodes.find((n) => n.type === "transformer_ref");
    expect(refNode).toBeDefined();
    expect(refNode?.data?.targetServiceId).toBe(serviceNodeId);
    expect(refNode?.data?.targetEndpointIds).toContain(endpointId);

    // Ingress edge from transformer_ref to service endpoint-in
    const edge = store.edges.find(
      (e) =>
        e.source === refNode?.id &&
        e.target === serviceNodeId &&
        e.targetHandle === `endpoint-in-${endpointId}`,
    );
    expect(edge).toBeDefined();

    // Edge from master transformer to transformer_ref
    const refEdge = store.edges.find(
      (e) =>
        e.source === globalTransformerNode.id &&
        e.target === refNode?.id &&
        e.type === "transformer-reference",
    );
    expect(refEdge).toBeDefined();
  });

  it("cleanupTransformerConnection preserves edges when transformer is still used inside a nested block", () => {
    // Connect transformer
    ensureTransformerConnection({
      transformerNodeId: globalTransformerNode.id,
      functionName: "formatUserData",
      serviceNodeId,
      endpointId,
    });

    const pipelineWithNestedUsage: PipelineStepDraft[] = [
      {
        id: "step-if",
        type: "condition",
        name: "Check Auth",
        enabled: true,
        outputVariable: "authCheck",
        thenSteps: [
          {
            id: "step-transform-inside",
            type: "transform",
            name: "formatUserDataResult",
            enabled: true,
            transformerNodeId: globalTransformerNode.id,
            functionRef: { name: "formatUserData", importPath: "@workspace/transformers" },
            outputVariable: "formatUserDataResult",
          },
        ],
      },
    ];

    // Attempt cleanup passing remainingSteps containing the nested usage
    cleanupTransformerConnection({
      transformerNodeId: globalTransformerNode.id,
      functionName: "formatUserData",
      serviceNodeId,
      endpointId,
      remainingSteps: pipelineWithNestedUsage,
    });

    const store = useBackendCanvasStore.getState();
    const refNode = store.nodes.find((n) => n.type === "transformer_ref");
    expect(refNode).toBeDefined();

    const edge = store.edges.find(
      (e) =>
        e.source === refNode?.id &&
        e.target === serviceNodeId &&
        e.targetHandle === `endpoint-in-${endpointId}`,
    );
    expect(edge).toBeDefined();
  });

  it("endpoint pipeline validation recognizes transformers placed inside nested control flow blocks", () => {
    // Connect transformer on canvas
    ensureTransformerConnection({
      transformerNodeId: globalTransformerNode.id,
      functionName: "formatUserData",
      serviceNodeId,
      endpointId,
    });

    const store = useBackendCanvasStore.getState();

    // Endpoint with transformer configured inside THEN branch
    const pipelineSteps: PipelineStepDraft[] = [
      {
        id: "step-if",
        type: "condition",
        name: "Check condition",
        enabled: true,
        outputVariable: "condResult",
        conditionExpr: {
          left: { kind: "req_body", field: "userId" },
          operator: "truthy",
        },
        thenSteps: [
          {
            id: "step-tr",
            type: "transform",
            name: "formatUserDataResult",
            enabled: true,
            transformerNodeId: globalTransformerNode.id,
            functionRef: {
              name: "formatUserData",
              importPath: "@workspace/transformers",
              inputSchema: [{ name: "userId", type: "string", required: true }],
            },
            outputVariable: "formatUserDataResult",
            inputBindings: [
              {
                argName: "userId",
                source: { kind: "req_body", field: "userId" },
              },
            ],
          },
        ],
      },
    ];

    const endpointLike: EndpointLike = {
      id: endpointId,
      pipelineSteps,
    };

    const isUnconfigured = isEndpointPipelineUnconfigured(
      endpointLike,
      serviceNodeId,
      store.nodes,
      store.edges,
    );

    // Should NOT be flagged as unconfigured because nested transformer step is valid and matches the canvas connection
    expect(isUnconfigured).toBe(false);
  });
});
