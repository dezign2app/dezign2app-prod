import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";

export const insertMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    thinking: v.optional(v.string()),
    plan: v.optional(v.string()),
    context: v.optional(v.array(v.any())),
    role: v.union(
      v.literal("USER"),
      v.literal("AI"),
      v.literal("SYSTEM"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    clientMessageId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const {
      conversationId,
      content,
      role,
      context,
      thinking,
      plan,
      clientMessageId,
      createdAt,
    } = args;

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      content,
      role,
      thinking,
      plan,
      context,
      clientMessageId,
      createdAt: createdAt ?? Date.now(),
    });

    try {
      await ctx.db.patch(conversationId, {
        updatedAt: Date.now(),
      });
    } catch {
      // best-effort touch
    }

    return messageId;
  },
});

export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    role: v.union(
      v.literal("USER"),
      v.literal("AI"),
      v.literal("SYSTEM"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
  },
  handler: async (ctx, args) => {
    const { messageId, content, role } = args;
    const existingMessage = await ctx.db.get(messageId);

    return await ctx.db.patch(messageId, {
      content: `${existingMessage?.content || ""}${content}`,
      role,
    });
  },
});

/**
 * Returns all messages in a conversation ordered chronologically (oldest to newest)
 */
export const getConversationMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    // Sort by _creationTime ascending
    return messages.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { conversationId } = args;
    if (!conversationId)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return messages;
  },
});

export const getLastNMessages = query({
  args: {
    conversationId: v.id("conversations"),
    n: v.number(),
  },
  handler: async (ctx, args) => {
    const { conversationId, n } = args;
    if (!conversationId)
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("desc")
      .take(n);
    return messages.reverse();
  },
});
