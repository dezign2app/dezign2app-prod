import { describe, it, expect } from "vitest";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { compileMonorepo } from "../compileMonorepo";
import { compileFrontendNodes } from "../compileFrontendHelpers";

describe("Frontend Hooks Compilation", () => {
  it("compiles global hooks to packages/ui/ and app-local hooks to their owning apps", () => {
    // 1. WebApp Nodes
    const adminApp: BackendNode = {
      id: "webapp-admin",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Admin Portal",
        appSlug: "admin-portal",
      },
    };

    const storeApp: BackendNode = {
      id: "webapp-store",
      type: "webApp",
      position: { x: 500, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Storefront",
        appSlug: "storefront",
      },
    };

    // 2. WebPage Nodes
    const adminDashboard: BackendNode = {
      id: "page-admin-dash",
      type: "webPage",
      position: { x: 0, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "/dashboard",
        appSlug: "admin-portal",
      },
    };

    const storeHome: BackendNode = {
      id: "page-store-home",
      type: "webPage",
      position: { x: 500, y: 200 },
      fractionalIndex: "a3",
      data: {
        label: "/",
        appSlug: "storefront",
        isRoot: true,
      },
    };

    // 3. Global Hook
    const globalHook: BackendNode = {
      id: "hook-debounce",
      type: "hook",
      position: { x: 200, y: -200 },
      fractionalIndex: "a4",
      data: {
        label: "useDebounce",
        hookName: "useDebounce",
        scope: "global",
        inputParams: [{ id: "1", name: "value", type: "string", required: true }],
        returnSchema: [{ id: "2", name: "debouncedValue", type: "string", required: true }],
      },
    };

    // 4. Local Hook for Admin Portal
    const adminHook: BackendNode = {
      id: "hook-admin-stats",
      type: "hook",
      position: { x: -200, y: 200 },
      fractionalIndex: "a6",
      data: {
        label: "useAdminStats",
        hookName: "useAdminStats",
        scope: "local",
        targetWebAppId: "webapp-admin",
      },
    };

    // 5. Local Hook for Storefront
    const storeHook: BackendNode = {
      id: "hook-cart-sync",
      type: "hook",
      position: { x: 700, y: 200 },
      fractionalIndex: "a8",
      data: {
        label: "useCartSync",
        hookName: "useCartSync",
        scope: "local",
        targetWebAppId: "webapp-store",
      },
    };

    const allNodes = [
      adminApp,
      storeApp,
      adminDashboard,
      storeHome,
      globalHook,
      adminHook,
      storeHook,
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-admin-page",
        source: "webapp-admin",
        target: "page-admin-dash",
        type: "connection",
        fractionalIndex: "e0",
      },
      {
        id: "edge-store-page",
        source: "webapp-store",
        target: "page-store-home",
        type: "connection",
        fractionalIndex: "e1",
      },
    ];

    // Compile Monorepo
    const result = compileMonorepo(
      allNodes,
      [],
      [],
      edges,
      [],
      "MultiAppFrontendMonorepo",
    );

    const fileMap = new Map(result.files.map((f) => [f.filename, f.content]));

    // 1. Verify Global Hook in packages/ui/
    expect(fileMap.has("packages/ui/src/hooks/useDebounce.ts")).toBe(true);

    const debounceContent = fileMap.get("packages/ui/src/hooks/useDebounce.ts")!;
    expect(debounceContent).toContain("export function useDebounce");
    expect(debounceContent).toContain("DebounceArgs");

    // 2. Verify Admin-Local items in apps/admin-portal/
    expect(fileMap.has("apps/admin-portal/hooks/useAdminStats.ts")).toBe(true);

    // 3. Verify Storefront-Local items in apps/storefront/
    expect(fileMap.has("apps/storefront/hooks/useCartSync.ts")).toBe(true);

    // 4. Verify Scope Isolation
    expect(fileMap.has("apps/storefront/hooks/useAdminStats.ts")).toBe(false);
    expect(fileMap.has("apps/admin-portal/hooks/useCartSync.ts")).toBe(false);
  });
});
