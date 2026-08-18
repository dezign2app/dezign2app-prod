import { DbOperationFunction } from "@workspace/canvas/types";
import { sqlColumnToTsType, isSqlNumericType } from "@workspace/canvas/constants";
import { toSqlIdentifier, toTableName, toVarName } from "@/lib/compiler/utils";
import type { BackendNode } from "@/types/canvas";

function toPascal(str: string): string {
  if (!str) return "Item";
  const snake = str.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const clean = toSqlIdentifier(snake, "table");
  return clean
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function toCamel(str: string): string {
  const p = toPascal(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function toSingular(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();

  const irregulars: Record<string, string> = {
    people: "person",
    children: "child",
    men: "man",
    women: "woman",
    data: "data",
    media: "media",
    species: "species",
    series: "series",
  };

  if (irregulars[lower]) {
    const s = irregulars[lower];
    return str.charAt(0) === str.charAt(0).toUpperCase()
      ? s.charAt(0).toUpperCase() + s.slice(1)
      : s;
  }

  if (lower.endsWith("ies") && lower.length > 3) {
    return str.slice(0, -3) + (str.charAt(str.length - 3) === "I" ? "Y" : "y");
  }
  if (
    lower.endsWith("sses") ||
    lower.endsWith("shes") ||
    lower.endsWith("ches") ||
    lower.endsWith("xes") ||
    lower.endsWith("zes")
  ) {
    return str.slice(0, -2);
  }
  if (lower.endsWith("ses") && lower.length > 4) {
    if (
      lower.endsWith("status") ||
      lower.endsWith("statuses") ||
      lower.endsWith("process") ||
      lower.endsWith("processes")
    ) {
      return str.slice(0, -2);
    }
    return str.slice(0, -1);
  }
  if (
    lower.endsWith("s") &&
    !lower.endsWith("ss") &&
    !lower.endsWith("us") &&
    !lower.endsWith("is") &&
    lower.length > 2
  ) {
    return str.slice(0, -1);
  }

  return str;
}

export function toPlural(str: string): string {
  if (!str) return str;
  const lower = str.toLowerCase();

  if (
    lower.endsWith("ies") ||
    lower.endsWith("ses") ||
    (lower.endsWith("s") &&
      !lower.endsWith("ss") &&
      !lower.endsWith("us") &&
      !lower.endsWith("is"))
  ) {
    return str;
  }

  const irregulars: Record<string, string> = {
    person: "people",
    child: "children",
    man: "men",
    woman: "women",
    data: "data",
    media: "media",
    species: "species",
    series: "series",
  };

  if (irregulars[lower]) {
    const p = irregulars[lower];
    return str.charAt(0) === str.charAt(0).toUpperCase()
      ? p.charAt(0).toUpperCase() + p.slice(1)
      : p;
  }

  if (lower.endsWith("y") && !/[aeiou]y$/i.test(str)) {
    return str.slice(0, -1) + (str.charAt(str.length - 1) === "Y" ? "IES" : "ies");
  }
  if (
    lower.endsWith("s") ||
    lower.endsWith("sh") ||
    lower.endsWith("ch") ||
    lower.endsWith("x") ||
    lower.endsWith("z")
  ) {
    return str + (str.charAt(str.length - 1) === str.charAt(str.length - 1).toUpperCase() ? "ES" : "es");
  }

  return str + (str.charAt(str.length - 1) === str.charAt(str.length - 1).toUpperCase() ? "S" : "s");
}

/**
 * Generates default auto-created database operation functions for an entity table,
 * including standard CRUD and index-based fetch functions (fetchByIndex).
 * Populates both natural language prompts and executable TypeScript query code.
 */
export function generateDefaultDbOperations(
  label: string,
  rawColumns: { name: string; type: string; isPrimaryKey?: boolean; isUnique?: boolean; isForeignKey?: boolean }[] = [],
  indexes: { name: string; columns: string; isUnique?: boolean }[] = [],
  allNodes: BackendNode[] = [],
): DbOperationFunction[] {
  const tableName = toTableName(label || "table");
  const pascal = toPascal(tableName);
  const pascalSingular = toSingular(pascal);
  const pascalPlural = toPlural(pascal);

  // Sanitize all column names against SQL identifier injections
  const columns = rawColumns.map((c) => ({
    ...c,
    name: toSqlIdentifier(c.name || "col", "col"),
  }));

  const pkCol = columns.find((c) => c.isPrimaryKey) || columns[0];
  const pkColName = pkCol?.name || "id";
  const pkVarName = toVarName(pkColName);
  const pkType = sqlColumnToTsType(pkCol?.type);

  const writableCols = columns.filter((c) => !c.isPrimaryKey);
  const insertCols = writableCols.map((c) => c.name).join(", ");
  const insertPlaceholders = writableCols.map(() => "?").join(", ");
  const insertBindArgs = writableCols.map((c) => `data.${toVarName(c.name)}`).join(", ");

  const rowIdExpr =
    pkType === "number"
      ? `typeof info.lastInsertRowid === "bigint" ? Number(info.lastInsertRowid) : info.lastInsertRowid`
      : `typeof info.lastInsertRowid === "bigint" ? info.lastInsertRowid.toString() : String(info.lastInsertRowid)`;

  const createCode = writableCols.length > 0
    ? `export function create${pascalSingular}(data: Create${pascal}Data): ${pascal}Row {\n  const info = stmtInsert.run(${insertBindArgs});\n  const _rowId = ${rowIdExpr};\n  return { ${pkColName}: _rowId, ...data } as unknown as ${pascal}Row;\n}`
    : `export function create${pascalSingular}(): ${pascal}Row {\n  const info = db.prepare("INSERT INTO ${tableName} DEFAULT VALUES").run();\n  const _rowId = ${rowIdExpr};\n  return { ${pkColName}: _rowId } as unknown as ${pascal}Row;\n}`;

  const updateCode = writableCols.length > 0
    ? `export function update${pascalSingular}(${pkVarName}: ${pkType}, data: Update${pascal}Data): ${pascal}Row | undefined {\n  const current = find${pascalSingular}ById(${pkVarName});\n  if (!current) return undefined;\n  const updated = { ...current, ...data };\n  stmtUpdate.run(${writableCols.map((c) => `updated.${toVarName(c.name)}`).join(", ")}, ${pkVarName});\n  return find${pascalSingular}ById(${pkVarName});\n}`
    : `export function update${pascalSingular}(${pkVarName}: ${pkType}): ${pascal}Row | undefined {\n  return find${pascalSingular}ById(${pkVarName});\n}`;

  const ops: DbOperationFunction[] = [
    {
      id: `auto-find-all-${tableName}`,
      name: `findAll${pascalPlural}`,
      kind: "findAll",
      description: `Retrieve all rows from ${tableName}`,
      signature: `findAll${pascalPlural}(limit?: number, offset?: number): ${pascal}Row[]`,
      params: [
        { name: "limit", type: "number", required: false, defaultValue: "20" },
        { name: "offset", type: "number", required: false, defaultValue: "0" },
      ],
      returnType: `${pascal}Row[]`,
      pagination: {
        enabled: true,
        defaultLimit: 20,
        maxLimit: 100,
        mode: "offset",
      },
      logicMode: "natural_language",
      prompt: `Retrieve all records from the ${tableName} table using prepared statements with limit and offset pagination.`,
      code: `export function findAll${pascalPlural}(limit: number = 20, offset: number = 0): ${pascal}Row[] {\n  return stmtFindAll.all(limit, offset) as unknown as ${pascal}Row[];\n}`,
      enabled: true,
      isAutoGenerated: true,
    },
    {
      id: `auto-find-by-id-${tableName}`,
      name: `find${pascalSingular}ById`,
      kind: "findById",
      description: `Find a ${tableName} record by ${pkColName}`,
      signature: `find${pascalSingular}ById(${pkVarName}: ${pkType}): ${pascal}Row | undefined`,
      params: [{ name: pkVarName, type: pkType, required: true }],
      returnType: `${pascal}Row | undefined`,
      logicMode: "natural_language",
      prompt: `Find a single record from the ${tableName} table by primary key (${pkColName}). Returns undefined if not found.`,
      code: `export function find${pascalSingular}ById(${pkVarName}: ${pkType}): ${pascal}Row | undefined {\n  return stmtFindById.get(${pkVarName}) as unknown as ${pascal}Row | undefined;\n}`,
      enabled: true,
      isAutoGenerated: true,
    },
    {
      id: `auto-create-${tableName}`,
      name: `create${pascalSingular}`,
      kind: "create",
      description: `Create a new record in ${tableName}`,
      signature: `create${pascalSingular}(data: Create${pascal}Data): ${pascal}Row`,
      params: [{ name: "data", type: `Create${pascal}Data`, required: true }],
      returnType: `${pascal}Row`,
      logicMode: "natural_language",
      prompt: `Insert a new record into the ${tableName} table with provided payload fields and return the created record.`,
      code: createCode,
      enabled: true,
      isAutoGenerated: true,
    },
    {
      id: `auto-update-${tableName}`,
      name: `update${pascalSingular}`,
      kind: "update",
      description: `Update a ${tableName} record by ${pkColName}`,
      signature: `update${pascalSingular}(${pkVarName}: ${pkType}, data: Update${pascal}Data): ${pascal}Row | undefined`,
      params: [
        { name: pkVarName, type: pkType, required: true },
        { name: "data", type: `Update${pascal}Data`, required: true },
      ],
      returnType: `${pascal}Row | undefined`,
      logicMode: "natural_language",
      prompt: `Update an existing record in the ${tableName} table by primary key (${pkColName}) with partial fields data.`,
      code: updateCode,
      enabled: true,
      isAutoGenerated: true,
    },
    {
      id: `auto-delete-${tableName}`,
      name: `delete${pascalSingular}ById`,
      kind: "delete",
      description: `Delete a ${tableName} record by ${pkColName}`,
      signature: `delete${pascalSingular}ById(${pkVarName}: ${pkType}): void`,
      params: [{ name: pkVarName, type: pkType, required: true }],
      returnType: "void",
      logicMode: "natural_language",
      prompt: `Delete a record from the ${tableName} table by primary key (${pkColName}).`,
      code: `export function delete${pascalSingular}ById(${pkVarName}: ${pkType}): void {\n  stmtDelete.run(${pkVarName});\n}`,
      enabled: true,
      isAutoGenerated: true,
    },
  ];

  // Combine explicit indexes and auto-discovered foreign key / unique column indexes
  const seenIndexCols = new Set<string>();
  const effectiveIndexes: { name: string; columns: string; isUnique?: boolean }[] = [];

  indexes.forEach((idx) => {
    const norm = (idx.columns || "").toLowerCase().replace(/\s+/g, "");
    if (norm && !seenIndexCols.has(norm)) {
      seenIndexCols.add(norm);
      effectiveIndexes.push(idx);
    }
  });

  columns.forEach((col) => {
    if (col.isPrimaryKey) return;
    const cName = col.name.toLowerCase();
    if (col.isForeignKey || cName.endsWith("_id") || cName.endsWith("id")) {
      const norm = col.name.toLowerCase();
      if (!seenIndexCols.has(norm)) {
        seenIndexCols.add(norm);
        effectiveIndexes.push({
          name: `idx_${tableName}_${col.name}`,
          columns: col.name,
          isUnique: false,
        });
      }
    }
  });

  // Index-based fetch functions (fetchByIndex)
  effectiveIndexes.forEach((idx, i) => {
    if (!idx.columns) return;
    const colList = idx.columns
      .split(",")
      .map((c) => toSqlIdentifier(c.trim(), ""))
      .filter(Boolean);

    if (colList.length === 0) return;

    const rawIdxName = idx.name || `idx_${colList.join("_")}`;
    const cleanName = rawIdxName.replace(new RegExp(`^idx_${tableName}_|^idx_|^by_`, "i"), "");
    const pascalIdxName = toPascal(cleanName || colList.join("_"));

    // Cardinality invariant: if the indexed column is a FK column, it is always N-cardinality
    // regardless of how the index was declared. Only truly unique constraints use .get().
    const colIsForeignKey = colList.some((c) =>
      columns.find((col) => col.name.toLowerCase() === c.toLowerCase())?.isForeignKey ||
      c.toLowerCase().endsWith("_id")
    );
    const isUnique = !!idx.isUnique && !colIsForeignKey;

    const targetPrefix = isUnique ? pascalSingular : pascalPlural;
    const fnName =
      cleanName.toLowerCase().startsWith(pascalSingular.toLowerCase()) ||
      cleanName.toLowerCase().startsWith(pascalPlural.toLowerCase())
        ? `findBy${pascalIdxName}`
        : `find${targetPrefix}By${pascalIdxName}`;

    const opId = `auto-index-${tableName}-${rawIdxName}-${i}`;
    if (ops.some((o) => o.name === fnName || o.id === opId)) return;

    const stmtVarName = `stmt${fnName.charAt(0).toUpperCase() + fnName.slice(1)}`;

    const paramList: { name: string; type: string; required?: boolean; defaultValue?: string }[] = colList.map((colName) => {
      const colObj = columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      const colType = sqlColumnToTsType(colObj?.type);
      return { name: toVarName(colName), type: colType, required: true };
    });

    if (!isUnique) {
      paramList.push(
        { name: "limit", type: "number", required: false, defaultValue: "20" },
        { name: "offset", type: "number", required: false, defaultValue: "0" },
      );
    }

    const paramSig = paramList
      .map((p) => `${p.name}: ${p.type}${p.defaultValue ? ` = ${p.defaultValue}` : ""}`)
      .join(", ");
    const returnType = isUnique ? `${pascal}Row | undefined` : `${pascal}Row[]`;
    const whereClause = colList.map((c) => `${c} = ?`).join(" AND ");
    const argList = colList.map((c) => toVarName(c)).join(", ") + (isUnique ? "" : ", limit, offset");

    const paramTypes = colList.map((colName) => {
      const colObj = columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      const colType = sqlColumnToTsType(colObj?.type);
      return `${toVarName(colName)}: ${colType}`;
    }).join(", ");

    const indexCode = isUnique
      ? `const ${stmtVarName} = db.prepare<[${paramTypes}], ${pascal}Row>(\n  "SELECT * FROM ${tableName} WHERE ${whereClause}"\n);\n\nexport function ${fnName}(${paramSig}): ${returnType} {\n  return ${stmtVarName}.get(${argList}) as unknown as ${returnType};\n}`
      : `const ${stmtVarName} = db.prepare<[${paramTypes}, limit?: number, offset?: number], ${pascal}Row>(\n  "SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT ? OFFSET ?"\n);\n\nexport function ${fnName}(${paramSig}): ${returnType} {\n  return ${stmtVarName}.all(${argList}) as unknown as ${returnType};\n}`;

    ops.push({
      id: opId,
      name: fnName,
      kind: "fetchByIndex",
      indexName: rawIdxName,
      description: `Find ${tableName} records by ${colList.join(", ")}`,
      signature: `${fnName}(${paramList.map((p) => `${p.name}${p.required === false ? "?" : ""}: ${p.type}`).join(", ")}): ${returnType}`,
      params: paramList,
      returnType: returnType,
      pagination: isUnique
        ? undefined
        : {
            enabled: true,
            defaultLimit: 20,
            maxLimit: 100,
            mode: "offset",
          },
      logicMode: "natural_language",
      prompt: `Find records from ${tableName} table matching ${whereClause}.`,
      code: indexCode,
      enabled: true,
      isAutoGenerated: true,
    });
  });

  // ── Auto-discover Relational JOIN Functions ──────────────────────────
  const uniqueEntityMap = new Map<string, BackendNode>();
  (allNodes || []).forEach((n) => {
    if (n?.type === "entity" || n?.type === "db_ref") {
      const lbl = toTableName(n.data?.label || n.data?.tableRef || "");
      if (lbl && !uniqueEntityMap.has(lbl)) {
        uniqueEntityMap.set(lbl, n);
      }
    }
  });
  const entityNodes = Array.from(uniqueEntityMap.values());

  // 1. Direct FK Columns on this table (N:1 relationships)
  const seenJoinTargets = new Set<string>();
  columns.forEach((col) => {
    if (col.isPrimaryKey) return;
    if (
      col.isForeignKey ||
      (col.name.toLowerCase().endsWith("id") &&
        col.name.toLowerCase() !== "id" &&
        col.name.toLowerCase() !== "_id")
    ) {
      const rawBase = col.name.replace(/(_id|id|_by|by)$/i, "");
      let targetTableName = "";
      let targetPascalSingular = "";

      const roleMap: Record<string, string> = {
        userId: "user",
        user_id: "user",
        created_by: "user",
        createdBy: "user",
        authorId: "user",
        author_id: "user",
        ownerId: "user",
        owner_id: "user",
        creatorId: "user",
        creator_id: "user",
        inviterId: "user",
        inviter_id: "user",
        organizationId: "organization",
        organization_id: "organization",
        orgId: "organization",
        org_id: "organization",
        teamId: "team",
        team_id: "team",
      };

      const matchedNode = entityNodes.find((n) => {
        const lbl = (n.data?.label || n.data?.tableRef || "").toLowerCase();
        return (
          lbl === rawBase.toLowerCase() ||
          toSingular(lbl) === toSingular(rawBase.toLowerCase()) ||
          toPlural(lbl) === toPlural(rawBase.toLowerCase())
        );
      });

      if ((col as any).references?.table) {
        const rawRef = String((col as any).references.table);
        const matchedRefNode = entityNodes.find((n) => {
          const lbl = (n.data?.label || n.data?.tableRef || "").toLowerCase();
          return (
            lbl === rawRef.toLowerCase() ||
            toSingular(lbl) === toSingular(rawRef.toLowerCase()) ||
            toPlural(lbl) === toPlural(rawRef.toLowerCase())
          );
        });
        if (matchedRefNode) {
          targetTableName = toTableName(matchedRefNode.data?.label || matchedRefNode.data?.tableRef || rawRef);
        } else if (rawRef.toLowerCase() === "user" || rawRef.toLowerCase() === "users") {
          targetTableName = "user";
        } else {
          targetTableName = toTableName(rawRef);
        }
        targetPascalSingular = toSingular(toPascal(targetTableName));
      } else if (matchedNode) {
        const matchedLabel = matchedNode.data?.label || matchedNode.data?.tableRef || rawBase;
        targetTableName = toTableName(matchedLabel);
        targetPascalSingular = toSingular(toPascal(targetTableName));
      } else if (roleMap[col.name]) {
        targetTableName = roleMap[col.name]!;
        targetPascalSingular = toSingular(toPascal(targetTableName));
      } else {
        // Do not generate a join on columns without an existing table
        return;
      }
      const targetVarSingular = toCamel(targetPascalSingular);
      const targetPkColName = matchedNode?.data?.columns?.find((c: any) => c.isPrimaryKey)?.name || "id";

      const fnName = `find${pascalSingular}ByIdWith${targetPascalSingular}`;
      const opId = `auto-join-${tableName}-with-${targetTableName}`;

      if (!seenJoinTargets.has(fnName) && !ops.some((o) => o.name === fnName || o.id === opId)) {
        seenJoinTargets.add(fnName);
        const joinCode = `const stmtFind${pascalSingular}ByIdWith${targetPascalSingular} = db.prepare<[${pkVarName}: ${pkType}]>(\n  "SELECT t.*, json_object('${targetPkColName}', r.${targetPkColName}) AS ${targetVarSingular} FROM ${tableName} t LEFT JOIN ${targetTableName} r ON t.${col.name} = r.${targetPkColName} WHERE t.${pkColName} = ?"\n);\n\nexport function ${fnName}(${pkVarName}: ${pkType}): ${pascalSingular}With${targetPascalSingular}Row | undefined {\n  const row = stmtFind${pascalSingular}ByIdWith${targetPascalSingular}.get(${pkVarName}) as unknown as (${pascalSingular}With${targetPascalSingular}Row & Record<string, unknown>) | undefined;\n  if (!row) return undefined;\n  if (typeof row.${targetVarSingular} === "string") {\n    try { (row as Record<string, unknown>).${targetVarSingular} = JSON.parse(row.${targetVarSingular}); } catch {}\n  }\n  return row;\n}`;

        ops.push({
          id: opId,
          name: fnName,
          kind: "join",
          description: `Find a ${pascalSingular} record by ${pkColName} joined with associated ${targetPascalSingular}`,
          signature: `${fnName}(${pkVarName}: ${pkType}): ${pascalSingular}With${targetPascalSingular}Row | undefined`,
          params: [{ name: pkVarName, type: pkType, required: true }],
          returnType: `${pascalSingular}With${targetPascalSingular}Row | undefined`,
          logicMode: "natural_language",
          prompt: `Retrieve a record from ${tableName} by ${pkColName} joined with associated ${targetPascalSingular} record by ${col.name}.`,
          code: joinCode,
          enabled: true,
          isAutoGenerated: true,
        });
      }
    }
  });

  // 2. Inverse FK Relationships from other entity nodes (1:N relationships)
  const seenInverseTargets = new Set<string>();
  entityNodes.forEach((otherNode) => {
    const otherLabel = otherNode.data?.label || otherNode.data?.tableRef;
    if (!otherLabel) return;
    const otherTableName = toTableName(otherLabel);
    if (otherTableName === tableName) return;

    const otherCols: { name: string; type: string; isPrimaryKey?: boolean; isForeignKey?: boolean; references?: { table?: string; column?: string } }[] =
      otherNode.data?.columns || [];

    const otherPascal = toPascal(otherTableName);
    const otherPascalSingular = toSingular(otherPascal);
    const otherPascalPlural = toPlural(otherPascal);
    const otherVarPlural = toCamel(otherPascalPlural);
    const otherPkCol = otherCols.find((c) => c.isPrimaryKey) || otherCols[0];
    const otherPkColName = otherPkCol?.name || "id";

    const otherFkCol = otherCols.find((c) => {
      if (c.isPrimaryKey) return false;
      const cName = (c.name || "").toLowerCase();
      return (
        (c.references?.table && toTableName(c.references.table) === tableName) ||
        cName === `${toCamel(pascalSingular)}_id` ||
        cName === `${toSingular(tableName).toLowerCase()}_id` ||
        cName === `${tableName.toLowerCase()}_id` ||
        cName === `${toCamel(pascalSingular)}id` ||
        cName === `${toSingular(tableName).toLowerCase()}id` ||
        cName === `${tableName.toLowerCase()}id`
      );
    });

    if (otherFkCol) {
      const fnName = `find${pascalSingular}ByIdWith${otherPascalPlural}`;
      const opId = `auto-join-${tableName}-with-${otherTableName}-list`;

      if (!seenInverseTargets.has(fnName) && !ops.some((o) => o.name === fnName || o.id === opId)) {
        seenInverseTargets.add(fnName);
        const joinCode = `const stmtFind${pascalSingular}ByIdWith${otherPascalPlural} = db.prepare<[${pkVarName}: ${pkType}]>(\n  "SELECT t.*, json_group_array(json_object('${otherPkColName}', r.${otherPkColName})) AS ${otherVarPlural} FROM ${tableName} t LEFT JOIN ${otherTableName} r ON t.${pkColName} = r.${otherFkCol.name} WHERE t.${pkColName} = ? GROUP BY t.${pkColName}"\n);\n\nexport function ${fnName}(${pkVarName}: ${pkType}): ${pascalSingular}With${otherPascalPlural}Row | undefined {\n  const row = stmtFind${pascalSingular}ByIdWith${otherPascalPlural}.get(${pkVarName}) as unknown as (${pascalSingular}With${otherPascalPlural}Row & Record<string, unknown>) | undefined;\n  if (!row) return undefined;\n  if (typeof row.${otherVarPlural} === "string") {\n    try { (row as Record<string, unknown>).${otherVarPlural} = JSON.parse(row.${otherVarPlural}); } catch {}\n  }\n  return row;\n}`;

        ops.push({
          id: opId,
          name: fnName,
          kind: "join",
          description: `Find a ${pascalSingular} record by ${pkColName} joined with list of associated ${otherPascalPlural}`,
          signature: `${fnName}(${pkVarName}: ${pkType}): ${pascalSingular}With${otherPascalPlural}Row | undefined`,
          params: [{ name: pkVarName, type: pkType, required: true }],
          returnType: `${pascalSingular}With${otherPascalPlural}Row | undefined`,
          logicMode: "natural_language",
          prompt: `Retrieve a record from ${tableName} table by ${pkColName} joined with its associated ${otherPascalPlural} records as a list by ${otherFkCol.name}.`,
          code: joinCode,
          enabled: true,
          isAutoGenerated: true,
        });
      }
    }
  });

  return ops;
}

/**
 * Helper function to retrieve the active list of DB operation functions for an entity node.
 * If entityNode has dbOperations configured on its data, returns that.
 * Otherwise generates default CRUD, index-based, and relational JOIN operations.
 */
export function getEntityDbOperations(
  entityNode?: { data?: { label?: string; columns?: any[]; indexes?: any[]; dbOperations?: DbOperationFunction[] } } | null,
  allNodes: BackendNode[] = []
): DbOperationFunction[] {
  if (!entityNode || !entityNode.data) return [];
  const label = entityNode.data.label || "table";
  const columns = entityNode.data.columns || [];
  const indexes = entityNode.data.indexes || [];

  const rawOps =
    entityNode.data.dbOperations && entityNode.data.dbOperations.length > 0
      ? entityNode.data.dbOperations
      : generateDefaultDbOperations(label, columns, indexes, allNodes);

  // Deduplicate operations by name and id
  const seenNames = new Set<string>();
  const deduped: DbOperationFunction[] = [];

  rawOps.forEach((op) => {
    if (!op || !op.name) return;
    if (seenNames.has(op.name)) return;
    seenNames.add(op.name);
    deduped.push(op);
  });

  return deduped;
}



