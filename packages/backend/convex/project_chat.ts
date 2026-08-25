import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getChats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("project_chats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const createChat = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("project_chats", {
      projectId: args.projectId,
      title: args.title,
      createdAt: Date.now(),
    });
  },
});

export const getMessages = query({
  args: { chatId: v.id("project_chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("project_chat_messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    chatId: v.id("project_chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("project_chat_messages", {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const updateChatTitle = mutation({
  args: {
    chatId: v.id("project_chats"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, {
      title: args.title,
    });
  },
});

export const clearChatMessages = mutation({
  args: {
    chatId: v.id("project_chats"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("project_chat_messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
  },
});

export const deleteChat = mutation({
  args: {
    chatId: v.id("project_chats"),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("project_chat_messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)));
    await ctx.db.delete(args.chatId);
  },
});

