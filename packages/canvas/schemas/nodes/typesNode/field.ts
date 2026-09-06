import { z } from "zod";

/**
 * Schema for a single property/field inside a custom type (interface or type alias).
 * Also used for enum member descriptors when a field carries extra metadata.
 */
export const customTypeFieldSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional().default(true),
  isArray: z.boolean().optional().default(false),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
});

export type CustomTypeFieldSchema = typeof customTypeFieldSchema;
