import { BackendNode } from "@workspace/canvas";
import {
  saveLocalEnvVariable,
  deleteLocalEnvVariable,
  cleanEnvVarName,
} from "./localEnvSync";

export interface DatabaseEnvVarEntry {
  id: string;
  name: string;
  description?: string;
}

/**
 * Reconciles the list of environment variables declared on a database node.
 * Ensures connectionStringEnv (e.g. DATABASE_URL) and connectionStringPooledEnv (e.g. DATABASE_URL_POOLED)
 * are properly declared or removed based on the engine, provider, and active connection strings.
 */
export function syncDatabaseEnvVarsList(
  data: BackendNode["data"],
  existingEnvVars?: DatabaseEnvVarEntry[],
): DatabaseEnvVarEntry[] {
  const engine = (data.dbEngine || "postgres").toLowerCase();
  const provider = (data.provider || "").toLowerCase();
  const currentVars = existingEnvVars || (data.envVars as DatabaseEnvVarEntry[]) || [];

  const connEnv = cleanEnvVarName(data.connectionStringEnv || "DATABASE_URL") || "DATABASE_URL";
  const pooledEnv =
    cleanEnvVarName(data.connectionStringPooledEnv || "DATABASE_URL_POOLED") || "DATABASE_URL_POOLED";
  const fileEnv = cleanEnvVarName(data.dbFilePathEnv || "DB_FILE_PATH") || "DB_FILE_PATH";

  const hasPooledConfig =
    Boolean(data.connectionStringPooled && data.connectionStringPooled.trim()) ||
    provider === "neon" ||
    provider === "supabase";

  // Retain any custom user-added env vars (that are not standard db keys)
  const isStandardDbKey = (name: string, id: string) => {
    return (
      id === "db-url" ||
      id === "db-url-pooled" ||
      id === "db-file-path" ||
      id === "redis-url" ||
      id === "mongodb-uri" ||
      name === connEnv ||
      name === pooledEnv ||
      name === fileEnv ||
      name === "DATABASE_URL" ||
      name === "DATABASE_URL_POOLED" ||
      name === "DB_FILE_PATH" ||
      name === "REDIS_URL" ||
      name === "MONGODB_URI"
    );
  };

  const customVars = currentVars.filter((v) => !isStandardDbKey(v.name, v.id));

  if (engine === "sqlite") {
    const sqliteVars: DatabaseEnvVarEntry[] = [
      {
        id: "db-file-path",
        name: fileEnv,
        description: "SQLite local file storage path",
      },
      {
        id: "db-url",
        name: connEnv,
        description: "SQLite connection string (file:./local.db)",
      },
    ];
    return [...sqliteVars, ...customVars];
  }

  if (engine === "redis") {
    const redisVars: DatabaseEnvVarEntry[] = [
      {
        id: "redis-url",
        name: cleanEnvVarName(data.connectionStringEnv || "REDIS_URL") || "REDIS_URL",
        description: "Redis connection URI",
      },
    ];
    return [...redisVars, ...customVars];
  }

  if (engine === "mongodb") {
    const mongoVars: DatabaseEnvVarEntry[] = [
      {
        id: "mongodb-uri",
        name: cleanEnvVarName(data.connectionStringEnv || "MONGODB_URI") || "MONGODB_URI",
        description: "MongoDB connection URI",
      },
    ];
    return [...mongoVars, ...customVars];
  }

  // PostgreSQL / MySQL / Relational
  const directVar: DatabaseEnvVarEntry = {
    id: "db-url",
    name: connEnv,
    description: `${engine === "mysql" ? "MySQL" : "PostgreSQL"} connection string (direct)`,
  };

  const result: DatabaseEnvVarEntry[] = [directVar];

  // Only include pooled environment variable if pooled connection is configured or provider is Neon/Supabase
  if (hasPooledConfig) {
    result.push({
      id: "db-url-pooled",
      name: pooledEnv,
      description: "PostgreSQL pooled connection string (Neon / Supabase Pooler)",
    });
  }

  return [...result, ...customVars];
}

/**
 * Synchronizes the actual environment variable values to/from the local .env file.
 * Handles creating new keys, updating changed values, deleting renamed old keys,
 * and deleting pooled keys when pooled connection is cleared.
 */
export async function syncDatabaseLocalEnv(
  prevData: Partial<BackendNode["data"]>,
  nextData: BackendNode["data"],
  projectId?: string,
): Promise<{ created: string[]; updated: string[]; deleted: string[] }> {
  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];

  const prevEngine = (prevData.dbEngine || "postgres").toLowerCase();
  const nextEngine = (nextData.dbEngine || "postgres").toLowerCase();

  const prevConnEnv = cleanEnvVarName(prevData.connectionStringEnv || "DATABASE_URL") || "DATABASE_URL";
  const nextConnEnv = cleanEnvVarName(nextData.connectionStringEnv || "DATABASE_URL") || "DATABASE_URL";

  const prevPooledEnv =
    cleanEnvVarName(prevData.connectionStringPooledEnv || "DATABASE_URL_POOLED") || "DATABASE_URL_POOLED";
  const nextPooledEnv =
    cleanEnvVarName(nextData.connectionStringPooledEnv || "DATABASE_URL_POOLED") || "DATABASE_URL_POOLED";

  const prevFileEnv = cleanEnvVarName(prevData.dbFilePathEnv || "DB_FILE_PATH") || "DB_FILE_PATH";
  const nextFileEnv = cleanEnvVarName(nextData.dbFilePathEnv || "DB_FILE_PATH") || "DB_FILE_PATH";

  const nextHasPooled =
    Boolean(nextData.connectionStringPooled && nextData.connectionStringPooled.trim()) ||
    nextData.provider === "neon" ||
    nextData.provider === "supabase";

  const prevHasPooled =
    Boolean(prevData.connectionStringPooled && prevData.connectionStringPooled.trim()) ||
    prevData.provider === "neon" ||
    prevData.provider === "supabase";

  // 1. Handle Direct Connection Key
  if (nextEngine !== "sqlite") {
    // If key name was changed, delete the old key
    if (prevConnEnv && prevConnEnv !== nextConnEnv) {
      await deleteLocalEnvVariable(prevConnEnv, projectId);
      deleted.push(prevConnEnv);
    }

    // If connection string exists or is provided, save it
    if (nextData.connectionString && nextData.connectionString.trim()) {
      await saveLocalEnvVariable(nextConnEnv, nextData.connectionString.trim(), projectId);
      if (prevConnEnv !== nextConnEnv || !prevData.connectionString) {
        created.push(nextConnEnv);
      } else {
        updated.push(nextConnEnv);
      }
    }
  }

  // 2. Handle Pooled Connection Key
  if (nextHasPooled && (nextEngine === "postgres" || nextEngine === "postgresql")) {
    // If pooled key name was changed, delete old key
    if (prevPooledEnv && prevPooledEnv !== nextPooledEnv) {
      await deleteLocalEnvVariable(prevPooledEnv, projectId);
      deleted.push(prevPooledEnv);
    }

    // If pooled value exists, save it
    if (nextData.connectionStringPooled && nextData.connectionStringPooled.trim()) {
      await saveLocalEnvVariable(nextPooledEnv, nextData.connectionStringPooled.trim(), projectId);
      if (prevPooledEnv !== nextPooledEnv || !prevData.connectionStringPooled) {
        created.push(nextPooledEnv);
      } else {
        updated.push(nextPooledEnv);
      }
    }
  } else if (prevHasPooled && !nextHasPooled) {
    // Pooled was removed/cleared or engine switched: delete from .env
    await deleteLocalEnvVariable(prevPooledEnv, projectId);
    deleted.push(prevPooledEnv);
    if (nextPooledEnv !== prevPooledEnv) {
      await deleteLocalEnvVariable(nextPooledEnv, projectId);
    }
  }

  // 3. Handle SQLite DB File Path
  if (nextEngine === "sqlite") {
    if (prevFileEnv && prevFileEnv !== nextFileEnv) {
      await deleteLocalEnvVariable(prevFileEnv, projectId);
      deleted.push(prevFileEnv);
    }
    const filePath = nextData.dbFilePath || "dev.db";
    await saveLocalEnvVariable(nextFileEnv, filePath, projectId);
    created.push(nextFileEnv);

    // If switched from postgres, clean up pooled env if it existed
    if (prevEngine !== "sqlite" && prevHasPooled) {
      await deleteLocalEnvVariable(prevPooledEnv, projectId);
      deleted.push(prevPooledEnv);
    }
  } else if (prevEngine === "sqlite" && nextEngine !== "sqlite") {
    // Switched away from sqlite: remove file path env
    await deleteLocalEnvVariable(prevFileEnv, projectId);
    deleted.push(prevFileEnv);
  }

  return { created, updated, deleted };
}
