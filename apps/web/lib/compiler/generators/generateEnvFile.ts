// ═══════════════════════════════════════════════════════════════════════════
// MODULE:  generateEnvFile
// LAYER:   generators
// PURPOSE: Collects environment variable definitions from a target app node
//          (service / webApp / langgraph) AND every package node it is
//          connected to (database, storage, redis, kafka, auth, payments),
//          then renders a structured `.env` / `.env.example` output.
//
//  Strategy:
//    1. Own envVars   — pulled directly from the app node's `data.envVars[]`
//    2. Package envVars — pulled from every directly-connected package node
//       (database, redis_instance, storage, kafka, auth, payments) via edges.
//       These are listed under a banner so the developer knows where they come
//       from (they do NOT own a .env themselves; their values land here).
//    3. Fallback inferred lines — for legacy nodes that have no envVars yet
//       (keeps existing behaviour for services with DB / Redis / etc).
// ═══════════════════════════════════════════════════════════════════════════

import { BackendNode, BackendEdge } from "@/types/canvas";
import { isServiceConnectedToStorage, toBucketKey } from "../storage/utils";
import { getDefaultNodeEnvVars } from "@workspace/canvas";

export interface EnvVarEntry {
  name: string;
  description?: string;
  /** Example / default value shown in .env.example */
  exampleValue?: string;
}

export interface EnvSection {
  /** Human-readable section heading */
  heading: string;
  /** Optional sub-heading context (e.g. package node label) */
  subheading?: string;
  vars: EnvVarEntry[];
}

// ── Package node type helpers ────────────────────────────────────────────────

const PACKAGE_NODE_TYPES = new Set([
  "database",
  "redis_instance",
  "storage",
  "kafka",
  "sqs",
  "redis-pubsub",
  "redis-streams",
  "redis-cache",
  "auth",
  "payments",
  "external",
]);

function isPackageNode(nodeType: string | undefined): boolean {
  return !!nodeType && PACKAGE_NODE_TYPES.has(nodeType);
}

export function isStorageRefNode(type?: string): boolean {
  return (
    type === "StorageBucketRefNode" ||
    type === "StorageOperationRefNode" ||
    type === "storage_bucket_ref" ||
    type === "storage_operation_ref" ||
    type === "bucket_ref" ||
    type === "storage_ref"
  );
}

export function resolveStorageNodeFromRef(
  refNode: BackendNode,
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
): BackendNode | undefined {
  const storageNodes = allNodes.filter((n) => n.type === "storage");
  if (storageNodes.length === 0) return undefined;

  // 1. Direct reference in refNode.data
  const storageId =
    refNode.data.storageNodeId ||
    refNode.data.connectedStorageNodeId;
  if (storageId) {
    const found = storageNodes.find((n) => n.id === storageId);
    if (found) return found;
  }

  // 2. Edge from StorageNode to refNode (or vice versa)
  const edgeToStorage = allEdges.find((e) => {
    if (!e) return false;
    const isTarget = e.target === refNode.id;
    const isSource = e.source === refNode.id;
    if (!isTarget && !isSource) return false;
    const otherId = isTarget ? e.source : e.target;
    return storageNodes.some((sn) => sn.id === otherId);
  });
  if (edgeToStorage) {
    const targetId = edgeToStorage.target === refNode.id ? edgeToStorage.source : edgeToStorage.target;
    const found = storageNodes.find((n) => n.id === targetId);
    if (found) return found;
  }

  // 3. Bucket matching
  const bucketKey = refNode.data.bucketId || refNode.data.bucketName;
  if (bucketKey) {
    const found = storageNodes.find((sn) =>
      sn.data.buckets?.some(
        (b) => b.id === bucketKey || b.name === bucketKey,
      ),
    );
    if (found) return found;
  }

  // 4. Default: single storage node on canvas
  if (storageNodes.length === 1) {
    return storageNodes[0];
  }

  return undefined;
}

export function isDatabaseRefNode(type?: string): boolean {
  return type === "db_ref" || type === "DatabaseTableRefNode" || type === "entity";
}

export function resolveDatabaseNodeFromRef(
  refNode: BackendNode,
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
): BackendNode | undefined {
  const dbNodes = allNodes.filter((n) => n.type === "database" && n.data?.dbEngine !== "redis");
  if (dbNodes.length === 0) return undefined;

  const dbId = refNode.data.databaseId || refNode.data.dbRef;
  if (dbId) {
    const found = dbNodes.find((n) => n.id === dbId);
    if (found) return found;
  }

  const edgeToDb = allEdges.find((e) => {
    if (!e) return false;
    const isTarget = e.target === refNode.id;
    const isSource = e.source === refNode.id;
    if (!isTarget && !isSource) return false;
    const otherId = isTarget ? e.source : e.target;
    return dbNodes.some((dn) => dn.id === otherId);
  });
  if (edgeToDb) {
    const foundId = edgeToDb.target === refNode.id ? edgeToDb.source : edgeToDb.target;
    const found = dbNodes.find((n) => n.id === foundId);
    if (found) return found;
  }

  if (dbNodes.length === 1) {
    return dbNodes[0];
  }

  return undefined;
}

export function isRedisRefNode(type?: string): boolean {
  return (
    type === "redis_schema" ||
    type === "RedisSchemaNode" ||
    type === "redis-cache" ||
    type === "redis-streams" ||
    type === "redis-pubsub"
  );
}

export function resolveRedisNodeFromRef(
  refNode: BackendNode,
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
): BackendNode | undefined {
  const redisNodes = allNodes.filter((n) => n.type === "redis_instance");
  if (redisNodes.length === 0) return undefined;

  const redisId = refNode.data.schemaRef;
  if (redisId) {
    const found = redisNodes.find((n) => n.id === redisId);
    if (found) return found;
  }

  const edgeToRedis = allEdges.find((e) => {
    if (!e) return false;
    const isTarget = e.target === refNode.id;
    const isSource = e.source === refNode.id;
    if (!isTarget && !isSource) return false;
    const otherId = isTarget ? e.source : e.target;
    return redisNodes.some((rn) => rn.id === otherId);
  });
  if (edgeToRedis) {
    const foundId = edgeToRedis.target === refNode.id ? edgeToRedis.source : edgeToRedis.target;
    const found = redisNodes.find((n) => n.id === foundId);
    if (found) return found;
  }

  if (redisNodes.length === 1) {
    return redisNodes[0];
  }

  return undefined;
}

function resolveEnvValue(name: string, packageNode?: BackendNode): string {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`dezign2app_env_${name}`);
      if (cached) return cached;
    } catch {}
  }
  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name]!;
  }

  if (packageNode?.type === "storage") {
    if (name === "AWS_REGION") {
      const r = packageNode.data.defaultRegion;
      if (r && r !== "AWS_REGION") return r;
    }
    if (name === "S3_ENDPOINT_URL" || name === "ENDPOINT_URL") {
      const u = packageNode.data.endpointUrl;
      if (u && u !== "S3_ENDPOINT_URL") return u;
    }
    if (name === (packageNode.data.accessKeyIdEnv || "AWS_ACCESS_KEY_ID")) {
      const k = packageNode.data.accessKeyId;
      if (k) return k;
    }
    if (name === (packageNode.data.secretAccessKeyEnv || "AWS_SECRET_ACCESS_KEY")) {
      const s = packageNode.data.secretAccessKey;
      if (s) return s;
    }
    if (name === "AWS_ROLE_ARN" && packageNode.data.roleArn) {
      return packageNode.data.roleArn;
    }
    if ((name === "CDN_URL" || name === "AWS_CDN_URL") && packageNode.data.cdnUrl) {
      return packageNode.data.cdnUrl;
    }
    if (name.startsWith("STORAGE_BUCKET_") && packageNode.data.buckets) {
      const bKey = name.replace("STORAGE_BUCKET_", "");
      const foundBucket = packageNode.data.buckets.find(
        (b) => toBucketKey(b.name) === bKey || toBucketKey(b.id) === bKey,
      );
      if (foundBucket?.name) return foundBucket.name;
    }
  }

  if (packageNode?.type === "database") {
    if (name === "DATABASE_URL" && packageNode.data?.connectionString) {
      return packageNode.data.connectionString;
    }
    if ((name === "DATABASE_PATH" || name === "DB_FILE_PATH") && packageNode.data?.dbFilePath) {
      return packageNode.data.dbFilePath;
    }
  }

  return "";
}

function sectionHeadingForNodeType(nodeType: string): string {
  const map: Record<string, string> = {
    database: "Database",
    redis_instance: "Redis",
    "redis-pubsub": "Redis Pub/Sub",
    "redis-streams": "Redis Streams",
    "redis-cache": "Redis Cache",
    storage: "Object Storage (S3 / R2 / MinIO)",
    kafka: "Kafka",
    sqs: "AWS SQS",
    auth: "Authentication",
    payments: "Payments",
    external: "External API",
  };
  return map[nodeType] ?? nodeType;
}

// ── Infer example values for common env var names ───────────────────────────

export function inferExampleValue(name: string, nodeType?: string): string {
  const n = name.toUpperCase();

  // Database
  if (n === "DATABASE_URL") {
    if (nodeType === "database") return "postgresql://user:password@localhost:5432/mydb";
    return "file:./local.db";
  }
  if (n === "DATABASE_PATH" || n === "DB_FILE_PATH") return "../../packages/db/sqlite.db";
  if (n === "REDIS_URL" || (n.endsWith("_URL") && n.includes("REDIS"))) return "redis://localhost:6379";
  if (n === "MONGODB_URI") return "mongodb://localhost:27017/mydb";

  // Storage
  if (n === "AWS_ACCESS_KEY_ID") return "AKIAIOSFODNN7EXAMPLE";
  if (n === "AWS_SECRET_ACCESS_KEY") return "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  if (n === "AWS_REGION") return "us-east-1";
  if (n === "S3_ENDPOINT_URL") return "https://your-custom-endpoint.com";

  // Auth
  if (n === "BETTER_AUTH_SECRET") return "your_super_secret_key_change_in_production";
  if (n === "BETTER_AUTH_URL" || n === "NEXT_PUBLIC_BETTER_AUTH_URL") return "http://localhost:3001";
  if (n === "AUTH_BASE_URL") return "http://localhost:3001";

  // Payments
  if (n.includes("CREEM") && n.includes("KEY")) return "creem_live_xxxxxxxxxxxx";
  if (n.includes("CREEM") && n.includes("SECRET")) return "whsec_xxxxxxxxxxxx";
  if (n.includes("STRIPE") && n.includes("KEY")) return "sk_test_xxxxxxxxxxxx";
  if (n.includes("STRIPE") && n.includes("SECRET")) return "whsec_xxxxxxxxxxxx";

  // Kafka
  if (n === "KAFKA_BROKERS") return "localhost:9092";
  if (n === "KAFKA_CLIENT_ID") return "my-service";

  // SQS
  if (n === "SQS_QUEUE_URL") return "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue";

  // Common
  if (n === "PORT") return "8080";
  if (n === "NODE_ENV") return "development";
  if (n === "LOG_LEVEL") return "info";
  if (n.endsWith("_BASE_URL")) return "http://localhost:8080";
  if (n.endsWith("_API_KEY")) return "your_api_key_here";

  return "";
}

// ── Core collection logic ────────────────────────────────────────────────────

export interface DetectedEnvVar {
  name: string;
  description?: string;
  exampleValue?: string;
  sourceNodeType: string;
  sourceNodeLabel: string;
  sourceNodeId: string;
}

/**
 * Discovers all environment variables declared on package nodes (storage, db, redis, auth, etc.)
 * that are connected to a target app node (directly or via reference nodes like StorageBucketRefNode).
 */
export function getDetectedPackageEnvVars(
  appNode: BackendNode,
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
  associatedNodes?: BackendNode[],
): DetectedEnvVar[] {
  const checkNodes = [appNode, ...(associatedNodes || [])];
  const detected: DetectedEnvVar[] = [];
  const seenNames = new Set<string>();
  const seenPackageNodeIds = new Set<string>();

  function collectFromPackageNode(packageNode: BackendNode) {
    if (seenPackageNodeIds.has(packageNode.id)) return;
    seenPackageNodeIds.add(packageNode.id);

    let pkgVars: EnvVarEntry[] = packageNode.data.envVars ?? [];
    if (pkgVars.length === 0) {
      const defaults = getDefaultNodeEnvVars(packageNode.type, packageNode.data);
      if (defaults && defaults.length > 0) {
        pkgVars = defaults;
      }
    }

    const extraVars: EnvVarEntry[] = [];
    if (packageNode.type === "storage" && packageNode.data.buckets) {
      packageNode.data.buckets.forEach((b) => {
        const rawName = b.name || "bucket";
        const key = toBucketKey(rawName);
        extraVars.push({
          name: `STORAGE_BUCKET_${key}`,
          description: `Bucket name for ${rawName}`,
          exampleValue: rawName,
        });
      });
    }

    const allSectionVars = [...pkgVars, ...extraVars];
    const nodeLabel = packageNode.data.label || sectionHeadingForNodeType(packageNode.type || "");

    allSectionVars.forEach((v) => {
      if (seenNames.has(v.name)) return;
      seenNames.add(v.name);
      detected.push({
        name: v.name,
        description: v.description,
        exampleValue: resolveEnvValue(v.name, packageNode) || v.exampleValue || inferExampleValue(v.name, packageNode.type),
        sourceNodeType: packageNode.type || "package",
        sourceNodeLabel: nodeLabel,
        sourceNodeId: packageNode.id,
      });
    });
  }

  // A. Traverse edges touching checkNodes
  checkNodes.forEach((currNode) => {
    allEdges.forEach((edge) => {
      if (!edge) return;
      const isSource = edge.source === currNode.id;
      const isTarget = edge.target === currNode.id;
      if (!isSource && !isTarget) return;

      const connectedId = isSource ? edge.target : edge.source;
      if (!connectedId) return;

      const connectedNode = allNodes.find((n) => n.id === connectedId);
      if (!connectedNode) return;

      if (isPackageNode(connectedNode.type)) {
        collectFromPackageNode(connectedNode);
        return;
      }

      if (isStorageRefNode(connectedNode.type)) {
        const parentStorage = resolveStorageNodeFromRef(connectedNode, allNodes, allEdges);
        if (parentStorage) {
          collectFromPackageNode(parentStorage);
        }
        return;
      }

      if (isDatabaseRefNode(connectedNode.type)) {
        const parentDb = resolveDatabaseNodeFromRef(connectedNode, allNodes, allEdges);
        if (parentDb) {
          collectFromPackageNode(parentDb);
        }
        return;
      }

      if (isRedisRefNode(connectedNode.type)) {
        const parentRedis = resolveRedisNodeFromRef(connectedNode, allNodes, allEdges);
        if (parentRedis) {
          collectFromPackageNode(parentRedis);
        }
        return;
      }
    });
  });

  // B. Storage connection resolver fallback
  const storageNodes = allNodes.filter((n) => n.type === "storage");
  storageNodes.forEach((storageNode) => {
    if (seenPackageNodeIds.has(storageNode.id)) return;
    const isConnected =
      checkNodes.some((n) => isServiceConnectedToStorage(n, allNodes, allEdges)) ||
      checkNodes.some((n) => n.data?.connectedStorageNodeId === storageNode.id);

    if (isConnected) {
      collectFromPackageNode(storageNode);
    }
  });

  // C. Database connection resolver fallback
  const dbNodes = allNodes.filter(
    (n) => n.type === "database" && n.data?.dbEngine !== "redis",
  );
  if (dbNodes.length > 0) {
    const isConnectedToDb =
      checkNodes.some((n) => n.data.databaseId || n.data.dbRef) ||
      allEdges.some(
        (e) =>
          checkNodes.some((cn) => cn.id === e.source || cn.id === e.target) &&
          (dbNodes.some((dn) => dn.id === e.source || dn.id === e.target) ||
            allNodes.some(
              (an) =>
                isDatabaseRefNode(an.type) &&
                (an.id === e.source || an.id === e.target),
            )),
      );

    if (isConnectedToDb || appNode.type === "webApp") {
      dbNodes.forEach((dbNode) => {
        if (!seenPackageNodeIds.has(dbNode.id)) {
          collectFromPackageNode(dbNode);
        }
      });
    }
  }

  return detected;
}

// ── Core collection logic ────────────────────────────────────────────────────

/**
 * Collects all env var sections for a given **app node** (service / webApp / langgraph).
 * Only variables that the user explicitly configured or imported into `appNode.data.envVars`
 * will be rendered into .env, preventing accidental exposure of root keys to client apps.
 *
 * @param appNode         - The app node being compiled (service / webApp / langgraph).
 * @param allNodes        - Full flat node list from the canvas.
 * @param allEdges        - Full edge list from the canvas.
 * @param associatedNodes - Optional array of associated nodes (e.g. WebPages in a WebApp).
 * @returns               - Ordered array of {@link EnvSection} objects, ready for rendering.
 */
export function collectEnvSections(
  appNode: BackendNode,
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
  associatedNodes?: BackendNode[],
): EnvSection[] {
  const sections: EnvSection[] = [];
  const ownVars: EnvVarEntry[] = appNode.data.envVars ?? [];
  const ownVarNames = new Set(ownVars.map((v) => v.name));

  // Detect available package environment variables
  const detectedVars = getDetectedPackageEnvVars(appNode, allNodes, allEdges, associatedNodes);
  const detectedMap = new Map<string, DetectedEnvVar>();
  detectedVars.forEach((d) => detectedMap.set(d.name, d));

  const packageSectionsMap = new Map<
    string,
    { heading: string; subheading?: string; vars: EnvVarEntry[] }
  >();
  const appVars: EnvVarEntry[] = [];

  ownVars.forEach((v) => {
    const detected = detectedMap.get(v.name);
    if (detected) {
      const pkgNode = allNodes.find((n) => n.id === detected.sourceNodeId);
      const heading = sectionHeadingForNodeType(detected.sourceNodeType);
      const subheading = detected.sourceNodeLabel
        ? `from package node: "${detected.sourceNodeLabel}"`
        : `from package node`;
      const key = `${heading}_${detected.sourceNodeId}`;

      if (!packageSectionsMap.has(key)) {
        packageSectionsMap.set(key, {
          heading,
          subheading,
          vars: [],
        });
      }
      packageSectionsMap.get(key)!.vars.push({
        name: v.name,
        description: v.description || detected.description,
        exampleValue:
          resolveEnvValue(v.name, pkgNode) ||
          v.exampleValue ||
          detected.exampleValue ||
          inferExampleValue(v.name, detected.sourceNodeType),
      });
    } else {
      appVars.push({
        name: v.name,
        description: v.description,
        exampleValue:
          resolveEnvValue(v.name, appNode) ||
          v.exampleValue ||
          inferExampleValue(v.name, appNode.type),
      });
    }
  });

  // Ensure default app vars if applicable
  if (appNode.type === "webApp" && !ownVarNames.has("NEXT_PUBLIC_LOG_LEVEL")) {
    appVars.push({
      name: "NEXT_PUBLIC_LOG_LEVEL",
      description: "Client logging level",
      exampleValue: "info",
    });
  }

  if (appVars.length > 0) {
    sections.push({
      heading: "Application",
      vars: appVars,
    });
  }

  packageSectionsMap.forEach((pkgSec) => {
    sections.push(pkgSec);
  });

  return sections;
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Renders an array of {@link EnvSection} objects into a `.env` file string.
 * Values are set to their example values (developer can edit them).
 */
export function renderEnvFile(sections: EnvSection[], comment?: string): string {
  const lines: string[] = [];

  if (comment) {
    lines.push(`# ${comment}`, "");
  }

  // Deduplicate across sections (first definition wins)
  const seen = new Set<string>();

  sections.forEach((section) => {
    const freshVars = section.vars.filter((v) => !seen.has(v.name));
    if (freshVars.length === 0) return;

    lines.push(
      `# ${'='.repeat(65)}`,
      `# ${section.heading}${section.subheading ? ` — ${section.subheading}` : ""}`,
      `# ${'='.repeat(65)}`,
    );

    freshVars.forEach((v) => {
      if (v.description) {
        lines.push(`# ${v.description}`);
      }
      lines.push(`${v.name}=${v.exampleValue ?? ""}`);
      seen.add(v.name);
    });

    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Renders an array of {@link EnvSection} objects into a `.env.example` string
 * with placeholder values and full commentary.
 */
export function renderEnvExampleFile(sections: EnvSection[], appLabel?: string): string {
  const lines: string[] = [
    "# ═══════════════════════════════════════════════════════════════════",
    `# Environment Variables${appLabel ? ` — ${appLabel}` : ""}`,
    "# Generated by Dezign2App Compiler",
    "#",
    "# Copy this file to .env and fill in the real values.",
    "# NEVER commit .env to source control — it contains secrets!",
    "# ═══════════════════════════════════════════════════════════════════",
    "",
  ];

  const seen = new Set<string>();

  sections.forEach((section) => {
    const freshVars = section.vars.filter((v) => !seen.has(v.name));
    if (freshVars.length === 0) return;

    lines.push(
      `# ─── ${section.heading}${section.subheading ? ` (${section.subheading})` : ""} ${'-'.repeat(Math.max(0, 55 - section.heading.length))}`,
    );

    freshVars.forEach((v) => {
      if (v.description) {
        lines.push(`# ${v.description}`);
      }
      lines.push(`${v.name}=${v.exampleValue ? `<${v.exampleValue}>` : "<your_value_here>"}`);
      seen.add(v.name);
    });

    lines.push("");
  });

  return lines.join("\n");
}

// ── Convenience one-shot API ─────────────────────────────────────────────────

/**
 * Builds both `.env` and `.env.example` content strings for an app node.
 *
 * @returns `{ env, envExample }` — ready to write as compiled files.
 */
export function generateEnvFilesForNode(
  appNode: BackendNode,
  allNodes: BackendNode[],
  allEdges: BackendEdge[],
  associatedNodes?: BackendNode[],
): { env: string; envExample: string } {
  const sections = collectEnvSections(appNode, allNodes, allEdges, associatedNodes);
  const label = appNode.data?.label as string | undefined;

  const env = renderEnvFile(
    sections,
    label ? `${label} — Environment Configuration` : undefined,
  );
  const envExample = renderEnvExampleFile(sections, label);

  return { env, envExample };
}
