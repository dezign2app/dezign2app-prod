import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  ensureDatabaseRefConnection,
  cleanupDatabaseRefConnection,
  updateDatabaseRefConnection,
} from "../utils";
import { PipelineStepDraft } from "../types";
import { cleanupDeletedNodesState } from "@/lib/stores/backendCanvas/stateCleanup";

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
        e.source === result?.dbRefNodeId &&
        e.target === serviceNodeId &&
        e.sourceHandle === "func-out-findAllUsers" &&
        e.targetHandle === `endpoint-in-${endpointId}`,
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

    // Both edges connect from the same db_ref node at their respective function handles to service endpoint-in handles
    const edge1 = state.edges.find(
      (e) =>
        e.source === result1?.dbRefNodeId &&
        e.target === serviceNodeId &&
        e.sourceHandle === "func-out-findAllUsers" &&
        e.targetHandle === `endpoint-in-${endpointId}`,
    );
    const edge2 = state.edges.find(
      (e) =>
        e.source === result2?.dbRefNodeId &&
        e.target === serviceNodeId &&
        e.sourceHandle === "func-out-createUser" &&
        e.targetHandle === `endpoint-in-${secondEndpointId}`,
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
      (e) => e.source === result?.dbRefNodeId && e.target === serviceNodeId,
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
        e.source === result?.dbRefNodeId &&
        e.target === serviceNodeId &&
        e.sourceHandle === "func-out-findAllUsers",
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
        e.source === result?.dbRefNodeId &&
        e.target === serviceNodeId &&
        e.sourceHandle === "func-out-findAllUsers",
    );
    expect(remainingEdges.length).toBe(1);
  });

  it("does not delete edges or endpoint databaseNodeIds connected to other db_ref nodes of the same database when 1 step is deleted", () => {
    // Add second entity for orders in same database
    const orderEntityId = "entity-orders";
    useBackendCanvasStore.setState((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: orderEntityId,
          type: "entity",
          position: { x: 500, y: 350 },
          fractionalIndex: "a4",
          data: {
            label: "orders",
            databaseId,
            columns: [
              { name: "id", type: "uuid", isPrimary: true },
              { name: "total", type: "integer" },
            ],
          },
        },
      ],
    }));

    // Connect step 1: users (findAllUsers)
    const userResult = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    // Connect step 2: orders (findAllOrders)
    const orderResult = ensureDatabaseRefConnection({
      tableNodeId: orderEntityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllOrders",
    });

    let state = useBackendCanvasStore.getState();
    expect(state.edges.length).toBe(2);

    const ep = state.endpoints.find((e) => e.id === endpointId);
    expect(ep?.databaseNodeIds).toContain(userResult?.dbRefNodeId);
    expect(ep?.databaseNodeIds).toContain(orderResult?.dbRefNodeId);

    // Now delete step 1 (users) while step 2 (orders) remains
    const remainingOrderStep: PipelineStepDraft = {
      id: "step-order",
      name: "findAllOrdersResult",
      type: "db_operation",
      tableNodeId: orderEntityId,
      databaseId,
      functionRef: {
        name: "findAllOrders",
        importPath: "@/lib/db",
      },
    };

    cleanupDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
      remainingSteps: [remainingOrderStep],
    });

    state = useBackendCanvasStore.getState();

    // Edge to users db_ref was deleted
    const userEdges = state.edges.filter(
      (e) => e.source === userResult?.dbRefNodeId,
    );
    expect(userEdges.length).toBe(0);

    // Edge to orders db_ref is STILL INTACT!
    const orderEdges = state.edges.filter(
      (e) =>
        e.source === orderResult?.dbRefNodeId &&
        e.target === serviceNodeId &&
        e.sourceHandle === "func-out-findAllOrders",
    );
    expect(orderEdges.length).toBe(1);

    // Endpoint databaseNodeIds still contains orders db_ref node ID!
    const updatedEp = state.endpoints.find((e) => e.id === endpointId);
    expect(updatedEp?.databaseNodeIds).not.toContain(userResult?.dbRefNodeId);
    expect(updatedEp?.databaseNodeIds).toContain(orderResult?.dbRefNodeId);
  });

  it("updateDatabaseRefConnection updates the same db_ref node in place when changing table on a step", () => {
    // Add posts entity to canvas
    const postsEntityId = "entity-posts";
    useBackendCanvasStore.setState((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: postsEntityId,
          type: "entity",
          position: { x: 500, y: 350 },
          fractionalIndex: "a4",
          data: {
            label: "posts",
            databaseId,
            columns: [
              { name: "id", type: "uuid", isPrimary: true },
              { name: "title", type: "text" },
            ],
          },
        },
      ],
    }));

    // Initially step has users table
    const initialResult = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    let state = useBackendCanvasStore.getState();
    const initialDbRefId = initialResult?.dbRefNodeId;
    expect(initialDbRefId).toBeDefined();

    const dbRefNodesBefore = state.nodes.filter((n) => n.type === "db_ref");
    expect(dbRefNodesBefore).toHaveLength(1);
    expect(dbRefNodesBefore[0]?.data?.label).toBe("users");
    expect(dbRefNodesBefore[0]?.data?.tableRef).toBe(entityId);

    // Now change table to posts in DbOperationStepSection
    const updateResult = updateDatabaseRefConnection({
      prevTableNodeId: entityId,
      prevDatabaseId: databaseId,
      prevFunctionName: "findAllUsers",
      newTableNodeId: postsEntityId,
      newDatabaseId: databaseId,
      newFunctionName: "findAllPosts",
      serviceNodeId,
      endpointId,
      remainingSteps: [],
    });

    state = useBackendCanvasStore.getState();

    // MUST reuse and update the EXACT SAME db_ref node in place!
    expect(updateResult?.dbRefNodeId).toBe(initialDbRefId);

    const dbRefNodesAfter = state.nodes.filter((n) => n.type === "db_ref");
    // NO multiple unused table ref nodes created! Exactly 1 remains!
    expect(dbRefNodesAfter).toHaveLength(1);
    expect(dbRefNodesAfter[0]?.id).toBe(initialDbRefId);
    expect(dbRefNodesAfter[0]?.data?.label).toBe("posts");
    expect(dbRefNodesAfter[0]?.data?.tableRef).toBe(postsEntityId);

    // Edge must be updated to target the new function handle
    const edges = state.edges.filter((e) => e.source === initialDbRefId);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.sourceHandle).toBe("func-out-findAllPosts");
    expect(edges[0]?.targetHandle).toBe(`endpoint-in-${endpointId}`);
  });

  it("updateDatabaseRefConnection preserves previous db_ref node when another step on same service still uses it", () => {
    const postsEntityId = "entity-posts";
    useBackendCanvasStore.setState((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: postsEntityId,
          type: "entity",
          position: { x: 500, y: 350 },
          fractionalIndex: "a4",
          data: {
            label: "posts",
            databaseId,
            columns: [
              { name: "id", type: "uuid", isPrimary: true },
              { name: "title", type: "text" },
            ],
          },
        },
      ],
    }));

    // Step 1: users (on endpoint 1)
    const initialResult = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    // Step 2: users (on endpoint 2 of the SAME service)
    ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId: secondEndpointId,
      functionName: "createUser",
    });

    // Another step in endpoint 2 still uses users!
    const stepInSecondEndpoint: PipelineStepDraft = {
      id: "step-2",
      name: "createUserResult",
      type: "db_operation",
      tableNodeId: entityId,
      databaseId,
      functionRef: { name: "createUser", importPath: "@/db" },
    };

    useBackendCanvasStore.setState((s) => ({
      endpoints: s.endpoints.map((ep) =>
        ep.id === secondEndpointId ? { ...ep, pipelineSteps: [stepInSecondEndpoint] } : ep,
      ),
    }));

    // Change step 1 on endpoint 1 from users to posts
    const updateResult = updateDatabaseRefConnection({
      prevTableNodeId: entityId,
      prevDatabaseId: databaseId,
      prevFunctionName: "findAllUsers",
      newTableNodeId: postsEntityId,
      newDatabaseId: databaseId,
      newFunctionName: "findAllPosts",
      serviceNodeId,
      endpointId,
      remainingSteps: [],
    });

    const state = useBackendCanvasStore.getState();

    // Previous users db_ref must be preserved for endpoint 2
    const usersDbRef = state.nodes.find((n) => n.id === initialResult?.dbRefNodeId);
    expect(usersDbRef).toBeDefined();
    expect(usersDbRef?.data?.tableRef).toBe(entityId);

    // New posts db_ref must be created for endpoint 1
    expect(updateResult?.dbRefNodeId).not.toBe(initialResult?.dbRefNodeId);
    const postsDbRef = state.nodes.find((n) => n.id === updateResult?.dbRefNodeId);
    expect(postsDbRef).toBeDefined();
    expect(postsDbRef?.data?.tableRef).toBe(postsEntityId);
  });

  it("updateDatabaseRefConnection deletes orphaned previous db_ref node when target table already has a db_ref node", () => {
    const postsEntityId = "entity-posts";
    useBackendCanvasStore.setState((s) => ({
      nodes: [
        ...s.nodes,
        {
          id: postsEntityId,
          type: "entity",
          position: { x: 500, y: 350 },
          fractionalIndex: "a4",
          data: {
            label: "posts",
            databaseId,
            columns: [
              { name: "id", type: "uuid", isPrimary: true },
              { name: "title", type: "text" },
            ],
          },
        },
      ],
    }));

    // Step 1: users on endpoint 1
    const usersResult = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    // Step 2: posts on endpoint 2
    const postsResult = ensureDatabaseRefConnection({
      tableNodeId: postsEntityId,
      databaseId,
      serviceNodeId,
      endpointId: secondEndpointId,
      functionName: "findAllPosts",
    });

    let state = useBackendCanvasStore.getState();
    expect(state.nodes.filter((n) => n.type === "db_ref")).toHaveLength(2);

    // Now change endpoint 1 table from users to posts (which already has a db_ref node!)
    const updateResult = updateDatabaseRefConnection({
      prevTableNodeId: entityId,
      prevDatabaseId: databaseId,
      prevFunctionName: "findAllUsers",
      newTableNodeId: postsEntityId,
      newDatabaseId: databaseId,
      newFunctionName: "findAllPosts",
      serviceNodeId,
      endpointId,
      remainingSteps: [],
    });

    state = useBackendCanvasStore.getState();

    // Reuses the existing posts db_ref
    expect(updateResult?.dbRefNodeId).toBe(postsResult?.dbRefNodeId);

    // Users db_ref was orphaned and deleted - leaving NO unused table ref nodes!
    const remainingDbRefs = state.nodes.filter((n) => n.type === "db_ref");
    expect(remainingDbRefs).toHaveLength(1);
    expect(remainingDbRefs[0]?.id).toBe(postsResult?.dbRefNodeId);
    expect(state.nodes.find((n) => n.id === usersResult?.dbRefNodeId)).toBeUndefined();
  });

  it("cleanupDatabaseRefConnection cascades deletion of orphaned db_ref node when no edges remain", () => {
    const result = ensureDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
    });

    let state = useBackendCanvasStore.getState();
    expect(state.nodes.filter((n) => n.type === "db_ref")).toHaveLength(1);

    // Clean up when step is deleted
    cleanupDatabaseRefConnection({
      tableNodeId: entityId,
      databaseId,
      serviceNodeId,
      endpointId,
      functionName: "findAllUsers",
      remainingSteps: [],
    });

    state = useBackendCanvasStore.getState();
    // Orphaned db_ref node must be removed from canvas
    expect(state.nodes.filter((n) => n.type === "db_ref")).toHaveLength(0);
  });

  describe("1:1 Step-to-TableRef Bidirectional Synchronization", () => {
    it("creates dedicated db_ref node per step (link 1 table ref per step)", () => {
      const step1Id = "step-db-1";
      const step2Id = "step-db-2";

      const res1 = ensureDatabaseRefConnection({
        stepId: step1Id,
        tableNodeId: entityId,
        databaseId,
        serviceNodeId,
        endpointId,
        functionName: "findAllUsers",
      });

      const res2 = ensureDatabaseRefConnection({
        stepId: step2Id,
        tableNodeId: entityId,
        databaseId,
        serviceNodeId,
        endpointId,
        functionName: "createUser",
      });

      expect(res1?.dbRefNodeId).toBeDefined();
      expect(res2?.dbRefNodeId).toBeDefined();
      expect(res1?.dbRefNodeId).not.toBe(res2?.dbRefNodeId);

      const state = useBackendCanvasStore.getState();
      const node1 = state.nodes.find((n) => n.id === res1?.dbRefNodeId);
      const node2 = state.nodes.find((n) => n.id === res2?.dbRefNodeId);

      expect(node1?.data?.stepId).toBe(step1Id);
      expect(node2?.data?.stepId).toBe(step2Id);
    });

    it("updates dedicated db_ref node in place when step table selection changes (never adds a new node)", () => {
      const step1Id = "step-db-1";
      const initial = ensureDatabaseRefConnection({
        stepId: step1Id,
        tableNodeId: entityId,
        databaseId,
        serviceNodeId,
        endpointId,
        functionName: "findAllUsers",
      });

      const stateBefore = useBackendCanvasStore.getState();
      const dbRefCountBefore = stateBefore.nodes.filter((n) => n.type === "db_ref").length;

      const updated = updateDatabaseRefConnection({
        stepId: step1Id,
        dbRefNodeId: initial?.dbRefNodeId,
        prevTableNodeId: entityId,
        newTableNodeId: "entity-orders",
        newDatabaseId: databaseId,
        newFunctionName: "findAllOrders",
        serviceNodeId,
        endpointId,
        remainingSteps: [],
      });

      expect(updated?.dbRefNodeId).toBe(initial?.dbRefNodeId);

      const stateAfter = useBackendCanvasStore.getState();
      const dbRefCountAfter = stateAfter.nodes.filter((n) => n.type === "db_ref").length;
      expect(dbRefCountAfter).toBe(dbRefCountBefore);

      const updatedNode = stateAfter.nodes.find((n) => n.id === initial?.dbRefNodeId);
      expect(updatedNode?.data?.tableRef).toBe("entity-orders");
    });

    it("deletes linked db_ref node when step is deleted", () => {
      const step1Id = "step-db-1";
      const initial = ensureDatabaseRefConnection({
        stepId: step1Id,
        tableNodeId: entityId,
        databaseId,
        serviceNodeId,
        endpointId,
        functionName: "findAllUsers",
      });

      let state = useBackendCanvasStore.getState();
      expect(state.nodes.find((n) => n.id === initial?.dbRefNodeId)).toBeDefined();

      cleanupDatabaseRefConnection({
        stepId: step1Id,
        dbRefNodeId: initial?.dbRefNodeId,
        serviceNodeId,
        endpointId,
        remainingSteps: [],
      });

      state = useBackendCanvasStore.getState();
      expect(state.nodes.find((n) => n.id === initial?.dbRefNodeId)).toBeUndefined();
    });

    it("deletes linked pipeline step when db_ref node is deleted from canvas", () => {
      const stepId = "step-db-1";
      const initial = ensureDatabaseRefConnection({
        stepId,
        tableNodeId: entityId,
        databaseId,
        serviceNodeId,
        endpointId,
        functionName: "findAllUsers",
      });

      // Endpoint has the step with dbRefNodeId
      useBackendCanvasStore.setState((s) => ({
        endpoints: s.endpoints.map((ep) =>
          ep.id === endpointId
            ? {
                ...ep,
                pipelineSteps: [
                  {
                    id: stepId,
                    name: "findAllUsersResult",
                    type: "db_operation" as const,
                    tableNodeId: entityId,
                    dbRefNodeId: initial!.dbRefNodeId,
                  },
                ],
              }
            : ep,
        ),
      }));

      const stateWithStep = useBackendCanvasStore.getState();
      const epWithStep = stateWithStep.endpoints.find((e) => e.id === endpointId);
      expect(epWithStep?.pipelineSteps).toHaveLength(1);

      // Delete the db_ref node via cleanupDeletedNodesState
      const cleanupUpdates = cleanupDeletedNodesState(stateWithStep, [initial!.dbRefNodeId]);
      useBackendCanvasStore.setState(cleanupUpdates);

      const stateAfter = useBackendCanvasStore.getState();
      const epAfter = stateAfter.endpoints.find((e) => e.id === endpointId);
      expect(epAfter?.pipelineSteps).toHaveLength(0);
    });
  });
});
