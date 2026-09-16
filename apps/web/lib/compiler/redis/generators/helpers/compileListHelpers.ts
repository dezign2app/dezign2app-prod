// ═══════════════════════════════════════════════════════════════
// MODULE: CompileListHelpers
// LAYER:  redis / generators / helpers
// EMITS:  List-specific Redis helpers (push, pop, getList, getLength)
// ═══════════════════════════════════════════════════════════════

import { HelperContext, HelperEmitResult } from "./types";

export function compileListHelpers(ctx: HelperContext): HelperEmitResult {
  const { varName, typeName, templateParams, keyArgsSig } = ctx.schema;
  const files: HelperEmitResult["files"] = [];
  const barrelExports: string[] = [];

  // 1. push<Name>.ts
  const pushFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("push${typeName}");

/**
 * Push items to ${typeName} List
 */
export async function push${typeName}(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  ...items: string[]
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.rpush(key, ...items);
  } catch (error) {
    logger.error(\`Failed to push items to List \${key}\`, error);
    throw error;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/push${typeName}.ts`,
    language: "typescript",
    content: pushFnContent,
  });
  barrelExports.push(`export * from "./push${typeName}";`);

  // 2. pop<Name>.ts
  const popFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("pop${typeName}");

/**
 * Pop item from ${typeName} List
 */
export async function pop${typeName}(${keyArgsSig}): Promise<string | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.lpop(key);
  } catch (error) {
    logger.error(\`Failed to pop from List \${key}\`, error);
    return null;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/pop${typeName}.ts`,
    language: "typescript",
    content: popFnContent,
  });
  barrelExports.push(`export * from "./pop${typeName}";`);

  // 3. get<Name>List.ts
  const getListFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}List");

/**
 * Get range of items from ${typeName} List
 */
export async function get${typeName}List(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  start: number = 0,
  stop: number = -1,
): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.lrange(key, start, stop);
  } catch (error) {
    logger.error(\`Failed to read List \${key}\`, error);
    return [];
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}List.ts`,
    language: "typescript",
    content: getListFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}List";`);

  // 4. get<Name>Length.ts
  const getLengthFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Length");

/**
 * Get length of ${typeName} List
 */
export async function get${typeName}Length(${keyArgsSig}): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.llen(key);
  } catch (error) {
    logger.error(\`Failed to get length of List \${key}\`, error);
    return 0;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}Length.ts`,
    language: "typescript",
    content: getLengthFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}Length";`);

  return { files, barrelExports };
}
