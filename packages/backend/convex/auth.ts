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
  return betterAuth({
    appName: "Dezign2App",
    baseURL:
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:46500",
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "development-secret-key-at-least-32-chars-long-dezign2app-2026",
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
        clientId: process.env.GITHUB_CLIENT_ID || "Ov23limRnMyJ14xW58oP",
        clientSecret:
          process.env.GITHUB_CLIENT_SECRET ||
          "45d8f1dca4a68a6ed4967f6068f4d3454d426f0c",
        enabled: true,
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
        jwt: {
          definePayload: async ({ user, session }) => {
            const activeOrgId =
              "activeOrganizationId" in session
                ? (session as { activeOrganizationId?: string }).activeOrganizationId
                : undefined;
            return {
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
