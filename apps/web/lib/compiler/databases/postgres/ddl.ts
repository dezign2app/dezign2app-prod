import { toSqlIdentifier } from "../../utils";
import type { PgColumnMeta } from "./types";
import { toPostgresType } from "./utils";

/**
 * Builds PostgreSQL DDL statements (CREATE TABLE, indexes) for a canvas entity.
 */
export function buildTableDDL(
  tableName: string,
  cols: PgColumnMeta[],
  indexes: { name?: string; columns?: string; isUnique?: boolean }[] = [],
  tableSchemas: Record<string, Array<{ name: string; pgType: string }>> = {},
): string[] {
  const stmts: string[] = [];
  const colDefs = cols.map((c) => {
    const pgType = toPostgresType(c.type, c.isPrimaryKey);
    let colDef = `  "${c.name}" ${pgType}`;
    if (c.isPrimaryKey) {
      if (pgType === "BIGSERIAL") {
        colDef += " PRIMARY KEY";
      } else {
        // TEXT UUID-style PK — default to gen_random_uuid() for true UUID, or just PRIMARY KEY
        colDef += " PRIMARY KEY NOT NULL";
      }
    } else {
      if (c.isNotNull) colDef += " NOT NULL";
      if (c.isUnique) colDef += " UNIQUE";
    }
    return colDef;
  });

  stmts.push(
    `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${colDefs.join(",\n")}\n);`,
  );

  // Register column schema for auto-migration
  tableSchemas[tableName] = cols.map((c) => ({
    name: c.name,
    pgType: toPostgresType(c.type, c.isPrimaryKey),
  }));

  // Named indexes
  indexes.forEach((idx) => {
    const colList = (idx.columns || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (colList.length === 0) return;
    const idxName = idx.name || `idx_${tableName}_${colList.join("_")}`;
    const unique = idx.isUnique ? "UNIQUE " : "";
    const colSpecs = colList.map((c) => `"${toSqlIdentifier(c, "col")}"`).join(", ");
    stmts.push(
      `CREATE ${unique}INDEX IF NOT EXISTS "${toSqlIdentifier(idxName, "idx")}" ON "${tableName}" (${colSpecs});`,
    );
  });

  return stmts;
}

// ---------------------------------------------------------------------------
// BetterAuth DDL for PostgreSQL
// ---------------------------------------------------------------------------

export const BETTERAUTH_PG_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "emailVerified" BOOLEAN,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "role" TEXT,
  "banned" BOOLEAN,
  "banReason" TEXT,
  "banExpires" TIMESTAMPTZ,
  "plan" TEXT,
  "creemCustomerId" TEXT
);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email" ON "user" ("email");`,

  `CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT,
  "token" TEXT UNIQUE,
  "expiresAt" TIMESTAMPTZ,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "impersonatedBy" TEXT,
  "activeOrganizationId" TEXT,
  "activeTeamId" TEXT
);`,
  `CREATE INDEX IF NOT EXISTS "idx_session_userId" ON "session" ("userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_session_token" ON "session" ("token");`,

  `CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT,
  "accountId" TEXT,
  "providerId" TEXT,
  "password" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "idToken" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);`,
  `CREATE INDEX IF NOT EXISTS "idx_account_userId" ON "account" ("userId");`,
  `CREATE INDEX IF NOT EXISTS "idx_account_provider_account" ON "account" ("providerId", "accountId");`,

  `CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT,
  "value" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);`,
  `CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification" ("identifier");`,

  `CREATE TABLE IF NOT EXISTS "invitation" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organizationId" TEXT,
  "email" TEXT,
  "role" TEXT,
  "teamId" TEXT,
  "status" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "inviterId" TEXT
);`,
  `CREATE INDEX IF NOT EXISTS "idx_invitation_organizationId" ON "invitation" ("organizationId");`,
  `CREATE INDEX IF NOT EXISTS "idx_invitation_email" ON "invitation" ("email");`,

  `CREATE TABLE IF NOT EXISTS "jwks" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "publicKey" TEXT,
  "privateKey" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  "alg" TEXT,
  "crv" TEXT
);`,
  `CREATE INDEX IF NOT EXISTS "idx_jwks_expiresAt" ON "jwks" ("expiresAt");`,

  `CREATE TABLE IF NOT EXISTS "passkey" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "publicKey" TEXT,
  "userId" TEXT,
  "credentialID" TEXT UNIQUE,
  "counter" INTEGER,
  "transports" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);`,
  `CREATE INDEX IF NOT EXISTS "idx_passkey_userId" ON "passkey" ("userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_passkey_credentialID" ON "passkey" ("credentialID");`,

  `CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT,
  "secret" TEXT,
  "backupCodes" TEXT
);`,
  `CREATE INDEX IF NOT EXISTS "idx_twoFactor_userId" ON "twoFactor" ("userId");`,

  `CREATE TABLE IF NOT EXISTS "rateLimit" (
  "key" TEXT PRIMARY KEY NOT NULL,
  "count" INTEGER DEFAULT 0,
  "lastRequest" BIGINT
);`,
  `CREATE INDEX IF NOT EXISTS "idx_rateLimit_lastRequest" ON "rateLimit" ("lastRequest");`,
];

export const PAYMENTS_PG_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "subscription" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "userId" TEXT,
  "plan" TEXT,
  "status" TEXT,
  "creemCustomerId" TEXT,
  "creemSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMPTZ,
  "currentPeriodEnd" TIMESTAMPTZ,
  "cancelAtPeriodEnd" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);`,
  `CREATE INDEX IF NOT EXISTS "idx_subscription_userId" ON "subscription" ("userId");`,
  `CREATE INDEX IF NOT EXISTS "idx_subscription_status" ON "subscription" ("status");`,
];

export const PG_SEED_SQL = `INSERT INTO "user" ("id", "name", "email", "createdAt") VALUES
  ('fake_admin_1', 'Admin User', 'admin@example.com', NOW()),
  ('fake_user_1', 'Standard User', 'user@example.com', NOW()),
  ('fake_superadmin_1', 'Super Admin', 'superadmin@example.com', NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "session" ("id", "userId", "token", "expiresAt", "createdAt") VALUES
  ('fake_session_admin', 'fake_admin_1', 'fake_admin_token', '2099-01-01T00:00:00.000Z', NOW()),
  ('fake_session_user', 'fake_user_1', 'fake_user_token', '2099-01-01T00:00:00.000Z', NOW()),
  ('fake_session_superadmin', 'fake_superadmin_1', 'fake_superadmin_token', '2099-01-01T00:00:00.000Z', NOW())
ON CONFLICT ("id") DO NOTHING;`;

// ---------------------------------------------------------------------------
// Auto-migration schema tracking
// ---------------------------------------------------------------------------

export const BETTERAUTH_PG_SCHEMAS: Record<string, Array<{ name: string; pgType: string }>> = {
  user: [
    { name: "name", pgType: "TEXT" },
    { name: "email", pgType: "TEXT" },
    { name: "emailVerified", pgType: "BOOLEAN" },
    { name: "image", pgType: "TEXT" },
    { name: "createdAt", pgType: "TIMESTAMPTZ" },
    { name: "updatedAt", pgType: "TIMESTAMPTZ" },
    { name: "role", pgType: "TEXT" },
    { name: "banned", pgType: "BOOLEAN" },
    { name: "banReason", pgType: "TEXT" },
    { name: "banExpires", pgType: "TIMESTAMPTZ" },
    { name: "plan", pgType: "TEXT" },
    { name: "creemCustomerId", pgType: "TEXT" },
  ],
  session: [
    { name: "userId", pgType: "TEXT" },
    { name: "token", pgType: "TEXT" },
    { name: "expiresAt", pgType: "TIMESTAMPTZ" },
    { name: "ipAddress", pgType: "TEXT" },
    { name: "userAgent", pgType: "TEXT" },
    { name: "createdAt", pgType: "TIMESTAMPTZ" },
    { name: "updatedAt", pgType: "TIMESTAMPTZ" },
    { name: "impersonatedBy", pgType: "TEXT" },
    { name: "activeOrganizationId", pgType: "TEXT" },
    { name: "activeTeamId", pgType: "TEXT" },
  ],
  account: [
    { name: "userId", pgType: "TEXT" },
    { name: "accountId", pgType: "TEXT" },
    { name: "providerId", pgType: "TEXT" },
    { name: "password", pgType: "TEXT" },
    { name: "accessToken", pgType: "TEXT" },
    { name: "refreshToken", pgType: "TEXT" },
    { name: "accessTokenExpiresAt", pgType: "TIMESTAMPTZ" },
    { name: "refreshTokenExpiresAt", pgType: "TIMESTAMPTZ" },
    { name: "scope", pgType: "TEXT" },
    { name: "idToken", pgType: "TEXT" },
    { name: "createdAt", pgType: "TIMESTAMPTZ" },
    { name: "updatedAt", pgType: "TIMESTAMPTZ" },
  ],
};

/**
 * Combines all DDL statements into a single formatted schema.sql file string.
 */
export function generateSchemaSql(
  userDdlStatements: string[],
  authDdlStatements: string[],
  paymentsDdlStatements: string[],
  seedSql: string = PG_SEED_SQL,
): string {
  const allDdl = [
    ...userDdlStatements,
    ...authDdlStatements,
    ...paymentsDdlStatements,
    seedSql,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    "-- Auto-generated PostgreSQL schema",
    "-- Run this once against your PostgreSQL database to initialize all tables.",
    "-- In production, use a proper migration tool (Flyway, Liquibase, or custom runner).",
    "",
    allDdl,
  ].join("\n");
}
