import { describe, it, expect } from "vitest";
import {
  formatSystemContext,
  formatSystemContextForAi,
  formatSystemContextAsToon,
  stripMarkdownFormatters,
  ProjectSystemContextInput,
} from "../formatSystemContext";
import type { BackendNode, BackendEdge } from "@/types/canvas";
import type { EndpointWithNode } from "@workspace/canvas/types";

describe("formatSystemContext", () => {
  it("formats a complete architecture into clean, human-readable text without repetitive JSON keys", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        appSlug: "web",
        port: "3000",
        zones: [
          {
            id: "zone-public",
            handleId: "public-in",
            name: "Public Zone",
            accessType: "public",
            layoutDescription: "Top navigation layout",
          },
          {
            id: "zone-private",
            handleId: "private-in",
            name: "Private Zone",
            accessType: "protected",
            layoutDescription: "Sidebar dashboard layout",
          },
        ],
      },
    };

    const webPageNode: BackendNode = {
      id: "node-page-dash",
      type: "webPage",
      position: { x: 100, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "/dashboard",
        appSlug: "web",
        description: "Main user dashboard",
        sections: [
          {
            id: "sec-1",
            name: "Overview Section",
            actions: [
              {
                id: "act-1",
                name: "Load Stats",
                event: "pageLoad",
                actionSteps: [
                  {
                    id: "step-1",
                    order: 1,
                    type: "api_call",
                    name: "GET /health",
                    serviceNodeId: "node-service",
                    requestBindings: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service",
      type: "service",
      position: { x: 200, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Conversations Service",
        port: "8080",
        grpcPort: "50051",
      },
    };

    const dbNode: BackendNode = {
      id: "node-db",
      type: "database",
      position: { x: 300, y: 0 },
      fractionalIndex: "a3",
      data: {
        label: "Primary PostgreSQL",
        dbEngine: "postgres",
        provider: "supabase",
        host: "db.supabase.co",
        database: "postgres",
      },
    };

    const entityNode: BackendNode = {
      id: "node-entity-user",
      type: "entity",
      position: { x: 300, y: 200 },
      fractionalIndex: "a4",
      data: {
        label: "user",
        tableName: "user",
        group: "Authentication",
        columns: [
          { name: "id", type: "UUID", isPrimaryKey: true, isNotNull: true },
          { name: "email", type: "TEXT", isNotNull: true, isUnique: true },
        ],
      },
    };

    const langGraphNode: BackendNode = {
      id: "node-langgraph",
      type: "langgraph",
      position: { x: 400, y: 0 },
      fractionalIndex: "a5",
      data: {
        label: "Chat Agent",
        agentDefinitions: [
          {
            id: "agent-1",
            agentId: "agent-1",
            name: "Conversational Agent",
            llmConfig: {
              enabled: true,
              provider: "groq",
              model: "openai/gpt-oss-120b",
              temperature: 0.2,
            },
            tools: [],
            middleware: [],
            transformers: [],
            memory: [],
            nodeSteps: [],
            pipelineSteps: [],
            position: { x: 0, y: 0 },
            systemPrompt: "",
          },
        ],
        stateChannels: [
          {
            key: "messages",
            type: "messages",
            defaultValue: [],
            reducer: "messagesReducer",
          },
        ],
        graphEdges: [
          {
            id: "edge-start",
            source: "START",
            targets: [{ id: "agent-1", kind: "step" }],
          },
        ],
      },
    };

    const edgePageToService: BackendEdge = {
      id: "edge-1",
      source: "node-page-dash",
      target: "node-service",
      type: "connection",
      targetHandle: "endpoint-in-ep-health",
      fractionalIndex: "a0",
    };

    const edgeDbToEntity: BackendEdge = {
      id: "edge-2",
      source: "node-db",
      target: "node-entity-user",
      type: "database-connection",
      fractionalIndex: "a1",
    };

    const endpointHealth: EndpointWithNode = {
      id: "ep-health",
      nodeId: "node-service",
      name: "/health",
      type: "GET",
      summary: "Health Check",
      businessLogic: "Verifies service health",
      pipelineSteps: [
        {
          id: "step-ret",
          name: "Return Status",
          type: "return_response",
          statusCode: 200,
          inputBindings: [
            {
              argName: "status",
              source: { kind: "inline", value: "UP" },
            },
          ],
        },
      ],
    };

    const input: ProjectSystemContextInput = {
      project: { id: "proj-123", name: "Demo App" },
      nodes: [webAppNode, webPageNode, serviceNode, dbNode, entityNode, langGraphNode],
      edges: [edgePageToService, edgeDbToEntity],
      endpoints: [endpointHealth],
    };

    const result = formatSystemContext(input);

    expect(result).toContain("# System Architecture: Demo App (ID: proj-123)");
    expect(result).toContain("## 1. System Overview");
    expect(result).toContain("WebApp: `web` (Port: 3000)");
    expect(result).toContain("Service: `Conversations Service`");
    expect(result).toContain("HTTP Port: `8080` | gRPC: **Disabled** (Allocated Port: `50051`)");
    expect(result).toContain("GET /health");
    expect(result).toContain("Chat Agent");
    expect(result).toContain("Primary PostgreSQL");
    expect(result).toContain("user");
    expect(result).toContain("id: UUID [PK, NOT NULL]");
    expect(result).toContain("email: TEXT [NOT NULL, UNIQUE]");
    expect(result).toContain("- **Database Operations (Active)**: 6");
    expect(result).toContain("- **Database Operations (6 active)**:");
    expect(result).toContain("findAllUsers");
    expect(result).toContain("findUserById");
    expect(result).toContain("Page `/dashboard` -> Service `Conversations Service`: Invokes `GET /health`");
  });

  it("accurately marks gRPC as Enabled when interServiceProtocol is set to grpc", () => {
    const grpcServiceNode: BackendNode = {
      id: "node-grpc-service",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Grpc Backend",
        port: "8081",
        grpcPort: "50055",
        interServiceProtocol: "grpc",
      },
    };

    const input: ProjectSystemContextInput = {
      project: { id: "p-1", name: "gRPC App" },
      nodes: [grpcServiceNode],
      edges: [],
    };

    const result = formatSystemContext(input);
    expect(result).toContain("HTTP Port: `8081` | gRPC: **Enabled** (Port: `50055`)");
    expect(result).toContain("- **Inter-Service Protocol**: `GRPC`");
  });

  it("formats explicit DbOperations with custom queries, prompts, pagination, and disabled states", () => {
    const dbNode: BackendNode = {
      id: "db-main",
      type: "database",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Main Postgres",
        dbEngine: "postgres",
      },
    };

    const entityNode: BackendNode = {
      id: "table-convos",
      type: "entity",
      parentId: "db-main",
      position: { x: 0, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "conversations",
        tableName: "conversations",
        databaseId: "db-main",
        columns: [
          { name: "id", type: "UUID", isPrimaryKey: true },
          { name: "title", type: "TEXT" },
        ],
        dbOperations: [
          {
            id: "op-custom-query",
            name: "findPopularConversations",
            kind: "custom",
            params: [{ name: "minMessages", type: "number", required: true }],
            returnType: "Promise<ConversationsRow[]>",
            query: "SELECT * FROM conversations WHERE message_count >= $1",
            pagination: { enabled: true, mode: "cursor", defaultLimit: 50 },
            enabled: true,
          },
          {
            id: "op-nl-prompt",
            name: "searchArchivedConversations",
            kind: "custom",
            logicMode: "natural_language",
            prompt: "Find all conversations that were archived more than 30 days ago",
            enabled: true,
          },
          {
            id: "op-disabled",
            name: "nukeConversations",
            kind: "delete",
            params: [{ name: "id", type: "UUID" }],
            enabled: false,
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "service-chat",
      type: "service",
      position: { x: 300, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Chat Service",
        port: "4000",
      },
    };

    const endpoint: EndpointWithNode = {
      id: "ep-popular",
      nodeId: "service-chat",
      type: "GET",
      name: "/popular",
      pipelineSteps: [
        {
          id: "step-db",
          name: "Fetch Popular",
          type: "db_operation",
          tableNodeId: "table-convos",
          operationId: "op-custom-query",
          functionRef: {
            name: "findPopularConversations",
            importPath: "@workspace/db/conversations",
          },
          outputVariable: "popularList",
          inputBindings: [
            {
              argName: "minMessages",
              source: { kind: "req_query", field: "min" },
            },
          ],
        },
      ],
    };

    const input: ProjectSystemContextInput = {
      project: { id: "p-ops", name: "Operations Test" },
      nodes: [dbNode, entityNode, serviceNode],
      edges: [],
      endpoints: [endpoint],
    };

    const result = formatSystemContext(input);

    // Section 1 overview reflects 3 active ops (including default upsert)
    expect(result).toContain("- **Database Operations (Active)**: 3");

    // Section 3 endpoint explains db_operation with binding and target table
    expect(result).toContain('`db_operation`: Calls `findPopularConversations` on "conversations" ({ minMessages <- query.min }) -> popularList');

    // Section 5 entity lists operations with status
    expect(result).toContain("Database Operations (3 active, 1 disabled)");
    expect(result).toContain("findPopularConversations(minMessages: number)");
    expect(result).toContain("paginated: cursor, limit: 50");
    expect(result).toContain('query: "SELECT * FROM conversations WHERE message_count >= $1"');
    expect(result).toContain("searchArchivedConversations()");
    expect(result).toContain('prompt: "Find all conversations that were archived more than 30 days ago"');
    expect(result).toContain("nukeConversations");
    expect(result).toContain("[DISABLED, delete]");
  });

  it("formats AI context as clean plain text without markdown formatters and includes node IDs and technical details", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-1",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        appSlug: "web",
        port: "3000",
      },
    };

    const webPageNode: BackendNode = {
      id: "node-page-dash-1",
      type: "webPage",
      position: { x: 100, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "/dashboard",
        appSlug: "web",
        description: "Dashboard page",
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-1",
      type: "service",
      position: { x: 200, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Backend Core",
        port: "8080",
      },
    };

    const endpoint: EndpointWithNode = {
      id: "ep-users",
      nodeId: "node-service-1",
      name: "/users",
      type: "GET",
      summary: "List users",
    };

    const edge: BackendEdge = {
      id: "edge-page-to-svc",
      source: "node-page-dash-1",
      target: "node-service-1",
      targetHandle: "endpoint-in-ep-users",
      type: "connection",
      fractionalIndex: "a0",
    };

    const input: ProjectSystemContextInput = {
      project: { id: "proj-ai-1", name: "AI App" },
      nodes: [webAppNode, webPageNode, serviceNode],
      edges: [edge],
      endpoints: [endpoint],
    };

    const aiContext = formatSystemContextForAi(input);

    // Should NOT contain markdown formatters
    expect(aiContext).not.toContain("**");
    expect(aiContext).not.toContain("`");
    expect(aiContext).not.toMatch(/^(\s*)#{1,6}\s+/m);
    expect(aiContext).not.toMatch(/^(\s*)[-*+]\s+/m);
    expect(aiContext).not.toMatch(/^\s*[-*_]{3,}\s*$/m);

    // Should include technical node IDs and link details
    expect(aiContext).toContain("[Node ID: node-webapp-1]");
    expect(aiContext).toContain("[Node ID: node-page-dash-1]");
    expect(aiContext).toContain("[Node ID: node-service-1]");
    expect(aiContext).toContain("[Endpoint ID: ep-users]");
    expect(aiContext).toContain("Edge ID: edge-page-to-svc");
    expect(aiContext).toContain("Invokes GET /users");
  });

  it("stripMarkdownFormatters correctly cleans bold, bullets, backticks, and headers", () => {
    const raw = `# System Architecture: Test (ID: 123)

## 1. Overview
- **Web Applications**: 2
- **Backend Services**: 1

---

### Service: \`auth-service\`
- **Endpoints**:
  - \`POST /login\`
    - Summary: User login
    - Pipeline:
      1. \`db_operation\`: Calls \`getUser\`
`;

    const cleaned = stripMarkdownFormatters(raw);

    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("`");
    expect(cleaned).not.toContain("#");
    expect(cleaned).not.toContain("---");
    expect(cleaned).not.toMatch(/^(\s*)[-*+]\s+/m);
    expect(cleaned).toContain("System Architecture: Test (ID: 123)");
    expect(cleaned).toContain("Web Applications: 2");
    expect(cleaned).toContain("Service: auth-service");
    expect(cleaned).toContain("POST /login");
    expect(cleaned).toContain("Calls getUser");
  });

  it("formatSystemContextAsToon encodes project architecture into compact TOON format", () => {
    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Auth Service",
        port: "3000",
      },
    };

    const dbNode: BackendNode = {
      id: "node-db",
      type: "database",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Primary DB",
        dbEngine: "postgres",
      },
    };

    const edge: BackendEdge = {
      id: "edge-1",
      source: "node-svc",
      target: "node-db",
      type: "database-connection",
      fractionalIndex: "a0",
    };

    const input: ProjectSystemContextInput = {
      project: { id: "p-toon", name: "Toon Project" },
      nodes: [serviceNode, dbNode],
      edges: [edge],
    };

    const toonOutput = formatSystemContextAsToon(input);

    // Verify TOON format characteristics
    expect(toonOutput).toContain("project:");
    expect(toonOutput).toContain("id: p-toon");
    expect(toonOutput).toContain("name: Toon Project");
    expect(toonOutput).toContain("nodes[2]");
    expect(toonOutput).toContain("edges[1]");
    expect(toonOutput).toContain("edge-1,node-svc,node-db,database-connection");
    // Verify TOON is significantly more token-compact than formatted JSON
    const jsonOutput = JSON.stringify(input, null, 2);
    expect(toonOutput.length).toBeLessThan(jsonOutput.length);
  });

  it("safely sanitizes live database passwords, Groq API keys, and JWT session tokens in TOON", () => {
    const dbWithSecret: BackendNode = {
      id: "node-db-secret",
      type: "database",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Prod DB",
        dbEngine: "postgres",
        connectionString: "postgresql://postgres:SuperSecretP@ssword123!@db.supabase.co:5432/postgres",
      },
    };

    const aiWithSecret: BackendNode = {
      id: "node-ai-secret",
      type: "llm",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Groq LLM",
        apiKey: "gsk_live_1234567890abcdef123456",
      },
    };

    const input: ProjectSystemContextInput = {
      project: { id: "p-sec", name: "Security Check" },
      nodes: [dbWithSecret, aiWithSecret],
      edges: [],
      testUsers: [
        {
          id: "usr-admin",
          name: "Admin User",
          createdAt: new Date().toISOString(),
          records: [],
          activeAuthToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature",
        },
      ],
    };

    const toonOutput = formatSystemContextAsToon(input);

    // Live secrets MUST NOT be present
    expect(toonOutput).not.toContain("SuperSecretP@ssword123!");
    expect(toonOutput).not.toContain("gsk_live_1234567890abcdef123456");
    expect(toonOutput).not.toContain("doNotLeakThisSignature");

    // Redacted placeholders MUST be present
    expect(toonOutput).toContain("***REDACTED***");
    expect(toonOutput).toContain("gsk_***REDACTED***");
    expect(toonOutput).toContain("[REDACTED_JWT_TOKEN]");
  });

  it("formats Section 6 (Client State Stores & Custom TypeScript Types) with field reducers, defaults, and type definitions", () => {
    const storeNode: BackendNode = {
      id: "node-app-store",
      type: "state_store",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "AppStore",
        storage: "memory",
        fields: [
          {
            id: "f-msg",
            name: "message",
            type: "string",
            defaultValue: "",
            reducer: "message_reducer",
          },
          {
            id: "f-nav",
            name: "navItems",
            type: "array",
            defaultValue: ["Dashboard", "Chat"],
          },
        ],
        actions: [
          {
            id: "act-append",
            name: "appendMessage",
            actionType: "setter" as any,
            targetFieldName: "message",
            defaultManipulatorType: "append",
          },
        ],
      },
    };

    const typesNode: BackendNode = {
      id: "node-custom-types",
      type: "types",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Conversations Types",
        scope: "global",
        types: [
          {
            id: "t-msg",
            name: "ConversationMessage",
            kind: "interface",
            fields: [
              { id: "f-id", name: "id", type: "string", required: true },
              { id: "f-content", name: "content", type: "string", required: true },
            ],
          },
          {
            id: "t-status",
            name: "MessageStatus",
            kind: "enum",
            enumValues: ["pending", "sent", "failed"],
          },
        ],
      },
    };

    const input: ProjectSystemContextInput = {
      project: { id: "p-types", name: "Types App" },
      nodes: [storeNode, typesNode],
      edges: [],
    };

    const result = formatSystemContext(input);

    expect(result).toContain("## 6. Client State Stores & Custom TypeScript Types");
    expect(result).toContain("State Store: `AppStore`");
    expect(result).toContain("- `message`: `string` [Default: \"\"] [Reducer: message_reducer]");
    expect(result).toContain("- `navItems`: `array` [Default: [\"Dashboard\",\"Chat\"]]");
    expect(result).toContain("Action `appendMessage` (append) -> updates `message`");
    expect(result).toContain("Custom Types: `Conversations Types` (Scope: `global`)");
    expect(result).toContain("interface `ConversationMessage`: { id: string; content: string }");
    expect(result).toContain("enum `MessageStatus`: pending | sent | failed");
  });

  it("formats frontend details including pathParams, SSE realtime connections, state mutations, and zone redirect mappings", () => {
    const webAppNode: BackendNode = {
      id: "node-app",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Portal",
        appSlug: "portal",
        zones: [
          {
            id: "z-protected",
            handleId: "h-protected",
            name: "Dashboard Zone",
            accessType: "protected",
            rule: {
              id: "r-1",
              scope: "zone",
              conditions: { kind: "leaf", condition: { type: "auth" } } as any,
              redirects: {
                default: "/login",
                "no-auth": "/login",
                "no-org": "/select-org",
                "wrong-plan": "/pricing",
                "wrong-role": "/unauthorized",
              },
            },
          },
        ],
      },
    };

    const chatPage: BackendNode = {
      id: "node-chat-page",
      type: "webPage",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/chat/[id]",
        appSlug: "portal",
        pathParams: [{ id: "p-id", name: "id", type: "string", required: true }],
        realtimeConnections: [
          {
            id: "rc-1",
            protocol: "SSE" as any,
            eventName: "chat_chunk",
            streamUrl: "/api/send-message/:id",
            sourceServiceNodeId: "node-chat-svc",
            storeActionBinding: {
              storeNodeId: "node-app-store",
              targetFieldName: "message",
            },
            isLangGraph: true,
            langGraphStreamModes: ["messages"],
          },
        ],
        sections: [
          {
            id: "sec-chat",
            name: "Chat Section",
            actions: [
              {
                id: "act-submit",
                name: "send message",
                event: "onSubmit",
                actionSteps: [
                  {
                    id: "step-mut",
                    order: 1,
                    type: "state_mutation",
                    name: "Append message",
                    stateKey: "message",
                    stateUpdateType: "append",
                    stateStoreNodeId: "node-app-store",
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-chat-svc",
      type: "service",
      position: { x: 200, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Chat Service",
        customDependencies: [{ name: "ws", version: "^8.18.0" }, { name: "@types/ws" }] as any,
      },
    };

    const endpoint: EndpointWithNode = {
      id: "ep-send-msg",
      nodeId: "node-chat-svc",
      name: "/send-message/:id",
      type: "POST",
      streamingConfig: {
        streamMode: "messages",
        enableSubgraphs: true,
        outputMode: "full_state",
      },
      pipelineSteps: [
        {
          id: "step-push",
          name: "Push SSE",
          type: "push_to_client",
          eventName: "chat_chunk",
          pushProtocol: "sse",
          ...({ pageRefNodeId: "node-chat-page" } as any),
        },
      ],
    } as any;

    const input: ProjectSystemContextInput = {
      project: { id: "p-chat", name: "Realtime Chat" },
      nodes: [webAppNode, chatPage, serviceNode],
      edges: [],
      endpoints: [endpoint],
    };

    const result = formatSystemContext(input);

    // Zone redirects map
    expect(result).toContain("no-auth -> `/login`");
    expect(result).toContain("no-org -> `/select-org`");
    expect(result).toContain("wrong-plan -> `/pricing`");
    expect(result).toContain("wrong-role -> `/unauthorized`");

    // Route path params
    expect(result).toContain("Path Parameters: id: string (required)");

    // Realtime connection & store update
    expect(result).toContain("Realtime Subscription (SSE from `Chat Service`, Event: `chat_chunk`, Stream: `/api/send-message/:id` [LangGraph Modes: messages]) -> Updates Store `node-app-store.message`");

    // Action step mutation
    expect(result).toContain("Mutates State: `message` (append) on `node-app-store`");

    // Service dependencies
    expect(result).toContain("- **Custom Dependencies**: `ws@^8.18.0`, `@types/ws`");

    // Endpoint streaming config & push step
    expect(result).toContain("Streaming Config: Protocol: `SSE`, Stream Mode: `messages`, Subgraphs: `on`, Output Mode: `full_state`");
    expect(result).toContain("`push_to_client`: Delivers to \"/chat/[id]\" (Protocol: `SSE`, Event: `chat_chunk`)");
  });
});
