import { z } from "zod";
import { customTypeFieldSchema } from "./field";

/**
 * Schema for a single type entry within a Types node.
 * Covers interfaces, type aliases, enums, and package-imported types.
 */
export const customTypeItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["interface", "type", "enum"]).default("interface"),
  description: z.string().optional(),
  fields: z.array(customTypeFieldSchema).optional(),
  enumValues: z.array(z.string()).optional(),
  // Raw source for type aliases or pre-extracted package types
  typeAliasValue: z.string().optional(),
  rawCode: z.string().optional(),
  // Package origin metadata
  packageSource: z.string().optional(),
  isReadOnly: z.boolean().optional(),
  isExtendable: z.boolean().optional(),
  // Extension / inheritance tracking
  extendedFrom: z.string().optional(),
  extendedFromTypeId: z.string().optional(),
});

export type CustomTypeItemSchema = typeof customTypeItemSchema;
