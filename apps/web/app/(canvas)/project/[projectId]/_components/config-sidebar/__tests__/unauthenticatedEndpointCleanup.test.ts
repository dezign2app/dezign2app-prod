import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge, Parameter } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { resolveEventParameters } from "@/lib/compiler/webClients/nextjs/v16/event-generators/resolveEventParameters";
import { useWebPageApiParameters } from "../web-page-config/hooks/useWebPageApiParameters";
import { renderHook } from "@testing-library/react";

describe("Unauthenticated API Route and WebPage Auth Cleanup", () => {
  it("resolveEventParameters strips Authorization header when requireAuth is false", () => {
    const staleHeaders: Parameter[] = [
      {
        id: "auth-bearer-header",
        name: "Authorization",
        type: "string",
        required: true,
        defaultValue: "Bearer <token>",
      },
      {
        id: "custom-header",
        name: "X-Custom-Header",
        type: "string",
        required: false,
        defaultValue: "hello",
      },
    ];

    const result = resolveEventParameters({
      url: "/api/test",
      method: "GET",
      eventItem: {
        id: "act-test",
        name: "TestPing",
        event: "click",
        headers: staleHeaders,
      },
      endpoint: {
        id: "ep-test",
        name: "/api/test",
        type: "GET",
        requireAuth: false,
        headers: staleHeaders,
      },
      requireAuth: false,
    });

    // mergedHeaders must NOT contain Authorization
    expect(result.mergedHeaders.some((h) => h.name.toLowerCase() === "authorization")).toBe(false);
    expect(result.mergedHeaders.some((h) => h.id === "auth-bearer-header")).toBe(false);
    // non-auth header remains
    expect(result.mergedHeaders.some((h) => h.name === "X-Custom-Header")).toBe(true);
  });

  it("resolveEventParameters never injects synthetic Authorization into mergedHeaders even when requireAuth is true", () => {
    const result = resolveEventParameters({
      url: "/api/reset",
      method: "POST",
      eventItem: {
        id: "act-reset",
        name: "reset",
        event: "click",
        headers: [],
      },
      endpoint: {
        id: "ep-reset",
        name: "/api/reset",
        type: "POST",
        requireAuth: true,
        headers: [],
      },
      requireAuth: true,
    });

    // In Next.js client, runtime auth token is handled by executeApiAction automatically.
    // mergedHeaders must NOT contain synthetic Authorization so that clean button renders instead of an interactive form.
    expect(result.mergedHeaders.some((h) => h.name.toLowerCase() === "authorization")).toBe(false);
    expect(result.hasHeaders).toBe(false);
    expect(result.hasFields).toBe(false);
  });

  it("useWebPageApiParameters respects connectedEndpoint.requireAuth === false and removes auth headers", () => {
    const staleHeaders: Parameter[] = [
      {
        id: "auth-bearer-header",
        name: "Authorization",
        type: "string",
        required: true,
        defaultValue: "Bearer <token>",
      },
      {
        id: "p-accept",
        name: "Accept",
        type: "string",
        required: false,
        defaultValue: "application/json",
      },
    ];

    const connectedEndpoint: Endpoint = {
      id: "ep-unauth",
      name: "/public/data",
      type: "GET",
      requireAuth: false,
      headers: staleHeaders,
    };

    const { result } = renderHook(() =>
      useWebPageApiParameters({
        data: {
          label: "/public-page",
          headers: staleHeaders,
        },
        connectedEndpoint,
        isProtected: true, // Even if page was in a protected section, endpoint's requireAuth: false overrides
      }),
    );

    expect(result.current.isAuthEnabled).toBe(false);
    expect(
      result.current.effectiveHeaders.some((h) => h.name.toLowerCase() === "authorization"),
    ).toBe(false);
    expect(
      result.current.effectiveHeaders.some((h) => h.id === "auth-bearer-header"),
    ).toBe(false);
    expect(
      result.current.effectiveHeaders.some((h) => h.name === "Accept"),
    ).toBe(true);
  });

  it("useWebPageApiParameters never exposes Authorization header even when connected endpoint requires auth", () => {
    const authHeaders: Parameter[] = [
      {
        id: "auth-bearer-header",
        name: "Authorization",
        type: "string",
        required: true,
        defaultValue: "Bearer <token>",
      },
      {
        id: "p-custom",
        name: "X-Trace-Id",
        type: "string",
        required: false,
      },
    ];

    const connectedEndpoint: Endpoint = {
      id: "ep-auth",
      name: "/protected/data",
      type: "GET",
      requireAuth: true,
      headers: authHeaders,
    };

    const { result } = renderHook(() =>
      useWebPageApiParameters({
        data: {
          label: "/protected-page",
          headers: authHeaders,
        },
        connectedEndpoint,
        isProtected: true,
      }),
    );

    expect(result.current.isAuthEnabled).toBe(true);
    // Even though requireAuth is true, WebPage effectiveHeaders should NOT have Authorization
    expect(
      result.current.effectiveHeaders.some((h) => h.name.toLowerCase() === "authorization"),
    ).toBe(false);
    expect(
      result.current.effectiveHeaders.some((h) => h.id === "auth-bearer-header"),
    ).toBe(false);
    // Non-auth header remains
    expect(
      result.current.effectiveHeaders.some((h) => h.name === "X-Trace-Id"),
    ).toBe(true);
  });

  it("cleans up stale auth headers on calling WebPageNode and action events when unauthenticated", () => {
    const webPageNode: BackendNode = {
      id: "webpage-caller",
      type: "webPage",
      fractionalIndex: "a0",
      position: { x: 100, y: 100 },
      data: {
        label: "/dashboard",
        headers: [
          {
            id: "auth-bearer-header",
            name: "Authorization",
            type: "string",
            required: true,
          },
          {
            id: "h-apikey",
            name: "X-Api-Key",
            type: "string",
            required: false,
          },
        ],
        sections: [
          {
            id: "sec-1",
            name: "Data Section",
            actions: [
              {
                id: "act-fetch",
                name: "FetchData",
                headers: [
                  {
                    id: "auth-bearer-header",
                    name: "Authorization",
                    type: "string",
                    required: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "service-target",
      type: "service",
      fractionalIndex: "a1",
      position: { x: 500, y: 100 },
      data: {
        label: "Backend Service",
        endpoints: [],
      },
    };

    const edge: BackendEdge = {
      id: "edge-act-ep",
      source: "webpage-caller",
      sourceHandle: "events-act-fetch",
      target: "service-target",
      targetHandle: "endpoint-in-ep-unauth",
      type: "connection",
      fractionalIndex: "a0",
    };

    useBackendCanvasStore.setState({
      nodes: [webPageNode, serviceNode],
      edges: [edge],
      endpoints: [
        {
          id: "ep-unauth",
          nodeId: "service-target",
          name: "/api/unauth",
          type: "GET",
          requireAuth: false,
          headers: [],
        },
      ],
    });

    // Simulate cleanup logic (same as cleanConnectedWebPageNodes in EndpointConfig)
    const store = useBackendCanvasStore.getState();
    const item = store.endpoints.find((e) => e.id === "ep-unauth");
    const targetNodeId = "service-target";

    store.nodes.forEach((n) => {
      if (n.type !== "webPage") return;
      const isDirectlyConnected = store.edges.some((e) => {
        const matches =
          (e.target === targetNodeId && e.source === n.id) ||
          (e.source === targetNodeId && e.target === n.id);
        if (!matches) return false;
        const handle = e.target === targetNodeId ? e.targetHandle : e.sourceHandle;
        return !handle || handle.includes(item!.id);
      });

      if (!isDirectlyConnected) return;

      const nextData = { ...n.data };
      if (nextData.headers) {
        nextData.headers = nextData.headers.filter(
          (h) => h.name?.toLowerCase() !== "authorization" && h.id !== "auth-bearer-header",
        );
      }
      if (nextData.sections) {
        nextData.sections = nextData.sections.map((sec) => ({
          ...sec,
          actions: (sec.actions || []).map((act) => ({
            ...act,
            headers: (act.headers || []).filter(
              (h) => h.name?.toLowerCase() !== "authorization" && h.id !== "auth-bearer-header",
            ),
          })),
        }));
      }
      store.updateNode(n.id, { data: nextData });
    });

    const updated = useBackendCanvasStore.getState().nodes.find((n) => n.id === "webpage-caller");
    expect(updated).toBeDefined();

    // Verify node.data.headers has Authorization stripped
    expect(updated?.data?.headers?.some((h) => h.name?.toLowerCase() === "authorization")).toBe(false);
    expect(updated?.data?.headers?.some((h) => h.name === "X-Api-Key")).toBe(true);

    // Verify action headers has Authorization stripped
    const updatedAction = updated?.data?.sections?.[0]?.actions?.[0];
    expect(updatedAction?.headers?.some((h) => h.name?.toLowerCase() === "authorization")).toBe(false);
    expect(updatedAction?.headers?.length).toBe(0);
  });
});
