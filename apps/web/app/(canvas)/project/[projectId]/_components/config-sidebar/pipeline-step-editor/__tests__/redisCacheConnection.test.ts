import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { ensureRedisCacheConnection, cleanupRedisCacheConnection } from "../utils";
import { PipelineStepDraft } from "../types";

describe("pipeline-step-editor: Redis Cache Node and Edge Synchronization", () => {
  const serviceNodeId = "service-1";
  const endpointId = "ep-user-cache";
  const redisSchemaId = "schema-user";
  const redisInstanceId = "redis-inst-1";

  beforeEach(() => {
    useBackendCanvasStore.setState({
      nodes: [
        {
          id: serviceNodeId,
          type: "service",
          position: { x: 100, y: 100 },
          fractionalIndex: "a0",
          data: { label: "User Service" },
        },
        {
          id: redisInstanceId,
          type: "redis_instance",
          position: { x: 500, y: 100 },
          fractionalIndex: "a1",
          data: { label: "Redis Main", dbEngine: "redis" },
        },
        {
          id: redisSchemaId,
          type: "redis_schema",
          position: { x: 500, y: 250 },
          fractionalIndex: "a2",
          data: { label: "User Cache Schema", databaseId: redisInstanceId },
        },
      ],
      edges: [],
      endpoints: [
        {
          id: endpointId,
          nodeId: serviceNodeId,
          name: "Get User",
          type: "GET",
        },
      ],
    });
  });

  it("creates a redis-cache node and draws an edge from ServiceNode endpoint if redis-cache node does not exist", () => {
    const cacheNodeId = ensureRedisCacheConnection({
      schemaId: redisSchemaId,
      instanceId: redisInstanceId,
      serviceNodeId,
      endpointId,
    });

    expect(cacheNodeId).toBeDefined();

    const state = useBackendCanvasStore.getState();
    const createdCacheNode = state.nodes.find((n) => n.id === cacheNodeId);
    expect(createdCacheNode).toBeDefined();
    expect(createdCacheNode?.type).toBe("redis-cache");
    expect(createdCacheNode?.data?.schemaRef).toBe(redisSchemaId);

    const createdEdge = state.edges.find(
      (e) =>
        e.source === serviceNodeId &&
        e.target === cacheNodeId &&
        e.sourceHandle === `endpoint-out-${endpointId}` &&
        e.targetHandle === "database-target",
    );
    expect(createdEdge).toBeDefined();
    expect(createdEdge?.type).toBe("connection");
  });

  it("reuses existing redis-cache node if one already exists for the schema", () => {
    const existingCacheNodeId = "existing-redis-cache-1";
    useBackendCanvasStore.getState().addNode({
      id: existingCacheNodeId,
      type: "redis-cache",
      position: { x: 450, y: 150 },
      data: {
        label: "User Cache Schema",
        schemaRef: redisSchemaId,
        databaseId: redisInstanceId,
      },
    });

    const returnedId = ensureRedisCacheConnection({
      schemaId: redisSchemaId,
      instanceId: redisInstanceId,
      serviceNodeId,
      endpointId,
    });

    expect(returnedId).toBe(existingCacheNodeId);

    const state = useBackendCanvasStore.getState();
    const cacheNodes = state.nodes.filter((n) => n.type === "redis-cache");
    expect(cacheNodes.length).toBe(1);

    const edge = state.edges.find(
      (e) =>
        e.source === serviceNodeId &&
        e.target === existingCacheNodeId &&
        e.sourceHandle === `endpoint-out-${endpointId}` &&
        e.targetHandle === "database-target",
    );
    expect(edge).toBeDefined();
  });

  it("deletes the edge when the step is deleted and no other step uses the Redis cache", () => {
    const cacheNodeId = ensureRedisCacheConnection({
      schemaId: redisSchemaId,
      instanceId: redisInstanceId,
      serviceNodeId,
      endpointId,
    });

    let state = useBackendCanvasStore.getState();
    expect(state.edges.length).toBe(1);

    cleanupRedisCacheConnection({
      tableNodeId: redisSchemaId,
      databaseId: redisInstanceId,
      serviceNodeId,
      endpointId,
      remainingSteps: [],
    });

    state = useBackendCanvasStore.getState();
    const remainingEdges = state.edges.filter(
      (e) => e.source === serviceNodeId && e.target === cacheNodeId,
    );
    expect(remainingEdges.length).toBe(0);
  });

  it("keeps the edge if another redis_operation step in the pipeline still uses the schema", () => {
    const cacheNodeId = ensureRedisCacheConnection({
      schemaId: redisSchemaId,
      instanceId: redisInstanceId,
      serviceNodeId,
      endpointId,
    });

    const otherStep: PipelineStepDraft = {
      id: "step-2",
      name: "setCacheResult",
      type: "redis_operation",
      tableNodeId: redisSchemaId,
      enabled: true,
      inputBindings: [],
      outputVariable: "setCacheResult",
    };

    cleanupRedisCacheConnection({
      tableNodeId: redisSchemaId,
      databaseId: redisInstanceId,
      serviceNodeId,
      endpointId,
      remainingSteps: [otherStep],
    });

    const state = useBackendCanvasStore.getState();
    const remainingEdges = state.edges.filter(
      (e) => e.source === serviceNodeId && e.target === cacheNodeId,
    );
    expect(remainingEdges.length).toBe(1);
  });
});
