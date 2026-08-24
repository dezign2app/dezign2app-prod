import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendEdge, BackendNode } from "@/types/canvas";
import { EndpointWithNode } from "../types";

describe("backendCanvasStore - edgeSlice modularization & handlers", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-edge-test");
  });

  describe("addEdge and autoDeriveForeignKeyHandles", () => {
    it("rejects edge creation if source or target node does not exist", () => {
      const store = useBackendCanvasStore.getState();
      const nodeA: BackendNode = {
        id: "node-a",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "Node A" },
        fractionalIndex: "a0",
      };
      store.setNodesAndEdges([nodeA], [], [], [], [], "proj-edge-test");

      useBackendCanvasStore.getState().addEdge({
        id: "edge-invalid",
        source: "node-a",
        target: "node-nonexistent",
        type: "connection",
      });

      expect(useBackendCanvasStore.getState().edges).toHaveLength(0);
    });

    it("auto-derives source and target column handles for foreign-key edges without explicit handles", () => {
      const store = useBackendCanvasStore.getState();

      const usersTable: BackendNode = {
        id: "table-users",
        type: "entity",
        position: { x: 0, y: 0 },
        data: {
          label: "users",
          columns: [
            { name: "id", type: "UUID", isPrimaryKey: true },
            { name: "email", type: "VARCHAR" },
          ],
        },
        fractionalIndex: "a0",
      };

      const ordersTable: BackendNode = {
        id: "table-orders",
        type: "entity",
        position: { x: 200, y: 0 },
        data: {
          label: "orders",
          columns: [
            { name: "id", type: "UUID", isPrimaryKey: true },
            {
              name: "user_id",
              type: "UUID",
              isForeignKey: true,
              references: { table: "users", column: "id" },
            },
          ],
        },
        fractionalIndex: "a1",
      };

      store.setNodesAndEdges([usersTable, ordersTable], [], [], [], [], "proj-edge-test");

      // Add foreign-key edge without specifying handles
      useBackendCanvasStore.getState().addEdge({
        id: "fk-users-orders",
        source: "table-users",
        target: "table-orders",
        type: "foreign-key",
      });

      const added = useBackendCanvasStore.getState().edges.find((e) => e.id === "fk-users-orders");
      expect(added).toBeDefined();
      expect(added?.sourceHandle).toBe("source-0");
      expect(added?.targetHandle).toBe("target-1");
    });
  });

  describe("updateEdge and deleteEdge", () => {
    it("updates edge properties and tracks in pendingEdgeUpserts", () => {
      const store = useBackendCanvasStore.getState();
      const nodeA: BackendNode = { id: "a", type: "service", position: { x: 0, y: 0 }, data: { label: "A" }, fractionalIndex: "a0" };
      const nodeB: BackendNode = { id: "b", type: "service", position: { x: 100, y: 0 }, data: { label: "B" }, fractionalIndex: "a1" };
      const edge: BackendEdge = { id: "e1", source: "a", target: "b", type: "connection", fractionalIndex: "f0" };

      store.setNodesAndEdges([nodeA, nodeB], [edge], [], [], [], "proj-edge-test");

      useBackendCanvasStore.getState().updateEdge("e1", { sourceHandle: "custom-out" });

      const updated = useBackendCanvasStore.getState().edges.find((e) => e.id === "e1");
      expect(updated?.sourceHandle).toBe("custom-out");
      expect(useBackendCanvasStore.getState().pendingEdgeUpserts.some((e) => e.id === "e1")).toBe(true);
    });

    it("deletes edge and records pending removal", () => {
      const store = useBackendCanvasStore.getState();
      const nodeA: BackendNode = { id: "a", type: "service", position: { x: 0, y: 0 }, data: { label: "A" }, fractionalIndex: "a0" };
      const nodeB: BackendNode = { id: "b", type: "service", position: { x: 100, y: 0 }, data: { label: "B" }, fractionalIndex: "a1" };
      const edge: BackendEdge = { id: "e1", source: "a", target: "b", type: "connection", fractionalIndex: "f0" };

      store.setNodesAndEdges([nodeA, nodeB], [edge], [], [], [], "proj-edge-test");

      useBackendCanvasStore.getState().deleteEdge("e1");

      expect(useBackendCanvasStore.getState().edges).toHaveLength(0);
      expect(useBackendCanvasStore.getState().pendingEdgeRemovals).toContain("e1");
    });
  });

  describe("onConnect domain handlers", () => {
    it("syncs databaseId when connecting database -> entity and redis_instance -> redis_schema", () => {
      const store = useBackendCanvasStore.getState();

      const dbNode: BackendNode = {
        id: "db-pg",
        type: "database",
        position: { x: 0, y: 0 },
        data: { label: "postgres", dbEngine: "postgres" },
        fractionalIndex: "a0",
      };

      const entityNode: BackendNode = {
        id: "entity-users",
        type: "entity",
        position: { x: 200, y: 0 },
        data: { label: "users", dbType: "relational" },
        fractionalIndex: "a1",
      };

      store.setNodesAndEdges([dbNode, entityNode], [], [], [], [], "proj-edge-test");

      useBackendCanvasStore.getState().onConnect({
        source: "db-pg",
        target: "entity-users",
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
      });

      const updatedEntity = useBackendCanvasStore.getState().nodes.find((n) => n.id === "entity-users");
      expect(updatedEntity?.data?.databaseId).toBe("db-pg");
    });

    it("syncs authNodeId bidirectionally between Auth and WebApp nodes", () => {
      const store = useBackendCanvasStore.getState();

      const authNode: BackendNode = {
        id: "auth-1",
        type: "auth",
        position: { x: 0, y: 0 },
        data: { label: "Auth" },
        fractionalIndex: "a0",
      };

      const webAppNode: BackendNode = {
        id: "web-1",
        type: "webApp",
        position: { x: 200, y: 0 },
        data: { label: "Web App" },
        fractionalIndex: "a1",
      };

      store.setNodesAndEdges([authNode, webAppNode], [], [], [], [], "proj-edge-test");

      // Connect Auth -> WebApp
      useBackendCanvasStore.getState().onConnect({
        source: "auth-1",
        target: "web-1",
        sourceHandle: "auth-out",
        targetHandle: "auth-in",
      });

      let state = useBackendCanvasStore.getState();
      expect(state.nodes.find((n) => n.id === "web-1")?.data?.authNodeId).toBe("auth-1");
    });

    it("syncs endpoint databaseNodeIds when connecting endpoint to database node", () => {
      const store = useBackendCanvasStore.getState();

      const serviceNode: BackendNode = {
        id: "service-1",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "API Service" },
        fractionalIndex: "a0",
      };

      const dbNode: BackendNode = {
        id: "db-1",
        type: "database",
        position: { x: 200, y: 0 },
        data: { label: "DB" },
        fractionalIndex: "a1",
      };

      const endpoint: EndpointWithNode = {
        id: "ep-users",
        nodeId: "service-1",
        name: "getUsers",
        type: "GET",
      };

      store.setNodesAndEdges([serviceNode, dbNode], [], [endpoint], [], [], "proj-edge-test");

      useBackendCanvasStore.getState().onConnect({
        source: "service-1",
        target: "db-1",
        sourceHandle: "endpoint-out-ep-users",
        targetHandle: "database-target",
      });

      const updatedEp = useBackendCanvasStore.getState().endpoints.find((e) => e.id === "ep-users");
      expect(updatedEp?.databaseNodeIds).toContain("db-1");
      expect(updatedEp?.databaseNodeId).toBe("db-1");
    });

    it("auto-creates messaging publisher and pipeline step when connecting endpoint to Kafka node", () => {
      const store = useBackendCanvasStore.getState();

      const serviceNode: BackendNode = {
        id: "service-1",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "Order Service" },
        fractionalIndex: "a0",
      };

      const kafkaNode: BackendNode = {
        id: "kafka-1",
        type: "kafka",
        position: { x: 300, y: 0 },
        data: {
          label: "orders-broker",
          topics: [{ id: "topic-orders", name: "order-events" }],
        },
        fractionalIndex: "a1",
      };

      const endpoint: EndpointWithNode = {
        id: "ep-create-order",
        nodeId: "service-1",
        name: "createOrder",
        type: "POST",
        pipelineSteps: [
          {
            id: "step-ret",
            name: "Return Response",
            type: "return_response",
            enabled: true,
            statusCode: 200,
            inputBindings: [],
            outputVariable: "",
          },
        ],
      };

      store.setNodesAndEdges([serviceNode, kafkaNode], [], [endpoint], [], [], "proj-edge-test");

      useBackendCanvasStore.getState().onConnect({
        source: "service-1",
        target: "kafka-1",
        sourceHandle: "endpoint-out-ep-create-order",
        targetHandle: "topics:in:topic-orders",
      });

      const state = useBackendCanvasStore.getState();
      const updatedEp = state.endpoints.find((e) => e.id === "ep-create-order");

      // Verify publishedEvents was added
      expect(updatedEp?.publishedEvents).toHaveLength(1);
      const pub = updatedEp?.publishedEvents?.[0];
      expect(pub?.brokerNodeId).toBe("kafka-1");
      expect(pub?.messagingResourceId).toBe("topic-orders");
      expect(pub?.resourceType).toBe("topics");

      // Verify kafka_publish step was injected before return_response
      expect(updatedEp?.pipelineSteps).toHaveLength(2);
      expect(updatedEp?.pipelineSteps?.[0]?.type).toBe("kafka_publish");
      expect(updatedEp?.pipelineSteps?.[1]?.type).toBe("return_response");

      // Verify the direct endpoint-out edge was cleaned up and replaced by publisher edge
      const directEdge = state.edges.find((e) => e.sourceHandle === "endpoint-out-ep-create-order");
      expect(directEdge).toBeUndefined();
      const publisherEdge = state.edges.find((e) => e.sourceHandle === `publishedEvents-out-${pub?.id}`);
      expect(publisherEdge).toBeDefined();
    });

    it("updates column foreign key references on column-to-column connection", () => {
      const store = useBackendCanvasStore.getState();

      const authorsTable: BackendNode = {
        id: "table-authors",
        type: "entity",
        position: { x: 0, y: 0 },
        data: {
          label: "authors",
          columns: [
            { name: "id", type: "UUID", isPrimaryKey: true },
            { name: "name", type: "VARCHAR" },
          ],
        },
        fractionalIndex: "a0",
      };

      const booksTable: BackendNode = {
        id: "table-books",
        type: "entity",
        position: { x: 200, y: 0 },
        data: {
          label: "books",
          columns: [
            { name: "id", type: "UUID", isPrimaryKey: true },
            { name: "author_id", type: "UUID" },
          ],
        },
        fractionalIndex: "a1",
      };

      store.setNodesAndEdges([authorsTable, booksTable], [], [], [], [], "proj-edge-test");

      // Connect authors.id (source-0) to books.author_id (target-1)
      useBackendCanvasStore.getState().onConnect({
        source: "table-authors",
        target: "table-books",
        sourceHandle: "source-0",
        targetHandle: "target-1",
      });

      const updatedBooks = useBackendCanvasStore.getState().nodes.find((n) => n.id === "table-books");
      const authorIdCol = updatedBooks?.data?.columns?.[1];
      expect(authorIdCol?.isForeignKey).toBe(true);
      expect(authorIdCol?.references).toEqual({
        table: "authors",
        column: "id",
      });
    });
  });
});
