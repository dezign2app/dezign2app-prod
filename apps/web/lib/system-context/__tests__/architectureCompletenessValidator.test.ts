import { describe, it, expect } from "vitest";
import {
  validateArchitectureCompleteness,
  formatArchitectureDiagnostic,
} from "../architectureCompletenessValidator";
import type { BackendNode, BackendEdge } from "@/types/canvas";
import type { EndpointWithNode } from "@workspace/canvas/types";
import type { ProjectSystemContextInput } from "../formatSystemContext";

describe("architectureCompletenessValidator", () => {
  it("passes with 100/100 score on a fully wired, production-ready architecture", () => {
    const webApp: BackendNode = {
      id: "node-webapp",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        zones: [
          {
            id: "z-public",
            handleId: "h-pub",
            name: "Public",
            accessType: "public",
            rule: {
              id: "r-pub",
              scope: "zone",
              conditions: { kind: "leaf", condition: { type: "auth" } } as any,
              redirects: {
                default: "/login",
              },
            } as any,
          },
        ],
      },
    };

    const loginPage: BackendNode = {
      id: "node-login",
      type: "webPage",
      position: { x: 0, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "/login",
      },
    };

    const chatPage: BackendNode = {
      id: "node-chat",
      type: "webPage",
      position: { x: 100, y: 100 },
      fractionalIndex: "a2",
      data: {
        label: "/chat/[id]",
        sections: [
          {
            id: "s-chat",
            name: "Chat Section",
            actions: [
              {
                id: "act-load",
                name: "Load History",
                event: "pageLoad",
                actionSteps: [
                  {
                    id: "step-fetch",
                    order: 1,
                    type: "api_call",
                    name: "GET /conversations/:id",
                  } as any,
                ],
              },
              {
                id: "act-send",
                name: "Send Message",
                event: "onSubmit",
                actionSteps: [
                  {
                    id: "step-api",
                    order: 1,
                    type: "api_call",
                    name: "POST /send-message/:id",
                  } as any,
                  {
                    id: "step-state",
                    order: 2,
                    type: "state_mutation",
                    source: { kind: "req_body", field: "message" },
                    value: "dynamic_val",
                  } as any,
                ],
              },
            ],
          },
        ],
        realtimeConnections: [
          {
            id: "rc-1",
            protocol: "SSE" as any,
            isLangGraph: true,
            storeActionBinding: {
              storeNodeId: "store-app",
              targetStoreId: "store-app",
              targetFieldName: "message",
            } as any,
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 200, y: 0 },
      fractionalIndex: "a3",
      data: {
        label: "Conversations Service",
        enableWebSocket: false,
        customDependencies: [],
      },
    };

    const endpoint: EndpointWithNode = {
      id: "ep-send",
      nodeId: "node-svc",
      name: "/send-message/:id",
      type: "POST",
      isStreaming: true,
      requireAuth: true,
      pathParams: [{ id: "p-id", name: "id", type: "string", required: true }] as any,
      requestBody: {
        fields: [{ id: "f-msg", name: "message", type: "string", required: true }] as any,
      },
      pipelineSteps: [
        {
          id: "step-auth-guard",
          type: "condition",
          name: "verify_conversation_ownership",
        },
        {
          id: "step-lg",
          type: "langgraph_invoke",
          name: "invoke_chat_agent",
        },
      ],
    } as any;

    const lgNode: BackendNode = {
      id: "node-lg",
      type: "langgraph",
      position: { x: 300, y: 0 },
      fractionalIndex: "a4",
      data: {
        label: "Chat Agent",
        memoryConfig: {
          checkpointer: "postgres",
        },
      },
    };

    const checkpointEntity: BackendNode = {
      id: "node-chk",
      type: "entity",
      position: { x: 400, y: 0 },
      fractionalIndex: "a5",
      data: {
        label: "checkpoints",
        tableName: "checkpoints",
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [webApp, loginPage, chatPage, serviceNode, lgNode, checkpointEntity],
      edges: [],
      endpoints: [endpoint],
    };

    const report = validateArchitectureCompleteness(input);
    expect(report.score).toBe(100);
    expect(report.status).toBe("production_ready");
    expect(report.issues.length).toBe(0);
    expect(report.passedChecks.length).toBeGreaterThanOrEqual(4);

    const diagnostic = formatArchitectureDiagnostic(report);
    expect(diagnostic).toContain("**Readiness Score**: 100 / 100 [PASSED");
    expect(diagnostic).toContain("Verified Complete Contracts:");
  });

  it("detects broken frontend send-message execution flow when backend API call step is missing", () => {
    const chatPage: BackendNode = {
      id: "node-chat",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/chat",
        sections: [
          {
            id: "s-chat",
            name: "Chat Section",
            actions: [
              {
                id: "act-send",
                name: "Send Message",
                event: "onSubmit",
                actionSteps: [
                  // Only state_mutation, missing api_call!
                  {
                    id: "step-mutate",
                    order: 1,
                    type: "state_mutation",
                    value: "hello",
                  } as any,
                ],
              },
            ],
          },
        ],
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [chatPage],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "EXECUTION_FLOW_BROKEN");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("critical");
    expect(issue?.category).toBe("execution");
    expect(issue?.title).toContain("Missing Backend API Call");
    expect(report.score).toBeLessThanOrEqual(80);
  });

  it("detects empty literal state mutations discarding user input", () => {
    const dashPage: BackendNode = {
      id: "node-dash",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/dashboard",
        sections: [
          {
            id: "s-dash",
            name: "Dashboard Section",
            actions: [
              {
                id: "act-send",
                name: "Submit Message",
                actionSteps: [
                  {
                    id: "step-mut",
                    order: 1,
                    type: "state_mutation",
                    value: "", // Empty literal!
                    bindingSource: { kind: "inline" },
                  } as any,
                ],
              },
            ],
          },
        ],
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [dashPage],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "STATE_MUTATION_EMPTY_LITERAL");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("critical");
    expect(issue?.description).toContain('literal empty strings');
  });

  it("detects unmapped realtime streaming connections", () => {
    const chatPage: BackendNode = {
      id: "node-chat",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/chat/[id]",
        realtimeConnections: [
          {
            id: "rc-1",
            protocol: "SSE" as any,
            isLangGraph: true,
            // storeActionBinding is empty or missing targetFieldName!
            storeActionBinding: {} as any,
          },
        ],
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [chatPage],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "REALTIME_PAYLOAD_UNMAPPED");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("critical");
    expect(issue?.remediation).toContain("storeActionBinding");
  });

  it("detects missing resource ownership authorization guards on protected parametric endpoints", () => {
    const endpoint: EndpointWithNode = {
      id: "ep-send",
      nodeId: "node-svc",
      name: "/send-message/:id",
      type: "POST",
      requireAuth: true,
      pipelineSteps: [
        // Has no condition or auth check step!
        {
          id: "step-lg",
          type: "langgraph_invoke",
          name: "invoke_agent",
        },
      ],
    };

    const input: ProjectSystemContextInput = {
      nodes: [],
      edges: [],
      endpoints: [endpoint],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "MISSING_OWNERSHIP_CHECK");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("critical");
    expect(issue?.description).toContain("accepts an entity ID parameter, but has no step verifying");
  });

  it("detects dynamic routes missing initial page load data hydration", () => {
    const chatPage: BackendNode = {
      id: "node-chat",
      type: "webPage",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/chat/[id]",
        sections: [
          {
            id: "sec-1",
            name: "Chat Section",
            actions: [
              // No pageLoad or onLoad action with api_call
            ],
          },
        ],
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [chatPage],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "MISSING_PAGE_HYDRATION");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("high");
    expect(issue?.title).toContain('Dynamic Route "/chat/[id]" Missing History Hydration');
  });

  it("detects checkpointer persistence mismatch between memory checkpointer and postgres tables", () => {
    const lgNode: BackendNode = {
      id: "node-lg",
      type: "langgraph",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "AI Agent",
        memoryConfig: {
          checkpointer: "memory", // Memory checkpointer
        },
      },
    };

    const checkpointTable: BackendNode = {
      id: "node-chk",
      type: "entity",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "checkpoints",
        tableName: "checkpoints",
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [lgNode, checkpointTable],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "CHECKPOINTER_SCHEMA_MISMATCH");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("high");
    expect(issue?.remediation).toContain("Change LangGraph checkpointer from `memory` to `postgres`");
  });

  it("detects dangling route references in redirects and navigation", () => {
    const webApp: BackendNode = {
      id: "node-app",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "web",
        zones: [
          {
            id: "z-private",
            handleId: "h-priv",
            name: "Private Zone",
            accessType: "protected",
            rule: {
              id: "r-priv",
              scope: "zone",
              conditions: { kind: "leaf", condition: { type: "auth" } } as any,
              redirects: {
                default: "/login",
                "no-auth": "/login",
                "wrong-role": "/unauthorized",
                "wrong-plan": "/pricing",
              },
            } as any,
          },
        ],
      },
    };

    // Only /login exists, /unauthorized and /pricing do not
    const loginPage: BackendNode = {
      id: "node-login",
      type: "webPage",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "/login",
      },
    };

    const input: ProjectSystemContextInput = {
      nodes: [webApp, loginPage],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "DANGLING_ROUTE_REFERENCE");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("high");
    expect(issue?.description).toContain("`/unauthorized`");
    expect(issue?.description).toContain("`/pricing`");
  });

  it("detects ambiguous realtime transports when service enables WebSocket and endpoints use SSE", () => {
    const svc: BackendNode = {
      id: "node-svc",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Conversations Service",
        enableWebSocket: true,
        customDependencies: [{ name: "ws@^8.18.0" }] as any,
      },
    };

    const sseEndpoint: EndpointWithNode = {
      id: "ep-1",
      nodeId: "node-svc",
      name: "/stream",
      isStreaming: true,
    } as any;

    const input: ProjectSystemContextInput = {
      nodes: [svc],
      edges: [],
      endpoints: [sseEndpoint],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "AMBIGUOUS_REALTIME_TRANSPORT");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("medium");
  });

  it("detects AI agent endpoints lacking request body schema validation", () => {
    const ep: EndpointWithNode = {
      id: "ep-lg",
      nodeId: "node-svc",
      name: "/send-message",
      type: "POST",
      pipelineSteps: [
        {
          id: "step-lg",
          name: "invoke_langgraph",
          type: "langgraph_invoke",
        },
      ],
      // No requestBody defined!
    };

    const input: ProjectSystemContextInput = {
      nodes: [],
      edges: [],
      endpoints: [ep],
    };

    const report = validateArchitectureCompleteness(input);
    const issue = report.issues.find((i) => i.id === "INCOMPLETE_ENDPOINT_CONTRACT");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("medium");
    expect(issue?.title).toContain('Streaming Endpoint "/send-message" Missing Request Schema Validation');
  });

  it("formats diagnostic report with proper Markdown severity tags, badges, and remediation steps", () => {
    const input: ProjectSystemContextInput = {
      nodes: [
        {
          id: "node-chat",
          type: "webPage",
          position: { x: 0, y: 0 },
          fractionalIndex: "a0",
          data: {
            label: "/chat",
            sections: [
              {
                id: "sec",
                name: "Chat Section",
                actions: [{ id: "act", name: "Send Message", actionSteps: [] }],
              },
            ],
          },
        },
      ],
      edges: [],
    };

    const report = validateArchitectureCompleteness(input);
    const diagnostic = formatArchitectureDiagnostic(report);

    expect(diagnostic).toContain("### Architecture Completeness & Runtime Readiness");
    expect(diagnostic).toContain("**Readiness Score**:");
    expect(diagnostic).toContain("[CRITICAL | EXECUTION]");
    expect(diagnostic).toContain("*Problem*:");
    expect(diagnostic).toContain("*Remediation*:");
  });
});
