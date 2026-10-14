import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import {
  checkDbTableSyncAction,
  applyDbTableSyncAction,
  dropDbTableAction,
  renameDbTableAction,
  renameDbColumnAction,
} from "@/app/actions/databaseActions";
import { resolveSqlitePath } from "../sqliteRunner";
import { resolveTableAndSchema } from "../postgresRunner";

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

  it("should drop physical table from live database", async () => {
    // 1. Create table first
    const applyRes = await applyDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "TemporaryLogs",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "message", type: "TEXT" },
      ],
    });
    expect(applyRes.success).toBe(true);

    // 2. Verify table exists
    const check1 = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "TemporaryLogs",
      columns: [{ name: "id", type: "TEXT", isPrimaryKey: true }],
    });
    expect(check1.tableExists).toBe(true);

    // 3. Drop table
    const dropRes = await dropDbTableAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "TemporaryLogs",
    });
    expect(dropRes.success).toBe(true);
    expect(dropRes.droppedTable).toBe("TemporaryLogs");

    // 4. Verify table no longer exists
    const check2 = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "TemporaryLogs",
      columns: [{ name: "id", type: "TEXT", isPrimaryKey: true }],
    });
    expect(check2.tableExists).toBe(false);
  });

  it("should rename physical table and column in live database", async () => {
    // 1. Create initial table "Orders" with column "customer_name"
    const applyRes = await applyDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Orders",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "customer_name", type: "TEXT" },
      ],
    });
    expect(applyRes.success).toBe(true);

    // 2. Rename column "customer_name" to "client_name"
    const colRenameRes = await renameDbColumnAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Orders",
      oldColumnName: "customer_name",
      newColumnName: "client_name",
    });
    expect(colRenameRes.success).toBe(true);
    expect(colRenameRes.newColumnName).toBe("client_name");

    // Verify column renamed in live DB
    const colCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Orders",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "client_name", type: "TEXT" },
      ],
    });
    expect(colCheck.inSync).toBe(true);
    expect(colCheck.existingColumns.map((c) => c.name)).toContain("client_name");

    // 3. Rename table "Orders" to "SalesOrders"
    const tableRenameRes = await renameDbTableAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      oldTableName: "Orders",
      newTableName: "SalesOrders",
    });
    expect(tableRenameRes.success).toBe(true);
    expect(tableRenameRes.newTableName).toBe("SalesOrders");

    // Verify old table doesn't exist
    const oldCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "Orders",
      columns: [{ name: "id", type: "TEXT", isPrimaryKey: true }],
    });
    expect(oldCheck.tableExists).toBe(false);

    // Verify new table exists and has client_name column
    const newCheck = await checkDbTableSyncAction({
      engine: "sqlite",
      connection: { dbFilePath: TEST_ACTION_DB },
      tableName: "SalesOrders",
      columns: [
        { name: "id", type: "TEXT", isPrimaryKey: true },
        { name: "client_name", type: "TEXT" },
      ],
    });
    expect(newCheck.tableExists).toBe(true);
    expect(newCheck.inSync).toBe(true);
  });

  it("should accurately resolve schema and table names", () => {
    // 1. Unqualified table defaults to 'public'
    expect(resolveTableAndSchema("users")).toEqual({
      safeTable: "users",
      targetSchema: "public",
    });

    // 2. Explicit schema argument overrides default
    expect(resolveTableAndSchema("users", "billing")).toEqual({
      safeTable: "users",
      targetSchema: "billing",
    });

    // 3. Dot-separated table name parses schema automatically
    expect(resolveTableAndSchema("billing.users")).toEqual({
      safeTable: "users",
      targetSchema: "billing",
    });

    // 4. Dot-separated public prefix
    expect(resolveTableAndSchema("public.users")).toEqual({
      safeTable: "users",
      targetSchema: "public",
    });

    // 5. Normalizes schema case and strips illegal characters
    expect(resolveTableAndSchema("CUSTOM_SCHEMA.My_Table")).toEqual({
      safeTable: "My_Table",
      targetSchema: "custom_schema",
    });
  });
});
