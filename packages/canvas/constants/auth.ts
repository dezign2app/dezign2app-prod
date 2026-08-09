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
  { value: "v1.7", label: "v1.7" },
] as const;

export const DEFAULT_AUTH_FRAMEWORK = AUTH_FRAMEWORK_BETTER_AUTH;
export const DEFAULT_BETTER_AUTH_VERSION = "v1.7";

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
export const AUTH_HOOK_EVENTS = {
  ON_SIGN_UP: "onSignUp",
  ON_SIGN_IN: "onSignIn",
  ON_SIGN_OUT: "onSignOut",
  ON_PASSWORD_RESET: "onPasswordReset",
  ON_EMAIL_VERIFY: "onEmailVerify",
  ON_ORG_CREATE: "onOrgCreate",
  ON_ORG_INVITE: "onOrgInvite",
} as const;

export type AuthHookEvent = (typeof AUTH_HOOK_EVENTS)[keyof typeof AUTH_HOOK_EVENTS];

export const LIFECYCLE_HOOK_SLOTS: AuthLifecycleHookDefinition[] = [
  {
    event: AUTH_HOOK_EVENTS.ON_SIGN_UP,
    label: "onSignUp",
    description: "Triggered immediately after a new user completes sign-up.",
    defaultPrompt: "After sign up, create a default workspace, initialize user settings, and send a welcome email.",
    defaultCode: `export async function onSignUp(user: User, ctx: AuthContext) {\n  await createDefaultWorkspace(user.id);\n  await sendWelcomeEmail(user.email);\n}`,
  },
  {
    event: AUTH_HOOK_EVENTS.ON_SIGN_IN,
    label: "onSignIn",
    description: "Triggered on every successful user sign-in.",
    defaultPrompt: "Log sign-in timestamp, update lastLoginIp, and check for geo-location anomalies.",
    defaultCode: `export async function onSignIn(session: Session, ctx: AuthContext) {\n  console.log(\`User \${session.userId} signed in from \${session.ipAddress}\`);\n}`,
  },
  {
    event: AUTH_HOOK_EVENTS.ON_PASSWORD_RESET,
    label: "onPasswordReset",
    description: "Triggered when a user requests or completes a password reset.",
    defaultPrompt: "On password reset, invalidate all other active sessions and notify the user via email.",
    defaultCode: `export async function onPasswordReset(user: User, ctx: AuthContext) {\n  await revokeAllUserSessions(user.id);\n}`,
  },
  {
    event: AUTH_HOOK_EVENTS.ON_EMAIL_VERIFY,
    label: "onEmailVerify",
    description: "Triggered when user clicks email verification link.",
    defaultPrompt: "Upon email verification, mark user status active and grant 14-day trial access.",
    defaultCode: `export async function onEmailVerify(user: User, ctx: AuthContext) {\n  await updateUserStatus(user.id, "active");\n}`,
  },
  {
    event: AUTH_HOOK_EVENTS.ON_ORG_CREATE,
    label: "onOrgCreate",
    description: "Triggered when a new Organization workspace is created.",
    defaultPrompt: "When an organization is created, assign creator as owner and seed default roles.",
    defaultCode: `export async function onOrgCreate(org: Organization, user: User) {\n  await addMember(org.id, user.id, "owner");\n}`,
  },
  {
    event: AUTH_HOOK_EVENTS.ON_ORG_INVITE,
    label: "onOrgInvite",
    description: "Triggered when an invitation is dispatched.",
    defaultPrompt: "Send email invite containing secure single-use sign-up token link.",
    defaultCode: `export async function onOrgInvite(invite: Invitation) {\n  await sendInviteMail(invite.email, invite.token);\n}`,
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
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "name", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "email", type: DB_COLUMN_TYPES.VARCHAR, isUnique: true },
      { name: "emailVerified", type: DB_COLUMN_TYPES.BOOLEAN },
      { name: "image", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.SESSION,
    name: BETTER_AUTH_TABLE_NAMES.SESSION,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "Active session tokens, expiration timestamps, IP & User-Agent metadata.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "userId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "token", type: DB_COLUMN_TYPES.VARCHAR, isUnique: true },
      { name: "expiresAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "ipAddress", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "userAgent", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.ACCOUNT,
    name: BETTER_AUTH_TABLE_NAMES.ACCOUNT,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "OAuth provider credentials, hashed passwords, and token links.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "userId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "accountId", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "providerId", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "password", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "accessToken", type: DB_COLUMN_TYPES.TEXT },
      { name: "refreshToken", type: DB_COLUMN_TYPES.TEXT },
      { name: "accessTokenExpiresAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "refreshTokenExpiresAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "scope", type: DB_COLUMN_TYPES.TEXT },
      { name: "idToken", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.VERIFICATION,
    name: BETTER_AUTH_TABLE_NAMES.VERIFICATION,
    category: BETTER_AUTH_CATEGORIES.CORE,
    description: "Email verification, magic link, and OTP tokens.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "identifier", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "value", type: DB_COLUMN_TYPES.TEXT },
      { name: "expiresAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "updatedAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.ORG,
    name: BETTER_AUTH_TABLE_NAMES.ORG,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "Multi-tenant workspaces, company accounts, and team scopes.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "name", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "slug", type: DB_COLUMN_TYPES.VARCHAR, isUnique: true },
      { name: "logo", type: DB_COLUMN_TYPES.TEXT },
      { name: "metadata", type: DB_COLUMN_TYPES.JSON },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.MEMBER,
    name: BETTER_AUTH_TABLE_NAMES.MEMBER,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "User membership mappings to organizations with roles.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "organizationId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.ORG, column: "id" } },
      { name: "userId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "role", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.INVITATION,
    name: BETTER_AUTH_TABLE_NAMES.INVITATION,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "Pending email invitations for joining organizations.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "organizationId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.ORG, column: "id" } },
      { name: "email", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "role", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "status", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "expiresAt", type: DB_COLUMN_TYPES.TIMESTAMP },
      { name: "inviterId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.TEAM,
    name: BETTER_AUTH_TABLE_NAMES.TEAM,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "Sub-groups and department teams within organizations.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "organizationId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.ORG, column: "id" } },
      { name: "name", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.TEAM_MEMBER,
    name: BETTER_AUTH_TABLE_NAMES.TEAM_MEMBER,
    category: BETTER_AUTH_CATEGORIES.ORGANIZATION,
    description: "User memberships mapped to organization teams.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "teamId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.TEAM, column: "id" } },
      { name: "userId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "role", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.PASSKEY,
    name: BETTER_AUTH_TABLE_NAMES.PASSKEY,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "WebAuthn / Passkey public credentials and counters.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "name", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "publicKey", type: DB_COLUMN_TYPES.TEXT },
      { name: "userId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
      { name: "credentialID", type: DB_COLUMN_TYPES.TEXT, isUnique: true },
      { name: "counter", type: DB_COLUMN_TYPES.INTEGER },
      { name: "transports", type: DB_COLUMN_TYPES.VARCHAR },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.TWO_FACTOR,
    name: BETTER_AUTH_TABLE_NAMES.TWO_FACTOR,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "TOTP secrets and encrypted recovery backup codes.",
    defaultColumns: [
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "userId", type: DB_COLUMN_TYPES.UUID, isForeignKey: true, references: { table: BETTER_AUTH_TABLE_NAMES.USER, column: "id" } },
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
      { name: "id", type: DB_COLUMN_TYPES.UUID, isPrimaryKey: true },
      { name: "publicKey", type: DB_COLUMN_TYPES.TEXT },
      { name: "privateKey", type: DB_COLUMN_TYPES.TEXT },
      { name: "createdAt", type: DB_COLUMN_TYPES.TIMESTAMP },
    ],
  },
  {
    key: BETTER_AUTH_TABLE_KEYS.RATE_LIMIT,
    name: BETTER_AUTH_TABLE_NAMES.RATE_LIMIT,
    category: BETTER_AUTH_CATEGORIES.PLUGIN,
    description: "Brute-force protection counter table.",
    defaultColumns: [
      { name: "key", type: DB_COLUMN_TYPES.VARCHAR, isPrimaryKey: true },
      { name: "count", type: DB_COLUMN_TYPES.INTEGER },
      { name: "lastRequest", type: DB_COLUMN_TYPES.BIGINT },
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
