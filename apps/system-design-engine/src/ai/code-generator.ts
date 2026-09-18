import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export interface GenerateCodeParams {
  prompt?: string;
  crudConfig?: Array<{
    tableNodeId?: string;
    tableName?: string;
    operations?: string[];
  }>;
  availableTableNodes?: Array<{ id: string; label: string }>;
  publishedEvents?: Array<{ name?: string; topic?: string }>;
  endpointMethod?: string;
  endpointPath?: string;
  serviceName?: string;
  requestBody?: {
    fields?: Array<{ name: string; type?: string; required?: boolean }>;
    rawJson?: string;
  };
}

export async function generateBusinessLogicCode(params: GenerateCodeParams): Promise<string> {
  const apiKeyStr = process.env.GROQ_API_KEY;
  const initialModel = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-120b";

  const apiKeys = apiKeyStr
    ? apiKeyStr
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : [];

  const modelsToTry = [initialModel, "openai/gpt-oss-120b", "openai/gpt-oss-20b"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  const method = (params.endpointMethod || "POST").toUpperCase();
  const path = params.endpointPath || "/";
  const promptText = params.prompt || "";
  const crudList = params.crudConfig || [];
  const publishedEvents = params.publishedEvents || [];
  const tableNodes = params.availableTableNodes || [];

  const tableNames = crudList.map((c) => {
    const tableObj = tableNodes.find((t) => t.id === c.tableNodeId);
    return tableObj?.label || c.tableName || c.tableNodeId || "Table";
  });

  const eventNames = publishedEvents.map((e) => e.name || e.topic || "EVENT");

  let requestBodySchemaStr = "None specified";
  if (params.requestBody) {
    if (Array.isArray(params.requestBody.fields) && params.requestBody.fields.length > 0) {
      const fDefs = params.requestBody.fields
        .filter((f) => f && f.name)
        .map((f) => `${f.name}${f.required === false ? "?" : ""}: ${f.type || "string"}`);
      if (fDefs.length > 0) {
        requestBodySchemaStr = `{ ${fDefs.join(", ")} }`;
      }
    } else if (typeof params.requestBody.rawJson === "string" && params.requestBody.rawJson.trim()) {
      requestBodySchemaStr = params.requestBody.rawJson.trim();
    }
  }

  const systemPrompt = new SystemMessage(
    `You are an expert full-stack TypeScript engineer writing Express.js route handler code for high-performance microservices.

Your objective is to generate ONLY the inner body lines of an Express async handler for ${method} ${path}.

Context & Requirements:
1. Endpoint Method: ${method}
2. Endpoint Path: ${path}
3. Natural Language Business Specification / Directives:
${promptText ? promptText : "(No specific custom directives supplied; implement standard REST logic)"}

4. Configured Request Body Schema:
${requestBodySchemaStr}

5. Database Tables & Operations Available (@workspace/db helpers):
${tableNames.length > 0 ? tableNames.map((t, idx) => `- Table "${t}": operations [${crudList[idx]?.operations?.join(", ") || "read"}]`).join("\n") : "None"}
- DB helper functions are available as:
  - create<Table>(body)
  - find<Table>ById(req.params.id) / findAll<Table>()
  - update<Table>(req.params.id, body)
  - delete<Table>ById(req.params.id)

6. Kafka Events to Publish (@workspace/kafka/publishers):
${eventNames.length > 0 ? eventNames.map((e) => `- Topic: ${e}`).join("\n") : "None"}
- Publish function call format:
  await publishKafkaEvent(KAFKA_TOPICS.<TOPIC_KEY>, { action: "${method.toLowerCase()}", path: "${path}", payload: body });

Strict Rules for Output:
- Output ONLY valid TypeScript code lines that can be directly pasted into an Express handler.
- Do NOT include outer function definitions, imports, or markdown code blocks (\`\`\`ts or \`\`\`).
- Note: \`body\` (validated request payload) is ALREADY defined in handler scope before this block. Do NOT write \`if (!req.body)\` or redefine \`const body = ...\`.
- Check required business logic properties directly on \`body\` (e.g. \`if (!body.name) { return res.status(400).json({ error: "Name is required" }); }\`).
- Pass \`body\` to DB operations (e.g. \`const createdProduct = await createProducts(body);\`).
- Pass \`body\` to Kafka event publishing.
- Return an HTTP response with res.status(statusCode).json({ ... }).
- Use clean, modern TypeScript syntax. Do not output prose or comments explaining the rules.`,
  );

  const humanPrompt = new HumanMessage(
    `Generate the business logic code snippet for ${method} ${path}.`,
  );

  for (const apiKey of apiKeys) {
    for (const model of modelsToTry) {
      try {
        const llm = new ChatGroq({ apiKey, model, temperature: 0.1, maxTokens: 1500 });
        const response = await llm.invoke([systemPrompt, humanPrompt]);
        const content = response.content.toString();

        const cleaned = content
          .replace(/^```(typescript|ts)?/gi, "")
          .replace(/```$/g, "")
          .trim();

        if (cleaned) {
          return cleaned;
        }
      } catch (err) {
        console.warn(`System design engine Groq attempt failed for model ${model}:`, err);
      }
    }
  }

  // Fallback string if all AI calls fail
  return `// Default fallback logic for ${method} ${path}\nreturn res.status(200).json({ success: true, message: "Successfully executed ${method} ${path}" });`;
}

export interface GenerateDbOperationParams {
  prompt?: string;
  contextType?: string;
  dbType?: string;
  tableName?: string;
  tableSchema?: {
    name: string;
    columns?: Array<{
      name: string;
      type?: string;
      isPrimaryKey?: boolean;
      isPrimary?: boolean;
      primaryKey?: boolean;
      isForeignKey?: boolean;
      references?: { table: string; column?: string };
      isNotNull?: boolean;
      isUnique?: boolean;
      defaultValue?: string;
    }>;
    indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  };
  allTableSchemas?: Array<{
    id?: string;
    name: string;
    columns?: Array<{ name: string; type?: string }>;
    indexes?: Array<{ name: string; columns: string; isUnique?: boolean }>;
  }>;
  operation?: {
    id?: string;
    name?: string;
    kind?: string;
    description?: string;
    signature?: string;
    params?: Array<{ name: string; type?: string; defaultValue?: string }>;
    returnType?: string;
    pagination?: {
      enabled?: boolean;
      defaultLimit?: number;
      maxLimit?: number;
      mode?: "offset" | "cursor";
    };
  };
}

export async function generateDbOperationCode(params: GenerateDbOperationParams): Promise<string> {
  const apiKeyStr = process.env.GROQ_API_KEY;
  const initialModel = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-120b";

  const apiKeys = apiKeyStr
    ? apiKeyStr
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : [];

  const modelsToTry = [initialModel, "openai/gpt-oss-120b", "openai/gpt-oss-20b"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  const dbType = (params.dbType || "sqlite").toLowerCase();
  const rawTableName = params.tableName || params.tableSchema?.name || "table";
  const tableName = rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const Pascal = tableName.charAt(0).toUpperCase() + tableName.slice(1);
  const promptText = params.prompt || "";
  const op = params.operation;
  const opName = op?.name || `query${Pascal}`;
  const opKind = op?.kind || "custom";
  const opParams = op?.params || [];
  const returnType = op?.returnType || `${Pascal}Row`;

  const columns = params.tableSchema?.columns || [];
  const formattedColumns =
    columns.length > 0
      ? columns
          .map((c) => {
            const tags: string[] = [];
            if (c.isPrimaryKey || c.isPrimary || c.primaryKey) tags.push("PRIMARY KEY");
            if (c.isForeignKey) tags.push(c.references ? `FOREIGN KEY -> ${c.references.table}.${c.references.column || "id"}` : "FOREIGN KEY");
            if (c.isNotNull) tags.push("NOT NULL");
            if (c.isUnique) tags.push("UNIQUE");
            if (c.defaultValue) tags.push(`DEFAULT ${c.defaultValue}`);
            const tagStr = tags.length > 0 ? ` (${tags.join(", ")})` : "";
            return `  - "${c.name}": ${c.type || "string"}${tagStr}`;
          })
          .join("\n")
      : "  - (No explicit columns defined)";

  const indexes = params.tableSchema?.indexes || [];
  const formattedIndexes =
    indexes.length > 0
      ? indexes.map((idx) => `  - ${idx.name}: (${idx.columns})${idx.isUnique ? " UNIQUE" : ""}`).join("\n")
      : "  None";

  const otherTables = (params.allTableSchemas || [])
    .filter((t) => t.name.toLowerCase() !== tableName)
    .map((t) => {
      const colNames = (t.columns || []).map((c) => `${c.name} (${c.type})`).join(", ");
      return `  - Table "${t.name}": [${colNames}]`;
    })
    .join("\n");

  const formattedParams =
    opParams.length > 0
      ? opParams.map((p) => `${p.name}: ${p.type || "string"}${p.defaultValue ? ` = ${p.defaultValue}` : ""}`).join(", ")
      : "None";

  const isPredicate =
    opName.startsWith("is") ||
    opName.startsWith("has") ||
    opName.startsWith("can") ||
    opName.startsWith("check") ||
    opName.startsWith("should");

  const promptIndicatesBoolean =
    /\b(return\s+(true|false|boolean)|check\s+if|active\s+then\s+true|is\s+active)\b/i.test(promptText);

  const effectiveReturnType =
    (isPredicate || promptIndicatesBoolean) &&
    (returnType.includes("[]") || returnType === `${Pascal}Row` || returnType === "any")
      ? "boolean"
      : returnType;

  const systemPrompt = new SystemMessage(
    `You are an expert full-stack TypeScript and database engineer writing high-performance, injection-safe database query helper functions for a modular database package (@workspace/db).

Your objective is to generate ONLY the standalone TypeScript exported function implementation for database operation "${opName}" on table "${tableName}" using ${dbType.toUpperCase()}.

=== TARGET DATABASE & SCHEMA ===
- Database Engine: ${dbType.toUpperCase()}
- Table Name: "${tableName}"
- Table Columns (Type Schema):
${formattedColumns}
- Table Indexes:
${formattedIndexes}

=== OTHER ACCESSIBLE TABLES IN DATABASE (for relations / joins) ===
${otherTables || "  None"}

=== FUNCTION SPECIFICATION ===
- Function Name: ${opName}
- Operation Kind: ${opKind}
- Function Description: ${op?.description || "Database operation"}
- Input Parameters: ${formattedParams}
- Expected Return Type: ${effectiveReturnType}
${op?.pagination?.enabled ? `- Pagination: ${op.pagination.mode || "offset"} mode (defaultLimit: ${op.pagination.defaultLimit || 20}, maxLimit: ${op.pagination.maxLimit || 100})` : ""}

=== NATURAL LANGUAGE USER DIRECTIVES / SPECIFICATION ===
${promptText || `Implement standard ${opKind} query for table ${tableName}`}

=== STRICT IMPLEMENTATION RULES ===
1. OUTPUT FORMAT:
   - Output ONLY the standalone exported TypeScript function:
     * SQLite: \`export function ${opName}(...): ... { ... }\` (or async if returning Promise)
     * PostgreSQL / MySQL / Redis: \`export async function ${opName}(...): Promise<...> { ... }\`
   - Do NOT wrap in markdown code fences (\`\`\`typescript or \`\`\`).
   - Do NOT include import statements or conversational prose.

2. ABSOLUTELY NO HTTP OR EXPRESS CODE (CRITICAL):
   - NEVER use 'req', 'res', 'res.status', 'res.json', 'req.body', 'req.params', or HTTP status codes!
   - This is an INTERNAL DATABASE ACCESS HELPER FUNCTION, NOT an HTTP / REST endpoint.

3. ABSOLUTELY NO EVENT STREAMING OR KAFKA (CRITICAL):
   - NEVER call 'publishKafkaEvent', 'KAFKA_TOPICS', or emit events inside this database helper.

4. ABSOLUTELY NO IN-MEMORY TABLE SCANS (CRITICAL):
   - NEVER call 'findAll...()' and then run '.filter()' or '.some()' or '.find()' in JavaScript!
   - ALWAYS write an actual database query with WHERE clauses!

5. PREDICATE & BOOLEAN RETURN INFERENCE (CRITICAL):
   - If the function name starts with "is", "has", "can", "should", "check", OR if user prompt specifies returning true/false (e.g. "if active then return true"):
     * The return type MUST BE 'boolean' (or 'Promise<boolean>').
     * NEVER return an array of rows or call '.all()' for existence/predicate checks!
     * Use 'SELECT 1 FROM ${tableName} WHERE ... LIMIT 1' and return Boolean(row) or (res.rowCount ?? 0) > 0.
     * SQLite: \`const row = db.prepare("SELECT 1 FROM ${tableName} WHERE ... LIMIT 1").get(...); return Boolean(row);\`.
     * PostgreSQL: \`const res = await query('SELECT 1 FROM "${tableName}" WHERE ... LIMIT 1', [...]); return (res.rowCount ?? 0) > 0;\`.

6. SQL INJECTION PREVENTION & PARAMETERIZATION:
   - SQLite: Use parameterized statements with '?' placeholders (e.g. \`db.prepare("SELECT 1 FROM ${tableName} WHERE ... LIMIT 1").get(...)\`). NEVER interpolate variables directly into SQL strings.
   - PostgreSQL: Use parameterized queries with '$1, $2' (e.g. \`await query('SELECT 1 FROM "${tableName}" WHERE "col" = $1 LIMIT 1', [val])\`).
   - MySQL: Use parameterized queries with '?' (e.g. \`await pool.execute("SELECT 1 FROM \\\`${tableName}\\\` WHERE \\\`col\\\` = ? LIMIT 1", [val])\`).
   - Redis: Use redis client commands (\`await redis.get(...)\`, \`await redis.set(...)\`, etc.).

7. STRICT COLUMN & SCHEMA ADHERENCE:
   - Use ONLY column names that are explicitly defined in the Table Columns schema above.
   - If the table column is 'user_id', use 'user_id' in SQL. If it is 'userId', use 'userId'.
   - NEVER invent or hallucinate non-existent column names.

8. EXACT ENGINE CODE PATTERNS:
   - For SQLite: \`db.prepare(...).get(...)\` or \`db.prepare(...).all(...)\`.
   - For PostgreSQL: \`await query('...', [...])\`.
   - For Redis: \`const redis = await getRedisClient(); await redis.get(...)\`.`
  );

  const humanPrompt = new HumanMessage(
    `Generate the standalone TypeScript database query function "${opName}" for table "${tableName}" (${dbType.toUpperCase()}) based on:
- Function Name: ${opName}
- Parameters: ${formattedParams}
- Expected Return Type: ${effectiveReturnType}
- Directives: ${promptText || `Implement query for ${tableName}`}`
  );

  for (const apiKey of apiKeys) {
    for (const model of modelsToTry) {
      try {
        const llm = new ChatGroq({ apiKey, model, temperature: 0.1, maxTokens: 1500 });
        const response = await llm.invoke([systemPrompt, humanPrompt]);
        const content = response.content.toString();

        const cleaned = content
          .replace(/^```(typescript|ts)?/gi, "")
          .replace(/```$/g, "")
          .trim();

        if (cleaned) {
          return cleaned;
        }
      } catch (err) {
        console.warn(`System design engine Groq DB attempt failed for model ${model}:`, err);
      }
    }
  }

  // Fallback deterministic function signature
  const isBoolean = opName.startsWith("is") || opName.startsWith("has") || returnType.toLowerCase().includes("boolean");
  if (dbType === "postgres" || dbType === "mysql") {
    return `export async function ${opName}(${formattedParams}): Promise<${returnType}> {\n  ${isBoolean ? 'const res = await query(\'SELECT 1 FROM "' + tableName + '" LIMIT 1\');\n  return (res.rowCount ?? 0) > 0;' : 'const res = await query<any>(\'SELECT * FROM "' + tableName + '" LIMIT 1\');\n  return res.rows[0] || null;'}\n}`;
  }
  return `export function ${opName}(${formattedParams}): ${returnType} {\n  ${isBoolean ? 'const row = db.prepare("SELECT 1 FROM ' + tableName + ' LIMIT 1").get();\n  return Boolean(row);' : 'return db.prepare("SELECT * FROM ' + tableName + ' LIMIT 1").get() as unknown as ' + returnType + ';'}\n}`;
}
