export const DEFAULT_DATABASE_NODE_LABEL = "Primary SQLite DB";
export const DEFAULT_DATABASE_ENGINE = "sqlite" as const;

export const DEFAULT_DATABASE_ENV_VARS = {
  connectionStringEnv: "DATABASE_URL",
  dbFilePathEnv: "DB_FILE_PATH",
} as const;

export const DATABASE_CATEGORY_MAP: Record<string, "sql" | "nosql" | "vector" | "key-value"> = {
  sqlite: "sql",
  postgres: "sql",
  mysql: "sql",
  mariadb: "sql",
  cockroachdb: "sql",
  mongodb: "nosql",
  dynamodb: "nosql",
  firestore: "nosql",
  pinecone: "vector",
  qdrant: "vector",
  milvus: "vector",
  weaviate: "vector",
  redis: "key-value",
};

export const DB_COLUMN_TYPES = {
  UUID: "UUID",
  VARCHAR: "VARCHAR",
  TEXT: "TEXT",
  BOOLEAN: "BOOLEAN",
  TIMESTAMP: "TIMESTAMP",
  INTEGER: "INTEGER",
  BIGINT: "BIGINT",
  SMALLINT: "SMALLINT",
  INT: "INT",
  JSON: "JSON",
  JSONB: "JSONB",
  DATE: "DATE",
  TIME: "TIME",
  FLOAT: "FLOAT",
  DECIMAL: "DECIMAL",
  NUMERIC: "NUMERIC",
  VECTOR: "VECTOR",
} as const;

export type DbColumnType = (typeof DB_COLUMN_TYPES)[keyof typeof DB_COLUMN_TYPES];
