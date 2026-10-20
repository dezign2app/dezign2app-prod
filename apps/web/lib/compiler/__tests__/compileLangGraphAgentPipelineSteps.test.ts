import { describe, it, expect } from "vitest";
import { compileLangGraph } from "../langgraph/typescript/v1";
import type { CompileLangGraphInput } from "../langgraph/typescript/v1/types";
import {
  LANGGRAPH_CANVAS_NODE_NODE,
  LANGGRAPH_CANVAS_NODE_LLM,
  HANDLE_LLM_IN,
  NODE_ID_START,
  NODE_ID_END,
} from "@/app/(canvas)/project/[projectId]/_components/backend-nodes/graph-nodes/langgraph/langgraph-canvas/constants";
import type { LangGraphNodePipelineStep } from "@workspace/canvas";

describe("compileLangGraph Agent Pipeline Steps", () => {
  it("compiles kafka_publish step inside an agent node and emits client helper & kafkajs dependency", () => {
    const kafkaStep: LangGraphNodePipelineStep = {
      id: "kafka_step_1",
      name: "Notify Broker",
      type: "kafka_publish",
      label: "Notify Broker",
      outputVariable: "kafkaResult",
      inputBindings: [
        {
          argName: "topic",
          source: { kind: "inline", value: "user-signups" },
        },
        {
          argName: "key",
          source: { kind: "state", field: "userId" },
        },
        {
          argName: "payload",
          source: { kind: "state", field: "messages" },
        },
      ],
    };

    const input: CompileLangGraphInput = {
      graphLabel: "agent-pipeline",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
        { key: "userId", type: "string", reducer: "replace", defaultValue: "u123" },
      ],
      inputChannels: [],
      nodes: [
        {
          id: "agent_1",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 200, y: 100 },
          data: {
            label: "Processor",
            name: "processor",
            pipelineSteps: [kafkaStep],
          },
        },
      ],
      edges: [
        { id: "e1", source: NODE_ID_START, target: "agent_1" },
        { id: "e2", source: "agent_1", target: NODE_ID_END },
      ],
    };

    const files = compileLangGraph(input);

    // 1. Verify agent node file contains Kafka call
    const agentFile = files.find((f) => f.filename === "src/nodes/processor.ts");
    expect(agentFile).toBeDefined();
    expect(agentFile!.content).toContain("import { publishKafkaEvent } from \"../lib/kafka\";");
    expect(agentFile!.content).toContain("await publishKafkaEvent(\"user-signups\", state.messages, state.userId);");

    // 2. Verify src/lib/kafka.ts helper is emitted
    const kafkaHelper = files.find((f) => f.filename === "src/lib/kafka.ts");
    expect(kafkaHelper).toBeDefined();
    expect(kafkaHelper!.content).toContain("export async function publishKafkaEvent");

    // 3. Verify package.json contains kafkajs
    const packageJsonFile = files.find((f) => f.filename === "package.json");
    expect(packageJsonFile).toBeDefined();
    const pkg = JSON.parse(packageJsonFile!.content);
    expect(pkg.dependencies.kafkajs).toBeDefined();
  });

  it("compiles multi-step pipeline (DB operation -> Transformer -> LLM call -> Kafka publish)", () => {
    const pipelineSteps: LangGraphNodePipelineStep[] = [
      {
        id: "step_db",
        name: "Fetch User",
        type: "db_operation",
        label: "Fetch User",
        outputVariable: "userRow",
        tableNodeId: "users",
        operationId: "findUnique",
        inputBindings: [
          { argName: "id", source: { kind: "state", field: "userId" } },
        ],
      },
      {
        id: "step_trans",
        name: "Prepare Prompt Data",
        type: "transformer",
        label: "Prepare Prompt Data",
        outputVariable: "promptContext",
        customCode: "return { userGreeting: `Hello ${inputs.name}` };",
        inputBindings: [
          { argName: "name", source: { kind: "step_output", stepId: "step_db", field: "name" } },
        ],
      },
      {
        id: "step_llm",
        name: "LLM Agent",
        type: "llm_call",
        label: "LLM Agent",
        outputVariable: "agentReply",
      },
      {
        id: "step_kafka",
        name: "Publish Audit Log",
        type: "kafka_publish",
        label: "Publish Audit Log",
        outputVariable: "auditLog",
        inputBindings: [
          { argName: "topic", source: { kind: "inline", value: "audit-trail" } },
          { argName: "response", source: { kind: "step_output", stepId: "step_llm" } },
        ],
      },
    ];

    const input: CompileLangGraphInput = {
      graphLabel: "multi-agent",
      stateChannels: [
        { key: "messages", type: "messages", reducer: "add_messages", defaultValue: [] },
        { key: "userId", type: "string", reducer: "replace", defaultValue: "u1" },
      ],
      inputChannels: [],
      nodes: [
        {
          id: "llm_1",
          type: LANGGRAPH_CANVAS_NODE_LLM,
          position: { x: 50, y: 50 },
          data: {
            label: "OpenAI GPT-4o",
            llmId: "llm_1",
            provider: "openai",
            model: "gpt-4o",
          },
        },
        {
          id: "agent_main",
          type: LANGGRAPH_CANVAS_NODE_NODE,
          position: { x: 200, y: 100 },
          data: {
            label: "WorkflowAgent",
            name: "workflowAgent",
            systemPrompt: "You are a helpful assistant.",
            pipelineSteps,
          },
        },
      ],
      edges: [
        { id: "e_llm", source: "llm_1", target: "agent_main", targetHandle: HANDLE_LLM_IN },
        { id: "e_start", source: NODE_ID_START, target: "agent_main" },
        { id: "e_end", source: "agent_main", target: NODE_ID_END },
      ],
    };

    const files = compileLangGraph(input);

    const agentFile = files.find((f) => f.filename === "src/nodes/workflowAgent.ts");
    expect(agentFile).toBeDefined();

    // Verify all steps are emitted in sequence
    expect(agentFile!.content).toContain("const userRow = await db.users.findUnique");
    expect(agentFile!.content).toContain("const promptContext = await (async () =>");
    expect(agentFile!.content).toContain("const agentReply = await openAiGpt4o.invoke(messages);");
    expect(agentFile!.content).toContain("const auditLog = await publishKafkaEvent(\"audit-trail\"");

    // Verify return object includes messages from the LLM step
    expect(agentFile!.content).toContain("messages: [agentReply],");

    // Verify helpers & package.json
    expect(files.some((f) => f.filename === "src/lib/kafka.ts")).toBe(true);
    expect(files.some((f) => f.filename === "src/lib/db.ts")).toBe(true);
    const pkg = JSON.parse(files.find((f) => f.filename === "package.json")!.content);
    expect(pkg.dependencies.kafkajs).toBeDefined();
    expect(pkg.dependencies.pg).toBeDefined();
  });
});
