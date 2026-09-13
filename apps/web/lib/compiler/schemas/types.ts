import { CompiledFile } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";

export type SchemaTechnology =
  | "redis"
  | "sqlite"
  | "postgres"
  | "mysql"
  | "convex"
  | "zod"
  | "json";

export interface CompiledSchemaResult {
  file: CompiledFile;
  varName: string;
  typeName: string;
  itemTypeName?: string;
  isJsonArray?: boolean;
  technology: SchemaTechnology;
  version?: string;
  dataStructure?: string;
  keyTemplate?: string;
  templateParams?: string[];
  keyArgsSig?: string;
  ttlSeconds?: number;
  exportedSymbols?: string[];
}

export interface RedisSchemaCompilerOptions {
  version?: "7.4" | "7.0" | "6.x" | string;
  defaultTtlSeconds?: number;
}

export interface DatabaseSchemaCompilerOptions {
  dialect?: "sqlite" | "postgres" | "mysql" | "convex";
  version?: string;
  packageName?: string;
}

export interface ZodSchemaCompilerOptions {
  version?: "3.x" | string;
  strict?: boolean;
}
