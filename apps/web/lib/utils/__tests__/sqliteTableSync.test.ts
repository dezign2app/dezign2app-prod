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
});
