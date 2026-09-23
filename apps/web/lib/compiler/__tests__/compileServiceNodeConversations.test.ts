import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";
import { compileServiceNode } from "../compileServiceNode";
import { generateTypesPackage } from "../generators/typesGenerator";

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
});
