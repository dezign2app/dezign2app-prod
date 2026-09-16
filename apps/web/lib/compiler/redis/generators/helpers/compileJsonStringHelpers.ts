// ═══════════════════════════════════════════════════════════════
// MODULE: CompileJsonStringHelpers
// LAYER:  redis / generators / helpers
// EMITS:  String, JSON object, and JSON array Redis helpers
// ═══════════════════════════════════════════════════════════════

import { HelperContext, HelperEmitResult } from "./types";

export function compileJsonStringHelpers(ctx: HelperContext): HelperEmitResult {
  const { schema } = ctx;
  const { varName, typeName, dataStructure, templateParams, keyArgsSig } = schema;
  const files: HelperEmitResult["files"] = [];
  const barrelExports: string[] = [];

  // 1. get<Name>.ts
  const getFnContent = `import { getCache as rawGetCache } from "../../cache";
import { ${typeName}, get${typeName}Key } from "../../schemas/${varName}";

/**
 * Retrieve cached value for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<${typeName} | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return rawGetCache<${typeName}>(key);
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}.ts`,
    language: "typescript",
    content: getFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}";`);

  // 2. set<Name>.ts
  const setFnContent = `import { setCache as rawSetCache } from "../../cache";
import {
  ${typeName},
  get${typeName}Key,
  ${typeName.toUpperCase()}_TTL_SECONDS,
} from "../../schemas/${varName}";

/**
 * Store cached value for ${typeName}
 */
${keyArgsSig ? `export async function set${typeName}<T = ${typeName}>(value: T, ttlSeconds?: number | { ttl?: number }): Promise<void>;
export async function set${typeName}<T = ${typeName}>(${keyArgsSig}, value: T, ttlSeconds?: number | { ttl?: number }): Promise<void>;
export async function set${typeName}<T = ${typeName}>(options: { key?: string | number; id?: string | number; value?: T; data?: T; ttlSeconds?: number; ttl?: number }): Promise<void>;
export async function set${typeName}<T = ${typeName}>(
  arg1: (string | number) | T | { key?: string | number; id?: string | number; value?: T; data?: T; ttlSeconds?: number; ttl?: number },
  arg2?: T | number | { ttl?: number },
  arg3?: number | { ttl?: number },
): Promise<void> {
  const isOptions = arg2 === undefined && typeof arg1 === "object" && arg1 !== null && ("key" in arg1 || "id" in arg1 || "value" in arg1 || "data" in arg1);
  let id: string | number;
  let value: T;
  let rawTtl: number | { ttl?: number } | undefined;
  if (isOptions) {
    const opts = arg1 as { key?: string | number; id?: string | number; value?: T; data?: T; ttlSeconds?: number; ttl?: number };
    id = (opts.key ?? opts.id ?? "default") as string | number;
    value = (opts.value ?? opts.data) as T;
    rawTtl = opts.ttlSeconds ?? opts.ttl;
  } else if (typeof arg2 === "number" || (typeof arg2 === "object" && arg2 !== null && "ttl" in arg2) || arg2 === undefined) {
    const rec = arg1 as { id?: string | number; _id?: string | number };
    id = (rec?.id ?? rec?._id ?? "default") as string | number;
    value = arg1 as T;
    rawTtl = arg2 as number | { ttl?: number } | undefined;
  } else {
    id = arg1 as string | number;
    value = arg2 as T;
    rawTtl = arg3;
  }
  const ttlSeconds = typeof rawTtl === "number" ? rawTtl : typeof rawTtl === "object" && rawTtl !== null && typeof rawTtl.ttl === "number" ? rawTtl.ttl : ${typeName.toUpperCase()}_TTL_SECONDS;
  const key = get${typeName}Key(${templateParams.length === 1 ? `id as string | number` : templateParams.map((_, i) => i === 0 ? `id as string | number` : `"default"`).join(", ")});
  const cacheValue = ${schema.isJsonArray ? `Array.isArray(value) ? value : [value]` : `value`};
  return rawSetCache(key, cacheValue, ttlSeconds);
}` : `export async function set${typeName}<T = ${typeName}>(
  value: T,
  ttlSeconds?: number | { ttl?: number },
): Promise<void> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  const resolvedTtl = typeof ttlSeconds === "number" ? ttlSeconds : typeof ttlSeconds === "object" && ttlSeconds !== null && typeof ttlSeconds.ttl === "number" ? ttlSeconds.ttl : ${typeName.toUpperCase()}_TTL_SECONDS;
  const cacheValue = ${schema.isJsonArray ? `Array.isArray(value) ? value : [value]` : `value`};
  return rawSetCache(key, cacheValue, resolvedTtl);
}`}
`;
  files.push({
    filename: `src/helpers/${varName}/set${typeName}.ts`,
    language: "typescript",
    content: setFnContent,
  });
  barrelExports.push(`export * from "./set${typeName}";`);

  // 3. JSON Array Helpers (appendItem, getRecentItems, popItem, getLength)
  if (dataStructure === "json" && schema.isJsonArray && schema.itemTypeName) {
    const itemType = schema.itemTypeName;

    // append<Name>Item.ts
    const appendFnContent = `import { getRedisClient } from "../../client";
import { ${itemType}, get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("append${typeName}Item");

/**
 * Append an item to ${typeName} JSON Array
 */
${keyArgsSig ? `export async function append${typeName}Item(item: ${itemType}): Promise<number>;
export async function append${typeName}Item(${keyArgsSig}, item: ${itemType}): Promise<number>;
export async function append${typeName}Item(options: { key?: string | number; id?: string | number; item?: ${itemType}; value?: ${itemType}; [k: string]: unknown }): Promise<number>;
export async function append${typeName}Item(
  arg1: (string | number) | ${itemType} | { key?: string | number; id?: string | number; item?: ${itemType}; value?: ${itemType}; [k: string]: unknown },
  arg2?: ${itemType},
): Promise<number> {
  const isOptions = arg2 === undefined && typeof arg1 === "object" && arg1 !== null && ("key" in arg1 || "id" in arg1 || "item" in arg1 || "value" in arg1);
  let id: string | number;
  let item: ${itemType};
  if (isOptions) {
    const opts = arg1 as Record<string, unknown>;
    id = (opts.key ?? opts.id ?? "default") as string | number;
    item = (opts.item ?? opts.value ?? opts) as ${itemType};
  } else if (arg2 === undefined) {
    const rec = arg1 as Record<string, unknown>;
    id = (rec?.id ?? rec?.conversationId ?? rec?._id ?? "default") as string | number;
    item = arg1 as ${itemType};
  } else {
    id = arg1 as string | number;
    item = arg2 as ${itemType};
  }
  const key = get${typeName}Key(${templateParams.length === 1 ? `id as string | number` : templateParams.map((_, i) => i === 0 ? `id as string | number` : `"default"`).join(", ")});` : `export async function append${typeName}Item(item: ${itemType}): Promise<number>;
export async function append${typeName}Item(options: { item?: ${itemType}; value?: ${itemType}; [k: string]: unknown }): Promise<number>;
export async function append${typeName}Item(
  arg1: ${itemType} | { item?: ${itemType}; value?: ${itemType}; [k: string]: unknown },
): Promise<number> {
  const isOptions = typeof arg1 === "object" && arg1 !== null && ("item" in arg1 || "value" in arg1);
  const item = isOptions
    ? (((arg1 as Record<string, unknown>).item ?? (arg1 as Record<string, unknown>).value) as ${itemType})
    : (arg1 as ${itemType});
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});`}
  try {
    const redis = await getRedisClient();
    // Ensure array root exists (upsert)
    await redis.call("JSON.SET", key, "$", "[]", "NX");
    const result = await redis.call("JSON.ARRAPPEND", key, "$", typeof item === "string" ? item : JSON.stringify(item));
    if (Array.isArray(result)) return (result[0] as number) || 1;
    return typeof result === "number" ? result : 1;
  } catch (error) {
    logger.error(\`Failed to append item to JSON array \${key}\`, error);
    throw error;
  }
}
`;
    files.push({
      filename: `src/helpers/${varName}/append${typeName}Item.ts`,
      language: "typescript",
      content: appendFnContent,
    });
    barrelExports.push(`export * from "./append${typeName}Item";`);

    // getRecent<Name>Items.ts
    const getRecentFnContent = `import { getRedisClient } from "../../client";
import { ${itemType}, get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("getRecent${typeName}Items");

/**
 * Retrieve the most recent N items from ${typeName} JSON Array
 */
${keyArgsSig ? `export async function getRecent${typeName}Items(count?: number): Promise<${itemType}[]>;
export async function getRecent${typeName}Items(${keyArgsSig}, count?: number): Promise<${itemType}[]>;
export async function getRecent${typeName}Items(options: { key?: string | number; id?: string | number; count?: number; [k: string]: unknown }): Promise<${itemType}[]>;
export async function getRecent${typeName}Items(
  arg1?: (string | number) | { key?: string | number; id?: string | number; count?: number; [k: string]: unknown },
  arg2?: number,
): Promise<${itemType}[]> {
  const isOptions = arg2 === undefined && typeof arg1 === "object" && arg1 !== null;
  const isSingleArgCount = typeof arg1 === "number" && arg2 === undefined;
  let id: string | number;
  let count: number;
  if (isOptions) {
    const opts = arg1 as Record<string, unknown>;
    id = (opts.key ?? opts.id ?? "default") as string | number;
    count = typeof opts.count === "number" ? opts.count : 20;
  } else {
    id = isSingleArgCount || arg1 === undefined ? "default" : (arg1 as string | number);
    count = (isSingleArgCount ? arg1 : arg2) ?? 20;
  }
  const key = get${typeName}Key(${templateParams.length === 1 ? `id as string | number` : templateParams.map((_, i) => i === 0 ? `id as string | number` : `"default"`).join(", ")});` : `export async function getRecent${typeName}Items(
  count: number = 20,
): Promise<${itemType}[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});`}
  try {
    const redis = await getRedisClient();
    const result = await redis.call("JSON.GET", key, "PATH", \`$[-\${count}:]\`);
    if (!result) return [];
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return [];
    return (Array.isArray(parsed[0]) ? parsed[0] : parsed) as ${itemType}[];
  } catch (error) {
    logger.error(\`Failed to get recent items from JSON array \${key}\`, error);
    return [];
  }
}
`;
    files.push({
      filename: `src/helpers/${varName}/getRecent${typeName}Items.ts`,
      language: "typescript",
      content: getRecentFnContent,
    });
    barrelExports.push(`export * from "./getRecent${typeName}Items";`);

    // pop<Name>Item.ts
    const popFnContent = `import { getRedisClient } from "../../client";
import { ${itemType}, get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("pop${typeName}Item");

/**
 * Pop an item from ${typeName} JSON Array
 */
${keyArgsSig ? `export async function pop${typeName}Item(index?: number): Promise<${itemType} | null>;
export async function pop${typeName}Item(${keyArgsSig}, index?: number): Promise<${itemType} | null>;
export async function pop${typeName}Item(
  arg1?: (string | number),
  arg2?: number,
): Promise<${itemType} | null> {
  const isSingleArgIndex = typeof arg1 === "number" && arg2 === undefined;
  const id = isSingleArgIndex || arg1 === undefined ? "default" : arg1;
  const index = (isSingleArgIndex ? arg1 : arg2) ?? -1;
  const key = get${typeName}Key(${templateParams.length === 1 ? `id as string | number` : templateParams.map((_, i) => i === 0 ? `id as string | number` : `"default"`).join(", ")});` : `export async function pop${typeName}Item(
  index: number = -1,
): Promise<${itemType} | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});`}
  try {
    const redis = await getRedisClient();
    const result = await redis.call("JSON.ARRPOP", key, "$", index);
    if (!result) return null;
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    if (Array.isArray(parsed)) return (parsed[0] as ${itemType}) ?? null;
    return parsed as ${itemType};
  } catch (error) {
    logger.error(\`Failed to pop item from JSON array \${key}\`, error);
    return null;
  }
}
`;
    files.push({
      filename: `src/helpers/${varName}/pop${typeName}Item.ts`,
      language: "typescript",
      content: popFnContent,
    });
    barrelExports.push(`export * from "./pop${typeName}Item";`);

    // get<Name>Length.ts
    const getArrLenFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Length");

/**
 * Get length of ${typeName} JSON Array
 */
${keyArgsSig ? `export async function get${typeName}Length(): Promise<number>;
export async function get${typeName}Length(${keyArgsSig}): Promise<number>;
export async function get${typeName}Length(arg1?: (string | number)): Promise<number> {
  const id = arg1 ?? "default";
  const key = get${typeName}Key(${templateParams.length === 1 ? `id as string | number` : templateParams.map((_, i) => i === 0 ? `id as string | number` : `"default"`).join(", ")});` : `export async function get${typeName}Length(): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});`}
  try {
    const redis = await getRedisClient();
    const result = await redis.call("JSON.ARRLEN", key, "$");
    if (Array.isArray(result)) return (result[0] as number) || 0;
    return typeof result === "number" ? result : 0;
  } catch (error) {
    logger.error(\`Failed to get length of JSON array \${key}\`, error);
    return 0;
  }
}
`;
    files.push({
      filename: `src/helpers/${varName}/get${typeName}Length.ts`,
      language: "typescript",
      content: getArrLenFnContent,
    });
    barrelExports.push(`export * from "./get${typeName}Length";`);
  }

  return { files, barrelExports };
}
