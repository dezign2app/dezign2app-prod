import { describe, it, expect } from "vitest";
import { BackendNode } from "@workspace/canvas/types";
import {
  compileSchema,
  compileRedisSchema,
  compileRedis74SchemaModule,
  compileRedis7SchemaModule,
  compileSqlite3TableSchema,
  compilePostgres16TableSchema,
  compileMySql8TableSchema,
  compileConvex1Schema,
  compileZod3Schema,
} from "../schemas";
import { compileRedisNodes } from "../compileRedisNodes";

describe("Modular Schema Compilers (Technologies & Versions)", () => {
  describe("Redis Schema Compiler", () => {
    it("compiles Redis 7.4+ Hash schema with HEXPIRE per-field TTLs", () => {
      const node: BackendNode = {
        id: "redis-schema-conv",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "ConversationCache",
          redisDataStructure: "hash",
          keyTemplate: "conv:{id}",
          ttl: { value: 3600, unit: "s" },
          hashConfig: {
            fields: [
              { name: "message", type: "string", required: true },
              {
                name: "sender",
                type: "string",
                required: false,
                ttl: { value: 300, unit: "s" },
              },
            ],
          },
        },
      };

      const result = compileRedis74SchemaModule(node);
      expect(result.technology).toBe("redis");
      expect(result.version).toBe("7.4");
      expect(result.typeName).toBe("ConversationCache");
      expect(result.file.content).toContain("export interface ConversationCache");
      expect(result.file.content).toContain("message: string;");
      expect(result.file.content).toContain("sender?: string;");
      // Redis 7.4+ HEXPIRE Field TTL constant
      expect(result.file.content).toContain(
        "CONVERSATIONCACHE_FIELD_SENDER_TTL_SECONDS = 300",
      );
      expect(result.file.content).toContain("CONVERSATIONCACHE_KEY_PATTERN = \"conv:*\"");
      expect(result.file.content).toContain("getConversationCacheKey");

      // Critical check: absolutely NO SQL prepared statements in Redis schema output
      expect(result.file.content).not.toContain("stmtUpdate");
      expect(result.file.content).not.toContain("stmtInsert");
      expect(result.file.content).not.toContain("ConversationRow");
    });

    it("compiles Redis 7.4+ JSON schema with nested structures and array root types", () => {
      const node: BackendNode = {
        id: "redis-schema-json",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a1",
        data: {
          label: "ChatMessageHistory",
          redisDataStructure: "json",
          jsonRootType: "array",
          keyTemplate: "chat:{roomId}:messages",
          columns: [
            { name: "id", type: "string", isPrimaryKey: true },
            { name: "content", type: "string" },
            { name: "senderId", type: "string" },
          ],
        },
      };

      const result = compileRedis74SchemaModule(node);
      expect(result.isJsonArray).toBe(true);
      expect(result.itemTypeName).toBe("ChatMessageHistoryItem");
      expect(result.file.content).toContain("export interface ChatMessageHistoryItem");
      expect(result.file.content).toContain(
        "export type ChatMessageHistory = ChatMessageHistoryItem[]",
      );
    });

    it("compiles Redis 7.4+ Streams schema with maxLen and consumer groups", () => {
      const node: BackendNode = {
        id: "redis-schema-stream",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a2",
        data: {
          label: "OrderEvents",
          redisDataStructure: "stream",
          keyTemplate: "orders:stream",
          streamConfig: {
            fields: [
              { name: "orderId", type: "string" },
              { name: "amount", type: "number" },
            ],
            maxLen: 10000,
            consumerGroups: [{ name: "fulfillment-workers" }],
          },
        },
      };

      const result = compileRedis74SchemaModule(node);
      expect(result.file.content).toContain("export interface OrderEvents");
      expect(result.file.content).toContain("ORDEREVENTS_STREAM_MAX_LEN = 10000");
      expect(result.file.content).toContain(
        'ORDEREVENTS_CONSUMER_GROUPS = ["fulfillment-workers"]',
      );
    });

    it("compiles Redis 7.0 compatibility mode schema without 7.4-specific field TTLs", () => {
      const node: BackendNode = {
        id: "redis-schema-compat",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a3",
        data: {
          label: "SessionData",
          redisDataStructure: "hash",
          columns: [{ name: "token", type: "string" }],
        },
      };

      const result = compileRedis7SchemaModule(node);
      expect(result.version).toBe("7.0");
      expect(result.file.content).toContain("export interface SessionData");
      expect(result.file.content).not.toContain("HEXPIRE");
    });
  });

  describe("Database Schema Compilers", () => {
    it("compiles SQLite 3.x Drizzle schema", () => {
      const node: BackendNode = {
        id: "table-users",
        type: "entity",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "users",
          columns: [
            { name: "id", type: "string", isPrimaryKey: true },
            { name: "email", type: "string", isUnique: true, isNotNull: true },
            { name: "age", type: "number" },
          ],
        },
      };

      const result = compileSqlite3TableSchema(node);
      expect(result.file.content).toContain('from "drizzle-orm/sqlite-core"');
      expect(result.file.content).toContain('sqliteTable("users"');
      expect(result.file.content).toContain("export type Users = typeof users.$inferSelect;");
    });

    it("compiles PostgreSQL 16.x Drizzle schema", () => {
      const node: BackendNode = {
        id: "table-orders",
        type: "entity",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "orders",
          columns: [
            { name: "id", type: "uuid", isPrimaryKey: true },
            { name: "total", type: "numeric", isNotNull: true },
            { name: "created_at", type: "timestamp" },
          ],
        },
      };

      const result = compilePostgres16TableSchema(node);
      expect(result.file.content).toContain('from "drizzle-orm/pg-core"');
      expect(result.file.content).toContain('pgTable("orders"');
      expect(result.file.content).toContain("export type Orders = typeof orders.$inferSelect;");
    });

    it("compiles MySQL 8.x Drizzle schema", () => {
      const node: BackendNode = {
        id: "table-products",
        type: "entity",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "products",
          columns: [
            { name: "sku", type: "varchar", isPrimaryKey: true },
            { name: "price", type: "int" },
          ],
        },
      };

      const result = compileMySql8TableSchema(node);
      expect(result.file.content).toContain('from "drizzle-orm/mysql-core"');
      expect(result.file.content).toContain('mysqlTable("products"');
    });

    it("compiles Convex 1.x schema", () => {
      const tables: BackendNode[] = [
        {
          id: "table-tasks",
          type: "entity",
          position: { x: 0, y: 0 },
          fractionalIndex: "a0",
          data: {
            label: "tasks",
            columns: [
              { name: "id", type: "string", isPrimaryKey: true },
              { name: "title", type: "string" },
              { name: "completed", type: "boolean" },
            ],
          },
        },
      ];

      const result = compileConvex1Schema(tables);
      expect(result.content).toContain('from "convex/server"');
      expect(result.content).toContain("defineSchema");
      expect(result.content).toContain("title: v.string()");
      expect(result.content).toContain("completed: v.boolean()");
    });
  });

  describe("Zod v3 Schema Compiler", () => {
    it("compiles Zod validation schemas for entity", () => {
      const node: BackendNode = {
        id: "entity-profile",
        type: "entity",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: {
          label: "UserProfile",
          columns: [
            { name: "id", type: "string", isPrimaryKey: true },
            { name: "bio", type: "string" },
            { name: "score", type: "number", isNotNull: true },
          ],
        },
      };

      const result = compileZod3Schema(node);
      expect(result.file.content).toContain('from "zod"');
      expect(result.file.content).toContain("export const userProfileSchema = z.object({");
      expect(result.file.content).toContain("id: z.string()");
      expect(result.file.content).toContain("bio: z.string().optional()");
      expect(result.file.content).toContain("score: z.number()");
      expect(result.file.content).toContain("export type UserProfile = z.infer<typeof userProfileSchema>");
    });
  });

  describe("Universal Schema Dispatcher", () => {
    it("routes to Redis compiler when node is redis_schema", () => {
      const node: BackendNode = {
        id: "node-1",
        type: "redis_schema",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: { label: "SessionCache" },
      };

      const result = compileSchema(node);
      expect(result.technology).toBe("redis");
      expect(result.typeName).toBe("SessionCache");
    });

    it("routes to PostgreSQL compiler when engine is postgres", () => {
      const node: BackendNode = {
        id: "node-2",
        type: "entity",
        position: { x: 0, y: 0 },
        fractionalIndex: "a0",
        data: { label: "BillingAccounts", dbEngine: "postgres" },
      };

      const result = compileSchema(node);
      expect(result.technology).toBe("postgres");
      expect(result.typeName).toBe("BillingAccounts");
    });
  });

  describe("Regression: No SQL Prepared Statements in compileRedisNodes()", () => {
    it("ensures compileRedisNodes does not leak stmtUpdate or SQL queries into helpers", () => {
      const nodes: BackendNode[] = [
        {
          id: "redis-inst",
          type: "redis_instance",
          position: { x: 0, y: 0 },
          fractionalIndex: "a0",
          data: { label: "AppRedis", port: 6379 },
        },
        {
          id: "redis-conv",
          type: "redis_schema",
          position: { x: 100, y: 100 },
          fractionalIndex: "a1",
          data: {
            label: "Conversation",
            databaseId: "redis-inst",
            redisDataStructure: "hash",
            keyTemplate: "conversation:{id}",
            columns: [
              { name: "message", type: "string", isPrimaryKey: true },
              { name: "sender", type: "string" },
            ],
            // Simulate legacy / stale SQL prepared statement operations attached to node
            dbOperations: [
              {
                id: "stale-sql-update",
                name: "updateConversation",
                kind: "update",
                code: `export function updateConversation(message: string, data: UpdateConversationData): ConversationRow | undefined {\n  const current = findConversationById(message);\n  if (!current) return undefined;\n  const updated = { ...current, ...data };\n  stmtUpdate.run(updated.message, updated.sender, message);\n  const fresh = findConversationById(message);\n  return fresh ? ({ ...fresh, message: "Conversation updated successfully" } as unknown as ConversationRow) : undefined;\n}`,
                enabled: true,
                isAutoGenerated: false,
              },
            ],
          },
        },
      ];

      const result = compileRedisNodes(nodes);
      expect(result.packages).toBeDefined();
      const pkg = result.packages![0]!;

      // Check all files in the compiled Redis package
      pkg.files.forEach((file) => {
        expect(file.content).not.toContain("stmtUpdate");
        expect(file.content).not.toContain("stmtInsert");
        expect(file.content).not.toContain("stmtFindAll");
        expect(file.content).not.toContain("ConversationRow");
      });
    });
  });
});
