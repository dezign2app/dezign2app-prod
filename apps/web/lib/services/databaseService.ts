import { getElectronAPI } from "@/lib/electron";
import {
  testDbOperationAction,
  checkDbConnectionAction,
  type TestDbOperationPayload,
  type TestDbOperationResult,
  type CheckDbConnectionPayload,
  type CheckDbConnectionResult,
  type JsonValue,
  type JsonObject,
  type JsonArray,
} from "@/app/actions/databaseActions";

export type {
  TestDbOperationPayload,
  TestDbOperationResult,
  CheckDbConnectionPayload,
  CheckDbConnectionResult,
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
  // Only route SQLite to Electron IPC (where local filesystem access via host Node is needed).
  // Network engines (like Redis) have full live execution with ioredis implemented in Server Actions.
  if (electron?.db?.executeOperation && payload.engine === "sqlite") {
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
 * 1. SQLite -> Desktop IPC pipe (`window.electronAPI.db.checkConnection`)
 * 2. Redis & others -> Next.js Server Action (`checkDbConnectionAction`)
 *
 * Zero manual `fetch()` or REST HTTP `/api` calls.
 */
export async function checkDatabaseConnection(
  payload: CheckDbConnectionPayload,
): Promise<CheckDbConnectionResult> {
  const electron = getElectronAPI();
  if (electron?.db?.checkConnection && payload.engine === "sqlite") {
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
