import { z } from "zod";
import { baseNodeDataSchema } from "./base";
import { transformerHelperSchema, transformerHelperInputSchema } from "../shared";

export const transformerNodeDataSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    functionName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetServiceId: z.string().optional(),
    inputSchema: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional().default(true),
          description: z.string().optional(),
        }),
      )
      .optional(),
    logicMode: z.enum(["natural_language", "code"]).optional().default("code"),
    prompt: z.string().optional(),
    code: z.string().optional(),
    returnSchema: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional().default(true),
          description: z.string().optional(),
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
    functionName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetServiceId: z.string().optional(),
    inputSchema: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    logicMode: z.enum(["natural_language", "code"]).optional(),
    prompt: z.string().optional(),
    code: z.string().optional(),
    returnSchema: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean().optional(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    isAsync: z.boolean().optional(),
    transformerHelpers: z.array(transformerHelperInputSchema).optional(),
  })
  .passthrough();
