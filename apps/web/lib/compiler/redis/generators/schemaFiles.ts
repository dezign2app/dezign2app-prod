import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import {
  compileRedisSchema,
  generateRedisSchemasIndex,
} from "../../schemas/redis";

export interface GeneratedSchemaResult {
  file: CompiledFile;
  varName: string;
  typeName: string;
  itemTypeName?: string;
  isJsonArray?: boolean;
  dataStructure: string;
  keyTemplate: string;
  templateParams: string[];
  keyArgsSig: string;
  ttlSeconds: number;
}

/**
 * Generates the TypeScript schema module for a Redis schema node.
 * Delegates to modular schema compiler under `apps/web/lib/compiler/schemas/redis/`.
 */
export function generateSchemaModule(
  schemaNode: BackendNode,
): GeneratedSchemaResult {
  const result = compileRedisSchema(schemaNode);
  return {
    file: result.file,
    varName: result.varName,
    typeName: result.typeName,
    itemTypeName: result.itemTypeName,
    isJsonArray: result.isJsonArray,
    dataStructure: result.dataStructure || "hash",
    keyTemplate: result.keyTemplate || "",
    templateParams: result.templateParams || [],
    keyArgsSig: result.keyArgsSig || "id: string | number",
    ttlSeconds: result.ttlSeconds || 3600,
  };
}

/**
 * Generates the schemas barrel file (`src/schemas/index.ts`) for a Redis package.
 */
export function generateSchemasIndex(
  schemaBarrelExports: string[],
  instLabel: string,
): CompiledFile {
  return generateRedisSchemasIndex(schemaBarrelExports, instLabel);
}
