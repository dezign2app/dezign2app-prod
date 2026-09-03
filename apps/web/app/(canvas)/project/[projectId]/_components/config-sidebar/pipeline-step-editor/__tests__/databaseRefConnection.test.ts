import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { ensureDatabaseRefConnection, cleanupDatabaseRefConnection } from "../utils";
import { PipelineStepDraft } from "../types";

describe("pipeline-step-editor: Database Ref Node and Function Edge Synchronization", () => {
  const serviceNodeId = "service-1";
  const otherServiceNodeId = "service-2";
  const endpointId = "ep-get-users";
  const secondEndpointId = "ep-create-user";
  const entityId = "entity-users";
  const databaseId = "db-postgres-1";

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
          id: otherServiceNodeId,
          type: "service",
          position: { x: 100, y: 400 },
          fractionalIndex: "a1",
          data: { label: "Order Service" },
        },
        {
          id: databaseId,
          type: "database",
          position: { x: 500, y: 100 },
          fractionalIndex: "a2",
          data: { label: "Postgres DB", dbEngine: "postgres" },
        },
        {
          id: entityId,
          type: "entity",
          position: { x: 500, y: 250 },
          fractionalIndex: "a3",
          data: {
            label: "users",
            databaseId,
            columns: [
              { name: "id", type: "uuid", isPrimary: true },
              { name: "name", type: "text" },
            ],
          },
        },
      ],
      edges: [],
      endpoints: [
        {
          id: endpointId,
          nodeId: serviceNodeId,
          name: "Get Users",
          type: "GET",
        },
        {
          id: secondEndpointId,
          nodeId: serviceNodeId,
          name: "Create User",
          type: "POST",
        },
      ],
    });
  });

  it("creates a db_ref node and draws an edge targeting func-${functionName} from ServiceNode endpoint", () => {
    const result = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    expect(result).toBeDefined();
    expect(result?.dbRefNodeId).toBeDefined();
    expect(result?.functionName).toBe("findAllUsers");

    const state = useBackendCanvasStore.getState();
    const createdDbRef = state.nodes.find((n) => n.id === result?.dbRefNodeId);
    expect(createdDbRef).toBeDefined();
    expect(createdDbRef?.type).toBe("db_ref");
    expect(createdDbRef?.data?.tableRef).toBe(entityId);
    expect(createdDbRef?.data?.targetServiceId).toBe(serviceNodeId);

    const createdEdge = state.edges.find(
      (e) =>
        e.source === serviceNodeId &&
        e.target === result?.dbRefNodeId &&
        e.sourceHandle === `endpoint-out-${endpointId}` &&
        e.targetHandle === "func-findAllUsers",
    );
    expect(createdEdge).toBeDefined();
    expect(createdEdge?.type).toBe("connection");

    // Endpoint databaseNodeIds updated
    const ep = state.endpoints.find((e) => e.id === endpointId);
    expect(ep?.databaseNodeIds).toContain(result?.dbRefNodeId);
  });

  it("reuses the same db_ref node for any entity per server (1 db_ref per entity per server)", () => {
    // 1st step in endpoint 1
    const result1 = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    // 2nd step in endpoint 2 on the SAME server
    const result2 = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId: secondEndpointId,
      functionName: "createUser",
    });

    expect(result1?.dbRefNodeId).toBe(result2?.dbRefNodeId);

    const state = useBackendCanvasStore.getState();
    const dbRefNodes = state.nodes.filter(
      (n) => n.type === "db_ref" && n.data?.tableRef === entityId,
    );
    expect(dbRefNodes.length).toBe(1);

    // Both edges connect to the same db_ref node at their respective function handles
    const edge1 = state.edges.find(
      (e) =>
        e.source === serviceNodeId &&
        e.target === result1?.dbRefNodeId &&
        e.sourceHandle === `endpoint-out-${endpointId}` &&
        e.targetHandle === "func-findAllUsers",
    );
    const edge2 = state.edges.find(
      (e) =>
        e.source === serviceNodeId &&
        e.target === result2?.dbRefNodeId &&
        e.sourceHandle === `endpoint-out-${secondEndpointId}` &&
        e.targetHandle === "func-createUser",
    );

    expect(edge1).toBeDefined();
    expect(edge2).toBeDefined();
  });

  it("creates a separate db_ref node for a different server", () => {
    // Server 1
    const result1 = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    // Server 2 (otherServiceNodeId)
    const result2 = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId: otherServiceNodeId,
      functionName: "findAllUsers",
    });

    expect(result1?.dbRefNodeId).not.toBe(result2?.dbRefNodeId);

    const state = useBackendCanvasStore.getState();
    const dbRefNodes = state.nodes.filter((n) => n.type === "db_ref");
    expect(dbRefNodes.length).toBe(2);
  });

  it("creates a db_ref node even when no entity is defined yet on canvas", () => {
    const result = ensureDatabaseRefConnection({
      serviceNodeId,
      endpointId,
    });

    expect(result).toBeDefined();
    expect(result?.dbRefNodeId).toBeDefined();

    const state = useBackendCanvasStore.getState();
    const createdNode = state.nodes.find((n) => n.id === result?.dbRefNodeId);
    expect(createdNode).toBeDefined();
    expect(createdNode?.type).toBe("db_ref");
    expect(createdNode?.data?.label).toBe("Table Ref");

    const edge = state.edges.find(
      (e) => e.source === serviceNodeId && e.target === result?.dbRefNodeId,
    );
    expect(edge).toBeDefined();
  });

  it("cleans up the function edge when a step is deleted and no other step uses that function", () => {
    const result = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    let state = useBackendCanvasStore.getState();
    expect(state.edges.length).toBe(1);

    cleanupDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
      remainingSteps: [],
    });

    state = useBackendCanvasStore.getState();
    const remainingEdges = state.edges.filter(
      (e) =>
        e.source === serviceNodeId &&
        e.target === result?.dbRefNodeId &&
        e.targetHandle === "func-findAllUsers",
    );
    expect(remainingEdges.length).toBe(0);

    const ep = state.endpoints.find((e) => e.id === endpointId);
    expect(ep?.databaseNodeIds).not.toContain(result?.dbRefNodeId);
  });

  it("keeps the function edge if another step in the same endpoint still uses that function", () => {
    const result = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    const otherStep: PipelineStepDraft = {
      id: "step-2",
      name: "findAllUsersResult2",
      type: "db_operation",
      tableNodeId: entityId,
      databaseId,
      functionRef: {
        name: "findAllUsers",
        importPath: "@/lib/db",
      },
    };

    cleanupDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
      remainingSteps: [otherStep],
    });

    const state = useBackendCanvasStore.getState();
    const remainingEdges = state.edges.filter(
      (e) =>
        e.source === serviceNodeId &&
        e.target === result?.dbRefNodeId &&
        e.targetHandle === "func-findAllUsers",
    );
    expect(remainingEdges.length).toBe(1);
  });
});
