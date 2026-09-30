import type { BackendNode } from "@/types/canvas";
import type { CanvasEntityColumn } from "@workspace/canvas";

export interface LangGraphTableDefinition {
  name: string;
  description: string;
  columns: CanvasEntityColumn[];
  indexes?: {
    name: string;
    columns: string;
    isUnique?: boolean;
  }[];
}

export interface LangGraphRedisSchemaDefinition {
  name: string;
  description: string;
  redisDataStructure: "hash" | "string" | "list" | "set" | "zset" | "stream";
  keyTemplate: string;
  columns: CanvasEntityColumn[];
  indexes?: {
    name: string;
    columns: string;
    isUnique?: boolean;
  }[];
}

export const LANGGRAPH_POSTGRES_TABLE_DEFINITIONS: LangGraphTableDefinition[] = [
  {
    name: "langgraph_checkpoints",
    description: "LangGraph state checkpoints indexed by thread and run namespace",
    columns: [
      { name: "thread_id", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      { name: "checkpoint_ns", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      { name: "checkpoint_id", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      {
        name: "parent_checkpoint_id",
        type: "TEXT",
        isNotNull: false,
        isForeignKey: true,
        references: { table: "langgraph_checkpoints", column: "checkpoint_id" },
      },
      { name: "type", type: "TEXT", isNotNull: false },
      { name: "checkpoint", type: "JSON", isNotNull: true },
      { name: "metadata", type: "JSON", isNotNull: true },
    ],
    indexes: [
      { name: "idx_checkpoints_thread_id", columns: "thread_id" },
      { name: "idx_checkpoints_thread_ns", columns: "thread_id, checkpoint_ns" },
      { name: "idx_checkpoints_parent", columns: "parent_checkpoint_id" },
    ],
  },
  {
    name: "langgraph_checkpoint_writes",
    description: "Pending channel writes and delta operations per graph step",
    columns: [
      {
        name: "thread_id",
        type: "TEXT",
        isPrimaryKey: true,
        isNotNull: true,
        isForeignKey: true,
        references: { table: "langgraph_checkpoints", column: "thread_id" },
      },
      { name: "checkpoint_ns", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      {
        name: "checkpoint_id",
        type: "TEXT",
        isPrimaryKey: true,
        isNotNull: true,
        isForeignKey: true,
        references: { table: "langgraph_checkpoints", column: "checkpoint_id" },
      },
      { name: "task_id", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      { name: "idx", type: "INTEGER", isPrimaryKey: true, isNotNull: true },
      { name: "channel", type: "TEXT", isNotNull: true },
      { name: "type", type: "TEXT", isNotNull: false },
      { name: "blob", type: "JSON", isNotNull: true },
    ],
    indexes: [
      { name: "idx_checkpoint_writes_thread_id", columns: "thread_id" },
      { name: "idx_checkpoint_writes_checkpoint_id", columns: "checkpoint_id" },
      { name: "idx_checkpoint_writes_task", columns: "task_id, idx" },
    ],
  },
  {
    name: "langgraph_checkpoint_blobs",
    description: "Serialized large-state blobs and message buffers",
    columns: [
      {
        name: "thread_id",
        type: "TEXT",
        isPrimaryKey: true,
        isNotNull: true,
        isForeignKey: true,
        references: { table: "langgraph_checkpoints", column: "thread_id" },
      },
      { name: "checkpoint_ns", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      { name: "channel", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      { name: "version", type: "TEXT", isPrimaryKey: true, isNotNull: true },
      { name: "type", type: "TEXT", isNotNull: false },
      { name: "blob", type: "JSON", isNotNull: true },
    ],
    indexes: [
      { name: "idx_checkpoint_blobs_thread_id", columns: "thread_id" },
      { name: "idx_checkpoint_blobs_channel", columns: "channel, version" },
    ],
  },
  {
    name: "langgraph_checkpoint_migrations",
    description: "Database migration tracker for LangGraph schema versions",
    columns: [
      { name: "v", type: "INTEGER", isPrimaryKey: true, isNotNull: true },
    ],
    indexes: [
      { name: "idx_checkpoint_migrations_v", columns: "v", isUnique: true },
    ],
  },
];

export const LANGGRAPH_REDIS_SCHEMA_DEFINITIONS: LangGraphRedisSchemaDefinition[] = [
  {
    name: "langgraph_checkpoints",
    description: "LangGraph state checkpoints hash map indexed by thread and run namespace",
    redisDataStructure: "hash",
    keyTemplate: "checkpoint:{thread_id}:{checkpoint_ns}:{checkpoint_id}",
    columns: [
      { name: "checkpoint", type: "JSON", isNotNull: true },
      { name: "metadata", type: "JSON", isNotNull: true },
      { name: "parent_checkpoint_id", type: "TEXT", isNotNull: false },
    ],
  },
  {
    name: "langgraph_checkpoint_writes",
    description: "LangGraph step writes channel buffer and tasks",
    redisDataStructure: "hash",
    keyTemplate: "writes:{thread_id}:{checkpoint_ns}:{checkpoint_id}:{task_id}",
    columns: [
      { name: "task_id", type: "TEXT", isNotNull: true },
      { name: "channel", type: "TEXT", isNotNull: true },
      { name: "blob", type: "JSON", isNotNull: true },
    ],
  },
  {
    name: "langgraph_checkpoint_blobs",
    description: "Serialized large state binary objects and buffers",
    redisDataStructure: "hash",
    keyTemplate: "blobs:{thread_id}:{checkpoint_ns}:{channel}",
    columns: [
      { name: "blob", type: "JSON", isNotNull: true },
      { name: "version", type: "TEXT", isNotNull: true },
    ],
  },
];

/**
 * Returns existing LangGraph checkpointer tables or schemas associated with the given connectionId.
 */
export function getExistingCheckpointerTables(
  nodes: BackendNode[],
  edges: any[] = [],
  checkpointerType: string,
  connectionId?: string,
): BackendNode[] {
  if (!connectionId) return [];

  const isEdgeConnected = (nodeId: string) =>
    edges.some(
      (e) =>
        (e.source === connectionId && e.target === nodeId) ||
        (e.target === connectionId && e.source === nodeId),
    );

  if (checkpointerType === "postgres") {
    return nodes.filter(
      (n) =>
        n?.type === "entity" &&
        (n.data?.databaseId === connectionId || isEdgeConnected(n.id)) &&
        (n.data?.systemBadge === "langgraph" ||
          LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.some(
            (def) => def.name === n.data?.label || def.name === n.data?.tableName,
          )),
    );
  }

  if (checkpointerType === "redis") {
    return nodes.filter(
      (n) =>
        (n?.type === "redis_schema" || n?.type === "entity") &&
        (n.data?.databaseId === connectionId || isEdgeConnected(n.id)) &&
        (n.data?.systemBadge === "langgraph" ||
          LANGGRAPH_REDIS_SCHEMA_DEFINITIONS.some(
            (def) => def.name === n.data?.label || def.name === n.data?.tableName,
          ) ||
          LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.some(
            (def) => def.name === n.data?.label || def.name === n.data?.tableName,
          )),
    );
  }

  return [];
}

export interface CheckpointerTablesStatus {
  isConfigured: boolean;
  isMissingStorage: boolean;
  configuredNode?: BackendNode;
  configuredNodeId?: string;
  existingTables: BackendNode[];
  expectedCount: number;
  areTablesCreated: boolean;
  missingCount: number;
  errorMessage: string | null;
}

/**
 * Evaluates whether the checkpointer is properly configured and if all required tables exist in SchemaView.
 */
export function checkCheckpointerTablesStatus(
  nodes: BackendNode[],
  edges: any[] = [],
  isEnabled: boolean,
  checkpointerType: string,
  connectionId?: string,
): CheckpointerTablesStatus {
  if (!isEnabled || checkpointerType === "memory") {
    return {
      isConfigured: true,
      isMissingStorage: false,
      existingTables: [],
      expectedCount: 0,
      areTablesCreated: true,
      missingCount: 0,
      errorMessage: null,
    };
  }

  if (checkpointerType === "postgres") {
    const postgresNodes = nodes.filter(
      (n) => n?.type === "database" && n.data?.dbEngine === "postgres",
    );
    const configuredDb =
      postgresNodes.find((p) => p.id === connectionId) || postgresNodes[0];

    if (!configuredDb) {
      return {
        isConfigured: false,
        isMissingStorage: true,
        existingTables: [],
        expectedCount: 4,
        areTablesCreated: false,
        missingCount: 4,
        errorMessage: "No PostgreSQL database found in SchemaView. Please create a Database node in SchemaView.",
      };
    }

    const existing = getExistingCheckpointerTables(nodes, edges, "postgres", configuredDb.id);
    const expectedCount = LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.length;
    const areTablesCreated = existing.length >= expectedCount;
    const missingCount = Math.max(0, expectedCount - existing.length);
    const dbName = configuredDb.data?.label || "PostgreSQL";

    let errorMessage: string | null = null;
    if (!areTablesCreated) {
      if (existing.length === 0) {
        errorMessage = `Checkpointer tables have not been created for "${dbName}" in SchemaView.`;
      } else {
        errorMessage = `Only ${existing.length}/${expectedCount} checkpointer tables created for "${dbName}" in SchemaView.`;
      }
    }

    return {
      isConfigured: true,
      isMissingStorage: false,
      configuredNode: configuredDb,
      configuredNodeId: configuredDb.id,
      existingTables: existing,
      expectedCount,
      areTablesCreated,
      missingCount,
      errorMessage,
    };
  }

  if (checkpointerType === "redis") {
    const redisNodes = nodes.filter(
      (n) =>
        n?.type === "redis_instance" ||
        (n?.type === "database" && n.data?.dbEngine === "redis"),
    );
    const configuredRedis =
      redisNodes.find((r) => r.id === connectionId) || redisNodes[0];

    if (!configuredRedis) {
      return {
        isConfigured: false,
        isMissingStorage: true,
        existingTables: [],
        expectedCount: 3,
        areTablesCreated: false,
        missingCount: 3,
        errorMessage: "No Redis instance found in SchemaView. Please create a Redis instance in SchemaView.",
      };
    }

    const existing = getExistingCheckpointerTables(nodes, edges, "redis", configuredRedis.id);
    const expectedCount = LANGGRAPH_REDIS_SCHEMA_DEFINITIONS.length;
    const areTablesCreated = existing.length >= expectedCount;
    const missingCount = Math.max(0, expectedCount - existing.length);
    const redisName = configuredRedis.data?.label || "Redis";

    let errorMessage: string | null = null;
    if (!areTablesCreated) {
      if (existing.length === 0) {
        errorMessage = `Checkpointer schemas have not been created for "${redisName}" in SchemaView.`;
      } else {
        errorMessage = `Only ${existing.length}/${expectedCount} checkpointer schemas created for "${redisName}" in SchemaView.`;
      }
    }

    return {
      isConfigured: true,
      isMissingStorage: false,
      configuredNode: configuredRedis,
      configuredNodeId: configuredRedis.id,
      existingTables: existing,
      expectedCount,
      areTablesCreated,
      missingCount,
      errorMessage,
    };
  }

  return {
    isConfigured: true,
    isMissingStorage: false,
    existingTables: [],
    expectedCount: 0,
    areTablesCreated: true,
    missingCount: 0,
    errorMessage: null,
  };
}

/**
 * Provisions missing LangGraph checkpointer tables/schemas in SchemaView under the linked storage node,
 * or updates existing ones with foreign key mappings and indexes.
 */
export function provisionCheckpointerTables({
  linkedNodeId,
  checkpointerType,
  nodes,
  edges = [],
  addNode,
  updateNode,
  addEdge,
}: {
  linkedNodeId: string;
  checkpointerType: "postgres" | "redis" | string;
  nodes: BackendNode[];
  edges?: any[];
  addNode: (node: Omit<BackendNode, "fractionalIndex"> | any) => void;
  updateNode?: (id: string, changes: Partial<BackendNode>) => void;
  addEdge: (edge: any) => void;
}): number {
  const linkedNode = nodes.find((n) => n.id === linkedNodeId);
  if (!linkedNode) return 0;

  const dbPos = linkedNode.position || { x: 200, y: 200 };
  let createdCount = 0;
  let updatedCount = 0;
  const tableIdMap: Record<string, string> = {};

  if (checkpointerType === "redis") {
    LANGGRAPH_REDIS_SCHEMA_DEFINITIONS.forEach((schemaDef, idx) => {
      const existingNode = nodes.find(
        (n) =>
          (n.type === "redis_schema" || n.type === "entity") &&
          n.data?.databaseId === linkedNodeId &&
          (n.data?.label === schemaDef.name || n.data?.tableName === schemaDef.name),
      );

      if (existingNode) {
        tableIdMap[schemaDef.name] = existingNode.id;
        if (updateNode) {
          updateNode(existingNode.id, {
            data: {
              ...existingNode.data,
              columns: schemaDef.columns,
              indexes: schemaDef.indexes,
            },
          });
          updatedCount++;
        }
        return;
      }

      const schemaId = crypto.randomUUID();
      tableIdMap[schemaDef.name] = schemaId;
      const colOffset = (idx % 2) * 320;
      const rowOffset = Math.floor(idx / 2) * 260 + 260;

      addNode({
        id: schemaId,
        type: "redis_schema",
        position: { x: dbPos.x + colOffset, y: dbPos.y + rowOffset },
        data: {
          label: schemaDef.name,
          tableName: schemaDef.name,
          description: schemaDef.description,
          dbType: "redis",
          redisDataStructure: schemaDef.redisDataStructure,
          keyTemplate: schemaDef.keyTemplate,
          systemBadge: "langgraph",
          readOnly: true,
          databaseId: linkedNodeId,
          columns: schemaDef.columns,
          indexes: schemaDef.indexes,
        },
      });

      addEdge({
        id: `edge-${linkedNodeId}-${schemaId}`,
        source: linkedNodeId,
        target: schemaId,
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
        type: "database-connection",
      });

      createdCount++;
    });
  } else {
    // Postgres / Relational
    LANGGRAPH_POSTGRES_TABLE_DEFINITIONS.forEach((tableDef, idx) => {
      const existingNode = nodes.find(
        (n) =>
          n.type === "entity" &&
          n.data?.databaseId === linkedNodeId &&
          (n.data?.label === tableDef.name || n.data?.tableName === tableDef.name),
      );

      if (existingNode) {
        tableIdMap[tableDef.name] = existingNode.id;
        if (updateNode) {
          updateNode(existingNode.id, {
            data: {
              ...existingNode.data,
              columns: tableDef.columns,
              indexes: tableDef.indexes,
            },
          });
          updatedCount++;
        }
        return;
      }

      const tableId = crypto.randomUUID();
      tableIdMap[tableDef.name] = tableId;
      const colOffset = (idx % 2) * 320;
      const rowOffset = Math.floor(idx / 2) * 260 + 260;

      addNode({
        id: tableId,
        type: "entity",
        position: { x: dbPos.x + colOffset, y: dbPos.y + rowOffset },
        data: {
          label: tableDef.name,
          tableName: tableDef.name,
          description: tableDef.description,
          dbType: "relational",
          systemBadge: "langgraph",
          readOnly: true,
          databaseId: linkedNodeId,
          columns: tableDef.columns,
          indexes: tableDef.indexes,
        },
      });

      addEdge({
        id: `edge-${linkedNodeId}-${tableId}`,
        source: linkedNodeId,
        target: tableId,
        sourceHandle: "database-source",
        targetHandle: "database-entity-target",
        type: "database-connection",
      });

      createdCount++;
    });

    // Establish foreign-key edges between checkpoints, writes, and blobs
    const checkpointsId = tableIdMap["langgraph_checkpoints"];
    const writesId = tableIdMap["langgraph_checkpoint_writes"];
    const blobsId = tableIdMap["langgraph_checkpoint_blobs"];

    // 1. langgraph_checkpoints (checkpoint_id at idx 2) -> langgraph_checkpoint_writes (checkpoint_id at idx 2)
    if (checkpointsId && writesId) {
      const hasWritesFk = edges.some(
        (e) =>
          e.type === "foreign-key" &&
          ((e.source === checkpointsId && e.target === writesId) ||
            (e.target === checkpointsId && e.source === writesId)),
      );
      if (!hasWritesFk) {
        addEdge({
          id: `edge-fk-${writesId}-${checkpointsId}-checkpoint_id`,
          source: checkpointsId,
          target: writesId,
          sourceHandle: "source-2",
          targetHandle: "target-2",
          type: "foreign-key",
        });
      }
    }

    // 2. langgraph_checkpoints (thread_id at idx 0) -> langgraph_checkpoint_blobs (thread_id at idx 0)
    if (checkpointsId && blobsId) {
      const hasBlobsFk = edges.some(
        (e) =>
          e.type === "foreign-key" &&
          ((e.source === checkpointsId && e.target === blobsId) ||
            (e.target === checkpointsId && e.source === blobsId)),
      );
      if (!hasBlobsFk) {
        addEdge({
          id: `edge-fk-${blobsId}-${checkpointsId}-thread_id`,
          source: checkpointsId,
          target: blobsId,
          sourceHandle: "source-0",
          targetHandle: "target-0",
          type: "foreign-key",
        });
      }
    }
  }

  return createdCount > 0 ? createdCount : updatedCount;
}
