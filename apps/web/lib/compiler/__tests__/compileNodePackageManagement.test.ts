import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { BackendNode, BackendEdge } from "@/types/canvas";

describe("compileMonorepo Node Package Management", () => {
  it("merges custom dependencies and devDependencies into Express service package.json", () => {
    const serviceNode: BackendNode = {
      id: "node-order-srv",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "OrderService",
        techStack: "express",
        port: "8080",
        customDependencies: [
          { name: "stripe", version: "^14.18.0", isDev: false, category: "APIs & Payments" },
          { name: "lodash-es", version: "^4.17.21", isDev: false },
          { name: "@types/lodash-es", version: "^4.17.12", isDev: true },
          { name: "vitest", version: "^1.6.0", isDev: true },
        ],
      },
    };

    const result = compileMonorepo([serviceNode], [], [], [], [], "ShopApp");

    const pkgFile = result.files.find((f) => f.filename === "apps/orderservice/package.json");
    expect(pkgFile).toBeDefined();

    const parsed = JSON.parse(pkgFile!.content);

    // Verify runtime dependencies
    expect(parsed.dependencies["stripe"]).toBe("^14.18.0");
    expect(parsed.dependencies["lodash-es"]).toBe("^4.17.21");
    expect(parsed.dependencies["express"]).toBeDefined();
    expect(parsed.dependencies["@workspace/types"]).toBe("workspace:*");

    // Verify dev dependencies
    expect(parsed.devDependencies["@types/lodash-es"]).toBe("^4.17.12");
    expect(parsed.devDependencies["vitest"]).toBe("^1.6.0");
    expect(parsed.devDependencies["@workspace/typescript-config"]).toBe("workspace:*");
  });

  it("merges custom dependencies and devDependencies into Next.js Web App package.json", () => {
    const webAppNode: BackendNode = {
      id: "node-web-app",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Customer Portal",
        appSlug: "customer-portal",
        port: "3000",
        customDependencies: [
          { name: "framer-motion", version: "^11.0.8", isDev: false, category: "UI & Animations" },
          { name: "@tanstack/react-query", version: "^5.25.0", isDev: false },
          { name: "@types/canvas-confetti", version: "^1.9.0", isDev: true },
        ],
      },
    };

    const webPageNode: BackendNode = {
      id: "node-page-home",
      type: "webPage",
      position: { x: 100, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "/dashboard",
        appSlug: "customer-portal",
        accessType: "public",
        customDependencies: [
          { name: "recharts", version: "^2.12.2", isDev: false },
        ],
      },
    };

    const edge: BackendEdge = {
      id: "edge-app-page",
      source: "node-web-app",
      target: "node-page-home",
      type: "connection",
      fractionalIndex: "a0",
    };

    const result = compileMonorepo([webAppNode, webPageNode], [], [], [edge], [], "ShopApp");

    const pkgFile = result.files.find((f) => f.filename === "apps/customer-portal/package.json");
    expect(pkgFile).toBeDefined();

    const parsed = JSON.parse(pkgFile!.content);

    // Verify runtime dependencies from WebAppNode and attached WebPageNode
    expect(parsed.dependencies["framer-motion"]).toBe("^11.0.8");
    expect(parsed.dependencies["@tanstack/react-query"]).toBe("^5.25.0");
    expect(parsed.dependencies["recharts"]).toBe("^2.12.2");
    expect(parsed.dependencies["next"]).toBeDefined();
    expect(parsed.dependencies["react"]).toBeDefined();

    // Verify devDependencies
    expect(parsed.devDependencies["@types/canvas-confetti"]).toBe("^1.9.0");
    expect(parsed.devDependencies["tailwindcss"]).toBeDefined();
    expect(parsed.devDependencies["@workspace/typescript-config"]).toBe("workspace:*");
  });
});
