import {
  TableCrudConfig,
  PublishedEventInfo,
  TableSchemaInfo,
  DbOperationParamInfo,
} from "./types";
import { toVarName, toPascalCase, toTopicKey } from "./utils";
import { CanvasEntityColumn } from "@workspace/canvas/types";

export interface GenerateEndpointCodeParams {
  prompt?: string;
  crudConfig?: TableCrudConfig[];
  availableTableNodes?: { id: string; label: string }[];
  publishedEvents?: PublishedEventInfo[];
  endpointMethod?: string;
  endpointPath?: string;
  requestBody?: {
    fields?: Array<{ name: string; type?: string; required?: boolean }>;
    rawJson?: string;
  };

  // Database Operation Context Props
  contextType?: "endpoint" | "db_operation" | "transformer" | "langgraph";
  dbType?: string;
  tableName?: string;
  tableSchema?: {
    name: string;
    columns?: CanvasEntityColumn[];
    indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  };
  allTableSchemas?: TableSchemaInfo[];
  operation?: {
    id?: string;
    name?: string;
    kind?: string;
    description?: string;
    signature?: string;
    params?: DbOperationParamInfo[];
    returnType?: string;
    returnTypeMode?: "fixed" | "inferred";
    pagination?: {
      enabled?: boolean;
      defaultLimit?: number;
      maxLimit?: number;
      mode?: "offset" | "cursor";
    };
  };
}

/**
 * Builds the default schema context prompt string for embedding in the natural language textarea.
 */
export function buildDefaultDbPromptContext({
  dbType = "sqlite",
  tableName = "table",
  columns = [],
  indexes = [],
  operation,
}: {
  dbType?: string;
  tableName?: string;
  columns?: CanvasEntityColumn[];
  indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  operation?: {
    name?: string;
    kind?: string;
    description?: string;
    params?: DbOperationParamInfo[];
    returnType?: string;
  };
}): string {
  const lines: string[] = [];
  lines.push(`// Database Engine: ${dbType.toUpperCase()}`);
  lines.push(`// Table: ${tableName}`);

  if (columns && columns.length > 0) {
    lines.push(`// Schema Columns:`);
    columns.forEach((col) => {
      const tags: string[] = [];
      if (col.isPrimaryKey || col.isPrimary || col.primaryKey) tags.push("PK");
      if (col.isForeignKey) {
        tags.push(
          col.references
            ? `FK -> ${col.references.table}.${col.references.column || "id"}`
            : "FK",
        );
      }
      if (col.isNotNull || col.required) tags.push("NOT NULL");
      if (col.isUnique) tags.push("UNIQUE");
      const tagStr = tags.length > 0 ? ` (${tags.join(", ")})` : "";
      lines.push(`//   - ${col.name}: ${col.type || "string"}${tagStr}`);
    });
  }

  if (indexes && indexes.length > 0) {
    const idxStr = indexes.map((idx) => `${idx.name}(${idx.columns})`).join(", ");
    lines.push(`// Indexes: ${idxStr}`);
  }

  const fnName = operation?.name || "query";
  const paramsStr = (operation?.params || [])
    .map((p) => `${p.name}: ${p.type || "string"}`)
    .join(", ");
  const isPredicate =
    fnName.startsWith("is") ||
    fnName.startsWith("has") ||
    fnName.startsWith("can") ||
    fnName.startsWith("check") ||
    fnName.startsWith("should");
  const retType =
    isPredicate && (!operation?.returnType || operation.returnType.includes("Row[]"))
      ? "boolean"
      : operation?.returnType || (isPredicate ? "boolean" : "any");
  lines.push(`// Function Signature: ${fnName}(${paramsStr}): ${retType}`);
  lines.push("");
  lines.push(`// Describe function behaviour below:`);

  if (operation?.description) {
    lines.push(operation.description);
  } else {
    lines.push(`Query ${tableName} matching parameters and return expected result.`);
  }

  return lines.join("\n");
}

/**
 * Deterministic fallback generator for database operation functions.
 */
export function generateSyncedDbOperationCode(
  params: GenerateEndpointCodeParams,
): string {
  const op = params.operation;
  const rawTableName = params.tableName || "table";
  const tableName = rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const Pascal = toPascalCase(tableName);
  const fnName = op?.name || `query${Pascal}`;
  const engine = (params.dbType || "sqlite").toLowerCase();
  const kind = op?.kind || "custom";
  const fnParams = op?.params || [];
  const retType = op?.returnType || `${Pascal}Row`;

  const paramSig = fnParams.map((p) => `${p.name}: ${p.type || "string"}`).join(", ");
  const firstParam = fnParams[0];
  const firstParamName = firstParam?.name || "id";

  const columns = params.tableSchema?.columns || [];
  const pkCol = columns.find((c) => c.isPrimaryKey || c.isPrimary) || columns[0];
  const pkName = pkCol?.name || "id";

  // Check if this looks like a boolean status check (e.g. isSubscribed, isActive, hasValidAccess)
  const isBooleanQuery =
    fnName.startsWith("is") ||
    fnName.startsWith("has") ||
    fnName.startsWith("can") ||
    retType.toLowerCase().includes("boolean");

  if (engine === "redis") {
    return `export async function ${fnName}(${paramSig}): Promise<${retType}> {
  const redis = await getRedisClient();
  const raw = await redis.get(\`${tableName}:\${${firstParamName}}\`);
  if (!raw) return ${isBooleanQuery ? "false" : "null"};
  const data = JSON.parse(raw);
  return ${isBooleanQuery ? "Boolean(data && data.status === \"active\")" : "data"};
}`;
  }

  if (engine === "postgres") {
    if (isBooleanQuery) {
      const statusCol = columns.find((c) => c.name.toLowerCase() === "status");
      const checkCol = statusCol ? statusCol.name : pkName;
      return `export async function ${fnName}(${paramSig}): Promise<boolean> {
  const res = await query<${Pascal}Row>(
    'SELECT * FROM "${tableName}" WHERE "${firstParamName}" = $1 LIMIT 1',
    [${firstParamName}]
  );
  const row = res.rows[0];
  return Boolean(row${statusCol ? ` && (row.${checkCol} === "active" || row.${checkCol} === "trialing")` : ""});
}`;
    }

    return `export async function ${fnName}(${paramSig}): Promise<${retType}> {
  const res = await query<${Pascal}Row>(
    'SELECT * FROM "${tableName}" WHERE "${pkName}" = $1 LIMIT 1',
    [${firstParamName}]
  );
  return (res.rows[0] as unknown as ${retType}) || null;
}`;
  }

  // SQLite Default
  if (isBooleanQuery) {
    const statusCol = columns.find((c) => c.name.toLowerCase() === "status");
    const checkCol = statusCol ? statusCol.name : pkName;
    return `export function ${fnName}(${paramSig}): boolean {
  const row = db.prepare("SELECT * FROM ${tableName} WHERE ${firstParamName} = ? LIMIT 1").get(${firstParamName}) as unknown as ${Pascal}Row | undefined;
  return Boolean(row${statusCol ? ` && (row.${checkCol} === "active" || row.${checkCol} === "trialing")` : ""});
}`;
  }

  if (kind === "findAll" || retType.includes("[]")) {
    const hasLimit = fnParams.some((p) => p.name === "limit");
    const hasOffset = fnParams.some((p) => p.name === "offset");
    const paginationSig = hasLimit
      ? paramSig
      : `${paramSig ? `${paramSig}, ` : ""}limit = 20, offset = 0`;
    return `export function ${fnName}(${paginationSig}): ${Pascal}Row[] {
  return db.prepare("SELECT * FROM ${tableName} LIMIT ? OFFSET ?").all(limit, offset) as unknown as ${Pascal}Row[];
}`;
  }

  return `export function ${fnName}(${paramSig}): ${Pascal}Row | undefined {
  return db.prepare("SELECT * FROM ${tableName} WHERE ${firstParamName} = ? LIMIT 1").get(${firstParamName}) as unknown as ${Pascal}Row | undefined;
}`;
}

export function generateSyncedEndpointCode({
  prompt,
  crudConfig = [],
  availableTableNodes = [],
  publishedEvents = [],
  endpointMethod = "POST",
  endpointPath = "/",
  requestBody,
}: GenerateEndpointCodeParams): string {
  const lines: string[] = [];

  if (prompt && prompt.trim()) {
    lines.push("// --- Business Logic Specification ---");
    prompt
      .trim()
      .split("\n")
      .forEach((line, idx) => {
        if (line.trim()) lines.push(`// STEP ${idx + 1}: ${line.trim()}`);
      });
    lines.push("");
  }

  // Input field validation from requestBody fields
  const bodyFields = requestBody?.fields || [];
  const requiredFields = bodyFields.filter((f) => f && f.name && f.required !== false);
  if (requiredFields.length > 0) {
    lines.push("// --- Request Payload Validation ---");
    requiredFields.forEach((field) => {
      const fieldName = field.name.trim();
      const typeStr = field.type || "string";
      if (typeStr === "string") {
        lines.push(`if (!body?.${fieldName} || typeof body.${fieldName} !== "string" || !body.${fieldName}.trim()) {`);
        lines.push(`  return res.status(400).json({ error: "${fieldName} is required and must be a non-empty string" });`);
        lines.push(`}`);
      } else {
        lines.push(`if (body?.${fieldName} === undefined || body.${fieldName} === null) {`);
        lines.push(`  return res.status(400).json({ error: "${fieldName} is required" });`);
        lines.push(`}`);
      }
    });
    lines.push("");
  }

  const activeDbConfigs = crudConfig.filter(
    (c) => c.tableNodeId && c.operations && c.operations.length > 0,
  );

  let primaryResultVar = "result";

  if (activeDbConfigs.length > 0) {
    lines.push("// --- Database & Cache Operations ---");
    activeDbConfigs.forEach((configItem) => {
      const tableObj = availableTableNodes.find(
        (t) => t.id === configItem.tableNodeId,
      );
      const rawLabel = tableObj?.label || "table";
      const tableName = rawLabel.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const Pascal = toPascalCase(tableName);
      const isIdRoute =
        endpointPath.includes(":id") || endpointPath.includes("{id}");

      (configItem.operations || []).forEach((op) => {
        const opLower = op.toLowerCase();
        if (opLower.startsWith("get") && (opLower.includes("cache") || opLower.includes("field") || opLower.includes("member"))) {
          const varName = `cached${Pascal}`;
          lines.push(`const ${varName} = await ${op}(req.params.id);`);
          lines.push(`if (${varName}) {\n  return res.json({ success: true, data: ${varName} });\n}`);
          primaryResultVar = varName;
        } else if (opLower.startsWith("set") && opLower.includes("cache")) {
          lines.push(`await ${op}(req.params.id, body);`);
        } else if (opLower.startsWith("invalidate")) {
          lines.push(`await ${op}(req.params.id);`);
        } else if (op === "create") {
          const varName = `created${Pascal}`;
          lines.push(`const ${varName} = await create${Pascal}(body);`);
          primaryResultVar = varName;
        } else if (op === "read") {
          if (isIdRoute) {
            const varName = `${toVarName(tableName)}`;
            lines.push(`const ${varName} = await find${Pascal}ById(req.params.id);`);
            lines.push(`if (!${varName}) {\n  return res.status(404).json({ error: "${Pascal} not found" });\n}`);
            primaryResultVar = varName;
          } else {
            const varName = `${toVarName(tableName)}List`;
            lines.push(`const ${varName} = await findAll${Pascal}();`);
            primaryResultVar = varName;
          }
        } else if (op === "update") {
          const varName = `updated${Pascal}`;
          lines.push(`const ${varName} = await update${Pascal}(req.params.id, body);`);
          primaryResultVar = varName;
        } else if (op === "delete") {
          const varName = `delete${Pascal}Result`;
          lines.push(`const ${varName} = await delete${Pascal}ById(req.params.id);`);
          primaryResultVar = varName;
        } else {
          lines.push(`await ${op}();`);
        }
      });
    });
    lines.push("");
  }

  if (publishedEvents && publishedEvents.length > 0) {
    lines.push("// --- Kafka Event Publishing ---");
    publishedEvents.forEach((ev) => {
      const eventName = ev.name || ev.topic || "EVENT";
      const topicKey = toTopicKey(eventName);
      lines.push(
        `await publishKafkaEvent(KAFKA_TOPICS.${topicKey}, {\n  action: "${endpointMethod.toLowerCase()}",\n  path: "${endpointPath}",\n  payload: body,\n});`
      );
    });
    lines.push("");
  }

  const methodUpper = (endpointMethod || "POST").toUpperCase();
  const statusCode = methodUpper === "POST" ? 201 : 200;
  lines.push("// --- Response ---");
  if (activeDbConfigs.length > 0) {
    lines.push(`return res.status(${statusCode}).json({ success: true, data: ${primaryResultVar} });`);
  } else {
    lines.push(
      `return res.status(${statusCode}).json({\n  success: true,\n  message: "Successfully executed ${methodUpper} ${endpointPath}"\n});`
    );
  }

  return lines.join("\n");
}

export async function generateCodeWithAI(params: GenerateEndpointCodeParams): Promise<string> {
  console.log("[generateCodeWithAI] Requesting code generation with params:", {
    contextType: params.contextType,
    dbType: params.dbType,
    tableName: params.tableName,
    method: params.endpointMethod,
    path: params.endpointPath,
    promptLength: params.prompt?.length || 0,
    hasCrud: (params.crudConfig?.length || 0) > 0,
  });

  try {
    const res = await fetch("/api/generate-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    console.log("[generateCodeWithAI] API Response status:", res.status, res.statusText);

    if (res.ok) {
      const data = await res.json();
      console.log("[generateCodeWithAI] Received JSON response source:", data.source || "unknown");
      if (data.code && typeof data.code === "string" && data.code.trim()) {
        return data.code.trim();
      }
    } else {
      const errText = await res.text();
      console.error("[generateCodeWithAI] API route returned error:", res.status, errText);
    }
  } catch (err) {
    console.warn("[generateCodeWithAI] Request failed with exception, falling back to deterministic generator:", err);
  }

  // Fallback to deterministic code generator
  if (
    params.contextType === "db_operation" ||
    params.dbType ||
    params.tableSchema ||
    params.operation
  ) {
    console.log("[generateCodeWithAI] Executing client-side deterministic fallback for database operation");
    return generateSyncedDbOperationCode(params);
  }

  console.log("[generateCodeWithAI] Executing client-side deterministic fallback generator for endpoint");
  return generateSyncedEndpointCode(params);
}

