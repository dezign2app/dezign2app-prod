import { CanvasEntityColumn } from "@workspace/canvas/types";

export type { CanvasEntityColumn };

// Strongly-typed JSON structures avoiding any / unknown
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export function isJsonObject(val: unknown): val is JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

export interface TestDbOperationPayload {
  engine?: string;
  connection?: {
    host?: string;
    port?: number | string;
    connectionString?: string;
    connectionStringEnv?: string;
    dbFilePath?: string;
    dbFilePathEnv?: string;
  };
  entity?: {
    name?: string;
    columns?: CanvasEntityColumn[];
  };
  operation: {
    id?: string;
    name: string;
    kind?: string;
    code?: string;
    query?: string;
    signature?: string;
    params?: Array<{ name: string; type: string; defaultValue?: string }>;
  };
  args: Record<string, unknown>;
  mode?: "live" | "sandbox";
}

export interface TestDbOperationResult {
  success: boolean;
  output?: unknown;
  durationMs?: number;
  rawCommand?: string;
  mode?: "live" | "sandbox";
  connection?: string;
  serverActive?: boolean;
  error?: string;
  tip?: string;
  dbInfo?: {
    path?: string;
    exists?: boolean;
    sizeBytes?: number;
    fileStatus?: string;
    table?: string;
  };
}

export interface CheckDbConnectionPayload {
  engine?: string;
  connection?: {
    host?: string;
    port?: number | string;
    connectionString?: string;
    connectionStringEnv?: string;
    dbFilePath?: string;
    dbFilePathEnv?: string;
  };
  projectId?: string;
}

export interface CheckDbConnectionResult {
  success: boolean;
  engine?: string;
  latencyMs?: number;
  connectionUri?: string;
  host?: string;
  port?: number;
  error?: string;
  info?: {
    version?: string;
    rawVersion?: string;
    mode?: string;
    usedMemory?: string;
    connectedClients?: string;
    os?: string;
    path?: string;
    exists?: boolean;
    sizeBytes?: number;
    tableCount?: number;
    readable?: boolean;
    status?: string;
    reachable?: boolean;
    socket?: string;
  };
}

export interface CommandPlan {
  command: string;
  args: (string | number)[];
  rawCli: string;
}

export interface SqlCommandPlan {
  rawSql: string;
  tableName: string;
  kind: string;
}
