import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge, EndpointLike } from "@/types/canvas";
import {
  getDetectedPackageEnvVars,
  collectEnvSections,
  generateEnvFilesForNode,
  renderEnvFile,
  renderEnvExampleFile,
} from "../generators/generateEnvFile";

describe("LangGraph Environment Variable Compiler & Detection", () => {
  const serviceNode: BackendNode = {
    id: "service-profile",
    type: "service",
    position: { x: 0, y: 0 },
    fractionalIndex: "a0",
    data: {
      label: "ProfileService",
      port: 8080,
      envVars: [],
    },
  };

  const langGraphAgentNode: BackendNode = {
    id: "agent-chat",
    type: "langgraph",
    position: { x: 300, y: 0 },
    fractionalIndex: "a1",
    data: {
      label: "ChatAgent",
      customLlmNodes: [
        {
          id: "llm-groq",
          label: "Groq LLM",
          provider: "groq",
          model: "openai/gpt-oss-120b",
          apiKeyHeader: "Bearer gsk_live_secret_key_99999",
        },
      ],
      memoryConfig: {
        enabled: true,
        checkpointer: "postgres",
        checkpointerEnvVar: "LANGGRAPH_CHECKPOINTER_URL",
        connectionString: "postgresql://postgres:pass@localhost:5432/checkpointer",
      },
    },
  };

  const directEdge: BackendEdge = {
    id: "edge-service-to-agent",
    source: serviceNode.id,
    target: langGraphAgentNode.id,
    type: "connection",
    fractionalIndex: "a0",
  };

  it("detects LangGraph LLM and checkpointer environment variables via direct edge", () => {
    const detected = getDetectedPackageEnvVars(
      serviceNode,
      [serviceNode, langGraphAgentNode],
      [directEdge],
    );

    const groqVar = detected.find((d) => d.name === "GROQ_API_KEY");
    expect(groqVar).toBeDefined();
    expect(groqVar?.exampleValue).toBe("gsk_live_secret_key_99999");
    expect(groqVar?.sourceNodeType).toBe("langgraph");
    expect(groqVar?.sourceNodeLabel).toBe("ChatAgent");

    const checkpointerVar = detected.find((d) => d.name === "LANGGRAPH_CHECKPOINTER_URL");
    expect(checkpointerVar).toBeDefined();
    expect(checkpointerVar?.exampleValue).toBe("postgresql://postgres:pass@localhost:5432/checkpointer");
  });

  it("detects LangGraph environment variables via endpoint langgraph_invoke pipeline step without direct edge", () => {
    const endpoint: EndpointLike = {
      id: "ep-chat",
      nodeId: serviceNode.id,
      pipelineSteps: [
        {
          id: "step-1",
          type: "langgraph_invoke",
          name: "ChatAgent",
          langGraphTargetNodeId: langGraphAgentNode.id,
          enabled: true,
        },
      ],
    };

    const detected = getDetectedPackageEnvVars(
      serviceNode,
      [serviceNode, langGraphAgentNode],
      [],
      undefined,
      [endpoint],
    );

    const groqVar = detected.find((d) => d.name === "GROQ_API_KEY");
    expect(groqVar).toBeDefined();
    expect(groqVar?.exampleValue).toBe("gsk_live_secret_key_99999");
  });

  it("automatically compiles detected LangGraph variables into service .env and masks secrets in .env.example", () => {
    const { env, envExample } = generateEnvFilesForNode(
      serviceNode,
      [serviceNode, langGraphAgentNode],
      [directEdge],
    );

    // .env contains PORT, NODE_ENV, and the real secret key
    expect(env).toContain("PORT=8080");
    expect(env).toContain("NODE_ENV=development");
    expect(env).toContain("GROQ_API_KEY=gsk_live_secret_key_99999");
    expect(env).toContain("LANGGRAPH_CHECKPOINTER_URL=postgresql://postgres:pass@localhost:5432/checkpointer");
    expect(env).toContain("LangGraph Agent (LLM & Tools) — from package node: \"ChatAgent\"");

    // .env.example must NEVER leak the secret key, and instead provide a safe placeholder
    expect(envExample).not.toContain("gsk_live_secret_key_99999");
    expect(envExample).toContain("GROQ_API_KEY=<your_groq_api_key_here>");
  });

  it("preserves explicitly imported env vars from service.data.envVars", () => {
    const serviceWithImportedVars: BackendNode = {
      ...serviceNode,
      data: {
        ...serviceNode.data,
        envVars: [
          {
            id: "var-1",
            name: "GROQ_API_KEY",
            description: "Custom user-supplied description",
          },
        ],
      },
    };

    const sections = collectEnvSections(
      serviceWithImportedVars,
      [serviceWithImportedVars, langGraphAgentNode],
      [directEdge],
    );

    const env = renderEnvFile(sections);
    expect(env).toContain("GROQ_API_KEY=gsk_live_secret_key_99999");
    expect(env).toContain("# Custom user-supplied description");
  });
});
