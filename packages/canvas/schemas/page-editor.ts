import { z } from "zod";

export const pageEditorStatusEventSchema = z.object({
  type: z.literal("status"),
  message: z.string(),
});

export const pageEditorTokenEventSchema = z.object({
  type: z.literal("token"),
  content: z.string(),
});

export const pageEditorPlanEventSchema = z.object({
  type: z.literal("plan"),
  content: z.string(),
});

export const pageEditorDoneEventSchema = z.object({
  type: z.literal("done"),
  code: z.string(),
  plan: z.string().optional(),
  conversationId: z.string().optional(),
});

export const pageEditorErrorEventSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
});

export const pageEditorStreamEventSchema = z.discriminatedUnion("type", [
  pageEditorStatusEventSchema,
  pageEditorTokenEventSchema,
  pageEditorPlanEventSchema,
  pageEditorDoneEventSchema,
  pageEditorErrorEventSchema,
]);

export type PageEditorStatusEvent = z.infer<typeof pageEditorStatusEventSchema>;
export type PageEditorTokenEvent = z.infer<typeof pageEditorTokenEventSchema>;
export type PageEditorPlanEvent = z.infer<typeof pageEditorPlanEventSchema>;
export type PageEditorDoneEvent = z.infer<typeof pageEditorDoneEventSchema>;
export type PageEditorErrorEvent = z.infer<typeof pageEditorErrorEventSchema>;
export type PageEditorStreamEvent = z.infer<typeof pageEditorStreamEventSchema>;

export const pageEditorChatMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
});

export type PageEditorChatMessage = z.infer<typeof pageEditorChatMessageSchema>;

export const pageEditorRequestBodySchema = z.object({
  nodeId: z.string(),
  projectId: z.string(),
  currentCode: z.string().optional(),
  prompt: z.string(),
  pageName: z.string().optional(),
  pageRoute: z.string().optional(),
  convexUrl: z.string().optional(),
  token: z.string().optional(),
  conversationId: z.string().optional(),
  chatHistory: z.array(pageEditorChatMessageSchema).optional(),
});

export type PageEditorRequestBody = z.infer<typeof pageEditorRequestBodySchema>;
