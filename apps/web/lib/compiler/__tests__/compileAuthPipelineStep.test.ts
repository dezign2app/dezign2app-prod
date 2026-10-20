import { describe, it, expect } from "vitest";
import { getEndpointSources } from "@/app/(canvas)/project/[projectId]/_components/config-sidebar/pipeline-step-editor/source-paths/endpointSources";
import { resolveSource } from "../generators/routeGenerator/pipeline/sourceResolver";
import { compileTemplateString } from "../generators/routeGenerator/jsonInterpolation";
import { generateEndpointRouteHandler } from "../generators/routeGenerator/endpointHandlerGenerator";
import { resolveEndpointAuth } from "../generators/routeGenerator/handlers/authResolver";
import type { Endpoint, BackendNode, EndpointTraceResult } from "@workspace/canvas/types";

describe("Auth Session Tokens in Pipeline Steps", () => {
  it("provides 'auth' source with auth.username, id, email, role, etc. in available sources", () => {
    const ep: Endpoint = {
      id: "ep_1",
      name: "send-message",
      type: "POST",
      requireAuth: true,
      headers: [
        {
          id: "auth-bearer-header",
          name: "Authorization",
          type: "string",
          required: true,
        },
      ],
    };

    const sources = getEndpointSources(ep);
    const authSource = sources.find((s) => s.id === "auth" || s.kind === "auth");

    expect(authSource).toBeDefined();
    expect(authSource!.label).toBe("Auth Session (auth)");
    expect(authSource!.rootVariableName).toBe("auth");

    const pathNames = authSource!.paths.map((p) => p.path);
    expect(pathNames).toContain("username");
    expect(pathNames).toContain("id");
    expect(pathNames).toContain("userId");
    expect(pathNames).toContain("email");
    expect(pathNames).toContain("role");
    expect(pathNames).toContain("name");
    expect(pathNames).toContain("sessionToken");
  });

  it("dynamically interprets custom user columns and session claims from authNode and user entity", () => {
    const ep: Endpoint = {
      id: "ep_1",
      name: "profile",
      type: "GET",
      requireAuth: true,
    };

    const userEntityNode: BackendNode = {
      id: "node_user_entity",
      type: "entity",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "User",
        tableName: "user",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "username", type: "string" },
          { name: "avatarUrl", type: "string" },
          { name: "phoneNumber", type: "string" },
          { name: "stripeCustomerId", type: "string" },
          { name: "isVerified", type: "boolean" },
          { name: "loginCount", type: "integer" },
        ],
      },
    };

    const authNode: BackendNode = {
      id: "node_auth_server",
      type: "auth",
      position: { x: 100, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Better Auth",
        tableMappings: {
          userEntityId: "node_user_entity",
        },
        session: {
          claims: [
            { key: "subscriptionTier", source: "entityColumn", targetValue: "tier" },
          ],
        },
        plugins: ["organization"],
        paymentsPlugin: { provider: "creem" },
      },
    };

    const sources = getEndpointSources(ep, undefined, [authNode, userEntityNode]);
    const authSource = sources.find((s) => s.id === "auth" || s.kind === "auth");
    expect(authSource).toBeDefined();

    const pathNames = authSource!.paths.map((p) => p.path);
    // Standard defaults
    expect(pathNames).toContain("username");
    expect(pathNames).toContain("sessionToken");
    // Dynamic user entity columns
    expect(pathNames).toContain("avatarUrl");
    expect(pathNames).toContain("phoneNumber");
    expect(pathNames).toContain("stripeCustomerId");
    expect(pathNames).toContain("isVerified");
    expect(pathNames).toContain("loginCount");
    // Dynamic configured session claims
    expect(pathNames).toContain("subscriptionTier");
    // Dynamic plugin claims
    expect(pathNames).toContain("activeOrganizationId");
    expect(pathNames).toContain("orgRole");
    expect(pathNames).toContain("plan");
    expect(pathNames).toContain("creemCustomerId");

    const isVerifiedPath = authSource!.paths.find((p) => p.path === "isVerified");
    expect(isVerifiedPath?.type).toBe("boolean");

    const countPath = authSource!.paths.find((p) => p.path === "loginCount");
    expect(countPath?.type).toBe("number");
  });

  it("resolves auth source to auth?.username and auth in sourceResolver", () => {
    const ctx = {
      bodyVar: "body",
      priorOutputs: new Map<string, string>(),
      stepOutputMeta: new Map(),
    };

    expect(resolveSource({ kind: "auth", field: "username" }, ctx)).toBe("auth?.username");
    expect(resolveSource({ kind: "auth", field: "id" }, ctx)).toBe("auth?.id");
    expect(resolveSource({ kind: "auth", field: "email" }, ctx)).toBe("auth?.email");
    expect(resolveSource({ kind: "auth", field: "" }, ctx)).toBe("auth");
  });

  it("resolves ${auth.username} in template string interpolation", () => {
    const result = compileTemplateString("Hello ${auth.username}, your ID is ${auth.id}");
    expect(result).toBe("`Hello ${auth.username}, your ID is ${auth.id}`");
  });

  it("marks endpoint as requiring auth when a pipeline step binds to auth source", () => {
    const ep: Endpoint & { nodeId: string } = {
      id: "ep_msg",
      nodeId: "svc_1",
      name: "send-message",
      type: "POST",
      pipelineSteps: [
        {
          id: "step_agent",
          name: "Call Agent",
          type: "langgraph_invoke",
          inputBindings: [
            {
              argName: "user",
              source: { kind: "auth", field: "username" },
            },
          ],
        },
      ],
    };

    const trace: EndpointTraceResult = {
      incoming: [],
      outgoing: [],
    };

    const res = resolveEndpointAuth(ep, trace);
    expect(res.requiresAuth).toBe(true);
  });

  it("generates const auth = req.user; when pipeline steps reference auth", () => {
    const serviceNode: BackendNode = {
      id: "svc_1",
      type: "service",
      fractionalIndex:"a1",
      position: { x: 0, y: 0 },
      data: {
        label: "ChatService",
        name: "chat",
      },
    };

    const ep: Endpoint & { nodeId: string } = {
      id: "ep_msg",
      nodeId: "svc_1",
      name: "send-message",
      type: "POST",
      requireAuth: true,
      pipelineSteps: [
        {
          id: "step_ret",
          name: "Return Response",
          type: "return_response",
          statusCode: 201,
          inputBindings: [
            {
              argName: "username",
              source: { kind: "auth", field: "username" },
            },
            {
              argName: "userId",
              source: { kind: "auth", field: "id" },
            },
          ],
        },
      ],
    };

    const result = generateEndpointRouteHandler({
      ep,
      index: 0,
      serviceName: "chat",
      pascalServiceName: "Chat",
      serviceFolderName: "chat",
      serviceNode,
      allNodes: [serviceNode],
      allEdges: [],
      allEndpoints: [ep],
      dbFunctions: [],
      kafkaFunctions: [],
      nodePublishedEvents: [],
      usedFileNames: new Set<string>(),
    });

    expect(result.file.content).toContain("const auth = req.user;");
    expect(result.file.content).toContain("auth?.username");
    expect(result.file.content).toContain("auth?.id");
  });
});
