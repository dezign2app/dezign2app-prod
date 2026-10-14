import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import {
  checkDbTableSyncAction,
  applyDbTableSyncAction,
} from "@/app/actions/databaseActions";
import { resolveSqlitePath } from "../sqliteRunner";

const TEST_ACTION_DB = "test-action-sync.db";

describe("databaseActions Table Sync Actions", () => {
  afterEach(() => {
    const resolved = resolveSqlitePath(TEST_ACTION_DB);
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

  it("should check sync and apply schema through server actions", async () => {
    // 1. Check sync on uncreated table
    const initialCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
      ],
    });

    expect(initialCheck.success).toBe(true);
    expect(initialCheck.tableExists).toBe(false);
    expect(initialCheck.inSync).toBe(false);
    expect(initialCheck.missingColumns).toHaveLength(2);

    // 2. Apply table creation
    const applyRes = await applyDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
      ],
    });

    expect(applyRes.success).toBe(true);
    expect(applyRes.createdTable).toBe(true);

    // 3. Re-check: now in sync
    const syncedCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
      ],
    });

    expect(syncedCheck.inSync).toBe(true);
    expect(syncedCheck.tableExists).toBe(true);
    expect(syncedCheck.missingColumns).toHaveLength(0);

    // 4. Add new column 'price'
    const driftCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
        { name: "price", type: "REAL" },
      ],
    });

    expect(driftCheck.inSync).toBe(false);
    expect(driftCheck.missingColumns.map((c) => c.name)).toEqual(["price"]);

    // 5. Apply column migration
    const columnApplyRes = await applyDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
        { name: "price", type: "REAL" },
      ],
    });

    expect(columnApplyRes.success).toBe(true);
    expect(columnApplyRes.createdTable).toBe(false);
    expect(columnApplyRes.appliedColumns).toEqual(["price"]);

    // 6. Delete column 'price' on canvas
    const deleteDriftCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
      ],
    });

    expect(deleteDriftCheck.inSync).toBe(false);
    expect(deleteDriftCheck.missingColumns).toHaveLength(0);
    expect(deleteDriftCheck.extraColumns.map((c) => c.name)).toEqual(["price"]);

    // 7. Apply deletion
    const deleteApplyRes = await applyDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
      ],
    });

    expect(deleteApplyRes.success).toBe(true);
    expect(deleteApplyRes.droppedColumns).toEqual(["price"]);

    // 8. Re-check: now in sync
    const finalCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Product",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "title", type: "TEXT" },
      ],
    });

    expect(finalCheck.inSync).toBe(true);
    expect(finalCheck.extraColumns).toHaveLength(0);
    expect(finalCheck.missingColumns).toHaveLength(0);
  });
});
