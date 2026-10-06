import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { compileLangGraphNode } from "../compileLangGraphNode";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint, CompiledFile } from "@workspace/canvas/types";

describe("compileMonorepo: LangGraph Package Compilation & Service Integration", () => {
  it("compiles LangGraph node into packages/langgraph/<label> and wires it into consuming service", () => {
    const serviceNode: BackendNode = {
      id: "srv-chat",
      type: "service",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "ChatService",
        techStack: "express",
      },
    };

    const langGraphNode: BackendNode = {
      id: "agent-support",
      type: "langgraph",
      position: { x: 400, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "SupportAgent",
        stateChannels: [
          {
            key: "messages",
            type: "messages",
            reducer: "add_messages",
            defaultValue: [],
          },
        ],
      },
    };

    const endpoint: Endpoint & { nodeId: string } = {
      id: "ep-support-chat",
      nodeId: serviceNode.id,
      name: "/api/chat",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-invoke-agent",
          name: "SupportAgent",
          type: "langgraph_invoke",
          enabled: true,
          outputVariable: "agentResult",
          langGraphTargetNodeId: langGraphNode.id,
          langGraphStreamingEnabled: false,
          langGraphOutputMode: "full_state",
          langGraphStateMapping: {
            messages: "body.message",
          },
        },
        {
          id: "step-return-response",
          name: "Return Response",
          type: "return_response",
          enabled: true,
          statusCode: 200,
        },
      ],
    };

    const edge: BackendEdge = {
      id: "edge-ep-lg",
      source: serviceNode.id,
      target: langGraphNode.id,
      sourceHandle: `endpoint-out-${endpoint.id}`,
      targetHandle: "langgraph-in",
      type: "connection",
      fractionalIndex: "a0",
    };

    const result = compileMonorepo(
      [serviceNode, langGraphNode],
      [endpoint],
      [],
      [edge],
      [],
      "Test LangGraph Monorepo",
    );

    // 1. LangGraph package files MUST exist under packages/langgraph/SupportAgent/
    const lgPkgJson = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/SupportAgent/package.json",
    );
    expect(lgPkgJson).toBeDefined();
    const parsedLgPkg = JSON.parse(lgPkgJson!.content);
    expect(parsedLgPkg.name).toBe("@workspace/langgraph-supportagent");

    const lgGraphFile = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/SupportAgent/src/graph.ts",
    );
    expect(lgGraphFile).toBeDefined();

    const lgIndexFile = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/SupportAgent/src/index.ts",
    );
    expect(lgIndexFile).toBeDefined();
    expect(lgIndexFile!.content).toContain("export { supportAgentGraph } from \"./graph\";");

    // Must NOT generate a standalone server in apps/ for langgraph
    expect(result.files.some((f: CompiledFile) => f.filename.startsWith("apps/supportagent/"))).toBe(false);
    expect(result.files.some((f: CompiledFile) => f.filename.startsWith("apps/SupportAgent/"))).toBe(false);
    expect(result.files.some((f: CompiledFile) => f.filename.includes("packages/langgraph/SupportAgent/src/server.ts"))).toBe(false);

    // LangGraph package is a pure library — no express dependency and no start/dev scripts
    expect(parsedLgPkg.dependencies?.["express"]).toBeUndefined();
    expect(parsedLgPkg.scripts?.["start"]).toBeUndefined();
    expect(parsedLgPkg.scripts?.["dev"]).toBeUndefined();
    expect(parsedLgPkg.scripts?.["check-types"]).toBe("tsc --noEmit");

    // Docker Compose must NOT declare a service for SupportAgent
    const dockerCompose = result.files.find(
      (f: CompiledFile) => f.filename === "docker-compose.yml",
    );
    if (dockerCompose) {
      expect(dockerCompose.content).not.toContain("supportagent:");
      expect(dockerCompose.content).not.toContain("SupportAgent");
    }

    // 2. Consuming service package.json MUST depend on @workspace/langgraph-supportagent
    const srvPkgJson = result.files.find(
      (f: CompiledFile) => f.filename === "apps/chatservice/package.json",
    );
    expect(srvPkgJson).toBeDefined();
    const parsedSrvPkg = JSON.parse(srvPkgJson!.content);
    expect(parsedSrvPkg.dependencies["@workspace/langgraph-supportagent"]).toBe("workspace:*");

    // 3. Consuming service route handler MUST import the graph from the package
    const routeFile = result.files.find(
      (f: CompiledFile) => f.filename === "apps/chatservice/src/routes/postApiChat.ts",
    );
    expect(routeFile).toBeDefined();
    expect(routeFile!.content).toContain('from "@workspace/langgraph-supportagent";');

    // 4. pnpm-workspace.yaml MUST include packages/langgraph/*
    const pnpmWorkspace = result.files.find(
      (f: CompiledFile) => f.filename === "pnpm-workspace.yaml",
    );
    expect(pnpmWorkspace).toBeDefined();
    expect(pnpmWorkspace!.content).toContain('"packages/langgraph/*"');

    // 5. Root tsconfig.json MUST reference packages/langgraph/SupportAgent
    const rootTsconfig = result.files.find(
      (f: CompiledFile) => f.filename === "tsconfig.json",
    );
    expect(rootTsconfig).toBeDefined();
    expect(rootTsconfig!.content).toContain("packages/langgraph/SupportAgent");
  });

  it("imports pool from @workspace/db when LangGraph node has checkpointer: 'postgres'", () => {
    const dbNode: BackendNode = {
      id: "db-pg-1",
      type: "database",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "PrimaryDb",
        dbEngine: "postgres",
      },
    };

    const entityNode: BackendNode = {
      id: "ent-users",
      type: "entity",
      position: { x: 100, y: 300 },
      fractionalIndex: "a1",
      data: {
        label: "users",
        databaseId: dbNode.id,
        columns: [{ name: "id", type: "string", isPrimaryKey: true }],
      },
    };

    const langGraphNode: BackendNode = {
      id: "agent-pg",
      type: "langgraph",
      position: { x: 400, y: 100 },
      fractionalIndex: "a2",
      data: {
        label: "PgAgent",
        memoryConfig: {
          enabled: true,
          checkpointer: "postgres",
          checkpointerNodeId: dbNode.id,
        },
        stateChannels: [
          { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
        ],
      },
    };

    const result = compileMonorepo(
      [dbNode, entityNode, langGraphNode],
      [],
      [],
      [],
      [],
      "Test Pg Checkpointer Monorepo",
    );

    // 1. packages/langgraph/PgAgent/package.json MUST depend on the database workspace package
    const lgPkgJson = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/PgAgent/package.json",
    );
    expect(lgPkgJson).toBeDefined();
    const parsedPkg = JSON.parse(lgPkgJson!.content);
    expect(parsedPkg.dependencies["@workspace/db"]).toBe("workspace:*");
    expect(parsedPkg.dependencies["@langchain/langgraph-checkpoint-postgres"]).toBeDefined();

    // 2. packages/langgraph/PgAgent/src/graph.ts MUST import pool from the database package
    const lgGraphFile = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/PgAgent/src/graph.ts",
    );
    expect(lgGraphFile).toBeDefined();
    expect(lgGraphFile!.content).toContain('import { pool } from "@workspace/db";');
    expect(lgGraphFile!.content).toContain("const checkpointer = new PostgresSaver(pool);");
    expect(lgGraphFile!.content).toContain("await checkpointer.setup();");
  });

  it("imports REDIS_CONFIG from @workspace/redis when LangGraph node has checkpointer: 'redis'", () => {
    const redisNode: BackendNode = {
      id: "redis-1",
      type: "redis_instance",
      position: { x: 100, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "RedisCache",
        host: "localhost",
        port: 6379,
      },
    };

    const langGraphNode: BackendNode = {
      id: "agent-redis",
      type: "langgraph",
      position: { x: 400, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "RedisAgent",
        memoryConfig: {
          enabled: true,
          checkpointer: "redis",
          checkpointerNodeId: redisNode.id,
        },
        stateChannels: [
          { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
        ],
      },
    };

    const result = compileMonorepo(
      [redisNode, langGraphNode],
      [],
      [],
      [],
      [],
      "Test Redis Checkpointer Monorepo",
    );

    // 1. packages/langgraph/RedisAgent/package.json MUST depend on the redis workspace package
    const lgPkgJson = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/RedisAgent/package.json",
    );
    expect(lgPkgJson).toBeDefined();
    const parsedPkg = JSON.parse(lgPkgJson!.content);
    expect(parsedPkg.dependencies["@workspace/rediscache"]).toBe("workspace:*");
    expect(parsedPkg.dependencies["@langchain/langgraph-checkpoint-redis"]).toBeDefined();

    // 2. packages/langgraph/RedisAgent/src/graph.ts MUST import REDIS_CONFIG and use RedisSaver.fromUrl
    const lgGraphFile = result.files.find(
      (f: CompiledFile) => f.filename === "packages/langgraph/RedisAgent/src/graph.ts",
    );
    expect(lgGraphFile).toBeDefined();
    expect(lgGraphFile!.content).toContain('import { REDIS_CONFIG } from "@workspace/rediscache";');
    expect(lgGraphFile!.content).toContain("const checkpointer = await RedisSaver.fromUrl(redisUrl);");
  });

  it("compileLangGraphNode with outputMode: 'package' suppresses routes and express even with connected edges", () => {
    const langGraphNode: BackendNode = {
      id: "agent-1",
      type: "langgraph",
      fractionalIndex: "a1",
      position: { x: 0, y: 0 },
      data: {
        label: "LibraryAgent",
        stateChannels: [
          { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
        ],
      },
    };

    const edge: BackendEdge = {
      id: "edge-test",
      source: "service-1",
      target: "agent-1",
      sourceHandle: "endpoint-out-ep-1",
      targetHandle: "langgraph-in",
      type: "connection",
      fractionalIndex: "a0",
    };

    const result = compileLangGraphNode(langGraphNode, {
      edges: [edge],
      nodes: [
        {
          id: "service-1",
          type: "service",
          fractionalIndex: "a0",
          position: { x: 0, y: 0 },
          data: { label: "HostService" },
        },
      ],
      endpoints: [
        {
          id: "ep-1",
          name: "/api/chat",
          type: "POST",
          pipelineSteps: [],
        },
      ],
      outputMode: "package",
      packageName: "@workspace/langgraph-libraryagent",
    });

    // Must not generate server.ts or express.d.ts
    expect(result.files.some((f) => f.filename === "src/server.ts")).toBe(false);
    expect(result.files.some((f) => f.filename === "src/express.d.ts")).toBe(false);

    // Package.json must not have express dependency or start/dev scripts
    const pkgJson = result.files.find((f) => f.filename === "package.json");
    expect(pkgJson).toBeDefined();
    const parsed = JSON.parse(pkgJson!.content);
    expect(parsed.dependencies?.["express"]).toBeUndefined();
    expect(parsed.scripts?.["start"]).toBeUndefined();
    expect(parsed.scripts?.["dev"]).toBeUndefined();
    expect(parsed.scripts?.["check-types"]).toBe("tsc --noEmit");
    expect(parsed.name).toBe("@workspace/langgraph-libraryagent");
  });
});
