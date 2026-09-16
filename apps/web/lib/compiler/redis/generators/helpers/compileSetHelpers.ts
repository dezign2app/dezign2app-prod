// ═══════════════════════════════════════════════════════════════
// MODULE: CompileSetHelpers
// LAYER:  redis / generators / helpers
// EMITS:  Set-specific Redis helpers (addMembers, isMember, getMembers)
// ═══════════════════════════════════════════════════════════════

import { HelperContext, HelperEmitResult } from "./types";

export function compileSetHelpers(ctx: HelperContext): HelperEmitResult {
  const { varName, typeName, templateParams, keyArgsSig } = ctx.schema;
  const files: HelperEmitResult["files"] = [];
  const barrelExports: string[] = [];

  // 1. add<Name>Members.ts
  const addMembersFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("add${typeName}Members");

/**
 * Add members to ${typeName} Set
 */
export async function add${typeName}Members(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  ...members: string[]
): Promise<number> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.sadd(key, ...members);
  } catch (error) {
    logger.error(\`Failed to add members to Set \${key}\`, error);
    throw error;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/add${typeName}Members.ts`,
    language: "typescript",
    content: addMembersFnContent,
  });
  barrelExports.push(`export * from "./add${typeName}Members";`);

  // 2. is<Name>Member.ts
  const isMemberFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("is${typeName}Member");

/**
 * Check if member exists in ${typeName} Set
 */
export async function is${typeName}Member(
  ${keyArgsSig ? `${keyArgsSig}, ` : ""}
  member: string,
): Promise<boolean> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    const result = await redis.sismember(key, member);
    return result === 1;
  } catch (error) {
    logger.error(\`Failed to check membership in Set \${key}\`, error);
    return false;
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/is${typeName}Member.ts`,
    language: "typescript",
    content: isMemberFnContent,
  });
  barrelExports.push(`export * from "./is${typeName}Member";`);

  // 3. get<Name>Members.ts
  const getMembersFnContent = `import { getRedisClient } from "../../client";
import { get${typeName}Key } from "../../schemas/${varName}";
import { createLogger } from "@workspace/logger";

const logger = createLogger("get${typeName}Members");

/**
 * Get all members of ${typeName} Set
 */
export async function get${typeName}Members(${keyArgsSig}): Promise<string[]> {
  const key = get${typeName}Key(${templateParams.join(", ") || "id"});
  try {
    const redis = await getRedisClient();
    return await redis.smembers(key);
  } catch (error) {
    logger.error(\`Failed to get members of Set \${key}\`, error);
    return [];
  }
}
`;
  files.push({
    filename: `src/helpers/${varName}/get${typeName}Members.ts`,
    language: "typescript",
    content: getMembersFnContent,
  });
  barrelExports.push(`export * from "./get${typeName}Members";`);

  return { files, barrelExports };
}
