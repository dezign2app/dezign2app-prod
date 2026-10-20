import { describe, it, expect } from "vitest";
import { compileServiceNode } from "../compileServiceNode";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

describe("compileServiceNode: health route authenticated user details", () => {
  it("should show authenticated user details and requireAuth middleware on default health route when connected to authenticated page", () => {
    const serviceNode: BackendNode = {
      id: "node-service-1",
      type: "service",
      position: { x: 300, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "OrderService",
        port: "8080",
        techStack: "express",
      },
    };

    const authPageNode: BackendNode = {
      id: "node-page-auth",
      type: "webPage",
      position: { x: 0, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Dashboard",
        path: "/dashboard",
        requireAuth: true,
      },
    };

    const edge: BackendEdge = {
      id: "edge-page-service",
      type: "connection",
      source: "node-page-auth",
      target: "node-service-1",
      fractionalIndex: "a0",
    };

    const result = compileServiceNode(
      serviceNode,
      [],
      [],
      [serviceNode, authPageNode],
      [edge],
    );

    // 1. Verify healthRoute.ts shows user details
    const healthRoute = result.files.find((f) => f.filename === "src/routes/healthRoute.ts");
    expect(healthRoute).toBeDefined();
    expect(healthRoute!.content).toContain("user: req.user || null");
    expect(healthRoute!.content).not.toContain("as any");
    expect(healthRoute!.content).toContain("status: \"ok\"");
    expect(healthRoute!.content).toContain("service: \"OrderService\"");

    // 2. Verify router registration mounts requireAuth()
    const routesIndex = result.files.find((f) => f.filename === "src/routes/index.ts");
    expect(routesIndex).toBeDefined();
    expect(routesIndex!.content).toContain('router.get("/health", requireAuth(), healthHandler);');
    expect(routesIndex!.content).toContain('import { requireAuth } from "../middleware/requireAuth";');

    // 3. Verify requireAuth middleware is emitted
    const requireAuthFile = result.files.find((f) => f.filename === "src/middleware/requireAuth.ts");
    expect(requireAuthFile).toBeDefined();
  });

  it("should show authenticated user details on explicit /health endpoint when connected to authenticated page", () => {
    const serviceNode: BackendNode = {
      id: "node-service-2",
      type: "service",
      position: { x: 300, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "PaymentService",
        port: "8080",
        techStack: "express",
      },
    };

    const authPageNode: BackendNode = {
      id: "node-page-orders",
      type: "webPage",
      position: { x: 0, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Orders",
        path: "/orders",
        requireAuth: true,
      },
    };

    const healthEndpoint: Endpoint & { nodeId: string } = {
      id: "ep-health-check",
      nodeId: "node-service-2",
      name: "/health",
      type: "GET",
      summary: "Service health check",
    };

    const edge: BackendEdge = {
      id: "edge-orders-health",
      type: "connection",
      source: "node-page-orders",
      target: "node-service-2",
      targetHandle: "endpoint-in-ep-health-check",
      fractionalIndex: "a0",
    };

    const result = compileServiceNode(
      serviceNode,
      [healthEndpoint],
      [],
      [serviceNode, authPageNode],
      [edge],
    );

    // 1. Verify getHealth.ts contains req.user
    const healthRoute = result.files.find(
      (f) => f.filename === "src/routes/getHealth.ts" || f.filename === "src/routes/healthRoute.ts",
    );
    expect(healthRoute).toBeDefined();
    expect(healthRoute!.content).toContain("user: req.user");
    expect(healthRoute!.content).toContain("Successfully executed GET /health");

    // 2. Verify router registration mounts requireAuth()
    const routesIndex = result.files.find((f) => f.filename === "src/routes/index.ts");
    expect(routesIndex).toBeDefined();
    expect(routesIndex!.content).toContain('requireAuth()');
    expect(routesIndex!.content).toContain('import { requireAuth } from "../middleware/requireAuth";');

    // 3. Verify requireAuth middleware is emitted
    const requireAuthFile = result.files.find((f) => f.filename === "src/middleware/requireAuth.ts");
    expect(requireAuthFile).toBeDefined();
  });

  it("should NOT require auth on health route when page is public", () => {
    const serviceNode: BackendNode = {
      id: "node-service-public",
      type: "service",
      position: { x: 300, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "PublicService",
        port: "8080",
        techStack: "express",
      },
    };

    const publicPageNode: BackendNode = {
      id: "node-page-home",
      type: "webPage",
      position: { x: 0, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Home",
        path: "/",
        requireAuth: false,
      },
    };

    const edge: BackendEdge = {
      id: "edge-home-service",
      type: "connection",
      source: "node-page-home",
      target: "node-service-public",
      fractionalIndex: "a0",
    };

    const result = compileServiceNode(
      serviceNode,
      [],
      [],
      [serviceNode, publicPageNode],
      [edge],
    );

    const routesIndex = result.files.find((f) => f.filename === "src/routes/index.ts");
    expect(routesIndex).toBeDefined();
    expect(routesIndex!.content).toContain('router.get("/health", healthHandler);');
    expect(routesIndex!.content).not.toContain("requireAuth()");

    const requireAuthFile = result.files.find((f) => f.filename === "src/middleware/requireAuth.ts");
    expect(requireAuthFile).toBeUndefined();
  });

  it("should show authenticated user details in Next.js service health route when connected to authenticated page", () => {
    const nextjsServiceNode: BackendNode = {
      id: "node-next-srv",
      type: "service",
      position: { x: 300, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "NextService",
        port: "3000",
        techStack: "nextjs",
      },
    };

    const authPageNode: BackendNode = {
      id: "node-page-profile",
      type: "webPage",
      position: { x: 0, y: 100 },
      fractionalIndex: "a0",
      data: {
        label: "Profile",
        path: "/profile",
        requireAuth: true,
      },
    };

    const edge: BackendEdge = {
      id: "edge-profile-next",
      type: "connection",
      source: "node-page-profile",
      target: "node-next-srv",
      fractionalIndex: "a0",
    };

    const result = compileServiceNode(
      nextjsServiceNode,
      [],
      [],
      [nextjsServiceNode, authPageNode],
      [edge],
    );

    const healthRoute = result.files.find((f) => f.filename === "app/api/health/route.ts");
    expect(healthRoute).toBeDefined();
    expect(healthRoute!.content).toContain("request: NextRequest");
    expect(healthRoute!.content).toContain('request.headers.get("authorization")');
    expect(healthRoute!.content).toContain("user,");
  });
});
