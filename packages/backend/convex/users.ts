import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSubscriptionStatus = query({
  args: {
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userEmail = identity?.email || args.email;
    if (!userEmail) {
      return { status: "unauthenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .first();

    if (!user) {
      return { status: "no_subscription", hasPriorSubscription: false };
    }

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // If no subscriptions found at all, user is "new" to payments
    if (subscriptions.length === 0) {
      return { status: "no_subscription", hasPriorSubscription: false };
    }

    // Find if there is any active subscription
    const activeSub = subscriptions.find(
      (sub) => sub.status === "active" || sub.status === "trialing",
    );

    if (activeSub) {
      return {
        status: "active",
        hasPriorSubscription: true,
        creemSubscriptionId: activeSub.creemSubscriptionId,
        planId: activeSub.planId,
      };
    }

    // If subscriptions exist but none are active, they are an "existing" user with a lapsed sub
    return {
      status: "inactive",
      hasPriorSubscription: true,
    };
  },
});

export const ensureAuthUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    authId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      const updates: { authId?: string; avatarUrl?: string } = {};
      if (args.authId && !existingUser.authId) {
        updates.authId = args.authId;
      }
      if (args.avatarUrl && !existingUser.avatarUrl) {
        updates.avatarUrl = args.avatarUrl;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existingUser._id, updates);
      }
      return existingUser._id;
    }

    const newUserId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      authId: args.authId,
      avatarUrl: args.avatarUrl,
      passwordHash: "",
      createdAt: Date.now(),
    });

    return newUserId;
  },
});

export const syncCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return null;

    const email = identity.email;
    const name = identity.name || email.split("@")[0] || "User";
    const authId = identity.subject;
    const avatarUrl = identity.pictureUrl;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      if (authId && !existingUser.authId) {
        await ctx.db.patch(existingUser._id, {
          authId,
        });
      }
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      email,
      name,
      authId,
      avatarUrl,
      passwordHash: "",
      createdAt: Date.now(),
    });
  },
});

export const getIsSystemAdmin = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    return user?.isSystemAdmin ?? false;
  },
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
  },
});
