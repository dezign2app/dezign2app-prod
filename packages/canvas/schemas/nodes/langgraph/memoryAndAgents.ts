import { z } from "zod";

export const streamEnvelopeConfigSchema = z
  .object({
    includeEvent: z.boolean().optional().default(true),
    includeAgent: z.boolean().optional().default(true),
    includeRunId: z.boolean().optional().default(true),
    includeTimestamp: z.boolean().optional().default(true),
    includeDelta: z.boolean().optional().default(true),
    includeContent: z.boolean().optional().default(true),
    includeTool: z.boolean().optional().default(true),
    includeInputs: z.boolean().optional().default(false),
    includeOutput: z.boolean().optional().default(true),
    includeUsage: z.boolean().optional().default(false),
    flattenPayload: z.boolean().optional().default(false),
    stripEmptyDeltas: z.boolean().optional().default(true),
  })
  .optional();

export const streamTransformerConfigSchema = z
  .object({
    mode: z
      .enum([
        "standard_sse",
        "ai_sdk",
        "openai_chunk",
        "minimal",
        "full_trace",
        "custom",
      ])
      .optional()
      .default("standard_sse"),
    customCode: z.string().optional(),
  })
  .optional();

export const streamConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    version: z.string().optional().default("v3"),
    selectedEvents: z.array(z.string()).optional(),
    envelope: streamEnvelopeConfigSchema,
    transformer: streamTransformerConfigSchema,
  })
  .optional();

export const memoryDefinitionSchema = z.object({
  id: z.string().optional(),
  memoryId: z.string().optional(),
  name: z.string().default("Memory Saver"),
  checkpointer: z.string().default("memory"),
  threadIdKey: z.string().optional().default("thread_id"),
  threadScope: z
    .enum(["session", "user", "global"])
    .optional()
    .default("session"),
  autoSummarize: z.boolean().optional().default(true),
  maxWindowMessages: z.number().optional().default(10),
  saveMessages: z.boolean().optional().default(true),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type MemoryDefinition = z.infer<typeof memoryDefinitionSchema>;

export const agentMemoryConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true),
    checkpointer: z.string().optional().default("memory"),
    threadIdKey: z.string().optional().default("thread_id"),
    threadScope: z
      .enum(["session", "user", "global"])
      .optional()
      .default("session"),
    autoSummarize: z.boolean().optional().default(true),
    maxWindowMessages: z.number().optional().default(10),
    saveMessages: z.boolean().optional().default(true),
  })
  .optional();
export type AgentMemoryConfig = z.infer<typeof agentMemoryConfigSchema>;

export const agentResponseFormatConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    strategy: z.enum(["auto", "provider", "tool"]).optional().default("auto"),
    schemaType: z
      .enum(["json_schema", "custom"])
      .optional()
      .default("json_schema"),
    schemaJson: z.string().optional().default(""),
    toolMessageContent: z.string().optional(),
    handleErrorMode: z
      .enum(["default", "custom_message", "disabled"])
      .optional()
      .default("default"),
    customErrorMessage: z.string().optional(),
  })
  .optional();
export type AgentResponseFormatConfig = z.infer<
  typeof agentResponseFormatConfigSchema
>;

export const agentDefinitionSchema = z
  .object({
    id: z.string().optional(),
    agentId: z.string().optional(),
    name: z.string(),
    systemPrompt: z.string().optional(),
    modelConfig: z.record(z.unknown()).optional(),
    llmConfig: z
      .object({
        enabled: z.boolean().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().optional(),
      })
      .optional(),
    stateUpdatesConfig: z
      .object({
        enabled: z.boolean().optional(),
      })
      .optional(),
    llmNodeId: z.string().optional(),
    streamConfig: streamConfigSchema,
    responseFormat: agentResponseFormatConfigSchema,
    memoryConfig: agentMemoryConfigSchema,
    stateUpdates: z
      .array(
        z.object({
          channelKey: z.string(),
          mode: z.enum(["replace", "append", "merge", "custom"]).optional(),
          value: z.string().optional(),
        }),
      )
      .optional(),
    tools: z.array(z.string()).optional().default([]),
    middleware: z.array(z.string()).optional().default([]),
    memory: z.array(z.string()).optional().default([]),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  .passthrough();
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;

export const vectorStoreConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z
    .enum(["convex", "pinecone", "pgvector", "qdrant"])
    .default("convex"),
  embeddingModel: z.string().default("text-embedding-3-small"),
  collection: z.string().default("agent_memories"),
  topK: z.number().default(5),
  similarityThreshold: z.number().default(0.75),
});
export type VectorStoreConfig = z.infer<typeof vectorStoreConfigSchema>;
