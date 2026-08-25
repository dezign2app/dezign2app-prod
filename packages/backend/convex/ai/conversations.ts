import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const startConversation = mutation({
  args: {
    organizationId: v.optional(v.string()),
    title: v.optional(v.string()),
    type: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    nodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject || "anonymous";
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      title: args.title ?? "New Conversation",
      organizationId: args.organizationId ?? "personal",
      type: args.type,
      projectId: args.projectId,
      nodeId: args.nodeId,
      updatedAt: Date.now(),
    });
    return conversationId;
  },
});

/**
 * Gets the active conversation for a specific project node and type (e.g. "ui_design" or "node_building"),
 * or creates a new conversation if one does not exist yet.
 */
export const getOrCreateNodeConversation = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.optional(v.string()),
    type: v.string(), // "ui_design" | "node_building"
    title: v.optional(v.string()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject || "anonymous";

    let existing;
    if (args.nodeId) {
      existing = await ctx.db
        .query("conversations")
        .withIndex("by_project_node_type", (q) =>
          q
            .eq("projectId", args.projectId)
            .eq("nodeId", args.nodeId)
            .eq("type", args.type),
        )
        .first();
    } else {
      existing = await ctx.db
        .query("conversations")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", args.projectId).eq("type", args.type),
        )
        .first();
    }

    if (existing) {
      return existing._id;
    }

    const defaultTitle =
      args.title ??
      (args.type === "ui_design"
        ? `UI Design: ${args.nodeId || "Page"}`
        : `Node Builder: ${args.nodeId || "Architecture"}`);

    const conversationId = await ctx.db.insert("conversations", {
      userId,
      organizationId: args.organizationId ?? "personal",
      title: defaultTitle,
      type: args.type,
      projectId: args.projectId,
      nodeId: args.nodeId,
      updatedAt: Date.now(),
    });

    return conversationId;
  },
});

export const listConversations = query({
  args: {
    orgId: v.optional(v.string()),
    type: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    let conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }
    if (args.projectId) {
      conversations = conversations.filter((c) => c.projectId === args.projectId);
    }

    return conversations;
  },
});

export const listConversationsByProject = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("conversations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    let conversations = await q.order("desc").collect();
    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }
    return conversations;
  },
});

export const listNodeConversations = query({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let conversations = await ctx.db
      .query("conversations")
      .withIndex("by_project_node", (q) =>
        q.eq("projectId", args.projectId).eq("nodeId", args.nodeId),
      )
      .order("desc")
      .collect();

    if (args.type) {
      conversations = conversations.filter((c) => c.type === args.type);
    }
    return conversations;
  },
});

export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }
    return conversation;
  },
});

export const clearConversationMessages = mutation({
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

    await Promise.all(messages.map((msg) => ctx.db.delete(msg._id)));
    await ctx.db.patch(args.conversationId, { updatedAt: Date.now() });
  },
});

export const deleteConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return;
    }

    if (identity && conversation.userId !== identity.subject && conversation.userId !== "anonymous") {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authorized to access this conversation",
      });
    }

    // Delete all messages belonging to this conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    await Promise.all(messages.map((msg) => ctx.db.delete(msg._id)));

    await ctx.db.delete(args.conversationId);
  },
});

