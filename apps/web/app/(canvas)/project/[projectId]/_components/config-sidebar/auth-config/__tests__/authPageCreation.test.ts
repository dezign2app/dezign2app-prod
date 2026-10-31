import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { getConfiguredPages } from "../security/securityUtils";
import { handlePageRename } from "@/app/(canvas)/project/[projectId]/_components/node-deletion-dialog/subitem-handlers/handlePageRename";

describe("AuthConfig On-Demand WebPage Creation & Route Linking", () => {
  it("creates a WebPageNode with sign-in form boilerplate and links to WebApp public zone", () => {
    const webAppNode: BackendNode = {
      id: "webapp-1",
      type: "webApp",
      fractionalIndex: "a0",
      position: { x: 100, y: 100 },
      data: {
        label: "My Web App",
        appSlug: "my-web-app",
        zones: [
          { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
          { id: "zone-private", handleId: "private-in", name: "Private Section", accessType: "protected" },
        ],
      },
    };

    const authNode: BackendNode = {
      id: "auth-1",
      type: "auth",
      fractionalIndex: "a1",
      position: { x: -200, y: 100 },
      data: {
        label: "Auth Server",
        redirects: {
          signInPageUrl: "/login",
          signUpPageUrl: "/register",
          signInRedirectUrl: "/dashboard",
        },
      },
    };

    const authToWebAppEdge: BackendEdge = {
      id: "edge-auth-webapp",
      source: "auth-1",
      target: "webapp-1",
      type: "connection",
      fractionalIndex: "a0",
    };

    // Initialize Zustand store
    useBackendCanvasStore.setState({
      nodes: [webAppNode, authNode],
      edges: [authToWebAppEdge],
    });

    const store = useBackendCanvasStore.getState();

    // Simulate creating a /login WebPage node on demand
    const newPageId = "webPage-login-test";
    const newPageNode: BackendNode = {
      id: newPageId,
      type: "webPage",
      fractionalIndex: "a2",
      position: { x: 500, y: 100 },
      data: {
        label: "/login",
        path: "/login",
        appSlug: "my-web-app",
        description: "User sign-in and authentication page",
        useZoneDefault: true,
        sections: [
          {
            id: "sec-login-1",
            name: "Sign In Form",
            renderMode: "client",
            loadStrategy: "eager",
            actions: [
              {
                id: "act-login-1",
                name: "Sign In",
                event: "submit",
              },
            ],
          },
        ],
      },
    };

    store.addNode(newPageNode);

    // Wire to public-in handle of webapp
    const newEdgeId = `edge-${webAppNode.id}-public-in-${newPageId}-page-in`;
    store.addEdge({
      id: newEdgeId,
      source: webAppNode.id,
      sourceHandle: "public-in",
      target: newPageId,
      targetHandle: "page-in",
      type: "connection",
    });

    const updatedNodes = useBackendCanvasStore.getState().nodes;
    const updatedEdges = useBackendCanvasStore.getState().edges;

    // Verify WebPage node was added
    const createdPage = updatedNodes.find((n) => n.id === newPageId);
    expect(createdPage).toBeDefined();
    expect(createdPage?.data?.label).toBe("/login");
    expect(createdPage?.data?.path).toBe("/login");
    expect(createdPage?.data?.sections?.[0]?.name).toBe("Sign In Form");

    // Verify edge was added with public-in handle
    const createdEdge = updatedEdges.find((e) => e.id === newEdgeId);
    expect(createdEdge).toBeDefined();
    expect(createdEdge?.source).toBe("webapp-1");
    expect(createdEdge?.sourceHandle).toBe("public-in");
    expect(createdEdge?.target).toBe(newPageId);
    expect(createdEdge?.targetHandle).toBe("page-in");
  });

  it("creates a WebPageNode for dashboard and links to WebApp private zone", () => {
    const store = useBackendCanvasStore.getState();
    const webAppNode = store.nodes.find((n) => n.id === "webapp-1");
    expect(webAppNode).toBeDefined();

    const dashPageId = "webPage-dashboard-test";
    const dashPageNode: BackendNode = {
      id: dashPageId,
      type: "webPage",
      fractionalIndex: "a3",
      position: { x: 500, y: 260 },
      data: {
        label: "/dashboard",
        path: "/dashboard",
        appSlug: "my-web-app",
        description: "Authenticated user dashboard overview",
        useZoneDefault: true,
        sections: [
          {
            id: "sec-dash-1",
            name: "Dashboard Overview",
            renderMode: "server",
            loadStrategy: "eager",
            actions: [
              {
                id: "act-dash-1",
                name: "View Dashboard",
                event: "pageLoad",
              },
            ],
          },
        ],
      },
    };

    store.addNode(dashPageNode);

    // Wire to private-in handle of webapp
    const newEdgeId = `edge-${webAppNode!.id}-private-in-${dashPageId}-page-in`;
    store.addEdge({
      id: newEdgeId,
      source: webAppNode!.id,
      sourceHandle: "private-in",
      target: dashPageId,
      targetHandle: "page-in",
      type: "connection",
    });

    const updatedNodes = useBackendCanvasStore.getState().nodes;
    const updatedEdges = useBackendCanvasStore.getState().edges;

    const createdDash = updatedNodes.find((n) => n.id === dashPageId);
    expect(createdDash).toBeDefined();
    expect(createdDash?.data?.label).toBe("/dashboard");

    const createdEdge = updatedEdges.find((e) => e.id === newEdgeId);
    expect(createdEdge).toBeDefined();
    expect(createdEdge?.sourceHandle).toBe("private-in");
    expect(createdEdge?.targetHandle).toBe("page-in");
  });

  it("getConfiguredPages derives path from label and ignores stale legacy path", () => {
    // When a page had path: "/dashboard", but was renamed to label: "/c"
    const nodes: BackendNode[] = [
      {
        id: "webPage-renamed",
        type: "webPage",
        fractionalIndex: "a1",
        position: { x: 0, y: 0 },
        data: {
          label: "/c",
          path: "/dashboard", // Legacy stale path
        },
      },
    ];

    const pages = getConfiguredPages(nodes);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.id).toBe("webPage-renamed");
    expect(pages[0]?.label).toBe("/c");
    expect(pages[0]?.path).toBe("/c"); // Must be /c, NOT /dashboard!
  });

  it("store.updateNode synchronizes path and cascades to referencing auth redirects on page rename", () => {
    const pageId = "webPage-dash-to-c";
    const authId = "auth-server-test";

    useBackendCanvasStore.setState({
      nodes: [
        {
          id: pageId,
          type: "webPage",
          fractionalIndex: "a1",
          position: { x: 0, y: 0 },
          data: {
            label: "/dashboard",
            path: "/dashboard",
          },
        },
        {
          id: authId,
          type: "auth",
          fractionalIndex: "a2",
          position: { x: 100, y: 100 },
          data: {
            label: "Auth Server",
            redirects: {
              signInRedirectUrl: "/dashboard",
              signInRedirectNodeId: pageId,
            },
          },
        },
      ],
      edges: [],
    });

    const store = useBackendCanvasStore.getState();

    // Rename page from /dashboard to /c
    store.updateNode(pageId, {
      data: {
        ...store.nodes.find((n) => n.id === pageId)!.data,
        label: "/c",
      },
    });

    const updatedNodes = useBackendCanvasStore.getState().nodes;
    const updatedPage = updatedNodes.find((n) => n.id === pageId);
    const updatedAuth = updatedNodes.find((n) => n.id === authId);

    // Page node paths should be updated
    expect(updatedPage?.data?.label).toBe("/c");
    expect(updatedPage?.data?.path).toBe("/c");
    expect(updatedPage?.data?.route).toBe("/c");
    expect(updatedPage?.data?.pageSlug).toBe("c");

    // Auth node redirects should be updated to new path
    expect(updatedAuth?.data?.redirects?.signInRedirectUrl).toBe("/c");
    expect(updatedAuth?.data?.redirects?.signInRedirectNodeId).toBe(pageId);
  });

  it("handlePageRename simulation updates node data and cascades auth redirects", () => {
    const pageId = "page-123";
    const authId = "auth-123";
    const ctx = {
      nodes: [
        {
          id: pageId,
          type: "webPage" as const,
          fractionalIndex: "a1",
          position: { x: 0, y: 0 },
          data: {
            label: "/dashboard",
            path: "/dashboard",
          },
        },
        {
          id: authId,
          type: "auth" as const,
          fractionalIndex: "a2",
          position: { x: 0, y: 0 },
          data: {
            label: "Auth",
            redirects: {
              signInRedirectUrl: "/dashboard",
              signInRedirectNodeId: pageId,
            },
          },
        },
      ],
      endpoints: [],
      events: [],
      edges: [],
    };

    const res = handlePageRename(ctx, {
      type: "pageRename",
      nodeId: pageId,
      oldLabel: "/dashboard",
      newLabel: "/c",
      onConfirm: () => {},
    });

    const simPage = res.nextNodes.find((n) => n.id === pageId);
    const simAuth = res.nextNodes.find((n) => n.id === authId);

    expect(simPage?.data?.label).toBe("/c");
    expect(simPage?.data?.path).toBe("/c");
    expect(simPage?.data?.pageSlug).toBe("c");
    expect(simAuth?.data?.redirects?.signInRedirectUrl).toBe("/c");
    expect(res.cascadeElements.some((e) => e.type === "auth")).toBe(true);
  });
});
