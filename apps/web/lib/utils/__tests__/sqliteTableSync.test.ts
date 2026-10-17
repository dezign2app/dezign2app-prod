import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import {
  resolveSqlitePath,
  checkSqliteTableSync,
  applySqliteTableSync,
} from "../sqliteRunner";

const TEST_SYNC_DB = "test-table-sync.db";

describe("Database Table Schema Sync (SQLite)", () => {
  afterEach(() => {
    const resolved = resolveSqlitePath(TEST_SYNC_DB);
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

  it("should report table missing when database table has not been created yet", () => {
    const status = checkSqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "email", type: "TEXT" },
    ]);

    expect(status.success).toBe(true);
    expect(status.tableExists).toBe(false);
    expect(status.inSync).toBe(false);
    expect(status.missingColumns).toHaveLength(2);
    expect(status.missingColumns.map((c) => c.name)).toEqual(["id", "email"]);
  });

  it("should create table when applying sync and report inSync = true afterwards", () => {
    // 1. Initial creation
    const applyRes = applySqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "email", type: "TEXT" },
    ]);

    expect(applyRes.success).toBe(true);
    expect(applyRes.createdTable).toBe(true);

    // 2. Check sync status
    const status = checkSqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "email", type: "TEXT" },
    ]);

    expect(status.success).toBe(true);
    expect(status.tableExists).toBe(true);
    expect(status.inSync).toBe(true);
    expect(status.missingColumns).toHaveLength(0);
  });

  it("should detect pending columns and apply ALTER TABLE migration seamlessly", () => {
    // 1. Create table with initial columns
    applySqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
    ]);

    // 2. Add 'demo' and 'role' on canvas
    const driftStatus = checkSqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
      { name: "demo", type: "TEXT" },
      { name: "role", type: "TEXT" },
    ]);

    expect(driftStatus.tableExists).toBe(true);
    expect(driftStatus.inSync).toBe(false);
    expect(driftStatus.missingColumns.map((c) => c.name)).toEqual(["demo", "role"]);

    // 3. Apply migration
    const migrationRes = applySqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
      { name: "demo", type: "TEXT" },
      { name: "role", type: "TEXT" },
    ]);

    expect(migrationRes.success).toBe(true);
    expect(migrationRes.createdTable).toBe(false);
    expect(migrationRes.appliedColumns).toEqual(["demo", "role"]);

    // 4. Re-check: should now be 100% in sync
    const finalStatus = checkSqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
      { name: "demo", type: "TEXT" },
      { name: "role", type: "TEXT" },
    ]);

    expect(finalStatus.tableExists).toBe(true);
    expect(finalStatus.inSync).toBe(true);
    expect(finalStatus.missingColumns).toHaveLength(0);
  });

  it("should detect when a column is deleted on the canvas and drop it upon sync", () => {
    // 1. Create table with id, name, and demo
    applySqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
      { name: "demo", type: "TEXT" },
    ]);

    // 2. User deletes 'demo' from canvas
    const checkAfterDelete = checkSqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
    ]);

    expect(checkAfterDelete.tableExists).toBe(true);
    expect(checkAfterDelete.inSync).toBe(false);
    expect(checkAfterDelete.missingColumns).toHaveLength(0);
    expect(checkAfterDelete.extraColumns.map((c) => c.name)).toEqual(["demo"]);

    // 3. Apply sync to drop the column
    const applyDeleteRes = applySqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
    ]);

    expect(applyDeleteRes.success).toBe(true);
    expect(applyDeleteRes.droppedColumns).toEqual(["demo"]);

    // 4. Re-check: now fully in sync
    const finalCheck = checkSqliteTableSync(TEST_SYNC_DB, "User", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "name", type: "TEXT" },
    ]);

    expect(finalCheck.tableExists).toBe(true);
    expect(finalCheck.inSync).toBe(true);
    expect(finalCheck.extraColumns).toHaveLength(0);
    expect(finalCheck.missingColumns).toHaveLength(0);
  });

  it("should create, detect drift, and synchronize table indexes", () => {
    // 1. Initial creation with an index
    const applyRes = applySqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
      ],
      undefined,
      [{ name: "idx_user_email", columns: "email", isUnique: true }],
    );

    expect(applyRes.success).toBe(true);
    expect(applyRes.createdTable).toBe(true);
    expect(applyRes.appliedIndexes).toEqual(["idx_user_email"]);

    // 2. Check sync status - should be fully in sync
    const status1 = checkSqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
      ],
      undefined,
      [{ name: "idx_user_email", columns: "email", isUnique: true }],
    );

    expect(status1.inSync).toBe(true);
    expect(status1.missingIndexes).toHaveLength(0);
    expect(status1.extraIndexes).toHaveLength(0);

    // 3. User adds a second index on canvas
    const status2 = checkSqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
      undefined,
      [
        { name: "idx_user_email", columns: "email", isUnique: true },
        { name: "idx_user_role", columns: "role" },
      ],
    );

    expect(status2.inSync).toBe(false);
    expect(status2.missingColumns.map((c) => c.name)).toEqual(["role"]);
    expect(status2.missingIndexes?.map((i) => i.name)).toEqual(["idx_user_role"]);

    // 4. Apply migration for role column and index
    const apply2 = applySqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
      undefined,
      [
        { name: "idx_user_email", columns: "email", isUnique: true },
        { name: "idx_user_role", columns: "role" },
      ],
    );

    expect(apply2.success).toBe(true);
    expect(apply2.appliedColumns).toEqual(["role"]);
    expect(apply2.appliedIndexes).toEqual(["idx_user_role"]);

    // 5. User removes idx_user_role on canvas
    const status3 = checkSqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
      undefined,
      [{ name: "idx_user_email", columns: "email", isUnique: true }],
    );

    expect(status3.inSync).toBe(false);
    expect(status3.extraIndexes?.map((i) => i.name)).toEqual(["idx_user_role"]);

    // 6. Apply deletion of the index
    const apply3 = applySqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
      undefined,
      [{ name: "idx_user_email", columns: "email", isUnique: true }],
    );

    expect(apply3.success).toBe(true);
    expect(apply3.droppedIndexes).toEqual(["idx_user_role"]);

    // 7. Verify back in sync
    const status4 = checkSqliteTableSync(
      TEST_SYNC_DB,
      "User",
      [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "email", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
      undefined,
      [{ name: "idx_user_email", columns: "email", isUnique: true }],
    );

    expect(status4.inSync).toBe(true);
    expect(status4.missingIndexes).toHaveLength(0);
    expect(status4.extraIndexes).toHaveLength(0);
  });

  it("should detect column type drift and apply type alteration while preserving data", () => {
    const { DatabaseSync } = require("node:sqlite");

    // 1. Create table with column 'age' as TEXT
    const applyInit = applySqliteTableSync(TEST_SYNC_DB, "Profile", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "age", type: "TEXT" },
    ]);
    expect(applyInit.success).toBe(true);

    // 2. Insert test data
    const resolvedPath = resolveSqlitePath(TEST_SYNC_DB);
    const db = new DatabaseSync(resolvedPath);
    db.exec(`INSERT INTO "Profile" ("id", "age") VALUES ('u1', '25');`);
    db.close();

    // 3. Check drift when canvas column type is changed to INTEGER
    const driftCheck = checkSqliteTableSync(TEST_SYNC_DB, "Profile", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "age", type: "INTEGER" },
    ]);

    expect(driftCheck.inSync).toBe(false);
    expect(driftCheck.alteredColumns).toHaveLength(1);
    expect(driftCheck.alteredColumns?.[0]).toEqual({
      name: "age",
      oldType: "TEXT",
      newType: "INTEGER",
    });

    // 4. Apply sync to migrate the column type
    const applyRes = applySqliteTableSync(TEST_SYNC_DB, "Profile", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "age", type: "INTEGER" },
    ]);

    expect(applyRes.success).toBe(true);
    expect(applyRes.alteredColumns).toHaveLength(1);
    expect(applyRes.alteredColumns?.[0]?.name).toBe("age");

    // 5. Verify data is preserved and schema is updated
    const verifyDb = new DatabaseSync(resolvedPath);
    const row = verifyDb.prepare(`SELECT id, age FROM "Profile" WHERE id = 'u1'`).get() as { id: string; age: number | string };
    expect(row).toBeDefined();
    expect(row.id).toBe("u1");
    expect(row.age).toBe(25);

    const info = verifyDb.prepare(`PRAGMA table_info("Profile")`).all() as Array<{ name: string; type: string }>;
    const ageCol = info.find((c) => c.name === "age");
    expect(ageCol?.type).toBe("INTEGER");
    verifyDb.close();

    // 6. Verify table is now in sync
    const finalCheck = checkSqliteTableSync(TEST_SYNC_DB, "Profile", [
      { name: "id", type: "TEXT", isPrimaryKey: true },
      { name: "age", type: "INTEGER" },
    ]);
    expect(finalCheck.inSync).toBe(true);
    expect(finalCheck.alteredColumns).toHaveLength(0);
  });

  it("should create table with composite primary keys without syntax errors", () => {
    const applyRes = applySqliteTableSync(TEST_SYNC_DB, "langgraph_checkpoints", [
      { name: "thread_id", type: "TEXT", isPrimaryKey: true },
      { name: "checkpoint_ns", type: "TEXT", isPrimaryKey: true },
      { name: "checkpoint_id", type: "TEXT", isPrimaryKey: true },
      { name: "checkpoint", type: "JSON", isNotNull: true },
    ]);

    expect(applyRes.success).toBe(true);
    expect(applyRes.createdTable).toBe(true);

    const { DatabaseSync } = require("node:sqlite");
    const resolvedPath = resolveSqlitePath(TEST_SYNC_DB);
    const db = new DatabaseSync(resolvedPath);
    const info = db.prepare(`PRAGMA table_info("langgraph_checkpoints")`).all() as Array<{
      cid: number;
      name: string;
      pk: number;
    }>;
    db.close();

    const pkColumns = info.filter((c) => c.pk > 0);
    expect(pkColumns).toHaveLength(3);
    expect(pkColumns.map((c) => c.name)).toEqual(["thread_id", "checkpoint_ns", "checkpoint_id"]);

    const syncCheck = checkSqliteTableSync(TEST_SYNC_DB, "langgraph_checkpoints", [
      { name: "thread_id", type: "TEXT", isPrimaryKey: true },
      { name: "checkpoint_ns", type: "TEXT", isPrimaryKey: true },
      { name: "checkpoint_id", type: "TEXT", isPrimaryKey: true },
      { name: "checkpoint", type: "JSON", isNotNull: true },
    ]);
    expect(syncCheck.tableExists).toBe(true);
    expect(syncCheck.inSync).toBe(true);
  });
});
