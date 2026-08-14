import { describe, it, expect } from "vitest";
import { compileMonorepo } from "../compileMonorepo";
import { BackendNode, BackendEdge } from "@/types/canvas";
import { Endpoint } from "@workspace/canvas/types";

describe("compileMonorepo centralized SQLite database architecture", () => {
  it("should generate centralized database connection and consistent env configs across web, services, and auth", () => {
    const webNode: BackendNode = {
      id: "node-web-1",
      type: "webClient",
      position: { x: 0, y: 0 },
      fractionalIndex: "a0",
      data: {
        label: "/dashboard",
        appSlug: "customer-portal",
        appName: "Customer Portal",
        routeGroup: "private",
        accessType: "private",
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-1",
      type: "service",
      position: { x: 400, y: 0 },
      fractionalIndex: "a1",
      data: {
        label: "OrderService",
        port: "8080",
      },
    };

    const authNode: BackendNode = {
      id: "node-auth-1",
      type: "auth",
      position: { x: 200, y: -200 },
      fractionalIndex: "a2",
      data: {
        label: "AuthServer",
        framework: "better_auth",
        version: "v1.6",
        port: "3001",
        baseUrl: "http://localhost:3001",
      },
    };

    const userEntityNode: BackendNode = {
      id: "node-entity-user",
      type: "entity",
      position: { x: 200, y: 300 },
      fractionalIndex: "a3",
      data: {
        label: "User",
        columns: [
          { name: "id", type: "string", isPrimaryKey: true },
          { name: "email", type: "string", isUnique: true, isNotNull: true },
          { name: "name", type: "string" },
        ],
      },
    };

    const endpoints: (Endpoint & { nodeId: string })[] = [
      {
        id: "ep-orders",
        nodeId: "node-service-1",
        name: "/api/orders",
        type: "GET",
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "edge-auth-web",
        source: "node-auth-1",
        target: "node-web-1",
        type: "connection",
        fractionalIndex: "a0",
      },
      {
        id: "edge-web-service",
        source: "node-web-1",
        target: "node-service-1",
        type: "connection",
        fractionalIndex: "a1",
      },
    ];

    const result = compileMonorepo(
      [webNode, serviceNode, authNode, userEntityNode],
      endpoints,
      [],
      edges,
      [],
      "TestCentralizedMonorepo",
    );

    // 1. Verify packages/db/connection.ts has centralized resolveDatabasePath
    const dbConnectionFile = result.files.find(
      (f) => f.filename === "packages/db/connection.ts",
    );
    expect(dbConnectionFile).toBeDefined();
    expect(dbConnectionFile?.content).toContain("resolveDatabasePath");
    expect(dbConnectionFile?.content).toContain("pnpm-workspace.yaml");
    expect(dbConnectionFile?.content).toContain("packages");
    expect(dbConnectionFile?.content).toContain("sqlite.db");
    expect(dbConnectionFile?.content).toContain('db.pragma("journal_mode = WAL")');
    expect(dbConnectionFile?.content).toContain('db.pragma("foreign_keys = ON")');

    // 2. Verify Web Client .env and .env.example point to centralized packages/db/sqlite.db
    const webEnvFile = result.files.find(
      (f) => f.filename === "apps/customer-portal/.env",
    );
    expect(webEnvFile).toBeDefined();
    expect(webEnvFile?.content).toContain("DATABASE_PATH=../../packages/db/sqlite.db");
    expect(webEnvFile?.content).toContain("DATABASE_URL=../../packages/db/sqlite.db");

    const webEnvExampleFile = result.files.find(
      (f) => f.filename === "apps/customer-portal/.env.example",
    );
    expect(webEnvExampleFile).toBeDefined();
    expect(webEnvExampleFile?.content).toContain("DATABASE_PATH=../../packages/db/sqlite.db");
    expect(webEnvExampleFile?.content).toContain("DATABASE_URL=../../packages/db/sqlite.db");

    // 3. Verify Backend Service .env points to centralized packages/db/sqlite.db
    const serviceEnvFile = result.files.find(
      (f) => f.filename === "apps/orderservice/.env",
    );
    expect(serviceEnvFile).toBeDefined();
    expect(serviceEnvFile?.content).toContain("DATABASE_PATH=../../packages/db/sqlite.db");
    expect(serviceEnvFile?.content).toContain("DATABASE_URL=../../packages/db/sqlite.db");

    // 4. Verify Auth is NOT compiled as a separate service app in apps/
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.name).toBe("OrderService");
    expect(result.services[0]?.folderName).toBe("orderservice");

    const authStandaloneFiles = result.files.filter(
      (f) => f.filename.startsWith("apps/authserver/") || f.filename.startsWith("apps/auth-server/"),
    );
    expect(authStandaloneFiles).toHaveLength(0);

    // 5. Verify root .gitignore ignores sqlite database artifacts
    const gitignoreFile = result.files.find((f) => f.filename === ".gitignore");
    expect(gitignoreFile).toBeDefined();
    expect(gitignoreFile?.content).toContain("*.db");
    expect(gitignoreFile?.content).toContain("*.sqlite");
    expect(gitignoreFile?.content).toContain("*.db-wal");

    // 6. Verify all apps and packages have valid tsconfig.json files
    const rootTsconfigFile = result.files.find(
      (f) => f.filename === "tsconfig.json",
    );
    expect(rootTsconfigFile).toBeDefined();
    const rootTsconfigObj = JSON.parse(rootTsconfigFile!.content);
    const refs: { path: string }[] = rootTsconfigObj.references || [];
    refs.forEach((ref) => {
      const targetTsconfig = result.files.find(
        (f) => f.filename === `${ref.path}/tsconfig.json`,
      );
      expect(targetTsconfig).toBeDefined();
    });

    // 7. Verify Next.js web client has its own integrated auth route handler, auth client, and auth.ts
    const nextAuthRoute = result.files.find(
      (f) => f.filename === "apps/customer-portal/app/api/auth/[...all]/route.ts",
    );
    expect(nextAuthRoute).toBeDefined();
    expect(nextAuthRoute?.content).toContain("toNextJsHandler");

    const nextAuthLib = result.files.find(
      (f) => f.filename === "apps/customer-portal/lib/auth.ts",
    );
    expect(nextAuthLib).toBeDefined();
    expect(nextAuthLib?.content).toContain("betterAuth");

    const nextAuthClient = result.files.find(
      (f) => f.filename === "apps/customer-portal/lib/auth-client.ts",
    );
    expect(nextAuthClient).toBeDefined();
    expect(nextAuthClient?.content).toContain("createAuthClient");
  });
});
