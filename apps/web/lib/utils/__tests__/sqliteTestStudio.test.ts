import { describe, it, expect, afterEach } from "vitest";
import {
  testDatabaseOperation,
  checkDatabaseConnection,
} from "@/lib/services/databaseService";
import { resolveSqlitePath } from "../sqliteRunner";
import fs from "fs";

const TEST_DB = "test-studio-dev.db";

describe("SQLite Live and Sandbox Test Studio Execution (Server Action / databaseService)", () => {
  afterEach(() => {
    const resolved = resolveSqlitePath(TEST_DB);
    if (fs.existsSync(resolved)) {
      try {
        fs.unlinkSync(resolved);
      } catch {}
    }
    try {
      fs.unlinkSync(`${resolved}-wal`);
    } catch {}
    try {
      fs.unlinkSync(`${resolved}-shm`);
    } catch {}
  });

  it("executes SQLite operation in Live mode against real SQLite dev.db", async () => {
    // 1. Create a real record first
    const createRes = await testDatabaseOperation({
      engine: "sqlite",
      connection: { dbFilePath: TEST_DB },
      operation: {
        id: "auto-create-conversations",
        name: "createConversation",
        kind: "create",
      },
      args: {
        id: "conv-101",
        data: { title: "Live SQLite Conversation" },
      },
      mode: "live",
    });

    expect(createRes.success).toBe(true);
    expect(createRes.output).toMatchObject({ id: "conv-101", title: "Live SQLite Conversation" });

    // 2. Query all records - fetches real record from dev.db
    const res = await testDatabaseOperation({
      engine: "sqlite",
      connection: {
        dbFilePath: TEST_DB,
      },
      operation: {
        id: "auto-find-all-conversations",
        name: "findAllConversations",
        kind: "findAll",
        params: [
          { name: "limit", type: "number", defaultValue: "20" },
          { name: "offset", type: "number", defaultValue: "0" },
        ],
      },
      args: {
        limit: 20,
        offset: 0,
      },
      mode: "live",
    });

    expect(res.success).toBe(true);
    expect(res.serverActive).toBe(true);
    expect(res.mode).toBe("live");
    expect(res.connection).toBe(`sqlite:${TEST_DB}`);
    expect(res.rawCommand).toContain("SELECT * FROM conversations LIMIT 20 OFFSET 0");
    expect(Array.isArray(res.output)).toBe(true);
    expect((res.output as any[]).length).toBe(1);
    expect((res.output as any[])[0]).toMatchObject({ id: "conv-101" });
  });

  it("executes SQLite operation in Sandbox mode with relational mock data", async () => {
    const res = await testDatabaseOperation({
      engine: "sqlite",
      connection: {
        dbFilePath: "custom.db",
      },
      operation: {
        id: "auto-find-by-id-conversations",
        name: "findConversationById",
        kind: "findById",
        params: [{ name: "id", type: "string" }],
      },
      args: {
        id: "conv_123",
      },
      mode: "sandbox",
    });

    expect(res.success).toBe(true);
    expect(res.mode).toBe("sandbox");
    expect(res.rawCommand).toContain("SELECT * FROM conversations WHERE id = 'conv_123'");
    expect(res.output).toHaveProperty("id", "conv_123");
  });

  it("checks SQLite connection without requiring a TCP port", async () => {
    const res = await checkDatabaseConnection({
      engine: "sqlite",
      connection: {
        dbFilePath: TEST_DB,
      },
    });

    expect(res.success).toBe(true);
    expect(res.engine).toBe("sqlite");
    expect(res.connectionUri).toBe(`sqlite:${TEST_DB}`);
    expect(res.info).toHaveProperty("version");
    expect(res.info).toHaveProperty("status");
  });
});
