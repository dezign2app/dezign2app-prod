// ═══════════════════════════════════════════════════════════════
// MODULE: CompileInvalidationHelpers
// LAYER:  redis / generators / helpers
// EMITS:  Universal cache invalidation helpers (by key, alias, pattern scan)
// ═══════════════════════════════════════════════════════════════

import { HelperContext, HelperEmitResult } from "./types";

export function compileInvalidationHelpers(ctx: HelperContext): HelperEmitResult {
  const { varName, typeName, templateParams, keyArgsSig } = ctx.schema;
  const files: HelperEmitResult["files"] = [];
  const barrelExports: string[] = [];

  const invalidateFnContent = `import { getRedisClient } from "../../client";
import { deleteCache as rawDeleteCache } from "../../cache";
import {
  get${typeName}Key,
  ${typeName.toUpperCase()}_KEY_PATTERN,
} from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("invalidate${typeName}");

/**
 * Invalidate a specific ${typeName} key
 */
export async function invalidate${typeName}(${keyArgsSig}): Promise<boolean> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  return rawDeleteCache(key);
}

export const delete${typeName} = invalidate${typeName};

/**
 * Invalidate all keys matching ${typeName} pattern
 */
export async function invalidateAll${typeName}(): Promise<number> {
  try {
    const redis = await getRedisClient();
    const stream = redis.scanStream({ match: ${typeName.toUpperCase()}_KEY_PATTERN, count: 100 });
    let deletedCount = 0;
    for await (const resultKeys of stream) {
      const keys = resultKeys as string[];
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    }
    logger.info(\`Invalidated \${deletedCount} keys matching [\${${typeName.toUpperCase()}_KEY_PATTERN}]\`);
    return deletedCount;
  } catch (error) {
    logger.error(\`Failed to invalidate all keys for \${${typeName.toUpperCase()}_KEY_PATTERN}\`, error);
    return 0;
  }
}
`;

  files.push({
    filename: `src/helpers/${varName}/invalidate${typeName}.ts`,
    language: "typescript",
    content: invalidateFnContent,
  });
  barrelExports.push(`export * from "./invalidate${typeName}";`);

  return { files, barrelExports };
}
