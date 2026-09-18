import fs from "fs";
import path from "path";
import { executeFunctionCode } from "./functionCodeRunner";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonArray = JsonValue[];
type SqliteRawValue = JsonPrimitive | bigint | Uint8Array;

interface SqliteStatement {
  all(...params: JsonPrimitive[]): Record<string, SqliteRawValue>[];
  get(...params: JsonPrimitive[]): Record<string, SqliteRawValue> | undefined;
  run(...params: JsonPrimitive[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type DatabaseSyncConstructor = new (path: string) => SqliteDatabase;

let DatabaseSyncClass: DatabaseSyncConstructor | null = null;
try {
  DatabaseSyncClass = require("node:sqlite").DatabaseSync;
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  process.stdout.write(
    JSON.stringify({
      success: false,
      error: "Host node:sqlite not available: " + message,
    }),
  );
  process.exit(0);
}

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", async () => {
  try {
    if (!DatabaseSyncClass) {
      process.stdout.write(
        JSON.stringify({ success: false, error: "DatabaseSyncClass not initialized" }),
      );
      return;
    }
    const DatabaseSync = DatabaseSyncClass;

    if (!input.trim()) {
      process.stdout.write(JSON.stringify({ success: false, error: "Empty input" }));
      return;
    }

    const payload = JSON.parse(input);
    const { action } = payload;

    if (action === "check") {
      const { dbFilePath } = payload;
      const start = performance.now();
      const dir = path.dirname(dbFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const db = new DatabaseSync(dbFilePath);
      db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      const countStmt = db.prepare(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );
      const countRow = countStmt.get();
      db.close();

      const latencyMs = Math.round((performance.now() - start) * 10) / 10;
      const sizeBytes = fs.existsSync(dbFilePath) ? fs.statSync(dbFilePath).size : 0;
      let tableCount = 0;
      if (countRow && typeof countRow.count === "number") tableCount = countRow.count;
      else if (countRow && typeof countRow.count === "bigint") tableCount = Number(countRow.count);

      process.stdout.write(
        JSON.stringify({
          success: true,
          latencyMs,
          sizeBytes,
          tableCount,
        }),
      );
      return;
    }

    if (action === "execute") {
      const { dbFilePath, tableName, columns, operation, args } = payload;
      const start = performance.now();
      const dir = path.dirname(dbFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const db = new DatabaseSync(dbFilePath);
      db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

      const safeTable = (tableName || "records").replace(/[^a-zA-Z0-9_]/g, "") || "records";

      // Ensure table
      const checkStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
      if (!checkStmt.get(safeTable)) {
        const colDefs = [];
        if (columns && columns.length > 0) {
          for (const col of columns) {
            const cName = (col.name || "col").replace(/[^a-zA-Z0-9_]/g, "") || "col";
            const t = (col.type || "").toLowerCase();
            const cType =
              t === "number" || t === "int" || t === "integer" || t === "bigint"
                ? "INTEGER"
                : t === "float" || t === "double" || t === "real"
                ? "REAL"
                : t === "boolean" || t === "bool"
                ? "INTEGER"
                : "TEXT";
            const isPk = col.isPrimaryKey || col.primaryKey || cName.toLowerCase() === "id";
            colDefs.push(isPk ? `${cName} ${cType} PRIMARY KEY` : `${cName} ${cType}`);
          }
        }
        if (!colDefs.some((c: string) => c.includes("PRIMARY KEY"))) colDefs.unshift("id TEXT PRIMARY KEY");
        if (!colDefs.some((c: string) => c.startsWith("created_at "))) colDefs.push("created_at TEXT DEFAULT CURRENT_TIMESTAMP");
        if (!colDefs.some((c: string) => c.startsWith("updated_at "))) colDefs.push("updated_at TEXT DEFAULT CURRENT_TIMESTAMP");
        db.exec(`CREATE TABLE IF NOT EXISTS ${safeTable} (${colDefs.join(", ")});`);
      }

      const name = operation.name || "";
      const kind = operation.kind || "";
      const customQuery = operation.query || "";

      const isFindAll =
        kind === "findAll" ||
        name.toLowerCase().startsWith("findall") ||
        name.toLowerCase().startsWith("getall") ||
        name.toLowerCase().startsWith("list");
      const isFindById =
        kind === "findById" ||
        name.toLowerCase().startsWith("findbyid") ||
        name.toLowerCase().startsWith("getbyid") ||
        (name.toLowerCase().startsWith("find") && (args.id !== undefined || args.key !== undefined));
      const isCreate =
        kind === "create" || name.toLowerCase().startsWith("create") || name.toLowerCase().startsWith("insert");
      const isUpdate = kind === "update" || name.toLowerCase().startsWith("update");
      const isDelete =
        kind === "delete" || name.toLowerCase().startsWith("delete") || name.toLowerCase().startsWith("remove");

      let output = null;
      let rawSql = "";

      const formatRow = (row: Record<string, SqliteRawValue>): Record<string, JsonValue> => {
        if (!row || typeof row !== "object") return row;
        const obj: Record<string, JsonValue> = {};
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === "bigint") obj[k] = v.toString();
          else if (v instanceof Uint8Array) obj[k] = Buffer.from(v).toString("base64");
          else obj[k] = v;
        }
        return obj;
      };

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

        db.close();
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        const sizeBytes = fs.existsSync(dbFilePath) ? fs.statSync(dbFilePath).size : 0;

        process.stdout.write(
          JSON.stringify({
            success: codeRes.success,
            output: codeRes.output,
            error: codeRes.error,
            rawSql: codeRes.rawCommand,
            durationMs: codeRes.durationMs || durationMs,
            sizeBytes,
            table: safeTable,
          }),
        );
        return;
      }

      if (customQuery && !customQuery.startsWith("Query function for") && !customQuery.startsWith("Auto-generated")) {
        rawSql = customQuery.trim();
        if (/^SELECT|^PRAGMA/i.test(rawSql)) {
          output = db.prepare(rawSql).all().map(formatRow);
        } else {
          const res = db.prepare(rawSql).run();
          output = { success: true, changes: Number(res.changes) };
        }
      } else if (isFindAll) {
        const limit = Math.max(1, Number(args.limit) || 20);
        const offset = Math.max(0, Number(args.offset) || 0);
        rawSql = `SELECT * FROM ${safeTable} LIMIT ${limit} OFFSET ${offset};`;
        output = db.prepare(`SELECT * FROM ${safeTable} LIMIT ? OFFSET ?`).all(limit, offset).map(formatRow);
      } else if (isFindById) {
        const idVal = String(args.id ?? args.key ?? "1");
        rawSql = `SELECT * FROM ${safeTable} WHERE id = '${idVal}' LIMIT 1;`;
        const row = db.prepare(`SELECT * FROM ${safeTable} WHERE id = ? LIMIT 1`).get(idVal);
        output = row ? formatRow(row) : null;
      } else if (isCreate) {
        const dataObj =
          typeof args.data === "object" && args.data !== null && !Array.isArray(args.data)
            ? args.data
            : typeof args === "object" && args !== null && !Array.isArray(args)
            ? args
            : {};
        const newId = String(args.id ?? dataObj.id ?? `conv_${Date.now()}`);
        const nowIso = new Date().toISOString();
        const entries: [string, JsonPrimitive][] = [["id", newId]];
        if (dataObj.created_at === undefined) entries.push(["created_at", nowIso]);
        if (dataObj.updated_at === undefined) entries.push(["updated_at", nowIso]);
        for (const [k, v] of Object.entries(dataObj)) {
          if (k === "id" || k === "created_at" || k === "updated_at" || k === "limit" || k === "offset") continue;
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
            entries.push([k.replace(/[^a-zA-Z0-9_]/g, ""), v]);
          }
        }
        const infoRows = db.prepare(`PRAGMA table_info(${safeTable})`).all();
        const existing = new Set(infoRows.map((r) => String(r["name"] ?? "").toLowerCase()));
        for (const [k] of entries) {
          if (!existing.has(k.toLowerCase())) {
            db.exec(`ALTER TABLE ${safeTable} ADD COLUMN ${k} TEXT;`);
            existing.add(k.toLowerCase());
          }
        }
        const colNames = entries.map(([k]) => k).join(", ");
        const placeholders = entries.map(() => "?").join(", ");
        const bindVals = entries.map(([, v]) => v);
        rawSql = `INSERT INTO ${safeTable} (${colNames}) VALUES (${bindVals.map((v) => JSON.stringify(v)).join(", ")}) RETURNING *;`;
        const stmt = db.prepare(`INSERT INTO ${safeTable} (${colNames}) VALUES (${placeholders}) RETURNING *`);
        const created = stmt.get(...bindVals);
        output = created ? formatRow(created) : { id: newId, created_at: nowIso, updated_at: nowIso };
      } else if (isUpdate) {
        const dataObj =
          typeof args.data === "object" && args.data !== null && !Array.isArray(args.data)
            ? args.data
            : typeof args === "object" && args !== null && !Array.isArray(args)
            ? args
            : {};
        const idVal = String(args.id ?? dataObj.id ?? "1");
        const nowIso = new Date().toISOString();
        const updateEntries: [string, JsonPrimitive][] = [];
        for (const [k, v] of Object.entries(dataObj)) {
          if (k === "id" || k === "limit" || k === "offset") continue;
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
            updateEntries.push([k.replace(/[^a-zA-Z0-9_]/g, ""), v]);
          }
        }
        if (!updateEntries.some(([k]) => k === "updated_at")) updateEntries.push(["updated_at", nowIso]);
        const infoRows = db.prepare(`PRAGMA table_info(${safeTable})`).all();
        const existing = new Set(infoRows.map((r) => String(r["name"] ?? "").toLowerCase()));
        for (const [k] of updateEntries) {
          if (!existing.has(k.toLowerCase())) {
            db.exec(`ALTER TABLE ${safeTable} ADD COLUMN ${k} TEXT;`);
            existing.add(k.toLowerCase());
          }
        }
        const setClause = updateEntries.map(([k]) => `${k} = ?`).join(", ");
        const bindVals = [...updateEntries.map(([, v]) => v), idVal];
        rawSql = `UPDATE ${safeTable} SET ${updateEntries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ")} WHERE id = '${idVal}' RETURNING *;`;
        const stmt = db.prepare(`UPDATE ${safeTable} SET ${setClause} WHERE id = ? RETURNING *`);
        const updated = stmt.get(...bindVals);
        output = updated ? formatRow(updated) : { success: false, message: `Record with id '${idVal}' not found in ${safeTable}` };
      } else if (isDelete) {
        const idVal = String(args.id ?? "1");
        rawSql = `DELETE FROM ${safeTable} WHERE id = '${idVal}';`;
        const res = db.prepare(`DELETE FROM ${safeTable} WHERE id = ?`).run(idVal);
        output = { success: true, deletedCount: Number(res.changes), message: `Record with id '${idVal}' was deleted from ${safeTable}.` };
      } else {
        rawSql = `SELECT * FROM ${safeTable} LIMIT 20;`;
        output = db.prepare(rawSql).all().map(formatRow);
      }

      db.close();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const sizeBytes = fs.existsSync(dbFilePath) ? fs.statSync(dbFilePath).size : 0;

      process.stdout.write(
        JSON.stringify({
          success: true,
          output,
          rawSql,
          durationMs,
          sizeBytes,
          table: safeTable,
        }),
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(JSON.stringify({ success: false, error: message }));
  }
});
