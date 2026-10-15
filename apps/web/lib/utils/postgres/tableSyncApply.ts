import { normalizeToPostgresType } from "@/lib/schema/columnTypes";
import { resolveConnectionString, isSslRequiredForConfig, resolveTableAndSchema } from "./connection";
import { ensurePostgresTable } from "./tableSchema";
import { CanvasForeignKey, PostgresApplySyncResult, PostgresConnectionConfig, PrerequisiteTableDefinition } from "./types";

/**
 * Helper to synchronize foreign key constraints on a table in PostgreSQL.
 */
export async function applyForeignKeysToTable(
  client: import("pg").PoolClient,
  safeTable: string,
  targetSchema: string,
  validCanvasFks: CanvasForeignKey[],
): Promise<{
  appliedForeignKeys: string[];
  droppedForeignKeys: string[];
  foreignKeyErrors: string[];
}> {
  const appliedForeignKeys: string[] = [];
  const droppedForeignKeys: string[] = [];
  const foreignKeyErrors: string[] = [];

  // Query existing foreign keys
  let existingForeignKeys: Array<{
    name: string;
    column: string;
    foreignTable: string;
    foreignColumn: string;
    foreignSchema: string;
  }> = [];

  try {
    const fkRes = await client.query<{
      constraint_name: string;
      column_name: string;
      foreign_table: string;
      foreign_column: string;
      foreign_schema: string;
    }>(
      `SELECT
         c.conname AS constraint_name,
         att.attname AS column_name,
         cl_ref.relname AS foreign_table,
         att_ref.attname AS foreign_column,
         n_ref.nspname AS foreign_schema
       FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
       JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY(c.conkey)
       JOIN pg_class cl_ref ON cl_ref.oid = c.confrelid
       JOIN pg_namespace n_ref ON n_ref.oid = cl_ref.relnamespace
       JOIN pg_attribute att_ref ON att_ref.attrelid = c.confrelid AND att_ref.attnum = ANY(c.confkey)
       WHERE c.contype = 'f'
         AND LOWER(cl.relname) = LOWER($1)
         AND n.nspname = $2`,
      [safeTable, targetSchema],
    );

    existingForeignKeys = (fkRes.rows || []).map((r) => ({
      name: r.constraint_name,
      column: r.column_name,
      foreignTable: r.foreign_table,
      foreignColumn: r.foreign_column,
      foreignSchema: r.foreign_schema,
    }));
  } catch {
    existingForeignKeys = [];
  }

  const missingFks = validCanvasFks.filter((cFk) => {
    const cCol = cFk.column.trim().toLowerCase();
    const cTargetTable = cFk.foreignTable.trim().toLowerCase();
    const cTargetCol = cFk.foreignColumn.trim().toLowerCase();
    return !existingForeignKeys.some(
      (dbFk) =>
        dbFk.column.toLowerCase() === cCol &&
        dbFk.foreignTable.toLowerCase() === cTargetTable &&
        dbFk.foreignColumn.toLowerCase() === cTargetCol,
    );
  });

  const extraFks = existingForeignKeys.filter((dbFk) => {
    const dbCol = dbFk.column.toLowerCase();
    const dbTargetTable = dbFk.foreignTable.toLowerCase();
    const dbTargetCol = dbFk.foreignColumn.toLowerCase();
    return !validCanvasFks.some(
      (cFk) =>
        cFk.column.trim().toLowerCase() === dbCol &&
        cFk.foreignTable.trim().toLowerCase() === dbTargetTable &&
        cFk.foreignColumn.trim().toLowerCase() === dbTargetCol,
    );
  });

  // Drop extra foreign keys
  for (const extraFk of extraFks) {
    const safeConstraintName = (extraFk.name || "").replace(/[^a-zA-Z0-9_]/g, "");
    if (safeConstraintName) {
      try {
        await client.query(
          `ALTER TABLE "${targetSchema}"."${safeTable}" DROP CONSTRAINT IF EXISTS "${safeConstraintName}" CASCADE`,
        );
        droppedForeignKeys.push(safeConstraintName);
      } catch (err) {
        foreignKeyErrors.push(`Failed to drop FK "${safeConstraintName}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Add missing foreign keys
  for (const missingFk of missingFks) {
    const colName = (missingFk.column || "").replace(/[^a-zA-Z0-9_]/g, "");
    const targetTable = (missingFk.foreignTable || "").replace(/[^a-zA-Z0-9_]/g, "");
    const targetCol = (missingFk.foreignColumn || "").replace(/[^a-zA-Z0-9_]/g, "");
    const targetFkSchema =
      (missingFk.foreignSchema || targetSchema).replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "public";

    if (!colName || !targetTable || !targetCol) continue;

    // Verify target table exists
    const targetExistsRes = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE LOWER(table_name) = LOWER($1) AND table_schema = $2
      ) AS exists`,
      [targetTable, targetFkSchema],
    );

    if (!targetExistsRes.rows[0]?.exists) {
      foreignKeyErrors.push(
        `Foreign key on column "${colName}": target table "${targetTable}" does not exist in database yet`,
      );
      continue;
    }

    let safeFkName = (missingFk.name || `fk_${safeTable}_${colName}`).replace(/[^a-zA-Z0-9_]/g, "");
    const onDeleteAction = (missingFk.onDelete || "CASCADE").toUpperCase();
    const onDeleteClause = ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"].includes(onDeleteAction)
      ? `ON DELETE ${onDeleteAction}`
      : "ON DELETE CASCADE";
    const onUpdateAction = missingFk.onUpdate ? missingFk.onUpdate.toUpperCase() : "";
    const onUpdateClause = ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"].includes(onUpdateAction)
      ? `ON UPDATE ${onUpdateAction}`
      : "";

    try {
      await client.query(
        `ALTER TABLE "${targetSchema}"."${safeTable}"
         ADD CONSTRAINT "${safeFkName}"
         FOREIGN KEY ("${colName}")
         REFERENCES "${targetFkSchema}"."${targetTable}" ("${targetCol}")
         ${onDeleteClause} ${onUpdateClause}`,
      );
      appliedForeignKeys.push(safeFkName);
    } catch (fkErr) {
      const fallbackFkName = `fk_${safeTable}_${colName}_${Date.now() % 10000}`;
      try {
        await client.query(
          `ALTER TABLE "${targetSchema}"."${safeTable}"
           ADD CONSTRAINT "${fallbackFkName}"
           FOREIGN KEY ("${colName}")
           REFERENCES "${targetFkSchema}"."${targetTable}" ("${targetCol}")
           ${onDeleteClause} ${onUpdateClause}`,
        );
        appliedForeignKeys.push(fallbackFkName);
      } catch (fallbackErr) {
        const activeErr =
          fallbackErr instanceof Error
            ? fallbackErr
            : fkErr instanceof Error
              ? fkErr
              : null;
        let extra = "";
        if (activeErr) {
          const parts: string[] = [];
          if (
            "detail" in activeErr &&
            typeof activeErr.detail === "string" &&
            activeErr.detail.trim().length > 0
          ) {
            parts.push(activeErr.detail.trim());
          }
          if (
            "hint" in activeErr &&
            typeof activeErr.hint === "string" &&
            activeErr.hint.trim().length > 0
          ) {
            parts.push(activeErr.hint.trim());
          }
          extra = parts.join(". ");
        }
        const baseMsg = activeErr ? activeErr.message : String(fallbackErr || fkErr);
        foreignKeyErrors.push(
          `FK "${safeFkName}": ${baseMsg}${extra ? ` (${extra})` : ""}`,
        );
      }
    }
  }

  return { appliedForeignKeys, droppedForeignKeys, foreignKeyErrors };
}

/**
 * Applies missing table or missing columns/indexes/foreign keys to the live PostgreSQL database,
 * auto-creates prerequisite tables if provided, and drops removed columns/indexes/foreign keys.
 */
export async function applyPostgresTableSync(
  connection: PostgresConnectionConfig,
  tableName: string,
  columns?: Array<{ name?: string; type?: string; isPrimaryKey?: boolean; isNotNull?: boolean; isUnique?: boolean }>,
  schema?: string,
  indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>,
  foreignKeys?: Array<CanvasForeignKey>,
  prerequisiteTables?: Array<PrerequisiteTableDefinition>,
): Promise<PostgresApplySyncResult> {
  const { Pool } = await import("pg");
  const connectionString = resolveConnectionString(connection);
  const { safeTable, targetSchema } = resolveTableAndSchema(tableName, schema);

  const validCanvasIndexes = (indexes || [])
    .filter((i) => (i.name || "").trim().length > 0 && (i.columns || "").trim().length > 0)
    .map((i) => ({
      name: i.name.trim(),
      columns: i.columns.trim(),
      isUnique: Boolean(i.isUnique),
    }));

  const validCanvasFks = (foreignKeys || [])
    .filter(
      (fk) =>
        (fk.column || "").trim().length > 0 &&
        (fk.foreignTable || "").trim().length > 0 &&
        (fk.foreignColumn || "").trim().length > 0,
    )
    .map((fk) => ({
      name: (fk.name || "").trim(),
      column: fk.column.trim(),
      foreignTable: fk.foreignTable.trim(),
      foreignColumn: fk.foreignColumn.trim(),
      foreignSchema: (fk.foreignSchema || targetSchema).trim(),
      onDelete: fk.onDelete || "CASCADE",
      onUpdate: fk.onUpdate,
    }));

  if (!safeTable) {
    return {
      success: false,
      createdTable: false,
      appliedColumns: [],
      error: "Invalid table name",
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 6000,
    ssl: isSslRequiredForConfig(connection, connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  let client: import("pg").PoolClient | undefined;
  try {
    client = await pool.connect();

    // 1. Create any missing prerequisite tables first
    const appliedPrerequisiteTables: string[] = [];
    if (prerequisiteTables && prerequisiteTables.length > 0) {
      for (const prereq of prerequisiteTables) {
        const { safeTable: prereqTable, targetSchema: prereqSchema } = resolveTableAndSchema(
          prereq.tableName,
          prereq.schema || targetSchema,
        );
        if (!prereqTable) continue;

        const prereqCheck = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE LOWER(table_name) = LOWER($1) AND table_schema = $2
          ) AS exists`,
          [prereqTable, prereqSchema],
        );

        if (!prereqCheck.rows[0]?.exists) {
          await ensurePostgresTable(client, prereqTable, prereq.columns, prereqSchema);
          appliedPrerequisiteTables.push(prereqTable);

          // Also create any indexes for prerequisite table if provided
          for (const idx of prereq.indexes || []) {
            let safeIdxName = (idx.name || "").replace(/[^a-zA-Z0-9_]/g, "");
            if (!safeIdxName) {
              safeIdxName = `idx_${prereqTable}_${(idx.columns || "").replace(/[^a-zA-Z0-9_]/g, "_")}`;
            }
            const colList = (idx.columns || "")
              .split(",")
              .map((c) => `"${c.trim().replace(/[^a-zA-Z0-9_]/g, "")}"`)
              .join(", ");
            if (safeIdxName && colList) {
              const uniqueStr = idx.isUnique ? "UNIQUE " : "";
              try {
                await client.query(
                  `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${safeIdxName}" ON "${prereqSchema}"."${prereqTable}" (${colList})`
                );
              } catch {}
            }
          }
        }
      }
    }

    // 2. Check if table exists in the configured schema
    const checkRes = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE LOWER(table_name) = LOWER($1)
          AND table_schema = $2
      ) AS exists`,
      [safeTable, targetSchema],
    );
    const tableExists = Boolean(checkRes.rows[0]?.exists);

    if (!tableExists) {
      await ensurePostgresTable(client, safeTable, columns, targetSchema);
      const appliedIndexes: string[] = [];
      const indexErrors: string[] = [];
      for (const idx of validCanvasIndexes) {
        let safeIdxName = idx.name.replace(/[^a-zA-Z0-9_]/g, "");
        if (!safeIdxName) {
          safeIdxName = `idx_${safeTable}_${idx.columns.replace(/[^a-zA-Z0-9_]/g, "_")}`;
        }
        const colList = idx.columns
          .split(",")
          .map((c) => `"${c.trim().replace(/[^a-zA-Z0-9_]/g, "")}"`)
          .join(", ");
        if (safeIdxName && colList) {
          const uniqueStr = idx.isUnique ? "UNIQUE " : "";
          try {
            await client.query(
              `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${safeIdxName}" ON "${targetSchema}"."${safeTable}" (${colList})`
            );
            appliedIndexes.push(safeIdxName);
          } catch (err) {
            const fallbackIdxName = `idx_${safeTable}_${safeIdxName}`;
            if (safeIdxName !== fallbackIdxName) {
              try {
                await client.query(
                  `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${fallbackIdxName}" ON "${targetSchema}"."${safeTable}" (${colList})`
                );
                appliedIndexes.push(fallbackIdxName);
              } catch (fallbackErr) {
                indexErrors.push(`Index "${safeIdxName}": ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
              }
            } else {
              indexErrors.push(`Index "${safeIdxName}": ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }

      // Apply any foreign keys
      const fkSyncRes = await applyForeignKeysToTable(
        client,
        safeTable,
        targetSchema,
        validCanvasFks,
      );

      const allErrors = [...indexErrors, ...fkSyncRes.foreignKeyErrors];

      return {
        success: true,
        createdTable: true,
        appliedColumns: (columns || []).map((c) => c.name || "col"),
        appliedIndexes,
        appliedForeignKeys: fkSyncRes.appliedForeignKeys,
        droppedForeignKeys: fkSyncRes.droppedForeignKeys,
        appliedPrerequisiteTables,
        ...(allErrors.length > 0
          ? { error: `Table created, with notice(s): ${allErrors.join("; ")}` }
          : {}),
      };
    }

    // Inspect existing indexes
    let existingIndexes: Array<{ name: string; columns: string; isUnique?: boolean }> = [];
    try {
      const idxRes = await client.query<{
        index_name: string;
        is_unique: boolean;
        column_names: string;
      }>(
        `SELECT
           i.relname AS index_name,
           ix.indisunique AS is_unique,
           ARRAY_TO_STRING(
             ARRAY(
               SELECT pg_get_indexdef(ix.indexrelid, k + 1, true)
               FROM generate_series(0, ix.indnatts - 1) as k
             ),
             ', '
           ) AS column_names
         FROM pg_class t
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_index ix ON ix.indrelid = t.oid
         JOIN pg_class i ON i.oid = ix.indexrelid
         WHERE LOWER(t.relname) = LOWER($1)
           AND n.nspname = $2
           AND NOT ix.indisprimary
           AND i.oid NOT IN (
             SELECT conindid 
             FROM pg_constraint 
             WHERE conrelid = t.oid AND conindid > 0
           )`,
        [safeTable, targetSchema],
      );

      existingIndexes = (idxRes.rows || []).map((r) => ({
        name: r.index_name,
        columns: r.column_names,
        isUnique: Boolean(r.is_unique),
      }));
    } catch {
      existingIndexes = [];
    }

    const missingIndexes = validCanvasIndexes.filter((cIdx) => {
      const cName = cIdx.name.toLowerCase();
      const cCols = (cIdx.columns || "")
        .split(",")
        .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
        .filter(Boolean)
        .join(",");
      const fallbackName = `idx_${safeTable.toLowerCase()}_${cName}`;
      return !existingIndexes.some((dbIdx) => {
        const dbName = dbIdx.name.toLowerCase();
        const dbCols = (dbIdx.columns || "")
          .split(",")
          .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
          .filter(Boolean)
          .join(",");
        const nameMatches =
          dbName === cName ||
          dbName === fallbackName ||
          cName === `idx_${safeTable.toLowerCase()}_${dbName}`;
        return (
          nameMatches &&
          dbCols === cCols &&
          Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique)
        );
      });
    });

    const extraIndexes = existingIndexes.filter((dbIdx) => {
      const dbName = dbIdx.name.toLowerCase();
      const dbCols = (dbIdx.columns || "")
        .split(",")
        .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
        .filter(Boolean)
        .join(",");
      return !validCanvasIndexes.some((cIdx) => {
        const cName = cIdx.name.toLowerCase();
        const cCols = (cIdx.columns || "")
          .split(",")
          .map((c) => c.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase())
          .filter(Boolean)
          .join(",");
        const fallbackName = `idx_${safeTable.toLowerCase()}_${cName}`;
        const nameMatches =
          dbName === cName ||
          dbName === fallbackName ||
          cName === `idx_${safeTable.toLowerCase()}_${dbName}`;
        return (
          nameMatches &&
          dbCols === cCols &&
          Boolean(dbIdx.isUnique) === Boolean(cIdx.isUnique)
        );
      });
    });

    const droppedIndexes: string[] = [];
    for (const extraIdx of extraIndexes) {
      const safeIdxName = extraIdx.name.replace(/[^a-zA-Z0-9_]/g, "");
      if (safeIdxName) {
        try {
          await client.query(`DROP INDEX IF EXISTS "${targetSchema}"."${safeIdxName}" CASCADE`);
          droppedIndexes.push(safeIdxName);
        } catch {}
      }
    }

    // Table exists, query existing columns from the configured schema
    const infoRes = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE LOWER(table_name) = LOWER($1)
         AND table_schema = $2`,
      [safeTable, targetSchema],
    );
    const existingCols = new Set(infoRes.rows.map((r) => r.column_name.toLowerCase()));
    const canvasColNames = new Set((columns || []).map((c) => (c.name || "").toLowerCase()));
    const appliedColumns: string[] = [];
    const droppedColumns: string[] = [];

    // 1. Add missing columns
    for (const col of columns || []) {
      const colName = (col.name || "").replace(/[^a-zA-Z0-9_]/g, "");
      if (!colName || existingCols.has(colName.toLowerCase())) continue;
      const pgType = normalizeToPostgresType(col.type);

      await client.query(
        `ALTER TABLE "${targetSchema}"."${safeTable}" ADD COLUMN IF NOT EXISTS "${colName}" ${pgType}`,
      );
      appliedColumns.push(colName);
    }

    // 2. Drop columns that were removed from the canvas
    for (const row of infoRes.rows) {
      const dbColLower = row.column_name.toLowerCase();
      if (
        !canvasColNames.has(dbColLower) &&
        dbColLower !== "created_at" &&
        dbColLower !== "updated_at"
      ) {
        await client.query(
          `ALTER TABLE "${targetSchema}"."${safeTable}" DROP COLUMN IF EXISTS "${row.column_name}" CASCADE`,
        );
        droppedColumns.push(row.column_name);
      }
    }

    // 3. Create missing indexes
    const appliedIndexes: string[] = [];
    const indexErrors: string[] = [];
    for (const missingIdx of missingIndexes) {
      let safeIdxName = missingIdx.name.replace(/[^a-zA-Z0-9_]/g, "");
      if (!safeIdxName) {
        safeIdxName = `idx_${safeTable}_${missingIdx.columns.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      }
      const colList = missingIdx.columns
        .split(",")
        .map((c) => `"${c.trim().replace(/[^a-zA-Z0-9_]/g, "")}"`)
        .join(", ");
      if (safeIdxName && colList) {
        const uniqueStr = missingIdx.isUnique ? "UNIQUE " : "";
        try {
          await client.query(
            `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${safeIdxName}" ON "${targetSchema}"."${safeTable}" (${colList})`
          );
          appliedIndexes.push(safeIdxName);
        } catch (err) {
          const fallbackIdxName = `idx_${safeTable}_${safeIdxName}`;
          if (safeIdxName !== fallbackIdxName) {
            try {
              await client.query(
                `CREATE ${uniqueStr}INDEX IF NOT EXISTS "${fallbackIdxName}" ON "${targetSchema}"."${safeTable}" (${colList})`
              );
              appliedIndexes.push(fallbackIdxName);
            } catch (fallbackErr) {
              indexErrors.push(`Index "${safeIdxName}": ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
            }
          } else {
            indexErrors.push(`Index "${safeIdxName}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    // 4. Sync Foreign Keys
    const fkSyncRes = await applyForeignKeysToTable(
      client,
      safeTable,
      targetSchema,
      validCanvasFks,
    );

    const allErrors = [...indexErrors, ...fkSyncRes.foreignKeyErrors];
    const hasAnyChanges =
      appliedColumns.length > 0 ||
      droppedColumns.length > 0 ||
      appliedIndexes.length > 0 ||
      droppedIndexes.length > 0 ||
      fkSyncRes.appliedForeignKeys.length > 0 ||
      fkSyncRes.droppedForeignKeys.length > 0 ||
      appliedPrerequisiteTables.length > 0;

    return {
      success: hasAnyChanges || allErrors.length === 0,
      createdTable: false,
      appliedColumns,
      droppedColumns,
      appliedIndexes,
      droppedIndexes,
      appliedForeignKeys: fkSyncRes.appliedForeignKeys,
      droppedForeignKeys: fkSyncRes.droppedForeignKeys,
      appliedPrerequisiteTables,
      ...(allErrors.length > 0
        ? {
            error:
              (hasAnyChanges
                ? "Schema updated with notices: "
                : "Schema update error: ") + allErrors.join("; "),
          }
        : {}),
    };
  } catch (error) {
    return {
      success: false,
      createdTable: false,
      appliedColumns: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}
