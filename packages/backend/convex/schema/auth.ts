import { defineTable } from "convex/server";
import { v } from "convex/values";

export const authTables = {
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    creemCustomerId: v.optional(v.string()),
    authId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isSystemAdmin: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_creem_customer", ["creemCustomerId"])
    .index("by_auth_id", ["authId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    planId: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("incomplete"),
      v.literal("expired"),
      v.literal("trialing"),
      v.literal("unpaid"),
      v.literal("paused"),
      v.literal("free"),
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    creemSubscriptionId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_creem_sub_id", ["creemSubscriptionId"]),

  api_keys: defineTable({
    keyHash: v.string(),
    userId: v.string(),
    orgId: v.optional(v.string()),
    name: v.optional(v.string()),
    projectId: v.optional(v.string()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_key_hash", ["keyHash"])
    .index("by_user", ["userId"])
    .index("by_user_org", ["userId", "orgId"]),

  organization_billing: defineTable({
    organizationId: v.string(),
    ownerUserId: v.id("users"),
    baseSeats: v.number(),
    extraSeats: v.number(),
    totalSeats: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("expired"),
      v.literal("trialing"),
    ),
    creemSubscriptionId: v.optional(v.string()),
    creemCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_owner", ["ownerUserId"]),

  organization_deletions: defineTable({
    organizationId: v.string(),
    ownerUserId: v.id("users"),
    scheduledAt: v.number(),
    deleteAfter: v.number(),
    cancelledAt: v.optional(v.number()),
    convexSchedulerId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"]),
};

