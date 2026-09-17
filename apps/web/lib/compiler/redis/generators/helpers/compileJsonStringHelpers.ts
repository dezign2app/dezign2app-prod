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
  const getFnContent = `import { getRedisClient } from "../../client";
import { ${typeName}, get${typeName}Key, Get${typeName}Result } from "../../schemas/${varName}";

/**
 * Retrieve cached value for ${typeName}
 */
export async function get${typeName}(${keyArgsSig}): Promise<Get${typeName}Result> {
  const key = get${typeName}Key(${templateParams.join(", ")});
  try {
    const redis = await getRedisClient();
    ${
      schema.isJsonArray
        ? `const res = await redis.call("JSON.GET", key);
    if (!res || typeof res !== "string") return { success: true, data: null };
    const raw = JSON.parse(res);
    const data: ${typeName} = Array.isArray(raw) ? raw : [raw];
    return { success: true, data };`
        : `const data = await redis.get(key);
    if (!data) return { success: true, data: null };
    const parsed: ${typeName} = JSON.parse(data);
    return { success: true, data: parsed };`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_GET_ERROR",
      },
    };
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}.ts`,
    language: "typescript",
    content: getFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}";`);

  // 2. set<Name>.ts
  const setFnContent = `import { getRedisClient } from "../../client";
import {
  ${typeName},
  get${typeName}Key,
  ${typeName.toUpperCase()}_TTL_SECONDS,
  Set${typeName}Result,
} from "../../schemas/${varName}";

/**
 * Store cached value for ${typeName}
 */
export async function set${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}value: ${typeName},
  ttlSeconds: number = ${typeName.toUpperCase()}_TTL_SECONDS,
): Promise<Set${typeName}Result> {
  const key = get${typeName}Key(${templateParams.join(", ")});
  try {
    const redis = await getRedisClient();
    ${
      schema.isJsonArray
        ? `await redis.call("JSON.SET", key, "$", JSON.stringify(value));
    if (ttlSeconds > 0) {
      await redis.expire(key, ttlSeconds);
    }`
        : `const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }`
    }
    return { success: true, data: undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_SET_ERROR",
      },
    };
  }
}
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
import { ${itemType}, get${typeName}Key, Append${typeName}ItemResult } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("append${typeName}Item");

/**
 * Append an item to ${typeName} JSON Array
 */
export async function append${typeName}Item(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}item: ${itemType},
): Promise<Append${typeName}ItemResult> {
  const key = get${typeName}Key(${templateParams.join(", ")});
  try {
    const redis = await getRedisClient();
    // Ensure array root exists (upsert)
    await redis.call("JSON.SET", key, "$", "[]", "NX");
    const result = await redis.call("JSON.ARRAPPEND", key, "$", typeof item === "string" ? item : JSON.stringify(item));
    const count =
      Array.isArray(result) && typeof result[0] === "number"
        ? result[0]
        : typeof result === "number"
          ? result
          : 1;
    return { success: true, data: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to append item to JSON array \${key}\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_JSON_ARRAPPEND_ERROR",
      },
    };
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
import { ${itemType}, get${typeName}Key, GetRecent${typeName}ItemsResult } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("getRecent${typeName}Items");

/**
 * Retrieve the most recent N items from ${typeName} JSON Array
 */
export async function getRecent${typeName}Items(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}count: number = 20,
): Promise<GetRecent${typeName}ItemsResult> {
  const key = get${typeName}Key(${templateParams.join(", ")});
  try {
    const redis = await getRedisClient();
    const result = await redis.call("JSON.GET", key, "PATH", \`$[-\${count}:]\`);
    if (!result || typeof result !== "string") {
      return { success: true, data: [] };
    }
    const parsed = JSON.parse(result);
    const items: ${itemType}[] =
      Array.isArray(parsed) && Array.isArray(parsed[0])
        ? parsed[0]
        : Array.isArray(parsed)
          ? parsed
          : [];
    return { success: true, data: items };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to get recent items from JSON array \${key}\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_JSON_GET_ERROR",
      },
    };
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
import { ${itemType}, get${typeName}Key, Pop${typeName}ItemResult } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("pop${typeName}Item");

/**
 * Pop an item from ${typeName} JSON Array
 */
export async function pop${typeName}Item(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}index: number = -1,
): Promise<Pop${typeName}ItemResult> {
  const key = get${typeName}Key(${templateParams.join(", ")});
  try {
    const redis = await getRedisClient();
    const result = await redis.call("JSON.ARRPOP", key, "$", index);
    if (!result) return { success: true, data: null };
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    const data: ${itemType} | null = Array.isArray(parsed)
      ? (parsed[0] ?? null)
      : (parsed ?? null);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to pop item from JSON array \${key}\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_JSON_ARRPOP_ERROR",
      },
    };
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
import { get${typeName}Key, Get${typeName}LengthResult } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Length");

/**
 * Get length of ${typeName} JSON Array
 */
export async function get${typeName}Length(
  ${keyArgsSig ? `${keyArgsSig}` : ""}
): Promise<Get${typeName}LengthResult> {
  const key = get${typeName}Key(${templateParams.join(", ")});
  try {
    const redis = await getRedisClient();
    const result = await redis.call("JSON.ARRLEN", key, "$");
    const count =
      Array.isArray(result) && typeof result[0] === "number"
        ? result[0]
        : typeof result === "number"
          ? result
          : 0;
    return { success: true, data: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(\`Failed to get length of JSON array \${key}\`, error);
    return {
      success: false,
      error: {
        message,
        code: "REDIS_JSON_ARRLEN_ERROR",
      },
    };
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
