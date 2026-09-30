import { describe, it, expect } from "vitest";
import {
  checkCheckpointerTablesStatus,
  provisionCheckpointerTables,
  LANGGRAPH_POSTGRES_TABLE_DEFINITIONS,
  LANGGRAPH_REDIS_SCHEMA_DEFINITIONS,
} from "../checkpointerTables";
import type { BackendNode } from "@/types/canvas";

describe("checkpointerTables utilities", () => {
  const mockPostgresDb: BackendNode = {
    id: "db-pg-1",
    type: "database",
    position: { x: 100, y: 100 },
    fractionalIndex: "a0",
    data: {
      label: "Main Postgres",
      dbEngine: "postgres",
    },
  };

  const mockRedisInstance: BackendNode = {
    id: "redis-inst-1",
    type: "redis_instance",
    position: { x: 500, y: 100 },
    fractionalIndex: "a1",
    data: {
      label: "Cache Redis",
    },
  };

  describe("checkCheckpointerTablesStatus", () => {
    it("returns areTablesCreated=true when checkpointer is disabled", () => {
      const status = checkCheckpointerTablesStatus([mockPostgresDb], [], false, "postgres", "db-pg-1");
      expect(status.areTablesCreated).toBe(true);
      expect(status.errorMessage).toBeNull();
    });

    it("returns areTablesCreated=true when checkpointer engine is memory", () => {
      const status = checkCheckpointerTablesStatus([mockPostgresDb], [], true, "memory");
      expect(status.areTablesCreated).toBe(true);
      expect(status.errorMessage).toBeNull();
    });

    it("detects missing PostgreSQL database in SchemaView", () => {
      const status = checkCheckpointerTablesStatus([], [], true, "postgres");
      expect(status.isMissingStorage).toBe(true);
      expect(status.areTablesCreated).toBe(false);
      expect(status.errorMessage).toContain("No PostgreSQL database found");
    });

    it("detects missing tables when PostgreSQL database exists but has no tables", () => {
      const status = checkCheckpointerTablesStatus([mockPostgresDb], [], true, "postgres", "db-pg-1");
      expect(status.isMissingStorage).toBe(false);
      expect(status.isConfigured).toBe(true);
      expect(status.areTablesCreated).toBe(false);
      expect(status.existingTables).toHaveLength(0);
      expect(status.missingCount).toBe(4);
      expect(status.errorMessage).toContain('Checkpointer tables have not been created for "Main Postgres"');
    });

    it("detects partially created tables for PostgreSQL", () => {
      const partialTable: BackendNode = {
        id: "tbl-1",
        type: "entity",
        position: { x: 100, y: 300 },
        fractionalIndex: "a2",
        data: {
          label: "langgraph_checkpoints",
          databaseId: "db-pg-1",
          systemBadge: "langgraph",
        },
      };

      const status = checkCheckpointerTablesStatus([mockPostgresDb, partialTable], [], true, "postgres", "db-pg-1");
      expect(status.areTablesCreated).toBe(false);
      expect(status.existingTables).toHaveLength(1);
      expect(status.missingCount).toBe(3);
      expect(status.errorMessage).toContain('Only 1/4 checkpointer tables created for "Main Postgres"');
    });

    it("returns areTablesCreated=true when all 4 PostgreSQL tables exist", () => {
      const allTables: BackendNode[] = LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.map((def, idx) => ({
        id: `tbl-${idx}`,
        type: "entity",
        position: { x: 100 + idx * 50, y: 300 },
        fractionalIndex: `t${idx}`,
        data: {
          label: def.name,
          databaseId: "db-pg-1",
          systemBadge: "langgraph",
        },
      }));

      const status = checkCheckpointerTablesStatus([mockPostgresDb, ...allTables], [], true, "postgres", "db-pg-1");
      expect(status.areTablesCreated).toBe(true);
      expect(status.existingTables).toHaveLength(4);
      expect(status.missingCount).toBe(0);
      expect(status.errorMessage).toBeNull();
    });

    it("detects missing Redis instance in SchemaView", () => {
      const status = checkCheckpointerTablesStatus([], [], true, "redis");
      expect(status.isMissingStorage).toBe(true);
      expect(status.areTablesCreated).toBe(false);
      expect(status.errorMessage).toContain("No Redis instance found");
    });

    it("detects missing schemas when Redis instance exists without schemas", () => {
      const status = checkCheckpointerTablesStatus([mockRedisInstance], [], true, "redis", "redis-inst-1");
      expect(status.isMissingStorage).toBe(false);
      expect(status.areTablesCreated).toBe(false);
      expect(status.missingCount).toBe(3);
      expect(status.errorMessage).toContain('Checkpointer schemas have not been created for "Cache Redis"');
    });

    it("returns areTablesCreated=true when all 3 Redis schemas exist", () => {
      const allSchemas: BackendNode[] = LANGGRAPH_REDIS_SCHEMA_DEFINITIONS.map((def, idx) => ({
        id: `schema-${idx}`,
        type: "redis_schema",
        position: { x: 500 + idx * 50, y: 300 },
        fractionalIndex: `r${idx}`,
        data: {
          label: def.name,
          databaseId: "redis-inst-1",
          systemBadge: "langgraph",
        },
      }));

      const status = checkCheckpointerTablesStatus([mockRedisInstance, ...allSchemas], [], true, "redis", "redis-inst-1");
      expect(status.areTablesCreated).toBe(true);
      expect(status.existingTables).toHaveLength(3);
      expect(status.missingCount).toBe(0);
      expect(status.errorMessage).toBeNull();
    });
  });

  describe("provisionCheckpointerTables", () => {
    it("provisions all 4 tables for PostgreSQL with foreign keys, indexes, and connection edges", () => {
      const addedNodes: BackendNode[] = [];
      const addedEdges: any[] = [];

      const createdCount = provisionCheckpointerTables({
        linkedNodeId: "db-pg-1",
        checkpointerType: "postgres",
        nodes: [mockPostgresDb],
        addNode: (node) => addedNodes.push(node),
        addEdge: (edge) => addedEdges.push(edge),
      });

      expect(createdCount).toBe(4);
      expect(addedNodes).toHaveLength(4);
      // 4 database-connection edges + 2 foreign-key edges
      expect(addedEdges).toHaveLength(6);

      // Check checkpoints table
      const checkpointsNode = addedNodes.find((n) => n.data?.label === "langgraph_checkpoints");
      expect(checkpointsNode).toBeDefined();
      expect(checkpointsNode?.data?.systemBadge).toBe("langgraph");
      expect(checkpointsNode?.data?.databaseId).toBe("db-pg-1");
      expect(checkpointsNode?.data?.indexes).toHaveLength(3);
      expect(checkpointsNode?.data?.indexes?.[0]?.name).toBe("idx_checkpoints_thread_id");

      // Check writes table foreign keys & indexes
      const writesNode = addedNodes.find((n) => n.data?.label === "langgraph_checkpoint_writes");
      expect(writesNode).toBeDefined();
      expect(writesNode?.data?.indexes).toHaveLength(3);
      const writesFkCol = writesNode?.data?.columns?.find((c) => c.name === "checkpoint_id");
      expect(writesFkCol?.isForeignKey).toBe(true);
      expect(writesFkCol?.references?.table).toBe("langgraph_checkpoints");

      // Check foreign-key edges
      const fkEdges = addedEdges.filter((e) => e.type === "foreign-key");
      expect(fkEdges).toHaveLength(2);
      expect(fkEdges.some((e) => e.source === checkpointsNode?.id && e.target === writesNode?.id)).toBe(true);
    });

    it("provisions all 3 schemas for Redis and creates connection edges", () => {
      const addedNodes: BackendNode[] = [];
      const addedEdges: any[] = [];

      const createdCount = provisionCheckpointerTables({
        linkedNodeId: "redis-inst-1",
        checkpointerType: "redis",
        nodes: [mockRedisInstance],
        addNode: (node) => addedNodes.push(node),
        addEdge: (edge) => addedEdges.push(edge),
      });

      expect(createdCount).toBe(3);
      expect(addedNodes).toHaveLength(3);
      expect(addedEdges).toHaveLength(3);

      expect(addedNodes[0]?.type).toBe("redis_schema");
      expect(addedNodes[0]?.data?.label).toBe("langgraph_checkpoints");
      expect(addedNodes[0]?.data?.dbType).toBe("redis");
      expect(addedNodes[0]?.data?.systemBadge).toBe("langgraph");
      expect(addedNodes[0]?.data?.databaseId).toBe("redis-inst-1");
      expect(addedEdges[0]?.source).toBe("redis-inst-1");
      expect(addedEdges[0]?.type).toBe("database-connection");
    });

    it("updates existing tables with foreign keys and indexes when updateNode is provided", () => {
      const existingTable: BackendNode = {
        id: "tbl-0",
        type: "entity",
        position: { x: 100, y: 300 },
        fractionalIndex: "e0",
        data: {
          label: "langgraph_checkpoints",
          databaseId: "db-pg-1",
          systemBadge: "langgraph",
        },
      };

      const addedNodes: BackendNode[] = [];
      const addedEdges: any[] = [];
      const updatedNodes: { id: string; changes: any }[] = [];

      const count = provisionCheckpointerTables({
        linkedNodeId: "db-pg-1",
        checkpointerType: "postgres",
        nodes: [mockPostgresDb, existingTable],
        addNode: (node) => addedNodes.push(node),
        updateNode: (id, changes) => updatedNodes.push({ id, changes }),
        addEdge: (edge) => addedEdges.push(edge),
      });

      expect(count).toBe(3); // 3 newly created tables
      expect(addedNodes).toHaveLength(3);
      expect(updatedNodes).toHaveLength(1);
      expect(updatedNodes[0]?.changes?.data?.indexes).toBeDefined();
    });
  });
});
