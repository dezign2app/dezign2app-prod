import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { log } from "./logger";

// ----------------------------------------------------------------------------
// LANGGRAPH PIPELINE STEPS MUTATIONS & QUERIES
// ----------------------------------------------------------------------------

export const upsertLangGraphStep = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    stepId: v.string(),
    name: v.string(),
    type: v.string(),
    modelConfig: v.optional(v.any()),
    humanGateConfig: v.optional(v.any()),
    interruptConfig: v.optional(v.any()),
    vectorSearchConfig: v.optional(v.any()),
    customCode: v.optional(v.any()),
    tools: v.optional(v.array(v.string())),
    retryPolicy: v.optional(v.any()),
  },
  async handler(ctx, args) {
    log(
      `[upsertLangGraphStep] Upserting step "${args.name}" (${args.stepId}) on node ${args.nodeId} in project ${args.projectId}`,
    );
    const existing = await ctx.db
      .query("canvas_backend_langgraph_steps")
      .withIndex("by_node_step", (q) =>
        q.eq("nodeId", args.nodeId).eq("stepId", args.stepId),
      )
      .first();

    if (existing) {
      log(`[upsertLangGraphStep] Patching existing step document ${existing._id}`);
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      log(`[upsertLangGraphStep] Inserting new step document for step ${args.stepId}`);
      return await ctx.db.insert("canvas_backend_langgraph_steps", args);
    }
  },
});

export const getLangGraphSteps = query({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
  },
  async handler(ctx, args) {
    log(`[getLangGraphSteps] Querying steps for node ${args.nodeId} in project ${args.projectId}`);
    const steps = await ctx.db
      .query("canvas_backend_langgraph_steps")
      .withIndex("by_project_node", (q) =>
        q.eq("projectId", args.projectId).eq("nodeId", args.nodeId),
      )
      .collect();
    log(`[getLangGraphSteps] Found ${steps.length} steps for node ${args.nodeId}`);
    return steps;
  },
});

// ----------------------------------------------------------------------------
// LANGGRAPH TOPOLOGY EDGES MUTATIONS & QUERIES
// ----------------------------------------------------------------------------

export const upsertLangGraphEdge = mutation({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
    edgeId: v.string(),
    source: v.string(),
    targets: v.array(v.object({ id: v.string(), kind: v.string() })),
    condition: v.optional(v.any()),
    isDefault: v.optional(v.boolean()),
    sendConfig: v.optional(v.any()),
  },
  async handler(ctx, args) {
    log(
      `[upsertLangGraphEdge] Upserting edge ${args.edgeId} (source=${args.source}) on node ${args.nodeId} in project ${args.projectId}`,
    );
    const existing = await ctx.db
      .query("canvas_backend_langgraph_edges")
      .withIndex("by_node_edge", (q) =>
        q.eq("nodeId", args.nodeId).eq("edgeId", args.edgeId),
      )
      .first();

    if (existing) {
      log(`[upsertLangGraphEdge] Patching existing edge document ${existing._id}`);
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      log(`[upsertLangGraphEdge] Inserting new edge document for edge ${args.edgeId}`);
      return await ctx.db.insert("canvas_backend_langgraph_edges", args);
    }
  },
});

export const getLangGraphEdges = query({
  args: {
    projectId: v.id("projects"),
    nodeId: v.string(),
  },
  async handler(ctx, args) {
    log(`[getLangGraphEdges] Querying edges for node ${args.nodeId} in project ${args.projectId}`);
    const edges = await ctx.db
      .query("canvas_backend_langgraph_edges")
      .withIndex("by_project_node", (q) =>
        q.eq("projectId", args.projectId).eq("nodeId", args.nodeId),
      )
      .collect();
    log(`[getLangGraphEdges] Found ${edges.length} edges for node ${args.nodeId}`);
    return edges;
  },
});

// ----------------------------------------------------------------------------
// THREAD CHECKPOINTS MUTATIONS & QUERIES
// ----------------------------------------------------------------------------

export const saveCheckpoint = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    threadId: v.string(),
    checkpointId: v.string(),
    status: v.string(),
    stateSnapshot: v.any(),
    waitingPortId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    log(
      `[saveCheckpoint] Saving checkpoint ${args.checkpointId} (status=${args.status}) for thread ${args.threadId}`,
    );
    const existing = await ctx.db
      .query("langgraph_checkpoints")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    const updatedAt = Date.now();
    if (existing) {
      log(`[saveCheckpoint] Patching existing checkpoint ${existing._id}`);
      await ctx.db.patch(existing._id, { ...args, updatedAt });
      return existing._id;
    } else {
      log(`[saveCheckpoint] Inserting new checkpoint for thread ${args.threadId}`);
      return await ctx.db.insert("langgraph_checkpoints", {
        ...args,
        updatedAt,
      });
    }
  },
});

export const getCheckpoint = query({
  args: {
    threadId: v.string(),
  },
  async handler(ctx, args) {
    log(`[getCheckpoint] Fetching checkpoint for thread ${args.threadId}`);
    return await ctx.db
      .query("langgraph_checkpoints")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
  },
});

// ----------------------------------------------------------------------------
// ATOMIC SINGLE-USE RESUME TOKEN VERIFICATION (TOCTOU ELIMINATION)
// ----------------------------------------------------------------------------

export const createResumeToken = mutation({
  args: {
    threadId: v.string(),
    resumeToken: v.string(),
    waitingPortId: v.string(),
    timeoutMs: v.number(),
  },
  async handler(ctx, args) {
    log(`[createResumeToken] Creating token for thread ${args.threadId} (timeout=${args.timeoutMs}ms)`);
    const now = Date.now();
    const expiresAt = now + args.timeoutMs;
    return await ctx.db.insert("langgraph_resume_tokens", {
      threadId: args.threadId,
      resumeToken: args.resumeToken,
      waitingPortId: args.waitingPortId,
      expiresAt,
      createdAt: now,
    });
  },
});

export const atomicConsumeResumeToken = mutation({
  args: {
    threadId: v.string(),
    tokenInput: v.string(),
  },
  async handler(ctx, args) {
    log(`[atomicConsumeResumeToken] Consuming token for thread ${args.threadId}`);
    // ATOMIC OPERATIONAL DELETE: The deletion IS the verification.
    const tokenDoc = await ctx.db
      .query("langgraph_resume_tokens")
      .withIndex("by_token", (q) => q.eq("resumeToken", args.tokenInput))
      .first();

    if (!tokenDoc) {
      log(`[atomicConsumeResumeToken] Token not found or already consumed`);
      // Zero rows affected / token not found: Token was already consumed, expired, or invalid
      throw new ConvexError(
        "InvalidResumeTokenError: Resume token is invalid, expired, or already consumed.",
      );
    }

    if (tokenDoc.threadId !== args.threadId) {
      log(`[atomicConsumeResumeToken] Token thread mismatch`);
      throw new ConvexError(
        "InvalidResumeTokenError: Token does not match active thread session.",
      );
    }

    if (tokenDoc.expiresAt < Date.now()) {
      log(`[atomicConsumeResumeToken] Token expired`);
      await ctx.db.delete(tokenDoc._id);
      throw new ConvexError(
        "InvalidResumeTokenError: Resume token has expired.",
      );
    }

    // IMMEDIATELY INVALIDATE (DELETE) TOKEN IN THE ATOMIC TRANSACTION
    await ctx.db.delete(tokenDoc._id);
    log(`[atomicConsumeResumeToken] Token consumed and deleted atomically`);

    // Fetch and return associated thread checkpoint
    const checkpointDoc = await ctx.db
      .query("langgraph_checkpoints")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    return {
      tokenDoc,
      checkpointDoc,
    };
  },
});
