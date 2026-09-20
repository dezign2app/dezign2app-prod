import {
  TestDbOperationPayload,
  SqlCommandPlan,
  JsonObject,
  isJsonObject,
} from "./types";

/**
 * Extracts table name from operation definition (ID, raw SQL query, or function name).
 */
export function extractTableName(op: TestDbOperationPayload["operation"]): string {
  const id = op.id || "";
  const name = op.name || "";
  const code = op.code || "";
  const query = op.query || "";

  // 1. Check auto-generated operation ID, e.g. auto-find-by-id-conversations -> conversations
  const idMatch = id.match(
    /^auto-(?:find-all|find-by-id|create|update|delete)-(?:by-[a-z0-9_]+-)?(.+)$/i,
  );
  if (idMatch && idMatch[1]) {
    return idMatch[1].toLowerCase();
  }

  // 2. Check SQL query or code for FROM / INTO / UPDATE
  const fromMatch = (query + " " + code).match(
    /(?:FROM|INTO|UPDATE)\s+["'`]?([a-zA-Z0-9_]+)["'`]?/i,
  );
  if (fromMatch && fromMatch[1]) {
    return fromMatch[1].toLowerCase();
  }

  // 3. Parse from function name, e.g. findAllConversations / findConversationById
  const clean = name
    .replace(
      /^(findAll|findById|findBy|find|create|update|deleteById|delete|insert|select|remove)/i,
      "",
    )
    .replace(/ById$/i, "")
    .trim();

  if (clean) {
    const lower = clean.toLowerCase();
    return lower.endsWith("s") ? lower : `${lower}s`;
  }

  return "records";
}

/**
 * Plans a standard SQL command from operation details and arguments.
 */
export function planSqlCommand(
  op: TestDbOperationPayload["operation"],
  args: Record<string, unknown>,
  _engine = "sqlite",
): SqlCommandPlan {
  const name = op.name || "";
  const kind = op.kind || "";
  const query = op.query || "";
  const tableName = extractTableName(op);

  if (
    query &&
    !query.startsWith("Query function for") &&
    !query.startsWith("Auto-generated")
  ) {
    return { rawSql: query, tableName, kind };
  }

  const idVal = args.id !== undefined ? String(args.id) : "1";
  const isFindAll =
    kind === "findAll" ||
    name.toLowerCase().startsWith("findall") ||
    name.toLowerCase().startsWith("getall") ||
    name.toLowerCase().startsWith("list");
  const isFindById =
    kind === "findById" ||
    name.toLowerCase().includes("byid") ||
    (name.toLowerCase().startsWith("find") && args.id !== undefined);
  const isCreate =
    kind === "create" ||
    name.toLowerCase().startsWith("create") ||
    name.toLowerCase().startsWith("insert");
  const isUpdate =
    kind === "update" || name.toLowerCase().startsWith("update");
  const isDelete =
    kind === "delete" ||
    name.toLowerCase().startsWith("delete") ||
    name.toLowerCase().startsWith("remove");

  if (isFindAll) {
    const limit = args.limit !== undefined ? Number(args.limit) : 20;
    const offset = args.offset !== undefined ? Number(args.offset) : 0;
    if (_engine === "postgres") {
      return {
        rawSql: `SELECT * FROM "${tableName}" ORDER BY "id" LIMIT ${limit} OFFSET ${offset};`,
        tableName,
        kind: "findAll",
      };
    }
    return {
      rawSql: `SELECT * FROM ${tableName} LIMIT ${limit} OFFSET ${offset};`,
      tableName,
      kind: "findAll",
    };
  }

  if (isFindById) {
    if (_engine === "postgres") {
      return {
        rawSql: `SELECT * FROM "${tableName}" WHERE "id" = '${idVal}' LIMIT 1;`,
        tableName,
        kind: "findById",
      };
    }
    return {
      rawSql: `SELECT * FROM ${tableName} WHERE id = '${idVal}' LIMIT 1;`,
      tableName,
      kind: "findById",
    };
  }

  if (isCreate) {
    let rawPayload: unknown = args.data;
    if (!rawPayload) {
      const destructuredKey = Object.keys(args).find((k) => k.startsWith("{"));
      if (destructuredKey) rawPayload = args[destructuredKey];
    }
    if (!rawPayload) {
      rawPayload = args.record || args.item || args;
    }

    const dataObj: JsonObject = isJsonObject(rawPayload)
      ? (rawPayload as JsonObject)
      : {};

    // Keep all valid column keys (do NOT filter out "id" if id is provided in payload!)
    const keys = Object.keys(dataObj).filter(
      (k) => !k.startsWith("{") && k !== "data" && k !== "record" && dataObj[k] !== undefined,
    );

    if (_engine === "postgres") {
      if (keys.length > 0) {
        const cols = keys.map((k) => `"${k}"`).join(", ");
        const vals = keys.map((k) => JSON.stringify(dataObj[k])).join(", ");
        return {
          rawSql: `INSERT INTO "${tableName}" (${cols}) VALUES (${vals}) RETURNING *;`,
          tableName,
          kind: "create",
        };
      }
      // Never send DEFAULT VALUES on Postgres if id is not nullable without default — supply an explicit id
      const fallbackId = `${tableName}_${Date.now().toString(36)}`;
      return {
        rawSql: `INSERT INTO "${tableName}" ("id") VALUES ('${fallbackId}') RETURNING *;`,
        tableName,
        kind: "create",
      };
    }
    if (keys.length > 0) {
      const cols = keys.join(", ");
      const vals = keys.map((k) => JSON.stringify(dataObj[k])).join(", ");
      return {
        rawSql: `INSERT INTO ${tableName} (${cols}) VALUES (${vals}) RETURNING *;`,
        tableName,
        kind: "create",
      };
    }
    const fallbackId = `${tableName}_${Date.now().toString(36)}`;
    return {
      rawSql: `INSERT INTO ${tableName} (id) VALUES ('${fallbackId}') RETURNING *;`,
      tableName,
      kind: "create",
    };
  }

  if (isUpdate) {
    let rawPayload: unknown = args.data;
    if (!rawPayload) {
      const destructuredKey = Object.keys(args).find((k) => k.startsWith("{"));
      if (destructuredKey) rawPayload = args[destructuredKey];
    }
    if (!rawPayload) {
      rawPayload = args.record || args.item || args;
    }
    const dataObj: JsonObject = isJsonObject(rawPayload)
      ? (rawPayload as JsonObject)
      : {};
    if (_engine === "postgres") {
      const sets = Object.entries(dataObj)
        .filter(([k]) => k !== "id" && !k.startsWith("{") && k !== "data" && k !== "record")
        .map(([k, v]) => `"${k}" = ${JSON.stringify(v)}`);
      const setClause =
        sets.length > 0 ? sets.join(", ") : `"updated_at" = NOW()`;
      return {
        rawSql: `UPDATE "${tableName}" SET ${setClause} WHERE "id" = '${idVal}' RETURNING *;`,
        tableName,
        kind: "update",
      };
    }
    const sets = Object.entries(dataObj)
      .filter(([k]) => k !== "id")
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
    const setClause =
      sets.length > 0 ? sets.join(", ") : "updated_at = CURRENT_TIMESTAMP";
    return {
      rawSql: `UPDATE ${tableName} SET ${setClause} WHERE id = '${idVal}' RETURNING *;`,
      tableName,
      kind: "update",
    };
  }

  if (isDelete) {
    if (_engine === "postgres") {
      return {
        rawSql: `DELETE FROM "${tableName}" WHERE "id" = '${idVal}';`,
        tableName,
        kind: "delete",
      };
    }
    return {
      rawSql: `DELETE FROM ${tableName} WHERE id = '${idVal}';`,
      tableName,
      kind: "delete",
    };
  }

  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  return {
    rawSql: `${name}(${argsStr})`,
    tableName,
    kind: kind || "custom",
  };
}

/**
 * Generates sample/simulated SQL query results for mock test executions.
 */
export function executeSqlOperation(
  op: TestDbOperationPayload["operation"],
  args: Record<string, unknown>,
  engine = "sqlite",
): unknown {
  const tableName = extractTableName(op);
  const name = op.name || "";
  const kind = op.kind || "";

  const isFindAll =
    kind === "findAll" ||
    name.toLowerCase().startsWith("findall") ||
    name.toLowerCase().startsWith("getall") ||
    name.toLowerCase().startsWith("list");
  const isFindById =
    kind === "findById" ||
    name.toLowerCase().includes("byid") ||
    (name.toLowerCase().startsWith("find") && args.id !== undefined);
  const isCreate =
    kind === "create" ||
    name.toLowerCase().startsWith("create") ||
    name.toLowerCase().startsWith("insert");
  const isUpdate =
    kind === "update" || name.toLowerCase().startsWith("update");
  const isDelete =
    kind === "delete" ||
    name.toLowerCase().startsWith("delete") ||
    name.toLowerCase().startsWith("remove");

  const nowIso = new Date().toISOString();

  const buildSampleRow = (
    index: number,
    idOverride?: string,
  ): Record<string, unknown> => {
    const sampleId = idOverride || `${tableName}_${index}`;
    const base: Record<string, unknown> = {
      id: sampleId,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (op.params) {
      for (const p of op.params) {
        if (
          p.name !== "limit" &&
          p.name !== "offset" &&
          p.name !== "id" &&
          p.name !== "data"
        ) {
          base[p.name] =
            args[p.name] ??
            (p.type === "number"
              ? 0
              : p.type === "boolean"
                ? true
                : `sample_${p.name}`);
        }
      }
    }

    if (isJsonObject(args.data)) {
      Object.assign(base, args.data);
    }

    return base;
  };

  if (isFindAll) {
    const limit = Math.min(Math.max(1, Number(args.limit) || 20), 5);
    const rows: unknown[] = [];
    for (let i = 1; i <= limit; i++) {
      rows.push(buildSampleRow(i));
    }
    return rows;
  }

  if (isFindById) {
    const idVal = args.id !== undefined ? String(args.id) : `${tableName}_1`;
    return buildSampleRow(1, idVal);
  }

  if (isCreate) {
    const newId = args.id !== undefined ? String(args.id) : `new_${Date.now()}`;
    return buildSampleRow(1, newId);
  }

  if (isUpdate) {
    const idVal = args.id !== undefined ? String(args.id) : `${tableName}_1`;
    return buildSampleRow(1, idVal);
  }

  if (isDelete) {
    const idVal = args.id !== undefined ? String(args.id) : `${tableName}_1`;
    return {
      success: true,
      message: `Record with id '${idVal}' was deleted from ${tableName}.`,
      deletedCount: 1,
    };
  }

  return {
    success: true,
    operation: op.name,
    result: {
      message: `Executed ${op.name} successfully against ${engine}`,
      params: args,
    },
  };
}
