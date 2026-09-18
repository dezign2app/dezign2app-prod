import fs from "fs";
import path from "path";
import { DatabaseSync, SqliteBindValue } from "node:sqlite";
import { CanvasEntityColumn } from "@workspace/canvas/types";
import { executeFunctionCode } from "../database-runner/functionCodeRunner";

// Strongly-typed JSON structures avoiding any / unknown
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export function isJsonObject(val: unknown): val is JsonObject {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Resolve SQLite database file path.
 * If relative, resolves against the monorepo workspace root where dev.db lives.
 */
export function resolveSqlitePath(dbFilePath = "dev.db", projectDir?: string): string {
  if (path.isAbsolute(dbFilePath)) return dbFilePath;

  let searchDir = projectDir || process.cwd();
  while (searchDir && searchDir !== path.dirname(searchDir)) {
    if (
      fs.existsSync(path.join(searchDir, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(searchDir, "turbo.json"))
    ) {
      return path.resolve(searchDir, dbFilePath);
    }
    searchDir = path.dirname(searchDir);
  }
  return path.resolve(process.cwd(), dbFilePath);
}

/**
 * Sanitize SQL identifier against injection.
 */
export function sanitizeIdentifier(identifier: string, fallback = "item"): string {
  const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned || fallback;
}

/**
 * Map canvas column data type to SQLite storage type.
 */
export function mapColumnTypeToSqlite(type?: string): string {
  if (!type) return "TEXT";
  const t = type.toLowerCase();
  if (t === "number" || t === "int" || t === "integer" || t === "bigint") return "INTEGER";
  if (t === "float" || t === "double" || t === "real" || t === "decimal") return "REAL";
  if (t === "boolean" || t === "bool") return "INTEGER";
  return "TEXT";
}

/**
 * Convert a raw SQLite row into a clean, strongly-typed JSON object.
 */
export function formatSqliteRow(row: Record<string, SqliteBindValue>): JsonObject {
  const obj: JsonObject = {};
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === "bigint") {
      obj[key] = val.toString();
    } else if (val instanceof Uint8Array) {
      obj[key] = Buffer.from(val).toString("base64");
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

/**
 * Auto-ensure SQLite table and its columns exist in dev.db.
 */
export function ensureSqliteTable(
  db: DatabaseSync,
  tableName: string,
  columns?: CanvasEntityColumn[],
): string {
  const safeTable = sanitizeIdentifier(tableName, "records");

  const checkStmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
  );
  const exists = checkStmt.get(safeTable);

  if (!exists) {
    const colSqlList: string[] = [];
    if (columns && columns.length > 0) {
      for (const col of columns) {
        const colName = sanitizeIdentifier(col.name, "col");
        const colType = mapColumnTypeToSqlite(col.type);
        const isPk =
          col.isPrimaryKey ||
          col.isPrimary ||
          col.primaryKey ||
          colName.toLowerCase() === "id";
        colSqlList.push(isPk ? `${colName} ${colType} PRIMARY KEY` : `${colName} ${colType}`);
      }
    }
    if (!colSqlList.some((c) => c.includes("PRIMARY KEY"))) {
      colSqlList.unshift("id TEXT PRIMARY KEY");
    }
    if (!colSqlList.some((c) => c.startsWith("created_at "))) {
      colSqlList.push("created_at TEXT DEFAULT CURRENT_TIMESTAMP");
    }
    if (!colSqlList.some((c) => c.startsWith("updated_at "))) {
      colSqlList.push("updated_at TEXT DEFAULT CURRENT_TIMESTAMP");
    }
    db.exec(`CREATE TABLE IF NOT EXISTS ${safeTable} (${colSqlList.join(", ")});`);
  } else if (columns && columns.length > 0) {
    const infoStmt = db.prepare(`PRAGMA table_info(${safeTable})`);
    const infoRows = infoStmt.all();
    const existing = new Set<string>();
    for (const r of infoRows) {
      const colNameVal = r.name;
      if (typeof colNameVal === "string") {
        existing.add(colNameVal.toLowerCase());
      }
    }
    for (const col of columns) {
      const colName = sanitizeIdentifier(col.name, "col");
      if (!existing.has(colName.toLowerCase())) {
        const colType = mapColumnTypeToSqlite(col.type);
        db.exec(`ALTER TABLE ${safeTable} ADD COLUMN ${colName} ${colType};`);
        existing.add(colName.toLowerCase());
      }
    }
  }

  return safeTable;
}

export interface SqliteOperationParams {
  id?: string;
  name: string;
  kind?: string;
  code?: string;
  query?: string;
  signature?: string;
  params?: Array<{ name: string; type: string; defaultValue?: string }>;
}

export interface ExecuteSqliteOptions {
  dbFilePath?: string;
  projectDir?: string;
  tableName: string;
  columns?: CanvasEntityColumn[];
  operation: SqliteOperationParams;
  args: Record<string, unknown>;
}

export interface SqliteExecutionResult {
  success: boolean;
  output: JsonValue;
  rawSql: string;
  durationMs: number;
  error?: string;
  dbInfo: {
    path: string;
    sizeBytes: number;
    table: string;
    exists: boolean;
  };
}

/**
 * Execute a real query against the SQLite database file dev.db.
 */
export async function executeSqliteLiveOperation(
  options: ExecuteSqliteOptions,
): Promise<SqliteExecutionResult> {
  const start = performance.now();
  const resolvedPath = resolveSqlitePath(options.dbFilePath, options.projectDir);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(resolvedPath);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

    const safeTable = ensureSqliteTable(db, options.tableName, options.columns);
    const { operation, args } = options;
    const name = operation.name || "";
    const kind = operation.kind || "";
    const customQuery = operation.query || "";

    const isFindAll =
      kind === "findAll" ||
      name.toLowerCase().startsWith("findall") ||
      name.toLowerCase().startsWith("getall") ||
      name.toLowerCase().startsWith("list");

    const isDelete =
      kind === "delete" ||
      name.toLowerCase().startsWith("delete") ||
      name.toLowerCase().startsWith("remove");

    const isUpdate =
      kind === "update" ||
      name.toLowerCase().startsWith("update");

    const isCreate =
      kind === "create" ||
      name.toLowerCase().startsWith("create") ||
      name.toLowerCase().startsWith("insert");

    const isFindById =
      kind === "findById" ||
      name.toLowerCase().startsWith("findbyid") ||
      name.toLowerCase().startsWith("getbyid") ||
      (name.toLowerCase().startsWith("find") && (args.id !== undefined || args.key !== undefined));

    // 0. Custom JavaScript / TypeScript function code execution
    const code = (operation.code || "").trim();
    const hasCustomCode =
      code.length > 0 &&
      (kind === "custom" ||
        code.includes("function") ||
        code.includes("=>") ||
        code.includes("return") ||
        code.includes("stmt") ||
        code.includes("db."));

    if (hasCustomCode && (kind === "custom" || (!isFindAll && !isFindById && !isCreate && !isUpdate && !isDelete))) {
      const codeRes = await executeFunctionCode({
        code,
        name,
        params: operation.params,
        args,
        db,
        tableName: safeTable,
        safeTable,
      });

      const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;
      return {
        success: codeRes.success,
        output: codeRes.output as JsonValue,
        error: codeRes.error,
        rawSql: codeRes.rawCommand,
        durationMs: codeRes.durationMs,
        dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
      };
    }

    // 1. Custom raw SQL query
    if (
      customQuery &&
      !customQuery.startsWith("Query function for") &&
      !customQuery.startsWith("Auto-generated")
    ) {
      const trimmed = customQuery.trim();
      if (/^SELECT|^PRAGMA/i.test(trimmed)) {
        const stmt = db.prepare(trimmed);
        const rows = stmt.all();
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;
        return {
          success: true,
          output: rows.map(formatSqliteRow),
          rawSql: trimmed,
          durationMs: Math.max(0.4, durationMs),
          dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
        };
      } else {
        const stmt = db.prepare(trimmed);
        const res = stmt.run();
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;
        return {
          success: true,
          output: { success: true, changes: Number(res.changes) },
          rawSql: trimmed,
          durationMs: Math.max(0.4, durationMs),
          dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
        };
      }
    }

    // 2. Find All
    if (isFindAll) {
      const limit = Math.max(1, Number(args.limit) || 20);
      const offset = Math.max(0, Number(args.offset) || 0);
      const rawSql = `SELECT * FROM ${safeTable} LIMIT ${limit} OFFSET ${offset};`;

      const stmt = db.prepare(`SELECT * FROM ${safeTable} LIMIT ? OFFSET ?`);
      const rows = stmt.all(limit, offset);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;

      return {
        success: true,
        output: rows.map(formatSqliteRow),
        rawSql,
        durationMs: Math.max(0.4, durationMs),
        dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
      };
    }

    // 3. Find By ID
    if (isFindById) {
      const idVal = String(args.id ?? args.key ?? "1");
      const rawSql = `SELECT * FROM ${safeTable} WHERE id = '${idVal}' LIMIT 1;`;

      const stmt = db.prepare(`SELECT * FROM ${safeTable} WHERE id = ? LIMIT 1`);
      const row = stmt.get(idVal);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;

      return {
        success: true,
        output: row ? formatSqliteRow(row) : null,
        rawSql,
        durationMs: Math.max(0.4, durationMs),
        dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
      };
    }

    // 4. Create (INSERT ... RETURNING *)
    if (isCreate) {
      const dataObj: JsonObject = isJsonObject(args.data)
        ? args.data
        : isJsonObject(args)
          ? args
          : {};
      const newId = String(args.id ?? dataObj.id ?? `conv_${Date.now()}`);
      const nowIso = new Date().toISOString();

      const entries: [string, SqliteBindValue][] = [];
      entries.push(["id", newId]);
      if (dataObj.created_at === undefined) entries.push(["created_at", nowIso]);
      if (dataObj.updated_at === undefined) entries.push(["updated_at", nowIso]);

      for (const [k, v] of Object.entries(dataObj)) {
        if (
          k === "id" ||
          k === "created_at" ||
          k === "updated_at" ||
          k === "limit" ||
          k === "offset"
        ) {
          continue;
        }
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
          entries.push([sanitizeIdentifier(k), v]);
        }
      }

      // Ensure any extra dynamic fields exist as columns
      const infoRows = db.prepare(`PRAGMA table_info(${safeTable})`).all();
      const existing = new Set<string>();
      for (const r of infoRows) {
        if (typeof r.name === "string") existing.add(r.name.toLowerCase());
      }
      for (const [k] of entries) {
        if (!existing.has(k.toLowerCase())) {
          db.exec(`ALTER TABLE ${safeTable} ADD COLUMN ${k} TEXT;`);
          existing.add(k.toLowerCase());
        }
      }

      const colNames = entries.map(([k]) => k).join(", ");
      const placeholders = entries.map(() => "?").join(", ");
      const bindVals = entries.map(([, v]) => v);
      const rawSql = `INSERT INTO ${safeTable} (${colNames}) VALUES (${bindVals.map((v) => JSON.stringify(v)).join(", ")}) RETURNING *;`;

      const stmt = db.prepare(
        `INSERT INTO ${safeTable} (${colNames}) VALUES (${placeholders}) RETURNING *`,
      );
      const created = stmt.get(...bindVals);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;

      return {
        success: true,
        output: created
          ? formatSqliteRow(created)
          : { id: newId, created_at: nowIso, updated_at: nowIso },
        rawSql,
        durationMs: Math.max(0.4, durationMs),
        dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
      };
    }

    // 5. Update (UPDATE ... WHERE id = ? RETURNING *)
    if (isUpdate) {
      const dataObj: JsonObject = isJsonObject(args.data)
        ? args.data
        : isJsonObject(args)
          ? args
          : {};
      const idVal = String(args.id ?? dataObj.id ?? "1");
      const nowIso = new Date().toISOString();

      const updateEntries: [string, SqliteBindValue][] = [];
      for (const [k, v] of Object.entries(dataObj)) {
        if (k === "id" || k === "limit" || k === "offset") continue;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
          updateEntries.push([sanitizeIdentifier(k), v]);
        }
      }
      if (!updateEntries.some(([k]) => k === "updated_at")) {
        updateEntries.push(["updated_at", nowIso]);
      }

      // Ensure dynamic columns exist
      const infoRows = db.prepare(`PRAGMA table_info(${safeTable})`).all();
      const existing = new Set<string>();
      for (const r of infoRows) {
        if (typeof r.name === "string") existing.add(r.name.toLowerCase());
      }
      for (const [k] of updateEntries) {
        if (!existing.has(k.toLowerCase())) {
          db.exec(`ALTER TABLE ${safeTable} ADD COLUMN ${k} TEXT;`);
          existing.add(k.toLowerCase());
        }
      }

      const setClause = updateEntries.map(([k]) => `${k} = ?`).join(", ");
      const bindVals = [...updateEntries.map(([, v]) => v), idVal];
      const rawSql = `UPDATE ${safeTable} SET ${updateEntries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ")} WHERE id = '${idVal}' RETURNING *;`;

      const stmt = db.prepare(
        `UPDATE ${safeTable} SET ${setClause} WHERE id = ? RETURNING *`,
      );
      const updated = stmt.get(...bindVals);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;

      return {
        success: true,
        output: updated
          ? formatSqliteRow(updated)
          : { success: false, message: `Record with id '${idVal}' not found in ${safeTable}` },
        rawSql,
        durationMs: Math.max(0.4, durationMs),
        dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
      };
    }

    // 6. Delete (DELETE FROM ... WHERE id = ?)
    if (isDelete) {
      const idVal = String(args.id ?? "1");
      const rawSql = `DELETE FROM ${safeTable} WHERE id = '${idVal}';`;

      const stmt = db.prepare(`DELETE FROM ${safeTable} WHERE id = ?`);
      const res = stmt.run(idVal);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;

      return {
        success: true,
        output: {
          success: true,
          deletedCount: Number(res.changes),
          message: `Record with id '${idVal}' was deleted from ${safeTable}.`,
        },
        rawSql,
        durationMs: Math.max(0.4, durationMs),
        dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
      };
    }

    // Fallback default: SELECT *
    const fallbackSql = `SELECT * FROM ${safeTable} LIMIT 20;`;
    const stmt = db.prepare(fallbackSql);
    const rows = stmt.all();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;

    return {
      success: true,
      output: rows.map(formatSqliteRow),
      rawSql: fallbackSql,
      durationMs: Math.max(0.4, durationMs),
      dbInfo: { path: resolvedPath, sizeBytes, table: safeTable, exists: true },
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;
    const errMessage = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      output: null,
      rawSql: options.operation.query || `${options.operation.name}()`,
      durationMs: Math.max(0.4, durationMs),
      error: `SQLite execution error: ${errMessage}`,
      dbInfo: {
        path: resolvedPath,
        sizeBytes,
        table: sanitizeIdentifier(options.tableName, "records"),
        exists: fs.existsSync(resolvedPath),
      },
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {}
    }
  }
}

/**
 * Check SQLite database connectivity and status.
 */
export function checkSqliteConnection(
  dbFilePath = "dev.db",
  projectDir?: string,
): {
  success: boolean;
  latencyMs: number;
  path: string;
  sizeBytes: number;
  tableCount: number;
  error?: string;
} {
  const start = performance.now();
  const resolvedPath = resolveSqlitePath(dbFilePath, projectDir);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(resolvedPath);
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const countStmt = db.prepare(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const countRow = countStmt.get();
    let tableCount = 0;
    if (countRow && typeof countRow.count === "number") {
      tableCount = countRow.count;
    } else if (countRow && typeof countRow.count === "bigint") {
      tableCount = Number(countRow.count);
    }
    const latencyMs = Math.round((performance.now() - start) * 10) / 10;
    const sizeBytes = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath).size : 0;
    return {
      success: true,
      latencyMs: Math.max(0.4, latencyMs),
      path: resolvedPath,
      sizeBytes,
      tableCount,
    };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - start) * 10) / 10;
    return {
      success: false,
      latencyMs,
      path: resolvedPath,
      sizeBytes: 0,
      tableCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {}
    }
  }
}
