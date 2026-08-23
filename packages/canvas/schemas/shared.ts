import { z } from "zod";
import { processingOperationEnum } from "./primitives";

export const parameterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
});

export const parameterInputSchema = parameterSchema.extend({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  required: z.boolean().optional(),
});

export const responseFieldSchema = parameterSchema.extend({
  selectedColumns: z.array(z.string()).optional(),
});

export const responseFieldInputSchema = responseFieldSchema.extend({
  id: z.string().optional(),
});

export const schemaModelSchema = z.object({
  id: z.string(),
  fields: z.array(parameterSchema).optional(),
  rawJson: z.string().optional(),
  mode: z.enum(["field_builder", "raw_json"]).optional(),
  requestBodyMode: z.enum(["field_builder", "raw_json"]).optional(),
});

export const schemaModelInputSchema = z.object({
  id: z.string().optional(),
  fields: z.array(parameterInputSchema).optional(),
  rawJson: z.string().optional(),
  mode: z.enum(["field_builder", "raw_json"]).optional(),
  requestBodyMode: z.enum(["field_builder", "raw_json"]).optional(),
});

export const processingStepSchema = z.object({
  id: z.string(),
  text: z.string(),
  operation: processingOperationEnum.optional(),
  config: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});
export type ProcessingStep = z.infer<typeof processingStepSchema>;

export const processingStepInputSchema = processingStepSchema.extend({
  id: z.string().optional(),
});

export const architectureMetadataSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  createdByAI: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Pipeline Step Input Binding
// Describes where a single function argument value comes from
// ---------------------------------------------------------------------------
export const pipelineStepInputSourceSchema = z.discriminatedUnion("kind", [
  /** A field from req.body */
  z.object({ kind: z.literal("req_body"), field: z.string().optional() }),
  /** A field from req.params */
  z.object({ kind: z.literal("req_params"), field: z.string().optional() }),
  /** A field from req.query */
  z.object({ kind: z.literal("req_query"), field: z.string().optional() }),
  /** A field from req.headers */
  z.object({ kind: z.literal("req_headers"), field: z.string().optional() }),
  /** A field (or the whole object) from a prior step's output variable */
  z.object({
    kind: z.literal("step_output"),
    stepId: z.string(),
    /** If omitted, the entire step output object is passed */
    field: z.string().optional(),
  }),
  /** A hardcoded literal value */
  z.object({
    kind: z.literal("literal"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
]);
export type PipelineStepInputSource = z.infer<typeof pipelineStepInputSourceSchema>;

export const pipelineStepInputBindingSchema = z.object({
  /** Name of the argument in the called function's signature */
  argName: z.string(),
  source: pipelineStepInputSourceSchema,
});
export type PipelineStepInputBinding = z.infer<typeof pipelineStepInputBindingSchema>;

// ---------------------------------------------------------------------------
// Pipeline Step
// One ordered step in an endpoint or event handler
// ---------------------------------------------------------------------------
export const pipelineStepTypeEnum = z.enum([
  "transform",     // call a transformer helper function
  "db_operation",  // call a DB helper (createX, findById, etc.)
  "redis_operation", // call a Redis cache helper
  "kafka_publish", // publishKafkaEvent
  "service_call",  // HTTP / gRPC call to another service
  "custom_code",   // raw TypeScript block
  "return_response", // explicit return response step
]);
export type PipelineStepType = z.infer<typeof pipelineStepTypeEnum>;

export const pipelineStepOutputSchemaFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  description: z.string().optional(),
});

export const pipelineStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: pipelineStepTypeEnum,
  enabled: z.boolean().optional().default(true),
  /** HTTP status code for return_response step (e.g. 200, 201, 204) */
  statusCode: z.number().optional(),
  /** Mode for return_response step */
  responseMode: z.string().optional(),
  /** For DB/Redis operation steps: ID of the selected database node */
  databaseId: z.string().optional(),
  /** For DB/Redis operation steps: ID of the selected table/entity node */
  tableNodeId: z.string().optional(),
  /** For DB/Redis operation steps: ID of the selected operation */
  operationId: z.string().optional(),
  /** Reference to the function being called (name + importPath from ReusableFunction / transformer) */
  functionRef: z.object({
    name: z.string(),
    importPath: z.string(),
    signature: z.string().optional(),
  }).optional(),
  /** Explicit per-argument input bindings - user decides where every arg comes from */
  inputBindings: z.array(pipelineStepInputBindingSchema),
  /** Variable name assigned to this step's return value (usable by subsequent steps) */
  outputVariable: z.string().optional().default(""),
  /** Declared output schema - fields available to downstream steps and response builder */
  outputSchema: z.array(pipelineStepOutputSchemaFieldSchema).optional(),
  /** For custom_code steps: raw TypeScript to inline */
  customCode: z.string().optional(),
});
export type PipelineStep = z.infer<typeof pipelineStepSchema>;

export const pipelineStepInputSchema = pipelineStepSchema.extend({
  id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Transformer Helper Definition
// A small, pure data-transformation function (3 sections: Input | Logic | Return)
// Lives either as a global shared package or attached locally to a service node
// ---------------------------------------------------------------------------
export const transformerHelperSchema = z.object({
  id: z.string(),
  name: z.string().describe("camelCase function name, e.g. slugifyProductInput"),
  description: z.string().optional(),
  /** global = compiled into packages/transformers | local = compiled into service src/helpers */
  scope: z.enum(["global", "local"]),
  /** For local scope: which service node this helper belongs to */
  targetServiceId: z.string().optional(),
  /** Section 1: Input - typed fields this function accepts */
  inputSchema: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional().default(true),
    description: z.string().optional(),
  })),
  /** Section 2: Logic - how the transformation is defined */
  logicMode: z.enum(["natural_language", "code"]),
  prompt: z.string().optional().describe("Natural language description of the transformation"),
  code: z.string().optional().describe("TypeScript function body (return statement only, no function signature)"),
  /** Section 3: Return - typed fields this function returns */
  returnSchema: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional().default(true),
    description: z.string().optional(),
  })),
  isAsync: z.boolean().optional().default(false),
});
export type TransformerHelperDefinition = z.infer<typeof transformerHelperSchema>;

export const transformerHelperInputSchema = transformerHelperSchema.extend({
  id: z.string().optional(),
});
