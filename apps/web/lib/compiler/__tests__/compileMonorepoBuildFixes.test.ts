import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

describe("compileMonorepo Build Fixes & Consistency", () => {
  it("should generate matching type definitions and imports for services with database operations", () => {
    const productsNode: BackendNode = {
      id: "node-products-1",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Products",
        port: "8081",
      },
    };

    const productEntityNode: BackendNode = {
      id: "node-entity-product",
      type: "entity",
      position: { x: 0, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "Products",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "name", type: "string", isNotNull: true },
          { name: "price", type: "number", isNotNull: true },
        ],
      },
    };

    const createProductEndpoint: Endpoint & { nodeId: string } = {
      id: "ep-create-product",
      nodeId: "node-products-1",
      name: "/create-product",
      type: "POST",
      summary: "Create a new product",
      requestBody: {
        id: "req-1",
        rawJson: JSON.stringify({ name: "Widget", price: 99.99 }),
      },
      responseBody: {
        id: "res-1",
        rawJson: JSON.stringify({
          status: 201,
          message: "Successfully executed POST /create-product",
        }),
      },
      databaseNodeIds: ["node-entity-product"],
      crudOperations: {
        "node-entity-product": ["create"],
      },
    };

    const edges: BackendEdge[] = [
      {
        id: "edge-service-db",
        source: "node-products-1",
        target: "node-entity-product",
        type: "connection",
        fractionalIndex: "a0",
      },
    ];

    const result = compileMonorepo(
      [productsNode, productEntityNode],
      [createProductEndpoint],
      [],
      edges,
      [],
      "TestProductMonorepo",
    );

    // 1. Verify @workspace/types generates ProductsPostCreateProductResponse with strictly typed data?: Products
    const typesRouteFile = result.files.find(
      (f) => f.filename === "packages/types/src/products/postCreateProduct.ts",
    );
    expect(typesRouteFile).toBeDefined();
    expect(typesRouteFile?.content).toContain("export interface ProductsPostCreateProductResponse");
    expect(typesRouteFile?.content).toContain("data?: Products;");
    expect(typesRouteFile?.content).toContain('import type { Products } from "@workspace/db";');
    expect(typesRouteFile?.content).toContain("export const productsPostCreateProductBodySchema");

    // 2. Verify apps/products/src/routes/postCreateProduct.ts imports ProductsPostCreateProductResponse
    const serviceRouteFile = result.files.find(
      (f) => f.filename === "apps/products/src/routes/postCreateProduct.ts",
    );
    expect(serviceRouteFile).toBeDefined();
    expect(serviceRouteFile?.content).toContain("ProductsPostCreateProductResponse");
    expect(serviceRouteFile?.content).toContain("ProductsPostCreateProductParams");
    expect(serviceRouteFile?.content).toContain("productsPostCreateProductBodySchema");
    expect(serviceRouteFile?.content).toContain("createdProducts");
  });

  it("should handle multiple services and maintain synchronized type names without collision", () => {
    const serviceNode1: BackendNode = {
      id: "node-service-1",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Service",
        port: "8080",
      },
    };

    const serviceNode2: BackendNode = {
      id: "node-service-2",
      type: "service",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Products",
        port: "8081",
      },
    };

    const ep1: Endpoint & { nodeId: string } = {
      id: "ep-1",
      nodeId: "node-service-1",
      name: "/status",
      type: "GET",
    };

    const ep2: Endpoint & { nodeId: string } = {
      id: "ep-2",
      nodeId: "node-service-2",
      name: "/create-product",
      type: "POST",
    };

    const result = compileMonorepo(
      [serviceNode1, serviceNode2],
      [ep1, ep2],
      [],
      [],
      [],
      "MultiServiceMonorepo",
    );

    // Verify service 1 types and route
    const service1Route = result.files.find(
      (f) => f.filename === "apps/service/src/routes/getStatus.ts",
    );
    expect(service1Route).toBeDefined();
    expect(service1Route?.content).toContain("ServiceGetStatusResponse");

    const typesService1 = result.files.find(
      (f) => f.filename === "packages/types/src/service/getStatus.ts",
    );
    expect(typesService1).toBeDefined();
    expect(typesService1?.content).toContain("ServiceGetStatusResponse");

    // Verify service 2 types and route
    const service2Route = result.files.find(
      (f) => f.filename === "apps/products/src/routes/postCreateProduct.ts",
    );
    expect(service2Route).toBeDefined();
    expect(service2Route?.content).toContain("ProductsPostCreateProductResponse");

    const typesService2 = result.files.find(
      (f) => f.filename === "packages/types/src/products/postCreateProduct.ts",
    );
    expect(typesService2).toBeDefined();
    expect(typesService2?.content).toContain("ProductsPostCreateProductResponse");
  });

  it("should sanitize WebApp and WebClient slugs and clean trailing hyphens", () => {
    const webAppNode: BackendNode = {
      id: "node-webapp-1",
      type: "webApp",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Super App ",
        appSlug: "super-app-",
      },
    };

    const webClientNode: BackendNode = {
      id: "node-page-1",
      type: "webClient",
      position: { x: 0, y: 100 },
      fractionalIndex: "a1",
      data: {
        label: "Dashboard",
        appSlug: "super-app-",
      },
    };

    const result = compileMonorepo(
      [webAppNode, webClientNode],
      [],
      [],
      [],
      [],
      "WebAppSlugTest",
    );

    expect(result.webClients?.length).toBe(1);
    expect(result.webClients?.[0]?.folderName).toBe("super-app");

    const packageJsonFile = result.files.find(
      (f) => f.filename === "apps/super-app/package.json",
    );
    expect(packageJsonFile).toBeDefined();
    const pkg = JSON.parse(packageJsonFile!.content);
    expect(pkg.name).toBe("@workspace/super-app");
    expect(pkg.dependencies.zod).toBe("^3.24.2");
  });

  it("should compile four-service setup (Products, Service, Super, Super App) with full type consistency", () => {
    const serviceNode: BackendNode = {
      id: "node-service",
      type: "service",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Service",
        port: "8080",
        endpoints: [
          // Leftover legacy endpoint in data that is NOT in global endpoints
          { id: "stale-ep", name: "/create-product", type: "POST" },
        ],
      },
    };

    const productsNode: BackendNode = {
      id: "node-products",
      type: "service",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Products",
        port: "8081",
      },
    };

    const superNode: BackendNode = {
      id: "node-super",
      type: "service",
      position: { x: 400, y: 0 },
      fractionalIndex: "a2",
      data: {
        label: "Super",
        port: "8082",
      },
    };

    const superAppNode: BackendNode = {
      id: "node-super-app",
      type: "webApp",
      position: { x: 600, y: 0 },
      fractionalIndex: "a3",
      data: {
        label: "Super App",
        appSlug: "super-app",
      },
    };

    const createProductEndpoint: Endpoint & { nodeId: string } = {
      id: "ep-create-product",
      nodeId: "node-products",
      name: "/create-product",
      type: "POST",
      summary: "Create product in products service",
      requestBody: {
        id: "req-create-product",
        rawJson: JSON.stringify({ name: "Phone", price: 699 }),
      },
    };

    const result = compileMonorepo(
      [serviceNode, productsNode, superNode, superAppNode],
      [createProductEndpoint],
      [],
      [],
      [],
      "FourAppsMonorepo",
    );

    // 1. Verify types package generates products/postCreateProduct.ts with ProductsPostCreateProduct types
    const productsTypeFile = result.files.find(
      (f) => f.filename === "packages/types/src/products/postCreateProduct.ts",
    );
    expect(productsTypeFile).toBeDefined();
    expect(productsTypeFile?.content).toContain("ProductsPostCreateProductBody");
    expect(productsTypeFile?.content).toContain("ProductsPostCreateProductResponse");
    expect(productsTypeFile?.content).toContain("productsPostCreateProductBodySchema");

    // 2. Verify apps/products has postCreateProduct.ts with matching types and strictly typed error response
    const productsRouteFile = result.files.find(
      (f) => f.filename === "apps/products/src/routes/postCreateProduct.ts",
    );
    expect(productsRouteFile).toBeDefined();
    expect(productsRouteFile?.content).toContain("ProductsPostCreateProductBody");
    expect(productsRouteFile?.content).toContain("ProductsPostCreateProductErrorResponse");
    expect(productsRouteFile?.content).not.toContain("details?: any");

    // 3. Verify apps/service does NOT resurrect stale create-product endpoint and uses healthRoute instead
    const serviceRouteFile = result.files.find(
      (f) => f.filename === "apps/service/src/routes/postCreateProduct.ts",
    );
    expect(serviceRouteFile).toBeUndefined();

    const serviceHealthFile = result.files.find(
      (f) => f.filename === "apps/service/src/routes/healthRoute.ts",
    );
    expect(serviceHealthFile).toBeDefined();

    // 4. Verify apps/super uses healthRoute
    const superHealthFile = result.files.find(
      (f) => f.filename === "apps/super/src/routes/healthRoute.ts",
    );
    expect(superHealthFile).toBeDefined();

    // 5. Verify apps/super-app has package.json with zod ^3.24.2
    const superAppPkg = result.files.find(
      (f) => f.filename === "apps/super-app/package.json",
    );
    expect(superAppPkg).toBeDefined();
    const parsedPkg = JSON.parse(superAppPkg!.content);
    expect(parsedPkg.dependencies.zod).toBe("^3.24.2");
  });

  it("should generate portable ReturnType<typeof betterAuth> in lib/auth.ts to avoid TS2742 error", () => {
    const authNode: BackendNode = {
      id: "node-auth-1",
      type: "auth",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "Auth",
        framework: "better_auth",
        version: "v1.6",
      },
    };

    const webClientNode: BackendNode = {
      id: "node-web-1",
      type: "webClient",
      position: { x: 200, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "Super",
        appSlug: "super",
      },
    };

    const dbNode: BackendNode = {
      id: "node-db-1",
      type: "database",
      position: { x: 0, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "SQLite DB",
        dbEngine: "sqlite",
      },
    };

    const result = compileMonorepo(
      [authNode, webClientNode, dbNode],
      [],
      [],
      [],
      [],
      "AuthTypeMonorepo",
    );

    // 1. Verify lib/auth.ts contains typed betterAuth instance and Auth type export
    const authFile = result.files.find((f) => f.filename === "apps/super/lib/auth.ts");
    expect(authFile).toBeDefined();
    expect(authFile?.content).toContain("export const auth = betterAuth({");
    expect(authFile?.content).toContain("export type Auth = typeof auth;");

    // 2. Verify packages/db/connection.ts contains turbopackIgnore comments
    const dbConnFile = result.files.find((f) => f.filename === "packages/db/connection.ts");
    expect(dbConnFile).toBeDefined();
    expect(dbConnFile?.content).toContain("/* turbopackIgnore: true */");
  });
});
