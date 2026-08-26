import { z } from "zod";
import { baseNodeDataSchema } from "./base";
import { parameterSchema, parameterInputSchema } from "../shared";

export const hookNodeDataSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    hookName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetWebAppId: z.string().optional(),
    targetPageId: z.string().optional(),
    targetEndpointId: z.string().optional(),
    targetEventId: z.string().optional(),
    hookRef: z.string().optional(),
    hookType: z.enum(["query", "mutation", "subscription", "custom"]).optional().default("query"),
    inputParams: z.array(parameterSchema).optional(),
    returnSchema: z.array(parameterSchema).optional(),
    logicMode: z.enum(["natural_language", "code"]).optional().default("code"),
    prompt: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export type HookNodeData = z.infer<typeof hookNodeDataSchema>;

export const hookNodeDataInputSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    hookName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetWebAppId: z.string().optional(),
    targetPageId: z.string().optional(),
    targetEndpointId: z.string().optional(),
    targetEventId: z.string().optional(),
    hookRef: z.string().optional(),
    hookType: z.enum(["query", "mutation", "subscription", "custom"]).optional(),
    inputParams: z.array(parameterInputSchema).optional(),
    returnSchema: z.array(parameterInputSchema).optional(),
    logicMode: z.enum(["natural_language", "code"]).optional(),
    prompt: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export const hookRefDataSchema = baseNodeDataSchema
  .extend({
    hookRef: z.string().optional(),
    targetWebAppId: z.string().optional(),
    targetPageId: z.string().optional(),
    targetPageIds: z.array(z.string()).optional(),
  })
  .passthrough();

export type HookRefData = z.infer<typeof hookRefDataSchema>;

export const componentNodeDataSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    componentName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetWebAppId: z.string().optional(),
    targetPageId: z.string().optional(),
    slotName: z.enum(["header", "main", "sidebar", "footer", "modal", "custom"]).optional().default("main"),
    propsSchema: z.array(parameterSchema).optional(),
    logicMode: z.enum(["natural_language", "code"]).optional().default("code"),
    prompt: z.string().optional(),
    code: z.string().optional(),
    componentRef: z.string().optional(),
  })
  .passthrough();

export type ComponentNodeData = z.infer<typeof componentNodeDataSchema>;

export const componentNodeDataInputSchema = baseNodeDataSchema
  .extend({
    description: z.string().optional(),
    componentName: z.string().optional(),
    scope: z.enum(["global", "local"]).optional().default("global"),
    targetWebAppId: z.string().optional(),
    targetPageId: z.string().optional(),
    slotName: z.enum(["header", "main", "sidebar", "footer", "modal", "custom"]).optional(),
    propsSchema: z.array(parameterInputSchema).optional(),
    logicMode: z.enum(["natural_language", "code"]).optional(),
    prompt: z.string().optional(),
    code: z.string().optional(),
    componentRef: z.string().optional(),
  })
  .passthrough();

export const componentRefDataSchema = baseNodeDataSchema
  .extend({
    componentRef: z.string().optional(),
    targetWebAppId: z.string().optional(),
    targetPageId: z.string().optional(),
    targetPageIds: z.array(z.string()).optional(),
    slotName: z.string().optional(),
  })
  .passthrough();

export type ComponentRefData = z.infer<typeof componentRefDataSchema>;
