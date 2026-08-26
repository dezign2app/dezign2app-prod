import { BackendNode, BackendEdge } from "@/types/canvas";
import {
  CompiledFile,
  CompiledRedisResult,
  CompiledRedisPackage,
  ReusableFunction,
} from "@workspace/canvas/types";
import { toFolderName } from "../utils";
import {
  generatePackageJson,
  generateTsConfig,
  generateDockerCompose,
} from "./generators/packageFiles";
import {
  generateConfig,
  generateClient,
  generateCache,
  generatePubSub,
  generateStreams,
  generateIndex,
} from "./generators/clientFiles";
import {
  generateSchemaModule,
  generateSchemasIndex,
} from "./generators/schemaFiles";
import {
  generateHelperFilesForSchema,
  generateHelpersIndex,
} from "./generators/helperFiles";

export { isServiceConnectedToRedis } from "./isServiceConnectedToRedis";
export * from "./utils";

/**
 * Compiles Redis nodes into modular shared microservices packages:
 * Generates one dedicated package per Redis instance (e.g. packages/primary-redis-cache),
 * with schemas in src/schemas/ and per-function helper files in src/helpers/<cacheName>/<functionName>.ts.
 */
export function compileRedisNodes(
  allNodes: BackendNode[],
  allEdges: BackendEdge[] = [],
): CompiledRedisResult {
  const redisInstances = allNodes.filter(
    (n) =>
      n.type === "redis_instance" ||
      (n.type === "database" &&
        (n.data?.dbEngine === "redis" || n.data?.dbType === "redis")),
  );

  const redisSchemas = allNodes.filter(
    (n) =>
      n.type === "redis_schema" ||
      (n.type === "entity" && n.data?.dbType === "redis"),
  );

  const redisMessaging = allNodes.filter(
    (n) =>
      n.type === "redis-streams" ||
      n.type === "redis-pubsub" ||
      n.type === "redis-cache",
  );

  const totalRedisNodes =
    redisInstances.length + redisSchemas.length + redisMessaging.length;
  if (totalRedisNodes === 0) {
    return { files: [], packages: [], reusableFunctions: [] };
  }

  // 1. Resolve Effective Redis Instances
  const effectiveInstances: BackendNode[] =
    redisInstances.length > 0
      ? [...redisInstances]
      : [
          {
            id: "synthetic-redis",
            type: "redis_instance",
            position: { x: 0, y: 0 },
            fractionalIndex: "a0",
            data: {
              label: "redis",
              host: "localhost",
              port: 6379,
            },
          },
        ];

  // 2. Map schemas to instances
  const schemasByInstanceId = new Map<string, BackendNode[]>();
  effectiveInstances.forEach((inst) => {
    schemasByInstanceId.set(inst.id, []);
    const altId = inst.nodeId;
    if (altId && altId !== inst.id) {
      schemasByInstanceId.set(altId, schemasByInstanceId.get(inst.id)!);
    }
  });

  const primaryInstanceNode =
    effectiveInstances.find((d) => d.data?.isDefault) || effectiveInstances[0]!;

  redisSchemas.forEach((schemaNode) => {
    const schemaId = schemaNode.id || schemaNode.nodeId;
    let targetInstId = schemaNode.data?.databaseId;

    if (!targetInstId) {
      const connEdge = allEdges.find(
        (e) =>
          ((e.source === schemaId || e.source === schemaNode.id) &&
            effectiveInstances.some(
              (inst) => inst.id === e.target || inst.nodeId === e.target,
            )) ||
          ((e.target === schemaId || e.target === schemaNode.id) &&
            effectiveInstances.some(
              (inst) => inst.id === e.source || inst.nodeId === e.source,
            )),
      );
      if (connEdge) {
        targetInstId =
          connEdge.source === schemaId || connEdge.source === schemaNode.id
            ? connEdge.target
            : connEdge.source;
      }
    }

    if (!targetInstId || !schemasByInstanceId.has(targetInstId)) {
      targetInstId = primaryInstanceNode.id;
    }

    const bucket = schemasByInstanceId.get(targetInstId);
    if (bucket && !bucket.includes(schemaNode)) {
      bucket.push(schemaNode);
    }
  });

  // 3. Compile each Redis instance into its dedicated package
  const existingFolders = new Set<string>();
  const packages: CompiledRedisPackage[] = [];
  const mergedFiles: CompiledFile[] = [];
  const allReusableFunctions: ReusableFunction[] = [];

  effectiveInstances.forEach((inst) => {
    const rawLabel = inst.data?.label || "redis";
    const baseFolder = toFolderName(rawLabel) || "redis";
    let packageFolder = baseFolder;
    let counter = 1;
    while (existingFolders.has(packageFolder)) {
      counter++;
      packageFolder = `${baseFolder}-${counter}`;
    }
    existingFolders.add(packageFolder);

    const packageName = `@workspace/${packageFolder}`;
    const instanceSchemas = schemasByInstanceId.get(inst.id) || [];

    const instLabel = inst.data?.label || packageFolder;
    const instHost = inst.data?.host || "localhost";
    const instPort = inst.data?.port ? Number(inst.data.port) : 6379;
    const instEnvKey =
      inst.data?.connectionStringEnv ||
      (packageFolder === "redis"
        ? "REDIS_URL"
        : `${packageFolder.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_URL`);
    const maxmemoryPolicy = inst.data?.maxmemoryPolicy || "volatile-lru";
    const maxmemory = inst.data?.maxmemory || "2gb";
    const persistenceMode = inst.data?.persistenceMode || "RDB+AOF";

    const instanceFiles: CompiledFile[] = [];
    const instanceReusableFunctions: ReusableFunction[] = [];

    // 3.1. package.json
    instanceFiles.push(generatePackageJson(packageName, instLabel));

    // 3.2. tsconfig.json
    instanceFiles.push(generateTsConfig());

    // 3.3. src/config.ts
    instanceFiles.push(
      generateConfig(
        inst,
        instLabel,
        instEnvKey,
        instHost,
        instPort,
        maxmemoryPolicy,
        maxmemory,
        persistenceMode,
        instanceSchemas,
      ),
    );

    // 3.4. src/client.ts
    instanceFiles.push(generateClient(instLabel));

    // 3.5. src/cache.ts
    instanceFiles.push(generateCache(instLabel));

    // 3.6. src/pubsub.ts
    instanceFiles.push(generatePubSub(instLabel));

    // 3.7. src/streams.ts
    instanceFiles.push(generateStreams(instLabel));

    // 3.8. Schemas & Helpers
    const schemaBarrelExports: string[] = [];
    const helperBarrelExports: string[] = [];

    instanceSchemas.forEach((schemaNode) => {
      const generatedSchema = generateSchemaModule(schemaNode);
      instanceFiles.push(generatedSchema.file);
      schemaBarrelExports.push(`export * from "./${generatedSchema.varName}";`);

      const helpersResult = generateHelperFilesForSchema(
        generatedSchema,
        schemaNode,
        allNodes,
        packageName,
      );
      instanceFiles.push(...helpersResult.files);
      instanceReusableFunctions.push(...helpersResult.reusableFunctions);
      helperBarrelExports.push(helpersResult.helperBarrelExport);
    });

    // 3.9. src/schemas/index.ts
    instanceFiles.push(generateSchemasIndex(schemaBarrelExports, instLabel));

    // 3.10. src/helpers/index.ts
    instanceFiles.push(generateHelpersIndex(helperBarrelExports, instLabel));

    // 3.11. src/index.ts
    instanceFiles.push(
      generateIndex(instLabel, packageName, instanceSchemas.length > 0),
    );

    // 3.12. docker-compose.yml
    instanceFiles.push(
      generateDockerCompose(
        packageFolder,
        instPort,
        maxmemory,
        maxmemoryPolicy,
        persistenceMode,
      ),
    );

    // Merge into top-level files
    instanceFiles.forEach((f) => {
      mergedFiles.push({
        filename: `packages/${packageFolder}/${f.filename}`,
        language: f.language,
        content: f.content,
      });
    });

    allReusableFunctions.push(...instanceReusableFunctions);

    packages.push({
      packageName,
      packageFolder,
      redisNodeId: inst.id,
      redisLabel: instLabel,
      files: instanceFiles,
      reusableFunctions: instanceReusableFunctions,
    });
  });

  return {
    packages,
    files: mergedFiles,
    reusableFunctions: allReusableFunctions,
    packageFolder: packages[0]?.packageFolder || "redis",
    packageName: packages[0]?.packageName || "@workspace/redis",
  };
}
