import { JsonObject, JsonValue } from "@workspace/canvas";
import { TestDbOperationPayload } from "@/lib/database-runner";

export type SqlParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date;

export type SqlRowRecord = JsonObject;

export interface PostgresConnectionConfig {
  host?: string;
  port?: number | string;
  connectionString?: string;
  connectionStringEnv?: string;
  connectionStringPooled?: string;
  connectionStringPooledEnv?: string;
  sslMode?: string;
  provider?: string;
  database?: string;
  user?: string;
  username?: string;
  password?: string;
}

export interface ExecutePostgresOptions {
  connection: PostgresConnectionConfig;
  entity?: {
    name?: string;
    schema?: string;
    columns?: Array<{
      name?: string;
      type?: string;
      isPrimaryKey?: boolean;
      isPrimary?: boolean;
      primaryKey?: boolean;
    }>;
  };
  operation: TestDbOperationPayload["operation"];
  args: TestDbOperationPayload["args"];
  mode?: "live" | "sandbox";
}

export interface PostgresOperationResult {
  success: boolean;
  output?: JsonValue;
  rawSql?: string;
  durationMs?: number;
  error?: string;
  serverActive?: boolean;
}

export interface CanvasForeignKey {
  name?: string;
  column: string;
  foreignTable: string;
  foreignColumn: string;
  foreignSchema?: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface PrerequisiteTableDefinition {
  tableName: string;
  schema?: string;
  columns?: Array<{
    name?: string;
    type?: string;
    isPrimaryKey?: boolean;
    isNotNull?: boolean;
    isUnique?: boolean;
  }>;
  indexes?: Array<{
    name: string;
    columns: string;
    isUnique?: boolean;
  }>;
}

export interface AlteredColumnDefinition {
  name: string;
  oldType: string;
  newType: string;
}

export interface PostgresTableSyncResult {
  success: boolean;
  serverReachable: boolean;
  tableExists: boolean;
  inSync: boolean;
  missingColumns: Array<{ name: string; type: string }>;
  alteredColumns?: Array<AlteredColumnDefinition>;
  extraColumns: Array<{ name: string; type: string }>;
  existingColumns: Array<{ name: string; type: string }>;
  missingIndexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  extraIndexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  existingIndexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  missingForeignKeys?: Array<CanvasForeignKey>;
  extraForeignKeys?: Array<CanvasForeignKey>;
  existingForeignKeys?: Array<CanvasForeignKey>;
  missingPrerequisiteTables?: string[];
  error?: string;
}

export interface PostgresApplySyncResult {
  success: boolean;
  createdTable: boolean;
  appliedColumns: string[];
  alteredColumns?: Array<AlteredColumnDefinition>;
  droppedColumns?: string[];
  appliedIndexes?: string[];
  droppedIndexes?: string[];
  appliedForeignKeys?: string[];
  droppedForeignKeys?: string[];
  appliedPrerequisiteTables?: string[];
  error?: string;
}
