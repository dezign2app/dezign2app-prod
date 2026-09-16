// ═══════════════════════════════════════════════════════════════
// MODULE: CompileZsetHelpers
// LAYER:  redis / generators / helpers
// EMITS:  Sorted Set (zset)-specific Redis helpers (addScore, getRank, getTop)
// ═══════════════════════════════════════════════════════════════

import { HelperContext, HelperEmitResult } from "./types";

export function compileZsetHelpers(ctx: HelperContext): HelperEmitResult {
  const { varName, typeName, templateParams, keyArgsSig } = ctx.schema;
  const files: HelperEmitResult["files"] = [];
  const barrelExports: string[] = [];

  // 1. add<Name>Score.ts
  const addScoreFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("add${typeName}Score");

/**
 * Add or update member score in ${typeName} Sorted Set
 */
export async function add${typeName}Score(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  score: number,
  member: string,
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.zadd(key, score, member);
  } catch (error) {
    logger.error(\`Failed to add score to ZSet \${key}\`, error);
    throw error;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/add${typeName}Score.ts`,
    language: "typescript",
    content: addScoreFnContent,
  });
  barrelExports.push(`export * from "./add${typeName}Score";`);

  // 2. get<Name>Rank.ts
  const getRankFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Rank");

/**
 * Get member rank in ${typeName} Sorted Set
 */
export async function get${typeName}Rank(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  member: string,
): Promise<number | null> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.zrevrank(key, member);
  } catch (error) {
    logger.error(\`Failed to get rank in ZSet \${key}\`, error);
    return null;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}Rank.ts`,
    language: "typescript",
    content: getRankFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}Rank";`);

  // 3. get<Name>Top.ts
  const getTopFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Top");

/**
 * Get top ranked members in ${typeName} Sorted Set
 */
export async function get${typeName}Top(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  limit: number = 10,
): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.zrevrange(key, 0, limit - 1);
  } catch (error) {
    logger.error(\`Failed to get top members from ZSet \${key}\`, error);
    return [];
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}Top.ts`,
    language: "typescript",
    content: getTopFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}Top";`);

  return { files, barrelExports };
}
