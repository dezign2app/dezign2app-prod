import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import {
  backendEndpointDataValidator,
  backendIdentityProviderDataValidator,
  backendEventDataValidator,
} from "../schema/canvasValidators";
import { log } from "../logger";
import { assertActiveSubscriptionForProject } from "../auth_guards";

export const upsertBackendEndpoint = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    endpointId: v.string(),
    data: backendEndpointDataValidator,
  },
  async handler(ctx, args) {
    log(
      `[upsertBackendEndpoint] Upserting endpoint ${args.endpointId} on node ${args.nodeId} in project ${args.projectId}:`,
      {
        name: args.data.name,
        type: args.data.type,
      },
    );
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_endpoints")
      .withIndex("by_node_endpoint", (q) =>
        q.eq("nodeId", args.nodeId).eq("endpointId", args.endpointId),
      )
      .unique();

    if (existing) {
      log(`[upsertBackendEndpoint] Patching existing endpoint document ${existing._id}`);
      await ctx.db.patch(existing._id, { data: args.data });
    } else {
      log(`[upsertBackendEndpoint] Inserting new endpoint document ${args.endpointId}`);
      await ctx.db.insert("canvas_backend_endpoints", {
        projectId: args.projectId,
        nodeId: args.nodeId,
        endpointId: args.endpointId,
        data: args.data,
      });
    }
  },
});

export const removeBackendEndpoint = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    endpointId: v.string(),
  },
  async handler(ctx, args) {
    log(`[removeBackendEndpoint] Removing endpoint ${args.endpointId} on node ${args.nodeId} in project ${args.projectId}`);
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_endpoints")
      .withIndex("by_node_endpoint", (q) =>
        q.eq("nodeId", args.nodeId).eq("endpointId", args.endpointId),
      )
      .unique();

    if (existing) {
      log(`[removeBackendEndpoint] Deleting endpoint document ${existing._id}`);
      await ctx.db.delete(existing._id);
    }
  },
});

export const upsertBackendIdentityProvider = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    providerId: v.string(),
    data: backendIdentityProviderDataValidator,
  },
  async handler(ctx, args) {
    log(`[upsertBackendIdentityProvider] Upserting identity provider ${args.providerId} on node ${args.nodeId} in project ${args.projectId}:`, {
      provider: args.data.provider,
    });
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_identity_providers")
      .withIndex("by_node_provider", (q) =>
        q.eq("nodeId", args.nodeId).eq("providerId", args.providerId),
      )
      .unique();

    if (existing) {
      log(`[upsertBackendIdentityProvider] Patching existing provider document ${existing._id}`);
      await ctx.db.patch(existing._id, { data: args.data });
    } else {
      log(`[upsertBackendIdentityProvider] Inserting new provider document ${args.providerId}`);
      await ctx.db.insert("canvas_backend_identity_providers", {
        projectId: args.projectId,
        nodeId: args.nodeId,
        providerId: args.providerId,
        data: args.data,
      });
    }
  },
});

export const removeBackendIdentityProvider = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    providerId: v.string(),
  },
  async handler(ctx, args) {
    log(`[removeBackendIdentityProvider] Removing identity provider ${args.providerId} on node ${args.nodeId} in project ${args.projectId}`);
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_identity_providers")
      .withIndex("by_node_provider", (q) =>
        q.eq("nodeId", args.nodeId).eq("providerId", args.providerId),
      )
      .unique();

    if (existing) {
      log(`[removeBackendIdentityProvider] Deleting provider document ${existing._id}`);
      await ctx.db.delete(existing._id);
    }
  },
});

export const upsertBackendEvent = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    eventId: v.string(),
    variant: v.union(v.literal("publish"), v.literal("consume")),
    data: backendEventDataValidator,
  },
  async handler(ctx, args) {
    log(
      `[upsertBackendEvent] Upserting event ${args.eventId} (${args.variant}) on node ${args.nodeId} in project ${args.projectId}:`,
      {
        name: args.data.name,
        brokerNodeId: args.data.brokerNodeId,
      },
    );
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_events")
      .withIndex("by_node_event", (q) =>
        q.eq("nodeId", args.nodeId).eq("eventId", args.eventId),
      )
      .unique();

    if (existing) {
      log(`[upsertBackendEvent] Patching existing event document ${existing._id}`);
      await ctx.db.patch(existing._id, {
        variant: args.variant,
        data: args.data,
      });
    } else {
      log(`[upsertBackendEvent] Inserting new event document ${args.eventId}`);
      await ctx.db.insert("canvas_backend_events", {
        projectId: args.projectId,
        nodeId: args.nodeId,
        eventId: args.eventId,
        variant: args.variant,
        data: args.data,
      });
    }
  },
});

export const removeBackendEvent = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    eventId: v.string(),
  },
  async handler(ctx, args) {
    log(`[removeBackendEvent] Removing event ${args.eventId} on node ${args.nodeId} in project ${args.projectId}`);
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_events")
      .withIndex("by_node_event", (q) =>
        q.eq("nodeId", args.nodeId).eq("eventId", args.eventId),
      )
      .unique();

    if (existing) {
      log(`[removeBackendEvent] Deleting event document ${existing._id}`);
      await ctx.db.delete(existing._id);
    }
  },
});
