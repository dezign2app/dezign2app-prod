import { describe, it, expect } from "vitest";
import {
  buildDefaultDbPromptContext,
  generateSyncedDbOperationCode,
  generateSyncedEndpointCode,
} from "@/app/(canvas)/project/[projectId]/_components/shared/business-logic-block/generator";

describe("Database Operations Prompt Context & Code Generator", () => {
  const mockColumns = [
    { name: "id", type: "TEXT", isPrimaryKey: true, isNotNull: true },
    { name: "userId", type: "TEXT", isForeignKey: true, references: { table: "user", column: "id" } },
    { name: "plan", type: "TEXT" },
    { name: "status", type: "TEXT" },
    { name: "currentPeriodEnd", type: "TEXT" },
    { name: "cancelAtPeriodEnd", type: "BOOLEAN" },
  ];

  const mockIndexes = [
    { name: "idx_subscription_user", columns: "userId", isUnique: false },
  ];

  it("should build default schema context string including DB engine, table, columns, and signature", () => {
    const contextStr = buildDefaultDbPromptContext({
      dbType: "sqlite",
      tableName: "subscription",
      columns: mockColumns,
      indexes: mockIndexes,
      operation: {
        name: "isSubscribed",
        kind: "custom",
        description: "Check if user has an active subscription",
        params: [{ name: "userId", type: "string", required: true }],
        returnType: "boolean",
      },
    });

    expect(contextStr).toContain("// Database Engine: SQLITE");
    expect(contextStr).toContain("// Table: subscription");
    expect(contextStr).toContain("// Schema Columns:");
    expect(contextStr).toContain("//   - id: TEXT (PK, NOT NULL)");
    expect(contextStr).toContain("//   - userId: TEXT (FK -> user.id)");
    expect(contextStr).toContain("//   - plan: TEXT");
    expect(contextStr).toContain("//   - status: TEXT");
    expect(contextStr).toContain("// Indexes: idx_subscription_user(userId)");
    expect(contextStr).toContain("// Function Signature: isSubscribed(userId: string): boolean");
    expect(contextStr).toContain("Check if user has an active subscription");
  });

  it("should generate clean, type-safe SQLite database function without Express route handlers", () => {
    const code = generateSyncedDbOperationCode({
      contextType: "db_operation",
      dbType: "sqlite",
      tableName: "subscription",
      tableSchema: {
        name: "subscription",
        columns: mockColumns,
        indexes: mockIndexes,
      },
      operation: {
        name: "isSubscribed",
        kind: "custom",
        params: [{ name: "userId", type: "string", required: true }],
        returnType: "boolean",
      },
    });

    expect(code).toContain("export function isSubscribed(userId: string): boolean");
    expect(code).toContain('db.prepare("SELECT * FROM subscription WHERE userId = ? LIMIT 1")');
    expect(code).toContain('row.status === "active"');
    // Must NOT contain Express or HTTP handler code
    expect(code).not.toContain("res.status");
    expect(code).not.toContain("res.json");
    expect(code).not.toContain("req.body");
  });

  it("should generate PostgreSQL async query helper with parameterized SQL ($1)", () => {
    const code = generateSyncedDbOperationCode({
      contextType: "db_operation",
      dbType: "postgres",
      tableName: "subscription",
      tableSchema: {
        name: "subscription",
        columns: mockColumns,
      },
      operation: {
        name: "isSubscribed",
        kind: "custom",
        params: [{ name: "userId", type: "string", required: true }],
        returnType: "boolean",
      },
    });

    expect(code).toContain("export async function isSubscribed(userId: string): Promise<boolean>");
    expect(code).toContain('SELECT * FROM "subscription" WHERE "userId" = $1 LIMIT 1');
    expect(code).toContain("[userId]");
    expect(code).not.toContain("res.status");
  });

  it("should generate Redis async helper using getRedisClient", () => {
    const code = generateSyncedDbOperationCode({
      contextType: "db_operation",
      dbType: "redis",
      tableName: "user_session",
      operation: {
        name: "getUserSession",
        kind: "custom",
        params: [{ name: "sessionId", type: "string", required: true }],
        returnType: "UserSessionRow | null",
      },
    });

    expect(code).toContain("export async function getUserSession(sessionId: string): Promise<UserSessionRow | null>");
    expect(code).toContain("await getRedisClient()");
    expect(code).toContain("await redis.get(`user_session:${sessionId}`)");
    expect(code).not.toContain("res.status");
  });

  it("should preserve standard endpoint generator for non-db operations", () => {
    const endpointCode = generateSyncedEndpointCode({
      endpointMethod: "POST",
      endpointPath: "/api/checkout",
      requestBody: {
        fields: [{ name: "amount", type: "number", required: true }],
      },
    });

    expect(endpointCode).toContain("return res.status(201).json");
    expect(endpointCode).toContain("body?.amount");
  });
});
