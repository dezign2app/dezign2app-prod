import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  resolveSqlitePath,
  checkSqliteConnection,
  executeSqliteLiveOperation,
} from "../sqliteRunner";

const TEST_DB = "test-live-runner.db";

describe("sqliteRunner real operations", () => {
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

  it("should verify connection and initialize sqlite file", () => {
    const conn = checkSqliteConnection(TEST_DB);
    expect(conn.success).toBe(true);
    expect(conn.path).toContain(TEST_DB);
    expect(conn.sizeBytes).toBeGreaterThanOrEqual(0);
    expect(conn.tableCount).toBe(0);
  });

  it("should create table, insert record, find by id, and delete", async () => {
    // 1. Initial find by id returns null on empty table
    const findInitial = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "title", type: "string" },
        { name: "user_id", type: "string" },
      ],
      operation: {
        id: "auto-find-by-id-conversations",
        name: "findConversationById",
        kind: "findById",
      },
      args: { id: "12" },
    });

    expect(findInitial.success).toBe(true);
    expect(findInitial.output).toBeNull();
    expect(findInitial.rawSql).toBe("SELECT * FROM conversations WHERE id = '12' LIMIT 1;");

    // 2. Insert a real record with id 12
    const createResult = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "title", type: "string" },
        { name: "user_id", type: "string" },
      ],
      operation: {
        id: "auto-create-conversations",
        name: "createConversation",
        kind: "create",
      },
      args: {
        id: "12",
        data: {
          title: "Architecture Planning",
          user_id: "user_42",
        },
      },
    });

    expect(createResult.success).toBe(true);
    expect(createResult.output).toMatchObject({
      id: "12",
      title: "Architecture Planning",
      user_id: "user_42",
    });

    // 3. Find by id 12 now returns the REAL record from SQLite dev.db
    const findFound = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      operation: {
        id: "auto-find-by-id-conversations",
        name: "findConversationById",
        kind: "findById",
      },
      args: { id: "12" },
    });

    expect(findFound.success).toBe(true);
    expect(findFound.output).toMatchObject({
      id: "12",
      title: "Architecture Planning",
      user_id: "user_42",
    });

    // 4. Find all returns array containing the row
    const findAll = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      operation: {
        id: "auto-find-all-conversations",
        name: "findAllConversations",
        kind: "findAll",
      },
      args: { limit: 10, offset: 0 },
    });

    expect(findAll.success).toBe(true);
    expect(Array.isArray(findAll.output)).toBe(true);
    const rows = findAll.output as Array<{ id: string; title: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe("12");

    // 5. Update record
    const updateResult = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      operation: {
        id: "auto-update-conversations",
        name: "updateConversation",
        kind: "update",
      },
      args: {
        id: "12",
        data: {
          title: "Updated Title",
        },
      },
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.output).toMatchObject({
      id: "12",
      title: "Updated Title",
    });

    // 6. Delete record
    const deleteResult = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      operation: {
        id: "auto-delete-conversations",
        name: "deleteConversationById",
        kind: "delete",
      },
      args: { id: "12" },
    });

    expect(deleteResult.success).toBe(true);

    // 7. Verify it is gone
    const findAfterDelete = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      operation: {
        id: "auto-find-by-id-conversations",
        name: "findConversationById",
        kind: "findById",
      },
      args: { id: "12" },
    });

    expect(findAfterDelete.success).toBe(true);
    expect(findAfterDelete.output).toBeNull();
  });

  it("should execute custom TypeScript/JavaScript function code", async () => {
    // 1. Simple synchronous function returning a boolean
    const customRes = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      operation: {
        id: "custom-test",
        name: "test",
        kind: "custom",
        code: "function test(key: string): boolean {\n  return true;\n}",
      },
      args: { key: "conversations:1001" },
    });

    expect(customRes.success).toBe(true);
    expect(customRes.output).toBe(true);
    expect(customRes.rawSql).toContain("test(");

    // 2. Custom function querying the database
    const dbFuncRes = await executeSqliteLiveOperation({
      dbFilePath: TEST_DB,
      tableName: "conversations",
      columns: [
        { name: "id", type: "string", isPrimaryKey: true },
        { name: "title", type: "string" },
      ],
      operation: {
        id: "custom-count",
        name: "countConversations",
        kind: "custom",
        code: "function countConversations() {\n  const stmt = db.prepare('SELECT count(*) as count FROM conversations');\n  return stmt.get();\n}",
      },
      args: {},
    });

    expect(dbFuncRes.success).toBe(true);
    expect(dbFuncRes.output).toEqual({ count: 0 });
    expect(dbFuncRes.rawSql).toContain("countConversations()");
  });
});
