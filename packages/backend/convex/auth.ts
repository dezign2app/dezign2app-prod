import { betterAuth, type User } from "better-auth";
import {
  createClient,
  type CreateAuth,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { components, api } from "./_generated/api";
import authConfig from "./auth.config";
import { convex } from "@convex-dev/better-auth/plugins";
import { organization, bearer } from "better-auth/plugins";
import type { GenericDataModel } from "convex/server";

export const betterAuthComponentClient = createClient(components.betterAuth);

export const createAuth: CreateAuth<GenericDataModel> = (
  ctx: GenericCtx<GenericDataModel>,
) => {
  const baseURL =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  const trustedOrigins = [
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((s) => s.trim()) || []),
    "dezign2app://",
  ].filter(Boolean) as string[];

  return betterAuth({
    appName: "Dezign2App",
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: Array.from(new Set(trustedOrigins)),
    database: betterAuthComponentClient.adapter(ctx),
    databaseHooks: {
      user: {
        create: {
          after: async (user: User) => {
            if ("runMutation" in ctx && user.email) {
              try {
                await ctx.runMutation(api.users.ensureAuthUser, {
                  email: user.email,
                  name: user.name || user.email.split("@")[0] || "User",
                  authId: user.id,
                  avatarUrl: user.image ?? undefined,
                });
              } catch (e) {
                console.error("[Auth] Error syncing user on create:", e);
              }
            }
          },
        },
        update: {
          after: async (user: User) => {
            if ("runMutation" in ctx && user.email) {
              try {
                await ctx.runMutation(api.users.ensureAuthUser, {
                  email: user.email,
                  name: user.name || user.email.split("@")[0] || "User",
                  authId: user.id,
                  avatarUrl: user.image ?? undefined,
                });
              } catch (e) {
                console.error("[Auth] Error syncing user on update:", e);
              }
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        enabled: !!(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ),
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        enabled: !!(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
      },
    },
    plugins: [
      organization({ allowUserToCreateOrganization: true }),
      bearer(),
      convex({
        authConfig,
        jwksRotateOnTokenGenerationError: true,
        jwt: {
          definePayload: async ({ user, session }) => {
            const activeOrgId =
              "activeOrganizationId" in session &&
              typeof session.activeOrganizationId === "string"
                ? session.activeOrganizationId
                : undefined;
            return {
              aud: "convex",
              sub: user.id,
              email: user.email,
              name: user.name,
              org_id: activeOrgId,
              orgId: activeOrgId,
            };
          },
        },
      }),
    ],
  });
};
