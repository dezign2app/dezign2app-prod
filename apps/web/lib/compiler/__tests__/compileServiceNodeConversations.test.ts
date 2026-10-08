import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";
import { compileServiceNode } from "../compileServiceNode";
import { generateTypesPackage } from "../generators/typesGenerator";
import { cleanUnusedImports } from "../utils";
import { compilePostgresDatabase } from "../databases/postgres";
import { compileMysqlDatabase } from "../databases/mysql";
import { compileRawSqliteDatabase } from "../databases/sqlite/raw";
import { cleanupDeletedNodesState, cleanupDeletedEdgesState } from "@/lib/stores/backendCanvas/stateCleanup";

describe("compileServiceNode - Conversations route & typing audit", () => {
  it("compiles create-conversation endpoint with exact entity typing, no 'as any', no 'unknown', and guarded body", () => {
    const serviceNode: BackendNode = {
      id: "srv-conversations",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "conversations",
        techStack: "express",
        port: "8080",
      },
    };

    const entityNode: BackendNode = {
      id: "entity-conversations",
      type: "entity",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string", isNotNull: true },
        ],
      },
    };

    const dbRefNode: BackendNode = {
      id: "db-ref-conversations",
      type: "db_ref",
      position: { x: 100, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "conversations",
        tableRef: "entity-conversations",
      },
    };

    const allNodes: BackendNode[] = [serviceNode, entityNode, dbRefNode];

    const allEdges: BackendEdge[] = [
      {
        id: "e1",
        type: "database-connection",
        fractionalIndex: "a0",
        source: "srv-conversations",
        target: "db-ref-conversations",
      },
    ];

    const endpoint: Endpoint & { nodeId: string } = {
      id: "ep-create-conversation",
      nodeId: "srv-conversations",
      name: "/create-conversation",
      type: "POST",
      summary: "Create a conversation",
    };

    // 1. Compile Service Node
    const serviceResult = compileServiceNode(
      serviceNode,
      [endpoint],
      [],
      allNodes,
      allEdges,
      [],
      [],
      [],
      "conversations",
    );

    const routeFile = serviceResult.files.find((f) =>
      f.filename.includes("postCreateConversation.ts"),
    );
    expect(routeFile).toBeDefined();
    const routeCode = routeFile!.content;

    // Verify ZERO 'as any', ZERO 'as {', ZERO '(PAYLOAD_VAR || {}) as any'
    expect(routeCode).not.toContain("as any");
    expect(routeCode).not.toContain("(PAYLOAD_VAR || {}) as any");
    expect(routeCode).not.toContain("as { id");
    expect(routeCode).not.toContain("as unknown");

    // Verify guarded body and clean create call
    expect(routeCode).toContain("await createConversation(body)");
    expect(routeCode).toContain("data: createdConversations");

    // 2. Compile Types Package
    const typesFiles = generateTypesPackage(
      allNodes,
      [endpoint],
      [],
      [{ id: serviceNode.id, name: "conversations", folderName: "conversations" }],
      allEdges,
    );

    const routeTypeFile = typesFiles.find((f) =>
      f.filename.includes("postCreateConversation.ts"),
    );
    expect(routeTypeFile).toBeDefined();
    const typeCode = routeTypeFile!.content;

    // Response must type data as Conversations (entity), NOT Record<string, ...> or any
    expect(typeCode).toContain("data: Conversations;");
    expect(typeCode).not.toContain("data?: Record<string, string | number | boolean | null>");
    expect(typeCode).not.toContain("data?: any");

    // Body must type as CreateConversationsData
    expect(typeCode).toContain("export type ConversationsPostCreateConversationBody = CreateConversationsData;");

    // Entities file must export CreateConversationsData with title
    const entitiesFile = typesFiles.find((f) => f.filename === "src/entities/index.ts");
    expect(entitiesFile).toBeDefined();
    expect(entitiesFile!.content).toContain("export type CreateConversationsData = {");
    expect(entitiesFile!.content).toContain("title: string;");
  });

  it("compiles an unconfigured GET /conversations endpoint with optional return type and no forced entity data requirement", () => {
    const serviceNode: BackendNode = {
      id: "srv-conversations",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "conversations",
        techStack: "express",
        port: "8080",
      },
    };

    const entityNode: BackendNode = {
      id: "entity-conversations",
      type: "entity",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string", isNotNull: true },
        ],
      },
    };

    // Notice: NO edges between serviceNode and entityNode, no db_ref, no db config on endpoint
    const allNodes: BackendNode[] = [serviceNode, entityNode];
    const allEdges: BackendEdge[] = [];

    const endpoint: Endpoint & { nodeId: string } = {
      id: "ep-get-conversations",
      nodeId: "srv-conversations",
      name: "/conversations",
      type: "GET",
      summary: "Get conversations",
    };

    // 1. Compile Service Node
    const serviceResult = compileServiceNode(
      serviceNode,
      [endpoint],
      [],
      allNodes,
      allEdges,
      [],
      [],
      [],
      "conversations",
    );

    const routeFile = serviceResult.files.find((f) =>
      f.filename.includes("getConversations.ts"),
    );
    expect(routeFile).toBeDefined();
    const routeCode = routeFile!.content;

    // Route returns simple message without database queries
    expect(routeCode).toContain('message: "Successfully executed GET /conversations"');
    expect(routeCode).not.toContain("findAllConversations");

    // 2. Compile Types Package
    const typesFiles = generateTypesPackage(
      allNodes,
      [endpoint],
      [],
      [{ id: serviceNode.id, name: "conversations", folderName: "conversations" }],
      allEdges,
    );

    const routeTypeFile = typesFiles.find((f) =>
      f.filename.includes("getConversations.ts"),
    );
    expect(routeTypeFile).toBeDefined();
    const typeCode = routeTypeFile!.content;

    // Response must NOT require data: Conversations[];
    expect(typeCode).not.toContain("data: Conversations[];");
    expect(typeCode).toContain("export interface ConversationsGetConversationsResponse {");
    expect(typeCode).toContain("message?: string;");
    expect(typeCode).toContain("data?: Record<string, string | number | boolean | null>;");
  });

  it("does not generate createConversation import for POST route with pipeline steps (e.g. LangGraph)", () => {
    const serviceNode: BackendNode = {
      id: "srv-conversation",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "conversation",
        techStack: "express",
        port: "8080",
      },
    };

    const entityNode: BackendNode = {
      id: "entity-conversations",
      type: "entity",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string", isNotNull: true },
        ],
      },
    };

    const dbRefNode: BackendNode = {
      id: "db-ref-conversations",
      type: "db_ref",
      position: { x: 100, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "conversations",
        tableRef: "entity-conversations",
      },
    };

    const allNodes: BackendNode[] = [serviceNode, entityNode, dbRefNode];
    const allEdges: BackendEdge[] = [
      {
        id: "e1",
        type: "database-connection",
        fractionalIndex: "a0",
        source: "srv-conversation",
        target: "db-ref-conversations",
      },
    ];

    const endpoint: Endpoint & { nodeId: string } = {
      id: "ep-send-message",
      nodeId: "srv-conversation",
      name: "/send-message",
      type: "POST",
      summary: "Send a message via LangGraph",
      pipelineSteps: [
        {
          id: "step-1",
          name: "Invoke LangGraph Agent",
          type: "langgraph_invoke",
          langGraphTargetNodeId: "lg-node-1",
          inputBindings: [],
        },
      ],
    };

    const serviceResult = compileServiceNode(
      serviceNode,
      [endpoint],
      [],
      allNodes,
      allEdges,
      [],
      [],
      [],
      "conversation",
    );

    const routeFile = serviceResult.files.find((f) =>
      f.filename.includes("postSendMessage.ts"),
    );
    expect(routeFile).toBeDefined();
    const routeCode = routeFile!.content;

    // Must NOT contain createConversation or unused database import
    expect(routeCode).not.toContain("createConversation");
    expect(routeCode).not.toContain("@workspace/db/helpers/conversations");
  });

  it("does not generate createConversation import when crudOperations is explicitly empty array", () => {
    const serviceNode: BackendNode = {
      id: "srv-conversation",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "conversation",
        techStack: "express",
        port: "8080",
      },
    };

    const entityNode: BackendNode = {
      id: "entity-conversations",
      type: "entity",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string", isNotNull: true },
        ],
      },
    };

    const dbRefNode: BackendNode = {
      id: "db-ref-conversations",
      type: "db_ref",
      position: { x: 100, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "conversations",
        tableRef: "entity-conversations",
      },
    };

    const allNodes: BackendNode[] = [serviceNode, entityNode, dbRefNode];
    const allEdges: BackendEdge[] = [
      {
        id: "e1",
        type: "database-connection",
        fractionalIndex: "a0",
        source: "srv-conversation",
        target: "db-ref-conversations",
      },
    ];

    const endpoint: Endpoint & { nodeId: string } = {
      id: "ep-post-action",
      nodeId: "srv-conversation",
      name: "/custom-action",
      type: "POST",
      summary: "Custom action without CRUD",
      crudOperations: {
        "db-ref-conversations": [],
      },
    };

    const serviceResult = compileServiceNode(
      serviceNode,
      [endpoint],
      [],
      allNodes,
      allEdges,
      [],
      [],
      [],
      "conversation",
    );

    const routeFile = serviceResult.files.find((f) =>
      f.filename.includes("postCustomAction.ts"),
    );
    expect(routeFile).toBeDefined();
    const routeCode = routeFile!.content;

    // Deliberately cleared CRUD operations must NOT be resurrected
    expect(routeCode).not.toContain("createConversation");
    expect(routeCode).not.toContain("@workspace/db/helpers/conversations");
  });

  it("cleanUnusedImports removes unused database imports even when mentioned in AI comment blocks", () => {
    const source = `
import { createConversation, findAllConversations } from "@workspace/db/helpers/conversations";
import { logger } from "@workspace/logger";

/**
 * AI Directive:
 * Available database helpers: createConversation, findAllConversations
 */
export async function handler(req: any, res: any) {
  logger.info("Handling request");
  return res.json({ ok: true });
}
`;
    const cleaned = cleanUnusedImports(source);
    // Unused imports from @workspace/db/helpers/conversations must be removed
    expect(cleaned).not.toContain("@workspace/db/helpers/conversations");
    expect(cleaned).not.toMatch(/import\s*\{[^}]*createConversation/);
    expect(cleaned).not.toMatch(/import\s*\{[^}]*findAllConversations/);
    expect(cleaned).toContain("logger");
  });

  it("generates both singular and plural alias files for database helpers across postgres, mysql, and sqlite raw", () => {
    const entityNode: BackendNode = {
      id: "entity-conversations",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "conversations",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "title", type: "string" },
        ],
      },
    };

    // Postgres
    const pgResult = compilePostgresDatabase([entityNode], []);
    const pgSingular = pgResult.files.find((f) => f.filename === "helpers/conversation.ts");
    const pgPlural = pgResult.files.find((f) => f.filename === "helpers/conversations.ts");
    expect(pgSingular).toBeDefined();
    expect(pgPlural).toBeDefined();
    expect(pgPlural!.content).toContain('export * from "./conversation";');

    // MySQL
    const mysqlResult = compileMysqlDatabase([entityNode], []);
    const mysqlSingular = mysqlResult.files.find((f) => f.filename === "helpers/conversation.ts");
    const mysqlPlural = mysqlResult.files.find((f) => f.filename === "helpers/conversations.ts");
    expect(mysqlSingular).toBeDefined();
    expect(mysqlPlural).toBeDefined();
    expect(mysqlPlural!.content).toContain('export * from "./conversation";');

    // SQLite Raw
    const sqliteResult = compileRawSqliteDatabase([entityNode], []);
    const sqliteSingular = sqliteResult.files.find((f) => f.filename === "helpers/conversation.ts");
    const sqlitePlural = sqliteResult.files.find((f) => f.filename === "helpers/conversations.ts");
    expect(sqliteSingular).toBeDefined();
    expect(sqlitePlural).toBeDefined();
    expect(sqliteSingular!.content).toContain('export * from "./conversations";');
  });

  it("stateCleanup cleans up db_operation pipeline steps when database nodes or edges are removed", () => {
    const mockState: any = {
      nodes: [
        { id: "srv-1", type: "service", data: { label: "srv" } },
        { id: "entity-1", type: "entity", data: { label: "conversations" } },
        { id: "db-1", type: "database", data: { label: "main-db" } },
      ],
      edges: [
        { id: "edge-1", source: "srv-1", target: "db-1" },
      ],
      endpoints: [
        {
          id: "ep-1",
          nodeId: "srv-1",
          name: "/send",
          type: "POST",
          databaseNodeIds: ["db-1"],
          crudOperations: { "db-1": ["create"] },
          pipelineSteps: [
            {
              id: "step-db",
              name: "Save message",
              type: "db_operation",
              databaseId: "db-1",
              tableNodeId: "entity-1",
            },
            {
              id: "step-other",
              name: "Other step",
              type: "custom_code",
            },
          ],
        },
      ],
      events: [],
      pendingNodeUpserts: [],
      pendingEndpointUpserts: [],
      pendingEventUpserts: [],
      pendingEdgeUpserts: [],
      pendingEventRemovals: [],
    };

    // 1. Test node deletion cleanup
    const nodeCleaned = cleanupDeletedNodesState(mockState, ["entity-1"]);
    const epAfterNodeDelete = nodeCleaned.endpoints?.find((e: any) => e.id === "ep-1");
    expect(epAfterNodeDelete).toBeDefined();
    expect(epAfterNodeDelete?.pipelineSteps).toHaveLength(1);
    expect(epAfterNodeDelete?.pipelineSteps?.[0]?.type).toBe("custom_code");

    // 2. Test edge deletion cleanup
    const edgeCleaned = cleanupDeletedEdgesState(mockState, ["edge-1"]);
    const epAfterEdgeDelete = edgeCleaned.endpoints?.find((e: any) => e.id === "ep-1");
    expect(epAfterEdgeDelete).toBeDefined();
    expect(epAfterEdgeDelete?.databaseNodeIds).toEqual([]);
    expect(epAfterEdgeDelete?.pipelineSteps).toHaveLength(1);
    expect(epAfterEdgeDelete?.pipelineSteps?.[0]?.type).toBe("custom_code");
  });
});

