import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { backendTestCaseDataValidator } from "../schema/canvasValidators";
import { assertActiveSubscriptionForProject } from "../auth_guards";

export const upsertBackendTestCase = mutation({
  args: {
    projectId: v.id("projects"),
    testCaseId: v.string(),
    data: backendTestCaseDataValidator, // uses simulationTestCaseSchema
  },
  async handler(ctx, args) {
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_test_cases")
      .withIndex("by_project_test_case", (q) =>
        q.eq("projectId", args.projectId).eq("testCaseId", args.testCaseId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data });
    } else {
      await ctx.db.insert("canvas_backend_test_cases", {
        projectId: args.projectId,
        testCaseId: args.testCaseId,
        data: args.data,
      });
    }
  },
});

export const removeBackendTestCase = mutation({
  args: { projectId: v.id("projects"), testCaseId: v.string() },
  async handler(ctx, args) {
    await assertActiveSubscriptionForProject(ctx, args.projectId);

    const existing = await ctx.db
      .query("canvas_backend_test_cases")
      .withIndex("by_project_test_case", (q) =>
        q.eq("projectId", args.projectId).eq("testCaseId", args.testCaseId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
