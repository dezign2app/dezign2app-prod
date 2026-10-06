import { describe, it, expect } from "vitest";
import { compileLangGraph } from "../langgraph/typescript/v1";
import type { CompileLangGraphInput } from "../langgraph/typescript/v1/types";
import {
  LANGGRAPH_CANVAS_NODE_TOOL,
  LANGGRAPH_CANVAS_NODE_LLM,
  LANGGRAPH_CANVAS_NODE_NODE,
  HANDLE_LLM_IN,
  HANDLE_TOOL_IN,
  NODE_ID_START,
} from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/constants";

describe("compileLangGraph Compiler Fixes", () => {
  it("compiles graph canvas state into valid TypeScript npm project without any, unknown, or as assertions", () => {
    const input: CompileLangGraphInput = {
      graphLabel: "chat",
      stateChannels: [
        {
          key: "messages",
          type: "messages",
          reducer: "add_messages",
          defaultValue: [],
        },
        {
          key: "currentMessage",
          type: "string",
          reducer: "replace",
          defaultValue: "",
        },
      ],
      inputChannels: [],
      nodes: [
        {
          id: "tool_1",
          type: LANGGRAPH_CANVAS_NODE_TOOL,
          position: { x: 100, y: 100 },
          data: {
            label: "my_tool",
            toolId: "tool_1",
            name: "my_tool",
            description: "Description of the tool",
            inputSchema: "{}",
            source: "inline",
          },
        },
        // Duplicate tool node with same name to test deduplication
        {
          id: "tool_2",
          type: LANGGRAPH_CANVAS_NODE_TOOL,
          position: { x: 100, y: 200 },
          data: {
            label: "my_tool",
            toolId: "tool_2",
            name: "my_tool",
            description: "Description of the tool",
            inputSchema: "{}",
            source: "inline",
          },
        },
        {
          id: "llm_1",
          type: LANGGRAPH_CANVAS_NODE_LLM,
          position: { x: 300, y: 100 },
          data: {
            label: "llmConfig",
            llmId: "llm_1",
            provider: "groq",
            model: "openai/gpt-oss-120b",
            temperature: 0.2,
          },
        },
        {
          id: "node_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 500, y: 100 },
          data: {
            name: "node",
            label: "node",
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "llm_1",
          target: "node_1",
          targetHandle: HANDLE_LLM_IN,
        },
        {
          id: "e2",
          source: "tool_1",
          target: "node_1",
          targetHandle: HANDLE_TOOL_IN,
        },
        {
          id: "e3",
          source: "tool_2",
          target: "node_1",
          targetHandle: HANDLE_TOOL_IN,
        },
        {
          id: "e4",
          source: NODE_ID_START,
          target: "node_1",
        },
      ],
      routeEndpoints: [
        {
          kind: "endpoint",
          path: "/simple-chat",
          method: "POST",
          sourceNodeLabel: "profile",
        },
      ],
    };

    const files = compileLangGraph(input);
    const fileMap = new Map(files.map((f) => [f.filename, f.content]));

    // 1. Verify state.ts uses Annotation.Root and no Zod StateSchema errors
    const stateFile = fileMap.get("src/state.ts");
    expect(stateFile).toBeDefined();
    expect(stateFile).toContain("Annotation.Root({");
    expect(stateFile).toContain("...MessagesAnnotation.spec,");
    expect(stateFile).toContain("currentMessage: Annotation<string>()");
    expect(stateFile).toContain("ChatStateType");
    expect(stateFile).toContain("ChatStateUpdateType");
    expect(stateFile).not.toContain("StateSchema");
    expect(stateFile).not.toContain("as any");
    expect(stateFile).not.toContain("as unknown");

    // 2. Verify tools.ts deduplicates tool declarations
    const toolsFile = fileMap.get("src/tools.ts");
    expect(toolsFile).toBeDefined();
    const myToolMatches = toolsFile!.match(/export const myTool\b/g);
    expect(myToolMatches?.length).toBe(1);
    expect(toolsFile).toContain("export const myTool2 = tool(");
    expect(toolsFile).not.toContain("z.any()");
    expect(toolsFile).not.toContain("as any");

    // 3. Verify graph.ts uses standard TS imports
    const graphFile = fileMap.get("src/graph.ts");
    expect(graphFile).toBeDefined();
    expect(graphFile).toContain('import { ChatState } from "./state";');
    expect(graphFile).toContain('import { node } from "./nodes";');

    // 4. Verify llm/llmConfig.ts uses standard TS imports
    const llmFile = fileMap.get("src/llm/llmConfig.ts");
    expect(llmFile).toBeDefined();
    expect(llmFile).toContain('from "../tools";');

    // 5. Verify llm/index.ts uses standard TS imports
    const llmIndexFile = fileMap.get("src/llm/index.ts");
    expect(llmIndexFile).toBeDefined();
    expect(llmIndexFile).toContain('export * from "./llmConfig";');

    // 6. Verify nodes/node.ts uses standard TS imports
    const nodeFile = fileMap.get("src/nodes/node.ts");
    expect(nodeFile).toBeDefined();
    expect(nodeFile).toContain('from "../state";');
    expect(nodeFile).toContain('from "../llm/llmConfig";');

    // 7. Verify nodes/index.ts uses standard TS imports
    const nodesIndexFile = fileMap.get("src/nodes/index.ts");
    expect(nodesIndexFile).toBeDefined();
    expect(nodesIndexFile).toContain('export * from "./node";');

    // 8. Verify index.ts uses standard TS imports
    const indexFile = fileMap.get("src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile).toContain('from "./graph";');

    // 9. Verify server.ts uses standard TS imports and strongly typed express handlers
    const serverFile = fileMap.get("src/server.ts");
    expect(serverFile).toBeDefined();
    expect(serverFile).toContain('import express, { type Request, type Response } from "express";');
    expect(serverFile).toContain('import { chatGraph } from "./graph";');
    expect(serverFile).toContain('import type { ChatStateUpdateType } from "./state";');
    expect(serverFile).toContain("(_req: Request, res: Response)");
    expect(serverFile).toContain("(req: Request, res: Response)");
    expect(serverFile).not.toContain("(_req, res)");
    expect(serverFile).not.toContain("(req, res)");
    expect(serverFile).not.toContain("as any");
    expect(serverFile).not.toContain("as unknown");

    // 10. Verify express.d.ts is generated
    const expressDts = fileMap.get("src/express.d.ts");
    expect(expressDts).toBeDefined();
    expect(expressDts).toContain('declare module "express"');
    expect(expressDts).not.toContain("any");
    expect(expressDts).not.toContain("unknown");

    // 11. Verify package.json contains @types/express in devDependencies
    const pkgJson = JSON.parse(fileMap.get("package.json") || "{}");
    expect(pkgJson.devDependencies["@types/express"]).toBeDefined();

    // 12. Verify tsconfig.json includes DOM and node types
    const tsconfig = JSON.parse(fileMap.get("tsconfig.json") || "{}");
    expect(tsconfig.compilerOptions.lib).toContain("DOM");
    expect(tsconfig.compilerOptions.types).toContain("node");
  });

  it("outputMode: package emits a reusable @workspace package structure", () => {
    const input: CompileLangGraphInput = {
      graphLabel: "chat",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages" },
      ],
      inputChannels: [],
      nodes: [
        {
          id: "node_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 0, y: 0 },
          data: { name: "chatNode", label: "chatNode" },
        },
      ],
      edges: [
        {
          id: "e1",
          source: NODE_ID_START,
          target: "node_1",
        },
      ],
      outputMode: "package",
    };

    const files = compileLangGraph(input);
    const fileMap = new Map(files.map((f) => [f.filename, f.content]));

    // package.json should use @workspace/ scope and have "exports" field
    const pkgJson = JSON.parse(fileMap.get("package.json") || "{}");
    expect(pkgJson.name).toBe("@workspace/chat");
    expect(pkgJson.exports).toBeDefined();
    expect(pkgJson.exports["."]).toBeDefined();
    // langgraph should be in peerDependencies, not dependencies
    expect(pkgJson.peerDependencies?.["@langchain/langgraph"]).toBeDefined();
    expect(pkgJson.dependencies?.["@langchain/langgraph"]).toBeUndefined();

    // tsconfig should emit declaration files
    const tsconfig = JSON.parse(fileMap.get("tsconfig.json") || "{}");
    expect(tsconfig.compilerOptions.declaration).toBe(true);
    // package mode doesn't need DOM lib
    expect(tsconfig.compilerOptions.lib).not.toContain("DOM");

    // src/index.ts should be a lib entry (re-exports), not a runnable script
    const indexFile = fileMap.get("src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile).toContain("export {");
    expect(indexFile).toContain("export type {");
    expect(indexFile).not.toContain("async function main");
    expect(indexFile).not.toContain("main().catch");

    // server.ts should NOT be generated in package mode (no HTTP layer)
    expect(fileMap.has("src/server.ts")).toBe(false);
    expect(fileMap.has("src/express.d.ts")).toBe(false);
  });

  it("compiles graph with PostgresSaver checkpointer", () => {
    const input: CompileLangGraphInput = {
      graphLabel: "postgres-agent",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages" },
      ],
      inputChannels: [],
      memoryConfig: {
        checkpointer: "postgres",
        checkpointerNodeId: "db_node_1",
        checkpointerEnvVar: "CUSTOM_POSTGRES_URL",
      },
      nodes: [
        {
          id: "node_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 0, y: 0 },
          data: { name: "responder", label: "responder" },
        },
      ],
      edges: [
        {
          id: "e1",
          source: NODE_ID_START,
          target: "node_1",
        },
      ],
    };

    const files = compileLangGraph(input);
    const fileMap = new Map(files.map((f) => [f.filename, f.content]));

    // graph.ts should import and configure PostgresSaver with void checkpointer.setup()
    const graphFile = fileMap.get("src/graph.ts");
    expect(graphFile).toBeDefined();
    expect(graphFile).toContain(`import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";`);
    expect(graphFile).toContain(`process.env.CUSTOM_POSTGRES_URL`);
    expect(graphFile).toContain(`void checkpointer.setup();`);
    expect(graphFile).toContain(`.compile({ checkpointer })`);

    // package.json should include postgres checkpointer and pg dependencies
    const pkgJson = JSON.parse(fileMap.get("package.json") || "{}");
    expect(pkgJson.dependencies["@langchain/langgraph-checkpoint-postgres"]).toBeDefined();
    expect(pkgJson.dependencies["pg"]).toBeDefined();

    // .env.example should contain the connection string var
    const envFile = fileMap.get(".env.example");
    expect(envFile).toContain("CUSTOM_POSTGRES_URL=postgresql://");
  });

  it("compiles graph with RedisSaver checkpointer", () => {
    const input: CompileLangGraphInput = {
      graphLabel: "redis-agent",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages" },
      ],
      inputChannels: [],
      memoryConfig: {
        checkpointer: "redis",
        checkpointerNodeId: "redis_node_1",
        checkpointerEnvVar: "CUSTOM_REDIS_URL",
      },
      nodes: [
        {
          id: "node_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 0, y: 0 },
          data: { name: "responder", label: "responder" },
        },
      ],
      edges: [
        {
          id: "e1",
          source: NODE_ID_START,
          target: "node_1",
        },
      ],
    };

    const files = compileLangGraph(input);
    const fileMap = new Map(files.map((f) => [f.filename, f.content]));

    const graphFile = fileMap.get("src/graph.ts");
    expect(graphFile).toBeDefined();
    expect(graphFile).toContain(`import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";`);
    expect(graphFile).toContain(`process.env.CUSTOM_REDIS_URL`);
    expect(graphFile).toContain(`.compile({ checkpointer })`);

    const pkgJson = JSON.parse(fileMap.get("package.json") || "{}");
    expect(pkgJson.dependencies["@langchain/langgraph-checkpoint-redis"]).toBeDefined();
    expect(pkgJson.dependencies["redis"]).toBeDefined();

    const envFile = fileMap.get(".env.example");
    expect(envFile).toContain("CUSTOM_REDIS_URL=redis://");
  });

  it("compiles server.ts with auto thread_id resolution, response thread_id, and history endpoint when memory is configured", () => {
    const input: CompileLangGraphInput = {
      graphLabel: "memory-chat-agent",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages" },
      ],
      inputChannels: [],
      memoryConfig: {
        checkpointer: "memory",
      },
      routeEndpoints: [
        {
          path: "/chat",
          method: "POST",
          kind: "endpoint",
          responseExecutionMode: "sync",
        },
      ],
      nodes: [
        {
          id: "node_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 0, y: 0 },
          data: { name: "bot", label: "bot" },
        },
      ],
      edges: [
        {
          id: "e1",
          source: NODE_ID_START,
          target: "node_1",
        },
      ],
    };

    const files = compileLangGraph(input);
    const fileMap = new Map(files.map((f) => [f.filename, f.content]));

    const serverFile = fileMap.get("src/server.ts");
    expect(serverFile).toBeDefined();
    expect(serverFile).toContain(`import crypto from "node:crypto";`);
    expect(serverFile).toContain(`crypto.randomUUID()`);
    expect(serverFile).toContain(`thread_id: threadId`);
    expect(serverFile).toContain(`/api/threads/:threadId/history`);
  });

  it("compiles developer-defined custom reducer code directly into field Annotation in state.ts", () => {
    const input: CompileLangGraphInput = {
      graphLabel: "custom-reducer-agent",
      stateChannels: [
        {
          key: "highScore",
          type: "number",
          reducer: "custom",
          customReducerCode: "(prev, next) => Math.max(prev ?? 0, next ?? 0)",
          defaultValue: 0,
        },
      ],
      inputChannels: [],
      nodes: [
        {
          id: "node_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 0, y: 0 },
          data: { name: "scorer", label: "scorer" },
        },
      ],
      edges: [
        {
          id: "e1",
          source: NODE_ID_START,
          target: "node_1",
        },
      ],
    };

    const files = compileLangGraph(input);
    const fileMap = new Map(files.map((f) => [f.filename, f.content]));

    const stateFile = fileMap.get("src/state.ts");
    expect(stateFile).toBeDefined();
    expect(stateFile).toContain(`highScore: Annotation<number>({`);
    expect(stateFile).toContain(`reducer: (prev, next) => Math.max(prev ?? 0, next ?? 0)`);
  });
});
