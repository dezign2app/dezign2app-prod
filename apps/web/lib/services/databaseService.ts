import { getElectronAPI } from "@/lib/electron";
import {
  testDbOperationAction,
  checkDbConnectionAction,
  checkDbTableSyncAction,
  applyDbTableSyncAction,
  type TestDbOperationPayload,
  type TestDbOperationResult,
  type CheckDbConnectionPayload,
  type CheckDbConnectionResult,
  type CheckDbTableSyncPayload,
  type CheckDbTableSyncResult,
  type ApplyDbTableSyncPayload,
  type ApplyDbTableSyncResult,
  type JsonValue,
  type JsonObject,
  type JsonArray,
} from "@/app/actions/databaseActions";

export type {
  TestDbOperationPayload,
  TestDbOperationResult,
  CheckDbConnectionPayload,
  CheckDbConnectionResult,
  CheckDbTableSyncPayload,
  CheckDbTableSyncResult,
  ApplyDbTableSyncPayload,
  ApplyDbTableSyncResult,
  JsonValue,
  JsonObject,
  JsonArray,
};

/**
 * Execute a database operation against live or sandbox data.
 *
 * Automatically routes:
 * 1. In Electron desktop app -> Native IPC pipe (`window.electronAPI.db.executeOperation`)
 * 2. In Browser development -> Next.js Server Action (`testDbOperationAction`)
 *
 * Zero manual `fetch()` or REST HTTP `/api` calls.
 */
export async function testDatabaseOperation(
  payload: TestDbOperationPayload,
): Promise<TestDbOperationResult> {
  const electron = getElectronAPI();
  // In Electron, always route through IPC — Server Actions are not available in the desktop shell.
  if (electron?.db?.executeOperation) {
    try {
      return await electron.db.executeOperation(payload);
    } catch (err) {
      return {
        success: false,
        error: `Desktop IPC error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return testDbOperationAction(payload);
}

/**
 * Check database connection status, reachability, and metadata.
 *
 * Automatically routes:
 * 1. In Electron desktop app -> Native IPC pipe (`window.electronAPI.db.checkConnection`)
 *    All engines (SQLite, Postgres, Redis, etc.) are handled by the Electron main process,
 *    which has direct Node.js network/filesystem access to localhost services.
 * 2. In Browser (dev/web) -> Next.js Server Action (`checkDbConnectionAction`)
 *
 * Zero manual `fetch()` or REST HTTP `/api` calls.
 */
export async function checkDatabaseConnection(
  payload: CheckDbConnectionPayload,
): Promise<CheckDbConnectionResult> {
  const electron = getElectronAPI();
  // In Electron, always route through IPC — Server Actions are not available in the desktop shell.
  // The main process handles Postgres, Redis, SQLite, and TCP checks natively.
  if (electron?.db?.checkConnection) {
    try {
      return await electron.db.checkConnection(payload);
    } catch (err) {
      return {
        success: false,
        error: `Desktop IPC error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return checkDbConnectionAction(payload);
}

/**
 * Check whether a table and all its columns exist in the connected database.
 */
export async function checkDbTableSync(
  payload: CheckDbTableSyncPayload,
): Promise<CheckDbTableSyncResult> {
  const electron = getElectronAPI();
  if (electron && (electron.db as any)?.checkTableSync) {
    try {
      return await (electron.db as any).checkTableSync(payload);
    } catch (err) {
      return {
        success: false,
        serverReachable: false,
        tableExists: false,
        inSync: false,
        missingColumns: [],
        extraColumns: [],
        existingColumns: [],
        error: `Desktop IPC error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return checkDbTableSyncAction(payload);
}

/**
 * Apply table creation or add missing columns to the connected live database.
 */
export async function applyDbTableSync(
  payload: ApplyDbTableSyncPayload,
): Promise<ApplyDbTableSyncResult> {
  const electron = getElectronAPI();
  if (electron && (electron.db as any)?.applyTableSync) {
    try {
      return await (electron.db as any).applyTableSync(payload);
    } catch (err) {
      return {
        success: false,
        createdTable: false,
        appliedColumns: [],
        error: `Desktop IPC error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return applyDbTableSyncAction(payload);
}

