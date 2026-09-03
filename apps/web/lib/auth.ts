import { betterAuth } from "better-auth";
import { organization, bearer } from "better-auth/plugins";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "@workspace/backend/auth.config";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const appUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

const trustedOrigins = [
  appUrl,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((s) => s.trim()) || []),
  "dezign2app://",
].filter(Boolean) as string[];

export const auth = betterAuth({
  appName: "Dezign2App",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: Array.from(new Set(trustedOrigins)),
  emailAndPassword: {
    enabled: true,
    async sendResetPassword(data, _request) {
      if (resend) {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to: data.user.email,
            subject: "Reset your password - Dezign2App",
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                <h2>Password Reset Request</h2>
                <p>Hello ${data.user.name || "there"},</p>
                <p>We received a request to reset your password. Click the button below to choose a new password:</p>
                <p style="margin: 24px 0;">
                  <a href="${data.url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
                </p>
                <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          });
          return;
        } catch (err) {
          console.error("[Auth] Failed to send reset password email via Resend:", err);
        }
      }
      console.log(
        `\n========================================\n[AUTH DEV] Password reset link for ${data.user.email}:\n${data.url}\n========================================\n`,
      );
    },
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
    organization({
      allowUserToCreateOrganization: true,
      async sendInvitationEmail(data, _request) {
        const inviteUrl = `${appUrl}/accept-invitation/${data.id}`;
        if (resend) {
          try {
            await resend.emails.send({
              from: process.env.EMAIL_FROM || "onboarding@resend.dev",
              to: data.email,
              subject: `Invitation to join ${data.organization.name} on Dezign2App`,
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                  <h2>Team Invitation</h2>
                  <p>You have been invited to join <strong>${data.organization.name}</strong> on Dezign2App as <strong>${data.role}</strong>.</p>
                  <p style="margin: 24px 0;">
                    <a href="${inviteUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
                  </p>
                </div>
              `,
            });
            return;
          } catch (err) {
            console.error(
              "[Auth] Failed to send invitation email via Resend:",
              err,
            );
          }
        }
        console.log(
          `\n========================================\n[AUTH DEV] Org invitation for ${data.email} to ${data.organization.name}:\n${inviteUrl}\n========================================\n`,
        );
      },
    }),
    bearer(),
    convex({
      authConfig,
      jwt: {
        definePayload: async ({ user, session }) => {
          return {
            aud: "convex",
            sub: user.id,
            email: user.email,
            name: user.name,
            org_id: session.activeOrganizationId ?? undefined,
            orgId: session.activeOrganizationId ?? undefined,
          };
        },
      },
    }),
  ],
});
