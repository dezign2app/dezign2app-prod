import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { BackendNode } from "@/types/canvas";
import { arePageRoutesEqual, normalizePageRoute } from "@workspace/canvas";

describe("WebPageNode Route Deduplication on WebApp", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-route-dedup-test");
  });

  it("normalizes '/<route>' and '<route>' as identical", () => {
    expect(arePageRoutesEqual("/login", "login")).toBe(true);
    expect(arePageRoutesEqual("login", "/login")).toBe(true);
    expect(arePageRoutesEqual("/about-us", "about-us")).toBe(true);
    expect(normalizePageRoute("login")).toBe("/login");
    expect(normalizePageRoute("/login")).toBe("/login");
  });

  it("prevents connecting two pages with equivalent routes ('/login' and 'login') to the same WebApp", () => {
    const store = useBackendCanvasStore.getState();

    const webApp: BackendNode = {
      id: "app-1",
      type: "webApp",
      fractionalIndex: "a0",
      position: { x: 100, y: 100 },
      data: {
        label: "WebApp 1",
        appSlug: "webapp-1",
        zones: [
          { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
        ],
      },
    };

    const page1: BackendNode = {
      id: "page-1",
      type: "webPage",
      fractionalIndex: "a1",
      position: { x: 500, y: 100 },
      data: {
        label: "/login",
      },
    };

    const page2: BackendNode = {
      id: "page-2",
      type: "webPage",
      fractionalIndex: "a2",
      position: { x: 500, y: 250 },
      data: {
        label: "login", // Same canonical route without leading slash
      },
    };

    store.addNode(webApp);
    // Note: addNode for webApp automatically creates default "/" and "/not-found" pages
    store.addNode(page1);
    store.addNode(page2);

    // Connect page-1 (/login) to WebApp
    store.onConnect({
      source: "app-1",
      sourceHandle: "public-in",
      target: "page-1",
      targetHandle: "page-in",
    });

    const edgesAfterFirstConnect = useBackendCanvasStore.getState().edges;
    expect(edgesAfterFirstConnect.some((e) => e.target === "page-1")).toBe(true);

    // Attempt to connect page-2 ("login") to the same WebApp
    store.onConnect({
      source: "app-1",
      sourceHandle: "public-in",
      target: "page-2",
      targetHandle: "page-in",
    });

    const edgesAfterSecondConnect = useBackendCanvasStore.getState().edges;
    // page-2 connection should be blocked because "/login" and "login" are duplicates
    expect(edgesAfterSecondConnect.some((e) => e.target === "page-2")).toBe(false);
  });

  it("allows connecting a different route ('/register') to the WebApp", () => {
    const store = useBackendCanvasStore.getState();

    const webApp: BackendNode = {
      id: "app-1",
      type: "webApp",
      fractionalIndex: "a0",
      position: { x: 100, y: 100 },
      data: {
        label: "WebApp 1",
        appSlug: "webapp-1",
        zones: [
          { id: "zone-public", handleId: "public-in", name: "Public Section", accessType: "public" },
        ],
      },
    };

    const loginPage: BackendNode = {
      id: "page-login",
      type: "webPage",
      fractionalIndex: "a1",
      position: { x: 500, y: 100 },
      data: { label: "/login" },
    };

    const registerPage: BackendNode = {
      id: "page-register",
      type: "webPage",
      fractionalIndex: "a2",
      position: { x: 500, y: 250 },
      data: { label: "register" }, // "register" vs "/login" are distinct routes
    };

    store.addNode(webApp);
    store.addNode(loginPage);
    store.addNode(registerPage);

    store.onConnect({
      source: "app-1",
      sourceHandle: "public-in",
      target: "page-login",
      targetHandle: "page-in",
    });

    store.onConnect({
      source: "app-1",
      sourceHandle: "public-in",
      target: "page-register",
      targetHandle: "page-in",
    });

    const edges = useBackendCanvasStore.getState().edges;
    expect(edges.some((e) => e.target === "page-login")).toBe(true);
    expect(edges.some((e) => e.target === "page-register")).toBe(true);
  });

  it("allows the same route name on two DIFFERENT WebApps", () => {
    const store = useBackendCanvasStore.getState();

    const webApp1: BackendNode = {
      id: "app-1",
      type: "webApp",
      fractionalIndex: "a0",
      position: { x: 100, y: 100 },
      data: {
        label: "WebApp 1",
        appSlug: "webapp-1",
        zones: [{ id: "zone-public", handleId: "public-in", name: "Public", accessType: "public" }],
      },
    };

    const webApp2: BackendNode = {
      id: "app-2",
      type: "webApp",
      fractionalIndex: "a1",
      position: { x: 100, y: 400 },
      data: {
        label: "WebApp 2",
        appSlug: "webapp-2",
        zones: [{ id: "zone-public", handleId: "public-in", name: "Public", accessType: "public" }],
      },
    };

    const page1: BackendNode = {
      id: "page-1",
      type: "webPage",
      fractionalIndex: "a2",
      position: { x: 500, y: 100 },
      data: { label: "/login" },
    };

    const page2: BackendNode = {
      id: "page-2",
      type: "webPage",
      fractionalIndex: "a3",
      position: { x: 500, y: 400 },
      data: { label: "login" }, // Equivalent route on a DIFFERENT WebApp
    };

    store.addNode(webApp1);
    store.addNode(webApp2);
    store.addNode(page1);
    store.addNode(page2);

    store.onConnect({
      source: "app-1",
      sourceHandle: "public-in",
      target: "page-1",
      targetHandle: "page-in",
    });

    store.onConnect({
      source: "app-2",
      sourceHandle: "public-in",
      target: "page-2",
      targetHandle: "page-in",
    });

    const edges = useBackendCanvasStore.getState().edges;
    expect(edges.some((e) => e.source === "app-1" && e.target === "page-1")).toBe(true);
    expect(edges.some((e) => e.source === "app-2" && e.target === "page-2")).toBe(true);
  });
});
