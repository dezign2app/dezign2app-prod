import type { CanvasEntityColumn } from "../database";

export type LangGraphMemoryConfig = {
  enabled?: boolean;
  checkpointer?: "memory" | "postgres" | "redis" | "convex" | string;
  checkpointerNodeId?: string;
  checkpointerEnvVar?: string;
  checkpointerConnectionId?: string;
  connectionString?: string;
  threadIdKey?: string;
  threadScope?: "session" | "user" | "global";
  autoSummarize?: boolean;
  maxWindowMessages?: number;
  vectorStore?: {
    enabled?: boolean;
    provider?: "convex" | "pinecone" | "pgvector" | "qdrant";
    embeddingModel?: string;
    collection?: string;
    topK?: number;
    similarityThreshold?: number;
  };
};

export interface LangGraphMemoryDefinition {
  id?: string;
  memoryId?: string;
  name?: string;
  enabled?: boolean;
  checkpointer: string;
  checkpointerConnectionId?: string;
  threadIdKey?: string;
  threadScope?: "session" | "user" | "global";
  autoSummarize?: boolean;
  maxWindowMessages?: number;
  saveMessages?: boolean;
  position?: { x: number; y: number };
}

export interface LangGraphTableDefinition {
  name: string;
  description: string;
  columns: CanvasEntityColumn[];
  indexes?: {
    name: string;
    columns: string;
    isUnique?: boolean;
  }[];
}

export interface LangGraphRedisSchemaDefinition {
  name: string;
  description: string;
  redisDataStructure: "hash" | "string" | "list" | "set" | "zset" | "stream";
  keyTemplate: string;
  columns: CanvasEntityColumn[];
  indexes?: {
    name: string;
    columns: string;
    isUnique?: boolean;
  }[];
}
