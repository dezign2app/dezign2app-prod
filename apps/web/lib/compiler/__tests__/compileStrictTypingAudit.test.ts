import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { generateEntitiesModule } from "../generators/typesGenerator/entitiesGenerator";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

describe("compileStrictTypingAudit - Verifying strict typing across generated monorepo", () => {
  it("generates monorepo with 0 ambient any in custom.ts, 0 unknown in ResponseContext, and typed actions", () => {
    const serviceNode: BackendNode = {
      id: "node-conversation",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Conversation",
        port: "8082",
      },
    };

    const redisNode: BackendNode = {
      id: "node-redis-conv",
      type: "redis_schema",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Conversation",
        tableName: "conversation",
        redisDataStructure: "json",
        jsonRootType: "array",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "message", type: "string", isNotNull: true },
        ],
      },
    };

    const typesNode: BackendNode = {
      id: "node-types",
      type: "types",
      position: { x: 400, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Domain Models",
        definitionMode: "visual",
        types: [
          {
            id: "t-1",
            name: "ConversationItem",
            kind: "interface",
            fields: [
              { id: "f-1", name: "id", type: "string", required: true },
              { id: "f-2", name: "message", type: "string", required: true },
            ],
          },
        ],
      },
    };

    const webAppNode: BackendNode = {
      id: "node-webapp",
      type: "webApp",
      position: { x: 0, y: 200 },
      fractionalIndex: "a3",
      data: {
        label: "Web App 1",
      },
    };

    const webPageNode: BackendNode = {
      id: "node-webpage",
      type: "webPage",
      position: { x: 200, y: 200 },
      fractionalIndex: "a4",
      data: {
        label: "Conversations",
        path: "/conversations",
        sections: [
          {
            id: "sec-main",
            name: "Main",
            renderMode: "client",
            loadStrategy: "eager",
            actions: [
              {
                id: "ev-get",
                name: "GetConversationsAction",
                event: "click",
              },
            ],
          },
        ],
      },
    };

    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-health",
        nodeId: "node-conversation",
        name: "/health",
        type: "GET",
        summary: "Health check",
      },
      {
        id: "ep-get-conversations",
        nodeId: "node-conversation",
        name: "/get-conversations",
        type: "GET",
        summary: "Get conversations",
        pipelineSteps: [
          {
            id: "step-1",
            name: "Get Recent Conversations",
            type: "redis_operation",
            enabled: true,
            outputVariable: "conversations",
            functionRef: {
              name: "getRecentConversationItems",
              importPath: "@workspace/redis",
            },
          },
        ],
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "e-web-page",
        source: "node-webapp",
        target: "node-webpage",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "e-page-srv",
        source: "node-webpage",
        target: "node-conversation",
        type: "connection",
        fractionalIndex: "a1",
      },
      {
        id: "e-srv-redis",
        source: "node-conversation",
        target: "node-redis-conv",
        type: "connection",
        fractionalIndex: "a2",
      },
    ];

    const result = compileMonorepo(
      [serviceNode, redisNode, typesNode, webAppNode, webPageNode],
      endpoints,
      [],
      edges,
      [],
      "StrictTypingProject",
    );

    // 1. Check custom.ts for zero ambient any
    const customFile = result.files.find((f) => f.filename === "packages/types/src/custom.ts");
    expect(customFile).toBeDefined();
    expect(customFile?.content).not.toContain("= any;");
    expect(customFile?.content).not.toContain(": any;");
    expect(customFile?.content).not.toContain("type ReactNode = any");

    // 2. Check route files for 0 unknown in ResponseContext
    const healthRoute = result.files.find((f) => f.filename.includes("routes/getHealth.ts"));
    expect(healthRoute).toBeDefined();
    expect(healthRoute?.content).not.toContain("Record<string, unknown>");
    expect(healthRoute?.content).not.toContain("unknown[]");
    expect(healthRoute?.content).toContain("ConversationGetHealthResponseContext =");

    const convRoute = result.files.find((f) => f.filename.includes("routes/getGetConversations.ts"));
    expect(convRoute).toBeDefined();
    expect(convRoute?.content).not.toContain("Record<string, unknown>");
    expect(convRoute?.content).not.toContain("unknown[]");

    // 3. Check page.tsx for 0 "as any"
    const pageFiles = result.files.filter((f) => f.filename.endsWith("page.tsx"));
    for (const p of pageFiles) {
      expect(p.content).not.toContain(") as any);");
    }

    // 4. Check action component for 0 requestBody?: unknown
    const actionFiles = result.files.filter((f) => f.filename.includes("GetConversationsAction.tsx"));
    for (const a of actionFiles) {
      expect(a.content).not.toContain("requestBody?: unknown");
    }

    // 5. Check Redis files for 0 any, 0 unknown, 0 'as <Type>' casts, and 0 loose <T> generics
    const redisFiles = result.files.filter((f) => f.filename.includes("packages/redis") || f.filename.includes("/schemas/conversation") || f.filename.includes("/helpers/conversation"));
    for (const rf of redisFiles) {
      if (!rf.filename.endsWith(".ts")) continue;
      expect(rf.content).not.toMatch(/:\s*any\b/);
      expect(rf.content).not.toMatch(/<any>/);
      expect(rf.content).not.toMatch(/:\s*unknown\b/);
      expect(rf.content).not.toMatch(/<unknown>/);
      expect(rf.content).not.toMatch(/\bas\s+[A-Za-z0-9_]+/);
      expect(rf.content).not.toMatch(/<T\s*=/);
    }

    // 6. Check packages/types/src/entities/index.ts for 0 unknown, 0 any, 0 [key: string]: unknown, and 0 as casts
    const entitiesFile = result.files.find((f) => f.filename === "packages/types/src/entities/index.ts");
    expect(entitiesFile).toBeDefined();
    expect(entitiesFile?.content).not.toContain("unknown");
    expect(entitiesFile?.content).not.toContain(": any");
    expect(entitiesFile?.content).not.toContain("<any>");
    expect(entitiesFile?.content).not.toContain("[key: string]: unknown");
    expect(entitiesFile?.content).not.toContain("as ");
  });

  it("generateEntitiesModule emits clean types without unknown, any, or index signatures", () => {
    const nodes: BackendNode[] = [
      {
        id: "n-db",
        type: "database",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "PostgresDB",
          tables: [
            {
              name: "user_profiles",
              columns: [
                { name: "id", type: "string", isPrimaryKey: true },
                { name: "metadata", type: "json" },
              ],
            },
          ],
        },
      },
      {
        id: "n-empty",
        type: "entity",
        position: { x: 0, y: 0 },
        fractionalIndex: "a1",
        data: {
          label: "EmptyEntity",
          columns: [],
        },
      },
    ];

    const code = generateEntitiesModule(nodes, new Set(["ReferencedFallback"]));
    expect(code).not.toContain("unknown");
    expect(code).not.toContain(": any");
    expect(code).not.toContain("<any>");
    expect(code).not.toContain("[key: string]: unknown");
    expect(code).not.toContain("as ");
    expect(code).toContain("export interface EmptyEntity {\n  id: string;\n}");
    expect(code).toContain("export interface UserProfiles {\n  id: string;\n  metadata?: Record<string, string | number | boolean | null>;\n}\nexport type UserProfile = UserProfiles;\n");
    expect(code).toContain("export interface ReferencedFallback {\n  id: string;\n}");
  });
});
