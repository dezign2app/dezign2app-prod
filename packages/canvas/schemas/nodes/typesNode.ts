import { z } from "zod";
import { baseNodeDataSchema } from "./base";

export const customTypeFieldSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional().default(true),
  isArray: z.boolean().optional().default(false),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
});

export const customTypeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["interface", "type", "enum"]).default("interface"),
  description: z.string().optional(),
  fields: z.array(customTypeFieldSchema).optional(),
  enumValues: z.array(z.string()).optional(),
  typeAliasValue: z.string().optional(),
  rawCode: z.string().optional(),
});

export const typesNodeDataSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetServiceId: z.string().optional(),
    definitionMode: z.enum(["visual", "raw"]).optional().default("visual"),
    rawTypeScript: z.string().optional(),
    types: z.array(customTypeItemSchema).optional(),
  })
  .passthrough();

export type TypesNodeData = z.infer<typeof typesNodeDataSchema>;
