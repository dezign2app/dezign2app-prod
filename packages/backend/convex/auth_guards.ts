import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { UserIdentity } from "convex/server";

/**
 * Verifies if a user is an authorized member of an organization.
 */
export async function isUserAuthorizedForOrg(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  targetOrgId: string,
  tokenOrgId?: string,
): Promise<boolean> {
  if (tokenOrgId && tokenOrgId === targetOrgId) {
    return true;
  }
  try {
    const member = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "member",
      where: [
        { field: "organizationId", value: targetOrgId },
        { field: "userId", value: userId },
      ],
    });
    return !!member;
  } catch (err) {
    console.error("[auth_guards] Error checking org membership:", err);
    return false;
  }
}

/**
 * Checks whether an organization has an active subscription, either via
 * organization_billing (with dedicated creemSubscriptionId) or through
 * the organization owner's personal subscription / early believer status.
 */
export async function isOrgSubscriptionActive(
  ctx: QueryCtx | MutationCtx,
  organizationId: string,
): Promise<boolean> {
  const orgBilling = await ctx.db
    .query("organization_billing")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  // If the organization has a dedicated Creem subscription ID, trust its billing status
  if (orgBilling?.creemSubscriptionId) {
    return orgBilling.status === "active" || orgBilling.status === "trialing";
  }

  // Fallback: check if the organization owner has an active subscription or early believer status
  try {
    const ownerMember = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      {
        model: "member",
        where: [
          { field: "organizationId", value: organizationId },
          { field: "role", value: "owner" },
        ],
      },
    );

    if (ownerMember?.userId) {
      const ownerUser = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", ownerMember.userId))
        .first();

      if (ownerUser) {
        if (ownerUser.isSystemAdmin) return true;

        const ownerSubs = await ctx.db
          .query("subscriptions")
          .withIndex("by_user", (q) => q.eq("userId", ownerUser._id))
          .collect();

        const hasActiveSub = ownerSubs.some(
          (s) => s.status === "active" || s.status === "trialing",
        );
        if (hasActiveSub) return true;

        const ownerEb = await ctx.db
          .query("early_believers")
          .withIndex("by_user", (q) => q.eq("userId", ownerUser._id))
          .first();

        if (ownerEb && ownerEb.status === "active") return true;
      }
    }
  } catch (e) {
    console.error("[auth_guards] Error checking owner subscription:", e);
  }

  return false;
}

/**
 * Checks whether a user has an active personal subscription, early believer status, or system admin rights.
 */
export async function isUserSubscriptionActive(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<boolean> {
  if (user.isSystemAdmin) {
    return true;
  }

  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const hasActiveSub = subscriptions.some(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );
  if (hasActiveSub) return true;

  const eb = await ctx.db
    .query("early_believers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();

  return !!(eb && eb.status === "active");
}

/**
 * Retrieves the authenticated user doc or throws an UNAUTHORIZED error.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ identity: UserIdentity; user: Doc<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  let user = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
    .first();

  if (!user && identity.email) {
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
  }

  if (!user) {
    throw new ConvexError({
      code: "PAYWALL_SUBSCRIPTION_REQUIRED",
      message: "User account not initialized. An active subscription is required.",
    });
  }

  return { identity, user };
}

/**
 * Asserts that the authenticated user has permission to edit the project
 * AND that an active subscription is in place (for personal workspace or organization workspace).
 */
export async function assertActiveSubscriptionForProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<{
  identity: UserIdentity;
  user: Doc<"users">;
  project: Doc<"projects">;
}> {
  const { identity, user } = await getAuthenticatedUser(ctx);

  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  }

  // System admin bypass
  if (user.isSystemAdmin) {
    return { identity, user, project };
  }

  // Organization Project
  if (project.organizationId) {
    const isMember = await isUserAuthorizedForOrg(
      ctx,
      identity.subject,
      project.organizationId,
      identity.org_id?.toString(),
    );

    if (!isMember && project.createdBy !== identity.subject) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authorized to modify this organization project",
      });
    }

    const hasActiveOrgSub = await isOrgSubscriptionActive(
      ctx,
      project.organizationId,
    );

    if (!hasActiveOrgSub) {
      throw new ConvexError({
        code: "PAYWALL_SUBSCRIPTION_REQUIRED",
        message: "An active subscription is required for this organization workspace to edit projects.",
      });
    }

    return { identity, user, project };
  }

  // Personal Project
  if (project.createdBy !== identity.subject) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Not authorized to modify this project",
    });
  }

  const hasActiveSub = await isUserSubscriptionActive(ctx, user);
  if (!hasActiveSub) {
    throw new ConvexError({
      code: "PAYWALL_SUBSCRIPTION_REQUIRED",
      message: "An active subscription is required to edit projects.",
    });
  }

  return { identity, user, project };
}

/**
 * Asserts that the authenticated user has an active subscription before
 * allowing them to create or duplicate a project.
 */
export async function assertCanCreateProject(
  ctx: MutationCtx,
  targetOrgId?: string | null,
): Promise<{
  identity: UserIdentity;
  user: Doc<"users">;
}> {
  const { identity, user } = await getAuthenticatedUser(ctx);

  if (user.isSystemAdmin) {
    return { identity, user };
  }

  if (targetOrgId && targetOrgId !== "personal") {
    const isMember = await isUserAuthorizedForOrg(
      ctx,
      identity.subject,
      targetOrgId,
      identity.org_id?.toString(),
    );

    if (!isMember) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authorized to create projects in this organization",
      });
    }

    const hasActiveOrgSub = await isOrgSubscriptionActive(ctx, targetOrgId);
    if (!hasActiveOrgSub) {
      throw new ConvexError({
        code: "PAYWALL_SUBSCRIPTION_REQUIRED",
        message: "An active organization subscription is required to create projects.",
      });
    }

    return { identity, user };
  }

  // Personal project creation
  const hasActiveSub = await isUserSubscriptionActive(ctx, user);
  if (!hasActiveSub) {
    throw new ConvexError({
      code: "PAYWALL_SUBSCRIPTION_REQUIRED",
      message: "An active subscription is required to create projects.",
    });
  }

  return { identity, user };
}

/**
 * Asserts that the authenticated user has an active subscription before
 * creating API keys.
 */
export async function assertCanManageApiKeys(
  ctx: MutationCtx,
  orgId?: string | null,
): Promise<{
  identity: UserIdentity;
  user: Doc<"users">;
}> {
  const { identity, user } = await getAuthenticatedUser(ctx);

  if (user.isSystemAdmin) {
    return { identity, user };
  }

  if (orgId && orgId !== "personal") {
    const isMember = await isUserAuthorizedForOrg(
      ctx,
      identity.subject,
      orgId,
      identity.org_id?.toString(),
    );

    if (!isMember) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authorized for this organization",
      });
    }

    const hasActiveOrgSub = await isOrgSubscriptionActive(ctx, orgId);
    if (!hasActiveOrgSub) {
      throw new ConvexError({
        code: "PAYWALL_SUBSCRIPTION_REQUIRED",
        message: "An active organization subscription is required to generate API keys.",
      });
    }

    return { identity, user };
  }

  const hasActiveSub = await isUserSubscriptionActive(ctx, user);
  if (!hasActiveSub) {
    throw new ConvexError({
      code: "PAYWALL_SUBSCRIPTION_REQUIRED",
      message: "An active subscription is required to generate API keys.",
    });
  }

  return { identity, user };
}
