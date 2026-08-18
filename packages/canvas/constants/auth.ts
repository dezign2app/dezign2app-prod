import type { BetterAuthTableDefinition, AuthLifecycleHookDefinition } from "../types/auth";
import { DB_COLUMN_TYPES } from "./database";

// ─── Auth Framework & Better Auth Options ───────────────────────────────────────
export const AUTH_FRAMEWORK_BETTER_AUTH = "better_auth" as const;
export const AUTH_FRAMEWORK_NEXT_AUTH = "next_auth" as const;
export const AUTH_FRAMEWORK_LUCIA = "lucia" as const;
export const AUTH_FRAMEWORK_CUSTOM = "custom" as const;

export const AUTH_FRAMEWORK_OPTIONS = [
  { value: "better_auth", label: "Better Auth" },
] as const;

export const BETTER_AUTH_VERSIONS = [
  { value: "v1.4", label: "v1.4" },
] as const;

export const DEFAULT_AUTH_FRAMEWORK = AUTH_FRAMEWORK_BETTER_AUTH;
export const DEFAULT_BETTER_AUTH_VERSION = "v1.4";

export const ACCOUNT_LINKING_POLICY_OPTIONS = [
  {
    id: "prompt",
    label: "Prompt & Verify",
    desc: "disableImplicitLinking: true — Rejects silent merge with account_not_linked. Requires user password auth + linkSocial().",
  },
  {
    id: "merge",
    label: "Auto-Merge",
    desc: "enabled: true — Automatically links accounts when email matches and provider's email is verified.",
  },
  {
    id: "block",
    label: "Block Account Linking",
    desc: "enabled: false — Prevents linking OAuth logins to existing accounts.",
  },
] as const;

// ─── Auth Lifecycle Hook Events & Default Slots ──────────────────────────────
// Better Auth has TWO separate hook systems:
//   1. Endpoint hooks → hooks.before / hooks.after  (createAuthMiddleware, branch on ctx.path)
//   2. Database hooks → databaseHooks.{model}.{operation}.{before|after}

// --- Endpoint Hook Events (ctx.path strings) ---
export const AUTH_ENDPOINT_HOOK_EVENTS = {
  SIGN_UP: "/sign-up",
  SIGN_IN_EMAIL: "/sign-in/email",
  SIGN_OUT: "/sign-out",
  RESET_PASSWORD: "/reset-password",
  VERIFY_EMAIL: "/verify-email",
} as const;
export type AuthEndpointHookEvent = (typeof AUTH_ENDPOINT_HOOK_EVENTS)[keyof typeof AUTH_ENDPOINT_HOOK_EVENTS];

// Backwards-compat alias (old code referenced AUTH_HOOK_EVENTS)
export const AUTH_HOOK_EVENTS = AUTH_ENDPOINT_HOOK_EVENTS;
export type AuthHookEvent = AuthEndpointHookEvent;

// --- Database Hook Models & Operations (verified against Better Auth v1.x docs) ---
export const AUTH_DB_HOOK_MODELS = ["user", "session", "account"] as const;
export type AuthDbHookModel = (typeof AUTH_DB_HOOK_MODELS)[number];

export const AUTH_DB_HOOK_OPERATIONS = ["create", "update", "delete"] as const;
export type AuthDbHookOperation = (typeof AUTH_DB_HOOK_OPERATIONS)[number];

export const AUTH_DB_HOOK_PHASES = ["before", "after"] as const;
export type AuthDbHookPhase = (typeof AUTH_DB_HOOK_PHASES)[number];

// All three operations are supported on all three core models in v1.x
export const AUTH_DB_MODEL_OPERATIONS: Record<AuthDbHookModel, AuthDbHookOperation[]> = {
  user: ["create", "update", "delete"],
  session: ["create", "update", "delete"],
  account: ["create", "update", "delete"],
};

// --- Endpoint Hook Slot Definitions ---
export const LIFECYCLE_HOOK_SLOTS: AuthLifecycleHookDefinition[] = [
  {
    event: AUTH_ENDPOINT_HOOK_EVENTS.SIGN_UP,
    phase: "after",
    label: "hooks.after → /sign-up",
    description: "Runs after sign-up. Access ctx.context.newSession for the created session.",
    defaultPrompt: "After sign up, create a default workspace, initialize user settings, and send a welcome email.",
    defaultCode: `hooks: {\n  after: createAuthMiddleware(async (ctx) => {\n    if (ctx.path === "/sign-up/email") {\n      const newSession = ctx.context.newSession;\n      if (newSession) {\n        await createDefaultWorkspace(newSession.user.id);\n        await sendWelcomeEmail(newSession.user.email);\n      }\n    }\n  }),\n}`,
  },
  {
    event: AUTH_ENDPOINT_HOOK_EVENTS.SIGN_IN_EMAIL,
    phase: "after",
    label: "hooks.after → /sign-in/email",
    description: "Runs after email sign-in. Log analytics, check IP anomalies, update last-seen.",
    defaultPrompt: "Log sign-in timestamp, update lastLoginIp, and check for geo-location anomalies.",
    defaultCode: `hooks: {\n  after: createAuthMiddleware(async (ctx) => {\n    if (ctx.path === "/sign-in/email") {\n      // log analytics, check IP anomaly\n    }\n  }),\n}`,
  },
  {
    event: AUTH_ENDPOINT_HOOK_EVENTS.RESET_PASSWORD,
    phase: "after",
    label: "hooks.after → /reset-password",
    description: "Runs after a password reset. Invalidate other sessions, notify user.",
    defaultPrompt: "On password reset, invalidate all other active sessions and notify the user via email.",
    defaultCode: `hooks: {\n  after: createAuthMiddleware(async (ctx) => {\n    if (ctx.path === "/reset-password") {\n      // revoke sessions, send security email\n    }\n  }),\n}`,
  },
  {
    event: AUTH_ENDPOINT_HOOK_EVENTS.VERIFY_EMAIL,
    phase: "after",
    label: "hooks.after → /verify-email",
    description: "Runs after the email verification link is clicked.",
    defaultPrompt: "Upon email verification, mark user status active and grant 14-day trial access.",
    defaultCode: `hooks: {\n  after: createAuthMiddleware(async (ctx) => {\n    if (ctx.path === "/verify-email") {\n      // activate user, start trial\n    }\n  }),\n}`,
  },
];

// --- Database Hook Slot Definitions ---
// Verified against Better Auth v1.x docs: user / session / account support create + update + delete
export interface AuthDbHookDefinition {
  model: AuthDbHookModel;
  operation: AuthDbHookOperation;
  label: string;
  description: string;
  defaultPrompt: string;
  defaultCode: string;
}

export const DB_HOOK_SLOTS: AuthDbHookDefinition[] = [
  // user
  {
    model: "user", operation: "create",
    label: "databaseHooks.user.create",
    description: "Before/after a user row is inserted. Return { data: user } in before to mutate fields.",
    defaultPrompt: "Before user creation, normalize email to lowercase and trim whitespace.",
    defaultCode: `databaseHooks: {\n  user: {\n    create: {\n      before: async (user, ctx) => {\n        return { data: { ...user, email: user.email.toLowerCase().trim() } };\n      },\n    },\n  },\n}`,
  },
  {
    model: "user", operation: "update",
    label: "databaseHooks.user.update",
    description: "Before/after a user row is updated.",
    defaultPrompt: "After a user is updated, invalidate their profile cache.",
    defaultCode: `databaseHooks: {\n  user: {\n    update: {\n      after: async (user, ctx) => {\n        await invalidateUserCache(user.id);\n      },\n    },\n  },\n}`,
  },
  {
    model: "user", operation: "delete",
    label: "databaseHooks.user.delete",
    description: "Before/after a user row is deleted. Return false in before to abort.",
    defaultPrompt: "Before deleting a user, cascade-delete their workspaces and subscriptions.",
    defaultCode: `databaseHooks: {\n  user: {\n    delete: {\n      before: async (user, ctx) => {\n        await deleteUserWorkspaces(user.id);\n      },\n    },\n  },\n}`,
  },
  // session
  {
    model: "session", operation: "create",
    label: "databaseHooks.session.create",
    description: "Before/after a session row is created (sign-in, token refresh).",
    defaultPrompt: "After session creation, log the IP and user-agent for audit purposes.",
    defaultCode: `databaseHooks: {\n  session: {\n    create: {\n      after: async (session, ctx) => {\n        await logSessionCreated(session.userId, session.ipAddress);\n      },\n    },\n  },\n}`,
  },
  {
    model: "session", operation: "update",
    label: "databaseHooks.session.update",
    description: "Before/after a session row is updated (e.g. token rotation).",
    defaultPrompt: "After session update, emit a session-renewed analytics event.",
    defaultCode: `databaseHooks: {\n  session: {\n    update: {\n      after: async (session, ctx) => {\n        await trackSessionRenewed(session.userId);\n      },\n    },\n  },\n}`,
  },
  {
    model: "session", operation: "delete",
    label: "databaseHooks.session.delete",
    description: "Before/after a session row is deleted (sign-out, expiry).",
    defaultPrompt: "After session deletion, notify the user about the sign-out event.",
    defaultCode: `databaseHooks: {\n  session: {\n    delete: {\n      after: async (session, ctx) => {\n        await notifySignOut(session.userId);\n      },\n    },\n  },\n}`,
  },
  // account
  {
    model: "account", operation: "create",
    label: "databaseHooks.account.create",
    description: "Before/after an OAuth account row is created (first OAuth login).",
    defaultPrompt: "After account creation, send a welcome email for new OAuth users.",
    defaultCode: `databaseHooks: {\n  account: {\n    create: {\n      after: async (account, ctx) => {\n        if (account.providerId !== "credential") {\n          await sendWelcomeEmail(account.userId);\n        }\n      },\n    },\n  },\n}`,
  },
  {
    model: "account", operation: "update",
    label: "databaseHooks.account.update",
    description: "Before/after an OAuth account row is updated (token refresh, re-auth).",
    defaultPrompt: "After account update, log the token refresh for security auditing.",
    defaultCode: `databaseHooks: {\n  account: {\n    update: {\n      after: async (account, ctx) => {\n        await logTokenRefresh(account.userId, account.providerId);\n      },\n    },\n  },\n}`,
  },
  {
    model: "account", operation: "delete",
    label: "databaseHooks.account.delete",
    description: "Before/after an OAuth account row is deleted (provider unlink).",
    defaultPrompt: "After account deletion, notify the user that a linked provider was removed.",
    defaultCode: `databaseHooks: {\n  account: {\n    delete: {\n      after: async (account, ctx) => {\n        await notifyProviderUnlinked(account.userId, account.providerId);\n      },\n    },\n  },\n}`,
  },
];

// ─── Access Conditions & Protection Rule Enums ──────────────────────────────
export const CONDITION_PRIMITIVE_TYPES = [
  "auth",
  "org",
  "orgRole",
  "access",
  "subscriptionStatus",
  "plan",
  "customClaim",
] as const;

export type ConditionPrimitiveType = (typeof CONDITION_PRIMITIVE_TYPES)[number];

export const FAILURE_REASONS = [
  "no-auth",
  "no-org",
  "wrong-role",
  "no-access",
  "wrong-plan",
  "custom-denied",
] as const;

export type FailureReasonType = (typeof FAILURE_REASONS)[number];

export const SESSION_DELIVERY_MODES = ["jwt", "cookie"] as const;
export type SessionDeliveryMode = (typeof SESSION_DELIVERY_MODES)[number];

export const DEFAULT_SESSION_CLAIM_SOURCE = "customField" as const;
export const DEFAULT_SESSION_CLAIM_DELIVERY_MODE = "jwt" as const;

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "expired",
] as const;

export type SubscriptionStatusType = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENTS_INTERVALS = ["monthly", "yearly"] as const;
export type PaymentsIntervalType = (typeof PAYMENTS_INTERVALS)[number];

export const PAYMENT_PROVIDER_OPTIONS = [
  { value: "creem", label: "Creem" },
  // { value: "lemonsqueezy", label: "Lemon Squeezy" },
  // { value: "custom", label: "Custom Billing Engine" },
  // { value: "stripe", label: "Stripe" }
] as const;

// ─── Better Auth Table Keys & Plugins ──────────────────────────────────────────
export const BETTER_AUTH_TABLE_KEYS = {
  USER: "userEntityId",
  SESSION: "sessionEntityId",
  ACCOUNT: "accountEntityId",
  VERIFICATION: "verificationEntityId",
  ORG: "orgEntityId",
  MEMBER: "memberEntityId",
  INVITATION: "invitationEntityId",
  TEAM: "teamEntityId",
  TEAM_MEMBER: "teamMemberEntityId",
  PASSKEY: "passkeyEntityId",
  TWO_FACTOR: "twoFactorEntityId",
  JWKS: "jwksEntityId",
  RATE_LIMIT: "rateLimitEntityId",
} as const;

export type BetterAuthTableKey = (typeof BETTER_AUTH_TABLE_KEYS)[keyof typeof BETTER_AUTH_TABLE_KEYS];

// ─── Better Auth Table Names ───────────────────────────────────────────────────
export const BETTER_AUTH_TABLE_NAMES = {
  USER: "user",
  SESSION: "session",
  ACCOUNT: "account",
  VERIFICATION: "verification",
  ORG: "organization",
  MEMBER: "member",
  INVITATION: "invitation",
  TEAM: "team",
  TEAM_MEMBER: "teamMember",
  PASSKEY: "passkey",
  TWO_FACTOR: "twoFactor",
  JWKS: "jwks",
  RATE_LIMIT: "rateLimit",
} as const;

export type BetterAuthTableName = (typeof BETTER_AUTH_TABLE_NAMES)[keyof typeof BETTER_AUTH_TABLE_NAMES];

// ─── Better Auth Categories ───────────────────────────────────────────────────
export const BETTER_AUTH_CATEGORIES = {
  CORE: "core",
  ORGANIZATION: "organization",
  PLUGIN: "plugin",
} as const;

export type BetterAuthCategory = (typeof BETTER_AUTH_CATEGORIES)[keyof typeof BETTER_AUTH_CATEGORIES];

export const BETTER_AUTH_PLUGINS = {
  TWO_FACTOR: "twoFactor",
  ORGANIZATION: "organization",
  PASSKEY: "passkey",
  MAGIC_LINK: "magicLink",
  EMAIL_OTP: "emailOtp",
  USERNAME: "username",
  PHONE_NUMBER: "phoneNumber",
  ADMIN: "admin",
  API_KEY: "apiKey",
  BEARER: "bearer",
  JWT: "jwt",
  MULTI_SESSION: "multiSession",
  SSO: "sso",
  RATE_LIMIT: "rateLimit",
} as const;

export type BetterAuthPluginId = (typeof BETTER_AUTH_PLUGINS)[keyof typeof BETTER_AUTH_PLUGINS];

// ─── Better Auth Table Definitions ───────────────────────────────────────────
export const BETTER_AUTH_TABLE_DEFINITIONS: BetterAuthTableDefinition[] = [
  {
    key: BETTER_AUTH_TABLE_KEYS.USER,
    name: BETTER_AUTH_TABLE_NAMES.USER,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "Core user accounts, emails, display names, and verification flags.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "name", type: DB_COLUMN_TYPES.TEXT },
      { name: "email", type: DB_COLUMN_TYPES.TEXT, isUnique: true },
      { name: "emailVerified", type: DB_COLUMN_TYPES.BOOLEAN },
      { name: "image", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.SESSION,
    name: BETTER_AUTH_TABLE_NAMES.SESSION,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "Active session tokens, expiration timestamps, IP & User-Agent metadata.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "userId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "token", type: DB_COLUMN_TYPES.TEXT, isUnique: true },
      { name: "expiresAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "ipAddress", type: DB_COLUMN_TYPES.TEXT },
      { name: "userAgent", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.ACCOUNT,
    name: BETTER_AUTH_TABLE_NAMES.ACCOUNT,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "OAuth provider credentials, hashed passwords, and token links.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "userId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "accountId", type: DB_COLUMN_TYPES.TEXT },
      { name: "providerId", type: DB_COLUMN_TYPES.TEXT },
      { name: "password", type: DB_COLUMN_TYPES.TEXT },
      { name: "accessToken", type: DB_COLUMN_TYPES.TEXT },
      { name: "refreshToken", type: DB_COLUMN_TYPES.TEXT },
      { name: "accessTokenExpiresAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "refreshTokenExpiresAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "scope", type: DB_COLUMN_TYPES.TEXT },
      { name: "idToken", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.VERIFICATION,
    name: BETTER_AUTH_TABLE_NAMES.VERIFICATION,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "Email verification, magic link, and OTP tokens.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "identifier", type: DB_COLUMN_TYPES.TEXT },
      { name: "value", type: DB_COLUMN_TYPES.TEXT },
      { name: "expiresAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.ORG,
    name: BETTER_AUTH_TABLE_NAMES.ORG,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "Multi-tenant workspaces, company accounts, and team scopes.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "name", type: DB_COLUMN_TYPES.TEXT },
      { name: "slug", type: DB_COLUMN_TYPES.TEXT, isUnique: true },
      { name: "logo", type: DB_COLUMN_TYPES.TEXT },
      { name: "metadata", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.MEMBER,
    name: BETTER_AUTH_TABLE_NAMES.MEMBER,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "User membership mappings to organizations with roles.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "organizationId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.ORG, column: "id" } },
      { name: "userId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "role", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.INVITATION,
    name: BETTER_AUTH_TABLE_NAMES.INVITATION,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "Pending email invitations for joining organizations.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "organizationId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.ORG, column: "id" } },
      { name: "email", type: DB_COLUMN_TYPES.TEXT },
      { name: "role", type: DB_COLUMN_TYPES.TEXT },
      { name: "status", type: DB_COLUMN_TYPES.TEXT },
      { name: "expiresAt", type: DB_COLUMN_TYPES.TEXT },
      { name: "inviterId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.TEAM,
    name: BETTER_AUTH_TABLE_NAMES.TEAM,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "Sub-groups and department teams within organizations.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "organizationId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.ORG, column: "id" } },
      { name: "name", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.TEAM_MEMBER,
    name: BETTER_AUTH_TABLE_NAMES.TEAM_MEMBER,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "User memberships mapped to organization teams.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "teamId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.TEAM, column: "id" } },
      { name: "userId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "role", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.PASSKEY,
    name: BETTER_AUTH_TABLE_NAMES.PASSKEY,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "WebAuthn / Passkey public credentials and counters.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "name", type: DB_COLUMN_TYPES.TEXT },
      { name: "publicKey", type: DB_COLUMN_TYPES.TEXT },
      { name: "userId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "credentialID", type: DB_COLUMN_TYPES.TEXT, isUnique: true },
      { name: "counter", type: DB_COLUMN_TYPES.INTEGER },
      { name: "transports", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.TWO_FACTOR,
    name: BETTER_AUTH_TABLE_NAMES.TWO_FACTOR,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "TOTP secrets and encrypted recovery backup codes.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "userId", type: DB_COLUMN_TYPES.TEXT, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "secret", type: DB_COLUMN_TYPES.TEXT },
      { name: "backupCodes", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.JWKS,
    name: BETTER_AUTH_TABLE_NAMES.JWKS,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "RSA / EC keypairs for JWT signing and OIDC discovery.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "publicKey", type: DB_COLUMN_TYPES.TEXT },
      { name: "privateKey", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TEXT },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.RATE_LIMIT,
    name: BETTER_AUTH_TABLE_NAMES.RATE_LIMIT,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "Brute-force protection counter table.",
    defaultColumns: [
      { name: "key", type: DB_COLUMN_TYPES.TEXT, isPrimaryKey: true },
      { name: "count", type: DB_COLUMN_TYPES.INTEGER },
      { name: "lastRequest", type: DB_COLUMN_TYPES.INTEGER },
    ],
  },
];

export interface BetterAuthTableRequirementOptions {
  isOrgEnabled?: boolean;
  enabledPlugins?: string[];
  providers?: {
    passkey?: boolean;
    emailPassword?: {
      enabled?: boolean;
      rateLimit?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
}

export function isBetterAuthTableRequired(
  def: BetterAuthTableDefinition,
  options: BetterAuthTableRequirementOptions = {},
): boolean {
  const { isOrgEnabled = true, enabledPlugins = [], providers } = options;

  if (def.category === BETTER_AUTH_CATEGORIES.CORE) return true;
  if (def.category === BETTER_AUTH_CATEGORIES.ORGANIZATION) return isOrgEnabled;

  if (def.key === BETTER_AUTH_TABLE_KEYS.PASSKEY) {
    return enabledPlugins.includes(BETTER_AUTH_PLUGINS.PASSKEY) || Boolean(providers?.passkey);
  }
  if (def.key === BETTER_AUTH_TABLE_KEYS.TWO_FACTOR) {
    return enabledPlugins.includes(BETTER_AUTH_PLUGINS.TWO_FACTOR);
  }
  if (def.key === BETTER_AUTH_TABLE_KEYS.JWKS) {
    return (
      enabledPlugins.includes(BETTER_AUTH_PLUGINS.JWT) ||
      enabledPlugins.includes(BETTER_AUTH_PLUGINS.BEARER)
    );
  }
  if (def.key === BETTER_AUTH_TABLE_KEYS.RATE_LIMIT) {
    return (
      enabledPlugins.includes(BETTER_AUTH_PLUGINS.RATE_LIMIT) ||
      providers?.emailPassword?.enabled !== false ||
      Boolean(providers?.emailPassword?.rateLimit)
    );
  }

  return false;
}
