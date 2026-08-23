import { describe, it, expect } from "vitest";
import { compileRedisNodes, isServiceConnectedToRedis } from "../compileRedisNodes";
import { compileMonorepo } from "../compileMonorepo";
import { BackendNode, BackendEdge } from "@workspace/canvas/types";

describe("compileRedisNodes", () => {
  it("compiles Redis instance with separated schemas (src/schemas) and per-function helper folder structure (src/helpers/<cacheName>/<functionName>.ts)", () => {
    const nodes: BackendNode[] = [
      {
        id: "redis-1",
        type: "redis_instance",
        data: {
          label: "Primary_Redis_Cache",
          host: "localhost",
          port: 6379,
        },
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
      },
      {
        id: "schema-1",
        type: "redis_schema",
        data: {
          label: "ProductsCache",
          redisDataStructure: "hash",
          keyTemplate: "product:{id}:details",
          databaseId: "redis-1",
        },
        position: { x: 100, y: 100 },
        fractionalIndex: "a1",
      },
    ];

    const result = compileRedisNodes(nodes);
    expect(result.packageFolder).toBe("primary-redis-cache");
    expect(result.packageName).toBe("@workspace/primary-redis-cache");
    expect(result.packages).toHaveLength(1);

    const pkg = result.packages![0]!;
    expect(pkg.packageFolder).toBe("primary-redis-cache");
    expect(pkg.packageName).toBe("@workspace/primary-redis-cache");
    expect(pkg.redisLabel).toBe("Primary_Redis_Cache");

    const packageJsonFile = pkg.files.find((f) => f.filename === "package.json");
    expect(packageJsonFile).toBeDefined();
    const parsedPkg = JSON.parse(packageJsonFile!.content);
    expect(parsedPkg.name).toBe("@workspace/primary-redis-cache");
    expect(parsedPkg.exports["./schemas"]).toBe("./src/schemas/index.ts");
    expect(parsedPkg.exports["./helpers"]).toBe("./src/helpers/index.ts");

    // Check config.ts for instance-scoped settings
    const configFile = pkg.files.find((f) => f.filename === "src/config.ts");
    expect(configFile).toBeDefined();
    expect(configFile!.content).toContain('label: "Primary_Redis_Cache"');
    expect(configFile!.content).toContain('connectionEnv: "PRIMARY_REDIS_CACHE_URL"');
    expect(configFile!.content).toContain('defaultPort: 6379');

    // 1. Schema File (src/schemas/productsCache.ts) — Data definitions only
    const schemaFile = pkg.files.find((f) => f.filename === "src/schemas/productsCache.ts");
    expect(schemaFile).toBeDefined();
    expect(schemaFile!.content).toContain("export interface ProductsCache");
    expect(schemaFile!.content).toContain("PRODUCTSCACHE_KEY_PATTERN");
    expect(schemaFile!.content).toContain("PRODUCTSCACHE_TTL_SECONDS");
    expect(schemaFile!.content).toContain("export function getProductsCacheKey");
    // Should NOT contain Redis client or DB calls directly in schema file
    expect(schemaFile!.content).not.toContain("getRedisClient");
    expect(schemaFile!.content).not.toContain("rawGetCache");

    // 2. Individual Function Helper Files in src/helpers/<cacheName>/<functionName>.ts
    const getFnFile = pkg.files.find((f) => f.filename === "src/helpers/productsCache/getProductsCache.ts");
    expect(getFnFile).toBeDefined();
    expect(getFnFile!.content).toContain('from "../../schemas/productsCache"');
    expect(getFnFile!.content).toContain("export async function getProductsCache");

    const setFnFile = pkg.files.find((f) => f.filename === "src/helpers/productsCache/setProductsCache.ts");
    expect(setFnFile).toBeDefined();
    expect(setFnFile!.content).toContain("export async function setProductsCache");

    const getFieldFnFile = pkg.files.find((f) => f.filename === "src/helpers/productsCache/getProductsCacheField.ts");
    expect(getFieldFnFile).toBeDefined();
    expect(getFieldFnFile!.content).toContain("export async function getProductsCacheField");

    const setFieldFnFile = pkg.files.find((f) => f.filename === "src/helpers/productsCache/setProductsCacheField.ts");
    expect(setFieldFnFile).toBeDefined();
    expect(setFieldFnFile!.content).toContain("export async function setProductsCacheField");

    const invalidateFnFile = pkg.files.find((f) => f.filename === "src/helpers/productsCache/invalidateProductsCache.ts");
    expect(invalidateFnFile).toBeDefined();
    expect(invalidateFnFile!.content).toContain("export async function invalidateProductsCache");

    // 3. Cache-level and top-level Barrels
    const cacheHelperIndex = pkg.files.find((f) => f.filename === "src/helpers/productsCache/index.ts");
    expect(cacheHelperIndex).toBeDefined();
    expect(cacheHelperIndex!.content).toContain('export * from "./getProductsCache"');
    expect(cacheHelperIndex!.content).toContain('export * from "./setProductsCache"');
    expect(cacheHelperIndex!.content).not.toContain('export * from "./getAllProductsCacheFields"');
    expect(cacheHelperIndex!.content).not.toContain('export * from "./setProductsCacheFields"');
    expect(cacheHelperIndex!.content).not.toContain('export * from "./deleteProductsCache"');

    const schemaIndexFile = pkg.files.find((f) => f.filename === "src/schemas/index.ts");
    expect(schemaIndexFile).toBeDefined();
    expect(schemaIndexFile!.content).toContain('export * from "./productsCache"');

    const helperIndexFile = pkg.files.find((f) => f.filename === "src/helpers/index.ts");
    expect(helperIndexFile).toBeDefined();
    expect(helperIndexFile!.content).toContain('export * from "./productsCache"');

    const indexFile = pkg.files.find((f) => f.filename === "src/index.ts");
    expect(indexFile).toBeDefined();
    expect(indexFile!.content).toContain('export * from "./schemas"');
    expect(indexFile!.content).toContain('export * from "./helpers"');

    // Check client.ts
    const clientFile = pkg.files.find((f) => f.filename === "src/client.ts");
    expect(clientFile).toBeDefined();
    expect(clientFile!.content).toContain('createLogger("Redis [Primary_Redis_Cache]")');

    // Check reusable functions import path
    expect(pkg.reusableFunctions.length).toBeGreaterThan(0);
    pkg.reusableFunctions.forEach((fn) => {
      expect(fn.importPath).toBe("@workspace/primary-redis-cache");
    });
  });

  it("compiles multiple Redis instances with per-cache helper folders", () => {
    const nodes: BackendNode[] = [
      {
        id: "redis-1",
        type: "redis_instance",
        data: { label: "Primary_Redis_Cache", port: 6379 },
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
      },
      {
        id: "redis-2",
        type: "redis_instance",
        data: { label: "Session_Redis", port: 6380 },
        position: { x: 300, y: 0 },
        fractionalIndex: "a1",
      },
      {
        id: "schema-1",
        type: "redis_schema",
        data: { label: "ProductsCache", databaseId: "redis-1" },
        position: { x: 0, y: 100 },
        fractionalIndex: "a2",
      },
      {
        id: "schema-2",
        type: "redis_schema",
        data: { label: "UserSession", databaseId: "redis-2" },
        position: { x: 300, y: 100 },
        fractionalIndex: "a3",
      },
    ];

    const result = compileRedisNodes(nodes);
    expect(result.packages).toHaveLength(2);

    const pkg1 = result.packages?.find((p) => p.packageFolder === "primary-redis-cache");
    const pkg2 = result.packages?.find((p) => p.packageFolder === "session-redis");
    expect(pkg1).toBeDefined();
    expect(pkg2).toBeDefined();

    expect(pkg1!.packageName).toBe("@workspace/primary-redis-cache");
    expect(pkg2!.packageName).toBe("@workspace/session-redis");

    // ProductsCache schema & helpers folder should only be in pkg1
    expect(pkg1!.files.some((f) => f.filename === "src/schemas/productsCache.ts")).toBe(true);
    expect(pkg1!.files.some((f) => f.filename === "src/helpers/productsCache/getProductsCache.ts")).toBe(true);
    expect(pkg1!.files.some((f) => f.filename === "src/helpers/productsCache/index.ts")).toBe(true);
    expect(pkg1!.files.some((f) => f.filename.includes("userSession"))).toBe(false);

    // UserSession schema & helpers folder should only be in pkg2
    expect(pkg2!.files.some((f) => f.filename === "src/schemas/userSession.ts")).toBe(true);
    expect(pkg2!.files.some((f) => f.filename === "src/helpers/userSession/getUserSession.ts")).toBe(true);
    expect(pkg2!.files.some((f) => f.filename === "src/helpers/userSession/index.ts")).toBe(true);
    expect(pkg2!.files.some((f) => f.filename.includes("productsCache"))).toBe(false);
  });

  it("adds @workspace/primary-redis-cache to service package.json when service is connected to redis", () => {
    const nodes: BackendNode[] = [
      {
        id: "redis-1",
        type: "redis_instance",
        data: { label: "Primary_Redis_Cache", port: 6379 },
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
      },
      {
        id: "schema-1",
        type: "redis_schema",
        data: { label: "UserCache", databaseId: "redis-1" },
        position: { x: 100, y: 100 },
        fractionalIndex: "a1",
      },
      {
        id: "srv-1",
        type: "service",
        data: {
          label: "products",
          port: "8080",
          endpoints: [
            {
              id: "ep-1",
              name: "/create-product",
              type: "POST",
              crudOperations: { "schema-1": ["create"] },
            },
          ],
        },
        position: { x: 200, y: 200 },
        fractionalIndex: "a2",
      },
    ];

    const edges: BackendEdge[] = [
      {
        id: "e-1",
        source: "srv-1",
        target: "schema-1",
        type: "connection",
        fractionalIndex: "a0",
      },
    ];

    expect(isServiceConnectedToRedis(nodes[2]!, nodes, edges, [])).toBe(true);

    const monorepo = compileMonorepo(nodes, [], [], edges, [], "test-project");
    const servicePkgFile = monorepo.files.find((f) => f.filename === "apps/products/package.json");
    expect(servicePkgFile).toBeDefined();
    const servicePkg = JSON.parse(servicePkgFile!.content);
    expect(servicePkg.dependencies["@workspace/primary-redis-cache"]).toBe("workspace:*");

    const redisPkgFile = monorepo.files.find((f) => f.filename === "packages/primary-redis-cache/package.json");
    expect(redisPkgFile).toBeDefined();

    // Check helper file presence in monorepo
    const helperFnFile = monorepo.files.find((f) => f.filename === "packages/primary-redis-cache/src/helpers/userCache/getUserCache.ts");
    expect(helperFnFile).toBeDefined();

    const rootTsConfigFile = monorepo.files.find((f) => f.filename === "tsconfig.json");
    expect(rootTsConfigFile).toBeDefined();
    const rootTsConfig = JSON.parse(rootTsConfigFile!.content);
    expect(rootTsConfig.references).toContainEqual({ path: "packages/primary-redis-cache" });
  });
});
