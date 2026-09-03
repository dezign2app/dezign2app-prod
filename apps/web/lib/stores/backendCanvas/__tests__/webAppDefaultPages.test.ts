import { describe, it, expect, beforeEach } from "vitest";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { parsePageRoute } from "@workspace/canvas";
import { compileNextjsV16WebClient } from "@/lib/compiler/webClients/nextjs/v16";

describe("backendCanvasStore - WebApp default pages on addNode", () => {
  beforeEach(() => {
    useBackendCanvasStore.getState().reset("proj-webapp-test");
  });

  it("automatically creates '/' and '/not-found' webPage nodes and edges when adding a webApp node", () => {
    const store = useBackendCanvasStore.getState();

    store.addNode({
      id: "app-1",
      type: "webApp",
      position: { x: 100, y: 150 },
      data: {
        label: "Storefront",
      },
    });

    const state = useBackendCanvasStore.getState();
    expect(state.nodes).toHaveLength(3);

    const webAppNode = state.nodes.find((n) => n.id === "app-1");
    expect(webAppNode).toBeDefined();
    expect(webAppNode?.type).toBe("webApp");
    expect(webAppNode?.data?.label).toBe("Storefront");
    expect(webAppNode?.data?.appSlug).toBe("storefront");
    expect(webAppNode?.data?.port).toBe("3000");
    expect(webAppNode?.data?.zones).toBeDefined();

    const webPageNodes = state.nodes.filter((n) => n.type === "webPage");
    expect(webPageNodes).toHaveLength(2);

    const rootPage = webPageNodes.find((p) => p.data?.label === "/");
    expect(rootPage).toBeDefined();
    expect(rootPage?.data?.isRoot).toBe(true);
    expect(rootPage?.data?.appSlug).toBe("storefront");
    expect(rootPage?.position).toEqual({ x: 500, y: 150 });
    expect(rootPage?.data?.useZoneDefault).toBe(true);
    expect(rootPage?.data?.sections).toHaveLength(1);

    const notFoundPage = webPageNodes.find((p) => p.data?.label === "/not-found");
    expect(notFoundPage).toBeDefined();
    expect(notFoundPage?.data?.appSlug).toBe("storefront");
    expect(notFoundPage?.data?.sections).toHaveLength(1);
    expect(notFoundPage?.data?.sections?.[0]?.actions?.[0]?.event).toBe("navigateToPage");
    expect(notFoundPage?.data?.sections?.[0]?.actions?.[0]?.targetRoute).toBe("/");
    expect(notFoundPage?.data?.sections?.[0]?.actions?.[0]?.targetPageId).toBe(rootPage?.id);

    // Edges
    expect(state.edges).toHaveLength(2);

    const rootEdge = state.edges.find((e) => e.target === rootPage?.id);
    expect(rootEdge).toBeDefined();
    expect(rootEdge?.source).toBe("app-1");
    expect(rootEdge?.sourceHandle).toBe("public-in");
    expect(rootEdge?.targetHandle).toBe("page-in");
    expect(rootEdge?.type).toBe("connection");

    const notFoundEdge = state.edges.find((e) => e.target === notFoundPage?.id);
    expect(notFoundEdge).toBeDefined();
    expect(notFoundEdge?.source).toBe("app-1");
    expect(notFoundEdge?.sourceHandle).toBe("public-in");
    expect(notFoundEdge?.targetHandle).toBe("page-in");
    expect(notFoundEdge?.type).toBe("connection");

    // Pending upserts for Convex synchronization
    expect(state.pendingNodeUpserts).toHaveLength(3);
    expect(state.pendingEdgeUpserts).toHaveLength(2);
  });

  it("respects skipDefaultPages flag when adding a webApp node", () => {
    const store = useBackendCanvasStore.getState();

    store.addNode({
      id: "app-2",
      type: "webApp",
      position: { x: 50, y: 50 },
      data: {
        label: "Bare App",
        skipDefaultPages: true,
      },
    });

    const state = useBackendCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]?.id).toBe("app-2");
    expect(state.edges).toHaveLength(0);
  });

  it("undoes the webApp and default pages together in a single history step", () => {
    const store = useBackendCanvasStore.getState();

    store.addNode({
      id: "app-3",
      type: "webApp",
      position: { x: 200, y: 200 },
      data: { label: "Blog App" },
    });

    expect(useBackendCanvasStore.getState().nodes).toHaveLength(3);
    expect(useBackendCanvasStore.getState().edges).toHaveLength(2);

    useBackendCanvasStore.getState().undo();

    expect(useBackendCanvasStore.getState().nodes).toHaveLength(0);
    expect(useBackendCanvasStore.getState().edges).toHaveLength(0);
  });

  it("parses page routes preserving leading slash when present", () => {
    expect(parsePageRoute("/")).toBe("/");
    expect(parsePageRoute("/not-found")).toBe("/not-found");
    expect(parsePageRoute("/about-us")).toBe("/about-us");
    expect(parsePageRoute("about-us")).toBe("about-us");
    expect(parsePageRoute("/dashboard/user settings/")).toBe("/dashboard/user-settings");
    expect(parsePageRoute("Landing Page")).toBe("landing-page");
  });

  it("compiles app/not-found.tsx and app/[...not_found]/page.tsx when a not-found page exists", () => {
    const store = useBackendCanvasStore.getState();

    store.addNode({
      id: "app-compile",
      type: "webApp",
      position: { x: 100, y: 100 },
      data: { label: "Commerce" },
    });

    const state = useBackendCanvasStore.getState();
    const webPages = state.nodes.filter((n) => n.type === "webPage");
    const webAppNode = state.nodes.find((n) => n.type === "webApp");

    const result = compileNextjsV16WebClient(
      webPages,
      [],
      [],
      state.nodes,
      state.edges,
      "Commerce",
      [],
      "commerce",
      webAppNode,
    );

    // 1. Regular route page
    const regularNotFoundPage = result.files.find(
      (f) => f.filename === "app/(public)/not-found/page.tsx",
    );
    expect(regularNotFoundPage).toBeDefined();
    expect(regularNotFoundPage?.content).toContain("404");
    expect(regularNotFoundPage?.content).toContain("Page Not Found");
    expect(regularNotFoundPage?.content).not.toContain("loadPageData");
    expect(regularNotFoundPage?.content).not.toContain("pageLoad");

    // 2. Next.js 404 convention file
    const rootNotFoundFile = result.files.find(
      (f) => f.filename === "app/not-found.tsx",
    );
    expect(rootNotFoundFile).toBeDefined();
    expect(rootNotFoundFile?.content).toContain('export { default } from "./(public)/not-found/page"');

    // 3. Unmatched route catch-all [...not_found]
    const catchAllFile = result.files.find(
      (f) => f.filename === "app/[...not_found]/page.tsx",
    );
    expect(catchAllFile).toBeDefined();
    expect(catchAllFile?.content).toContain('import { notFound } from "next/navigation";');
    expect(catchAllFile?.content).toContain("notFound();");
  });
});
