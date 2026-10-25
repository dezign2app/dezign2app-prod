import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";
import { Endpoint, EndpointWithNode } from "@workspace/canvas";
import { cleanupDeletedEdgesState } from "../stateCleanup";
import { getConnectedDbRefsForEndpoint } from "@/lib/utils/pipelineValidation";

describe("DatabaseTableRefNode Edge Flow: DatabaseTableRefNode -> ServiceNode", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-db-ref-edge-test");
  });

  const setupTestCanvas = () => {
    const store = useBackendCanvasStore.getState();

    const databaseNode: BackendNode = {
      id: "db-postgres-1",
      type: "database",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Postgres DB",
        database: "postgresql",
        dbEngine: "postgres",
      },
    };

    const entityNode: BackendNode = {
      id: "entity-users",
      type: "entity",
      position: { x: 200, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "users",
        databaseId: "db-postgres-1",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "email", type: "string", isNotNull: true },
          { name: "name", type: "string" },
        ],
      },
    };

    const dbRefNode: BackendNode = {
      id: "db-ref-users",
      type: "db_ref",
      position: { x: 300, y: 100 },
      fractionalIndex: "a2",
      data: {
        label: "users",
        tableRef: "entity-users",
        databaseId: "db-postgres-1",
      },
    };

    const serviceNode: BackendNode = {
      id: "service-api",
      type: "service",
      position: { x: 700, y: 100 },
      fractionalIndex: "a3",
      data: {
        label: "api-service",
        port: "8080",
      },
    };

    const endpoint: EndpointWithNode = {
      id: "ep-get-users",
      nodeId: "service-api",
      name: "/users",
      type: "GET",
      pipelineSteps: [
        {
          id: "step-return",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 200,
          outputVariable: "",
          inputBindings: [],
        },
      ],
    };

    store.addNode(databaseNode);
    store.addNode(entityNode);
    store.addNode(dbRefNode);
    store.addNode(serviceNode);
    useBackendCanvasStore.setState({ endpoints: [endpoint] });

    return { databaseNode, entityNode, dbRefNode, serviceNode, endpoint };
  };

  it("automatically adds a db_operation step to EndpointConfig when drawing edge from DatabaseTableRefNode to ServiceNode", () => {
    const { dbRefNode, serviceNode, endpoint, entityNode } = setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Draw edge from DatabaseTableRefNode (func-out-findAllUsers) to ServiceNode (endpoint-in-ep-get-users)
    store.onConnect({
      source: dbRefNode.id,
      sourceHandle: "func-out-findAllUsers",
      target: serviceNode.id,
      targetHandle: `endpoint-in-${endpoint.id}`,
    });

    const updatedEndpoints = useBackendCanvasStore.getState().endpoints;
    const updatedEp = updatedEndpoints.find((e) => e.id === endpoint.id);
    expect(updatedEp).toBeDefined();

    // Verify db_operation step was added before return_response
    const steps = updatedEp?.pipelineSteps || [];
    expect(steps.length).toBe(2);

    const dbStep = steps[0];
    expect(dbStep?.type).toBe("db_operation");
    expect(dbStep?.dbRefNodeId).toBe(dbRefNode.id);
    expect(dbStep?.tableNodeId).toBe(entityNode.id);
    expect(dbStep?.databaseId).toBe("db-postgres-1");
    expect(dbStep?.functionRef?.name).toBe("findAllUsers");
    expect(dbStep?.functionRef?.importPath).toBe("@workspace/db/helpers/users");
    expect(dbStep?.outputVariable).toBe("findAllUsersResult");

    const returnStep = steps[1];
    expect(returnStep?.type).toBe("return_response");

    // Verify databaseNodeIds updated on endpoint
    expect(updatedEp?.databaseNodeIds).toContain(dbRefNode.id);

    // Verify dbRefNode has link metadata
    const updatedNodes = useBackendCanvasStore.getState().nodes;
    const updatedDbRef = updatedNodes.find((n) => n.id === dbRefNode.id);
    expect(updatedDbRef?.data?.targetServiceId).toBe(serviceNode.id);
    expect(updatedDbRef?.data?.endpointId).toBe(endpoint.id);
    expect(updatedDbRef?.data?.stepId).toBe(dbStep?.id);

    // Verify edge metadata and handles
    const edges = useBackendCanvasStore.getState().edges;
    const connectedEdge = edges.find((e) => e.source === dbRefNode.id && e.target === serviceNode.id);
    expect(connectedEdge).toBeDefined();
    expect(connectedEdge?.sourceHandle).toBe("func-out-findAllUsers");
    expect(connectedEdge?.targetHandle).toBe(`endpoint-in-${endpoint.id}`);
    expect(connectedEdge?.data?.isDbOperation).toBe(true);
    expect(connectedEdge?.data?.operationName).toBe("findAllUsers");
  });

  it("targets the active endpoint or first non-health endpoint when dropped on ServiceNode generically", () => {
    const { dbRefNode, serviceNode, endpoint } = setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Generic connect to serviceNode with null targetHandle
    store.onConnect({
      source: dbRefNode.id,
      sourceHandle: "func-out-findUserById",
      target: serviceNode.id,
      targetHandle: null,
    });

    const updatedEndpoints = useBackendCanvasStore.getState().endpoints;
    const updatedEp = updatedEndpoints.find((e) => e.id === endpoint.id);
    const dbStep = updatedEp?.pipelineSteps?.find((s) => s.type === "db_operation");

    expect(dbStep).toBeDefined();
    expect(dbStep?.functionRef?.name).toBe("findUserById");
    expect(dbStep?.dbRefNodeId).toBe(dbRefNode.id);
  });

  it("supports reverse connection from ServiceNode to DatabaseTableRefNode", () => {
    const { dbRefNode, serviceNode, endpoint } = setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    // Reverse connect: serviceNode -> dbRefNode
    store.onConnect({
      source: serviceNode.id,
      sourceHandle: `endpoint-out-${endpoint.id}`,
      target: dbRefNode.id,
      targetHandle: "func-createUser",
    });

    const updatedEndpoints = useBackendCanvasStore.getState().endpoints;
    const updatedEp = updatedEndpoints.find((e) => e.id === endpoint.id);
    const dbStep = updatedEp?.pipelineSteps?.find((s) => s.type === "db_operation");

    expect(dbStep).toBeDefined();
    expect(dbStep?.functionRef?.name).toBe("createUser");
    expect(dbStep?.dbRefNodeId).toBe(dbRefNode.id);
  });

  it("getConnectedDbRefsForEndpoint retrieves connected db_ref node for an endpoint", () => {
    const { dbRefNode, serviceNode, endpoint } = setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    store.onConnect({
      source: dbRefNode.id,
      sourceHandle: "func-out-findAllUsers",
      target: serviceNode.id,
      targetHandle: `endpoint-in-${endpoint.id}`,
    });

    const nodes = useBackendCanvasStore.getState().nodes;
    const edges = useBackendCanvasStore.getState().edges;

    const connected = getConnectedDbRefsForEndpoint(endpoint.id, serviceNode.id, nodes, edges);
    expect(connected.length).toBe(1);
    expect(connected[0]?.dbRefNodeId).toBe(dbRefNode.id);
    expect(connected[0]?.tableNodeId).toBe("entity-users");
    expect(connected[0]?.operationName).toBe("findAllUsers");
  });

  it("cleans up db_operation step when edge between DatabaseTableRefNode and ServiceNode is deleted", () => {
    const { dbRefNode, serviceNode, endpoint } = setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    store.onConnect({
      source: dbRefNode.id,
      sourceHandle: "func-out-findAllUsers",
      target: serviceNode.id,
      targetHandle: `endpoint-in-${endpoint.id}`,
    });

    const edges = useBackendCanvasStore.getState().edges;
    const edge = edges.find((e) => e.source === dbRefNode.id && e.target === serviceNode.id);
    expect(edge).toBeDefined();

    if (edge) {
      store.deleteEdge(edge.id);
    }

    const endpointsAfter = useBackendCanvasStore.getState().endpoints;
    const epAfter = endpointsAfter.find((e) => e.id === endpoint.id);
    const remainingDbSteps = epAfter?.pipelineSteps?.filter((s) => s.type === "db_operation");

    expect(remainingDbSteps?.length).toBe(0);
    expect(epAfter?.databaseNodeIds).not.toContain(dbRefNode.id);
  });

  it("cleans up db_operation step when DatabaseTableRefNode itself is deleted", () => {
    const { dbRefNode, serviceNode, endpoint } = setupTestCanvas();
    const store = useBackendCanvasStore.getState();

    store.onConnect({
      source: dbRefNode.id,
      sourceHandle: "func-out-findAllUsers",
      target: serviceNode.id,
      targetHandle: `endpoint-in-${endpoint.id}`,
    });

    const epBefore = useBackendCanvasStore.getState().endpoints.find((e) => e.id === endpoint.id);
    const dbStepBefore = epBefore?.pipelineSteps?.find((s) => s.type === "db_operation");
    expect(dbStepBefore).toBeDefined();

    // Delete the db_ref node itself
    store.deleteNode(dbRefNode.id);

    const endpointsAfter = useBackendCanvasStore.getState().endpoints;
    const epAfter = endpointsAfter.find((e) => e.id === endpoint.id);
    const remainingDbSteps = epAfter?.pipelineSteps?.filter((s) => s.type === "db_operation");

    expect(remainingDbSteps?.length).toBe(0);
    expect(epAfter?.databaseNodeIds).not.toContain(dbRefNode.id);

    // Verify node is removed from nodes
    const nodesAfter = useBackendCanvasStore.getState().nodes;
    expect(nodesAfter.some((n) => n.id === dbRefNode.id)).toBe(false);
  });
});
