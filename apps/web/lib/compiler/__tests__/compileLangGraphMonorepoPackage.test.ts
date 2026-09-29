import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
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
          responseStatusCode: 200,
          responsePayload: "agentResult",
        },
      ],
    };

    const edge: BackendEdge = {
      id: "edge-ep-lg",
      source: serviceNode.id,
      target: langGraphNode.id,
      sourceHandle: `endpoint-out-${endpoint.id}`,
      targetHandle: "langgraph-in",
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
    expect(lgIndexFile!.content).toContain("export { supportAgentGraph } from \"./graph.js\";");

    // Must NOT generate a standalone server in apps/ for langgraph
    expect(result.files.some((f: CompiledFile) => f.filename.startsWith("apps/supportagent/"))).toBe(false);
    expect(result.files.some((f: CompiledFile) => f.filename.startsWith("apps/SupportAgent/"))).toBe(false);
    expect(result.files.some((f: CompiledFile) => f.filename.includes("packages/langgraph/SupportAgent/src/server.ts"))).toBe(false);

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
});
