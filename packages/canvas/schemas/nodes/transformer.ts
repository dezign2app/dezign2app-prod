import { z } from "zod";
import { baseNodeDataSchema } from "./base";
import { transformerHelperSchema, transformerHelperInputSchema } from "../shared";

export const transformerNodeDataSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    functionName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetServiceId: z.string().optional(),
    targetEndpointId: z.string().optional(),
    targetEndpointIds: z.array(z.string()).optional(),
    targetEventId: z.string().optional(),
    targetEventIds: z.array(z.string()).optional(),
    transformerRef: z.string().optional(),
    inputSchemaMode: z.enum(["field_builder", "raw_json"]).optional(),
    inputSchemaRawJson: z.string().optional(),
    inputSchema: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional().default(true),
          description: z.string().optional(),
          defaultValue: z.string().optional(),
        }),
      )
      .optional(),
    logicMode: z.enum(["natural_language", "code"]).optional().default("code"),
    prompt: z.string().optional(),
    code: z.string().optional(),
    returnSchemaMode: z.enum(["field_builder", "raw_json"]).optional(),
    returnSchemaRawJson: z.string().optional(),
    returnSchema: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional().default(true),
          description: z.string().optional(),
          defaultValue: z.string().optional(),
        }),
      )
      .optional(),
    isAsync: z.boolean().optional().default(false),
    transformerHelpers: z.array(transformerHelperSchema).optional(),
  })
  .passthrough();
export type TransformerNodeData = z.infer<typeof transformerNodeDataSchema>;

export const transformerNodeDataInputSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    functionName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetServiceId: z.string().optional(),
    targetEndpointId: z.string().optional(),
    targetEndpointIds: z.array(z.string()).optional(),
    targetEventId: z.string().optional(),
    targetEventIds: z.array(z.string()).optional(),
    transformerRef: z.string().optional(),
    inputSchemaMode: z.enum(["field_builder", "raw_json"]).optional(),
    inputSchemaRawJson: z.string().optional(),
    inputSchema: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional(),
          description: z.string().optional(),
          defaultValue: z.string().optional(),
        }),
      )
      .optional(),
    logicMode: z.enum(["natural_language", "code"]).optional(),
    prompt: z.string().optional(),
    code: z.string().optional(),
    returnSchemaMode: z.enum(["field_builder", "raw_json"]).optional(),
    returnSchemaRawJson: z.string().optional(),
    returnSchema: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional(),
          description: z.string().optional(),
          defaultValue: z.string().optional(),
        }),
      )
      .optional(),
    isAsync: z.boolean().optional(),
    transformerHelpers: z.array(transformerHelperInputSchema).optional(),
  })
  .passthrough();

export const transformerRefDataSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    transformerRef: z.string().optional(),
    targetServiceId: z.string().optional(),
    targetEndpointId: z.string().optional(),
    targetEndpointIds: z.array(z.string()).optional(),
    targetEventId: z.string().optional(),
    targetEventIds: z.array(z.string()).optional(),
    graphPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  .passthrough();
export type TransformerRefData = z.infer<typeof transformerRefDataSchema>;

export const transformerRefDataInputSchema = transformerRefDataSchema;
