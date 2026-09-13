import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { CompiledSchemaResult, RedisSchemaCompilerOptions } from "../types";
import {
  compileRedis74SchemaModule,
  generateRedis74SchemasIndex,
} from "./v7.4";
import {
  compileRedis7SchemaModule,
  generateRedis7SchemasIndex,
} from "./v7";

export * from "./v7.4";
export * from "./v7";
export type { RedisSchemaCompilerOptions } from "../types";

/**
 * Compiles a Redis Schema Node into its TypeScript Schema Module,
 * dynamically selecting the compiler implementation based on target version.
 * Defaults to modern Redis 7.4+ (with HEXPIRE field-level TTLs and RedisJSON).
 */
export function compileRedisSchema(
  schemaNode: BackendNode,
  options?: RedisSchemaCompilerOptions,
): CompiledSchemaResult {
  const version = (
    options?.version ||
    schemaNode.data?.redisVersion ||
    schemaNode.data?.dbEngineVersion ||
    schemaNode.data?.version ||
    "7.4"
  ).toString();

  if (version.startsWith("7.0") || version.startsWith("6")) {
    return compileRedis7SchemaModule(schemaNode);
  }

  return compileRedis74SchemaModule(schemaNode);
}

/**
 * Generates the central schemas index barrel file (`src/schemas/index.ts`)
 * for a Redis package.
 */
export function generateRedisSchemasIndex(
  schemaBarrelExports: string[],
  instLabel: string,
  options?: RedisSchemaCompilerOptions,
): CompiledFile {
  const version = (options?.version || "7.4").toString();

  if (version.startsWith("7.0") || version.startsWith("6")) {
    return generateRedis7SchemasIndex(schemaBarrelExports, instLabel);
  }

  return generateRedis74SchemasIndex(schemaBarrelExports, instLabel);
}
