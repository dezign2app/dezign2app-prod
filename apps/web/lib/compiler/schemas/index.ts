import { BackendNode } from "@/types/canvas";
import {
  CompiledSchemaResult,
  SchemaTechnology,
  RedisSchemaCompilerOptions,
} from "./types";
import { compileRedisSchema } from "./redis";
import { compileSqlite3TableSchema } from "./databases/sqlite/v3";
import { compilePostgres16TableSchema } from "./databases/postgres/v16";
import { compileMySql8TableSchema } from "./databases/mysql/v8";
import { compileZod3Schema } from "./zod/v3";

export * from "./types";
export * from "./redis";
export * from "./databases";
export * from "./zod";

export interface UniversalSchemaCompilerOptions {
  technology?: SchemaTechnology;
  version?: string;
  redisOptions?: RedisSchemaCompilerOptions;
}

/**
 * Universal Schema Compiler Dispatcher:
 * Automatically resolves the schema technology (Redis, SQLite, Postgres, MySQL, Convex, Zod)
 * and version, and compiles the node into its modular typed schema files.
 */
export function compileSchema(
  node: BackendNode,
  options?: UniversalSchemaCompilerOptions,
): CompiledSchemaResult {
  const isRedis =
    options?.technology === "redis" ||
    node.type === "redis_schema" ||
    node.data?.dbType === "redis" ||
    node.data?.dbEngine === "redis";

  if (isRedis) {
    return compileRedisSchema(node, options?.redisOptions);
  }

  const engine = (
    options?.technology ||
    node.data?.dbEngine ||
    node.data?.dbType ||
    "sqlite"
  ).toLowerCase();

  if (engine.includes("pg") || engine.includes("postgres")) {
    const pgRes = compilePostgres16TableSchema(node);
    return {
      file: pgRes.file,
      varName: pgRes.tableVarName,
      typeName: pgRes.typeName,
      technology: "postgres",
      version: "16.x",
    };
  }

  if (engine.includes("mysql") || engine.includes("mariadb")) {
    const myRes = compileMySql8TableSchema(node);
    return {
      file: myRes.file,
      varName: myRes.tableVarName,
      typeName: myRes.typeName,
      technology: "mysql",
      version: "8.x",
    };
  }

  // Default SQLite v3
  const sqliteRes = compileSqlite3TableSchema(node);
  return {
    file: sqliteRes.file,
    varName: sqliteRes.tableVarName,
    typeName: sqliteRes.typeName,
    technology: "sqlite",
    version: "3.x",
  };
}
