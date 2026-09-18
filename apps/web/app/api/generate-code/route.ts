import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import {
  generateSyncedEndpointCode,
  generateSyncedDbOperationCode,
  type GenerateEndpointCodeParams,
} from "@/app/(canvas)/project/[projectId]/_components/shared/business-logic-block/generator";

export interface GenerateCodeRequestBody extends GenerateEndpointCodeParams {
  endpoint?: {
    id: string;
    name?: string;
    type?: string;
    description?: string;
    path?: string;
  };
}

async function generateCodeWithGroq(body: GenerateCodeRequestBody): Promise<string | null> {
  const apiKeyStr = process.env.GROQ_API_KEY;
  if (!apiKeyStr || apiKeyStr === "dummy_key") {
    console.warn("[GENERATE_CODE_API] GROQ_API_KEY is missing or set to dummy_key in environment.");
    return null;
  }

  const apiKeys = apiKeyStr
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (apiKeys.length === 0) {
    console.warn("[GENERATE_CODE_API] GROQ_API_KEY provided no valid non-empty keys.");
    return null;
  }

  const model = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-120b";
  const fallbackModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

  const method = (body.endpointMethod || "POST").toUpperCase();
  const path = body.endpointPath || "/";
  const promptText = body.prompt || "";
  const crudList = body.crudConfig || [];
  const publishedEvents = body.publishedEvents || [];
  const tableNodes = body.availableTableNodes || [];

  console.log(`[GENERATE_CODE_API] Starting direct Groq generation with ${apiKeys.length} key(s). Target method=${method}, path=${path}, model=${model}`);

  const tableNames = crudList.map((c) => {
    const tableObj = tableNodes.find((t) => t.id === c.tableNodeId);
    return tableObj?.label || c.tableName || c.tableNodeId || "Table";
  });

  const eventNames = publishedEvents.map((e) => e.name || e.topic || "EVENT");

  let requestBodySchemaStr = "None specified";
  if (body.requestBody) {
    if (Array.isArray(body.requestBody.fields) && body.requestBody.fields.length > 0) {
      const fDefs = body.requestBody.fields
        .filter((f) => f && f.name)
        .map((f) => `${f.name}${f.required === false ? "?" : ""}: ${f.type || "string"}`);
      if (fDefs.length > 0) {
        requestBodySchemaStr = `{ ${fDefs.join(", ")} }`;
      }
    } else if (typeof body.requestBody.rawJson === "string" && body.requestBody.rawJson.trim()) {
      requestBodySchemaStr = body.requestBody.rawJson.trim();
    }
  }

  const systemPrompt = `You are an expert full-stack TypeScript engineer writing Express.js route handler code for high-performance microservices.

Your objective is to generate ONLY the inner body lines of an Express async handler for ${method} ${path}.

Context & Requirements:
1. Endpoint Method: ${method}
2. Endpoint Path: ${path}
3. Natural Language Business Specification / Directives:
${promptText ? promptText : "(No specific custom directives supplied; implement standard REST logic)"}

4. Configured Request Body Schema:
${requestBodySchemaStr}

5. Database Tables & Operations Available (@workspace/db helpers):
${tableNames.length > 0 ? tableNames.map((t: string, idx: number) => `- Table/Cache "${t}": operations [${crudList[idx]?.operations?.join(", ") || "read"}]`).join("\n") : "None"}
- DB helper functions are available as:
  - create<Table>(body)
  - find<Table>ById(req.params.id) / findAll<Table>()
  - update<Table>(req.params.id, body)
  - delete<Table>ById(req.params.id)
- Redis Cache helper functions (@workspace/redis helpers):
  - get<Cache>(id) / get<Cache>Field(id, field) (Check cache before DB if caching pattern is used)
  - set<Cache>(id, body) / set<Cache>Field(id, field, value)
  - invalidate<Cache>(id) / invalidateAll<Cache>()

6. Kafka Events to Publish (@workspace/kafka/publishers):
${eventNames.length > 0 ? eventNames.map((e: string) => `- Topic: ${e}`).join("\n") : "None"}
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
- Use clean, modern TypeScript syntax. Do not output prose or comments explaining the rules.`;

  for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
    const apiKey = apiKeys[keyIdx];
    if (!apiKey) continue;
    const maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    for (const m of [model, ...fallbackModels.filter((fm) => fm !== model)]) {
      try {
        console.log(`[GENERATE_CODE_API] Invoking Groq SDK with key index ${keyIdx} (${maskedKey}) on model=${m}`);
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate the business logic code snippet for ${method} ${path}.` },
          ],
          model: m,
          temperature: 0.1,
          max_tokens: 1500,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const cleaned = content
            .replace(/^```(typescript|ts)?/gi, "")
            .replace(/```$/g, "")
            .trim();
          if (cleaned) {
            console.log(`[GENERATE_CODE_API] Successfully generated code via Groq model=${m} (length=${cleaned.length} chars)`);
            return cleaned;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[GENERATE_CODE_API] Groq attempt failed with key index ${keyIdx} (${maskedKey}) on model=${m}: ${message}`);
      }
    }
  }

  console.warn("[GENERATE_CODE_API] All Groq API key/model combinations exhausted without returning code.");
  return null;
}

async function generateDbOperationCodeWithGroq(body: GenerateCodeRequestBody): Promise<string | null> {
  const apiKeyStr = process.env.GROQ_API_KEY;
  if (!apiKeyStr || apiKeyStr === "dummy_key") {
    console.warn("[GENERATE_CODE_API] GROQ_API_KEY is missing or set to dummy_key in environment.");
    return null;
  }

  const apiKeys = apiKeyStr
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (apiKeys.length === 0) {
    console.warn("[GENERATE_CODE_API] GROQ_API_KEY provided no valid non-empty keys.");
    return null;
  }

  const model = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-120b";
  const fallbackModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

  const dbType = (body.dbType || "sqlite").toLowerCase();
  const rawTableName = body.tableName || body.tableSchema?.name || "table";
  const tableName = rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const Pascal = tableName.charAt(0).toUpperCase() + tableName.slice(1);
  const promptText = body.prompt || "";
  const op = body.operation;
  const opName = op?.name || `query${Pascal}`;
  const opKind = op?.kind || "custom";
  const opParams = op?.params || [];
  const returnType = op?.returnType || `${Pascal}Row`;

  const columns = body.tableSchema?.columns || [];
  const formattedColumns =
    columns.length > 0
      ? columns
          .map((c) => {
            const tags: string[] = [];
            if (c.isPrimaryKey || c.isPrimary || c.primaryKey) tags.push("PRIMARY KEY");
            if (c.isForeignKey) {
              tags.push(
                c.references
                  ? `FOREIGN KEY -> ${c.references.table}.${c.references.column || "id"}`
                  : "FOREIGN KEY",
              );
            }
            if (c.isNotNull) tags.push("NOT NULL");
            if (c.isUnique) tags.push("UNIQUE");
            if (c.defaultValue) tags.push(`DEFAULT ${c.defaultValue}`);
            const tagStr = tags.length > 0 ? ` (${tags.join(", ")})` : "";
            return `  - "${c.name}": ${c.type || "string"}${tagStr}`;
          })
          .join("\n")
      : "  - (No explicit columns defined)";

  const indexes = body.tableSchema?.indexes || [];
  const formattedIndexes =
    indexes.length > 0
      ? indexes
          .map(
            (idx) =>
              `  - ${idx.name}: (${idx.columns})${idx.isUnique ? " UNIQUE" : ""}`,
          )
          .join("\n")
      : "  None";

  const otherTables = (body.allTableSchemas || [])
    .filter((t) => t.name.toLowerCase() !== tableName)
    .map((t) => {
      const colNames = (t.columns || [])
        .map((c) => `${c.name} (${c.type})`)
        .join(", ");
      return `  - Table "${t.name}": [${colNames}]`;
    })
    .join("\n");

  const formattedParams =
    opParams.length > 0
      ? opParams
          .map(
            (p) =>
              `${p.name}: ${p.type || "string"}${p.defaultValue ? ` = ${p.defaultValue}` : ""}`,
          )
          .join(", ")
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

  const systemPrompt = `You are an expert full-stack TypeScript and database engineer writing high-performance, injection-safe database query helper functions for a modular database package (@workspace/db).

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
   - If checking status = 'active', make sure 'status' column exists in schema.
   - NEVER invent or hallucinate non-existent column names.

8. EXACT ENGINE CODE PATTERNS:
   - For SQLite:
     * Available in scope: \`db\` (better-sqlite3 Database instance), \`${Pascal}Row\` type.
     * Boolean check example:
       \`\`\`
       export function ${opName}(${formattedParams}): boolean {
         const row = db.prepare("SELECT 1 FROM ${tableName} WHERE ... LIMIT 1").get(...);
         return Boolean(row);
       }
       \`\`\`
     * Record query example:
       \`\`\`
       export function ${opName}(${formattedParams}): ${Pascal}Row | undefined {
         return db.prepare("SELECT * FROM ${tableName} WHERE ... LIMIT 1").get(...) as unknown as ${Pascal}Row | undefined;
       }
       \`\`\`
   - For PostgreSQL:
     * Available in scope: \`query\` (pg pool query helper), \`${Pascal}Row\` type.
     * Boolean check example:
       \`\`\`
       export async function ${opName}(${formattedParams}): Promise<boolean> {
         const res = await query('SELECT 1 FROM "${tableName}" WHERE ... LIMIT 1', [...]);
         return (res.rowCount ?? 0) > 0;
       }
       \`\`\`
   - For Redis:
     * Available in scope: \`getRedisClient\` function.
     * Example:
       \`\`\`
       export async function ${opName}(${formattedParams}): Promise<${effectiveReturnType}> {
         const redis = await getRedisClient();
         const raw = await redis.get(\`${tableName}:\${...}\`);
         return ...;
       }
       \`\`\``;

  for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
    const apiKey = apiKeys[keyIdx];
    if (!apiKey) continue;
    const maskedKey = `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    for (const m of [model, ...fallbackModels.filter((fm) => fm !== model)]) {
      try {
        console.log(`[GENERATE_CODE_API] Invoking Groq SDK for DB operation with key index ${keyIdx} (${maskedKey}) on model=${m}`);
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate the standalone TypeScript database query function "${opName}" for table "${tableName}" (${dbType.toUpperCase()}) based on:
- Function Name: ${opName}
- Parameters: ${formattedParams}
- Expected Return Type: ${effectiveReturnType}
- Directives: ${promptText || `Implement query for ${tableName}`}`,
            },
          ],
          model: m,
          temperature: 0.1,
          max_tokens: 1500,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const cleaned = content
            .replace(/^```(typescript|ts)?/gi, "")
            .replace(/```$/g, "")
            .trim();
          if (cleaned) {
            console.log(`[GENERATE_CODE_API] Successfully generated DB operation code via Groq model=${m} (length=${cleaned.length} chars)`);
            return cleaned;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[GENERATE_CODE_API] Groq DB attempt failed with key index ${keyIdx} (${maskedKey}) on model=${m}: ${message}`);
      }
    }
  }

  console.warn("[GENERATE_CODE_API] All Groq API key/model combinations exhausted for DB operation.");
  return null;
}

export async function POST(req: NextRequest) {
  console.log(`[GENERATE_CODE_API] Incoming POST request to /api/generate-code`);
  try {
    const body: GenerateCodeRequestBody = await req.json();
    const isDbOperation =
      body.contextType === "db_operation" ||
      Boolean(body.dbType) ||
      Boolean(body.tableSchema) ||
      Boolean(body.operation);

    console.log(
      `[GENERATE_CODE_API] Request payload parsed. isDbOperation=${isDbOperation}, contextType=${body.contextType}, promptLength=${body.prompt?.length || 0}`,
    );

    // Branch 1: Database operation code generation (DO NOT forward to microservice engine)
    if (isDbOperation) {
      console.log(`[GENERATE_CODE_API] Processing database operation code generation...`);
      const dbCode = await generateDbOperationCodeWithGroq(body);
      if (dbCode) {
        return NextResponse.json({ code: dbCode, source: "groq-db" });
      }

      console.log(`[GENERATE_CODE_API] Falling back to deterministic DB code generator...`);
      const fallbackDbCode = generateSyncedDbOperationCode(body);
      console.log(`[GENERATE_CODE_API] Deterministic DB code generated (length=${fallbackDbCode.length} chars)`);
      return NextResponse.json({ code: fallbackDbCode, source: "fallback-db" });
    }

    // Branch 2: Standard microservice endpoint code generation
    const systemDesignEngineUrl =
      process.env.NEXT_PUBLIC_SYSTEM_DESIGN_ENGINE_URL ||
      process.env.SYSTEM_DESIGN_ENGINE_URL;

    if (systemDesignEngineUrl) {
      console.log(`[GENERATE_CODE_API] Attempting backend engine fetch at: ${systemDesignEngineUrl}/generate-code`);
      try {
        const response = await fetch(`${systemDesignEngineUrl}/generate-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });

        console.log(`[GENERATE_CODE_API] Engine response status: ${response.status} ${response.statusText}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.code) {
            console.log(`[GENERATE_CODE_API] Successfully received code from engine (length=${data.code.length} chars)`);
            return NextResponse.json(data);
          } else {
            console.warn(`[GENERATE_CODE_API] Engine responded 200 but missing data.code payload.`);
          }
        } else {
          const errText = await response.text();
          console.warn(`[GENERATE_CODE_API] Engine responded error ${response.status}: ${errText}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[GENERATE_CODE_API] Backend engine fetch failed/timed out: ${msg}`);
      }
    } else {
      console.log(`[GENERATE_CODE_API] No system design engine URL configured in env.`);
    }

    // Branch 2: Standard microservice endpoint code generation
    console.log(`[GENERATE_CODE_API] Attempting direct Groq endpoint generation in Next.js route handler...`);
    const aiCode = await generateCodeWithGroq(body);
    if (aiCode) {
      return NextResponse.json({ code: aiCode, source: "groq" });
    }

    // Fallback to deterministic code generator
    console.log(`[GENERATE_CODE_API] Falling back to deterministic endpoint code generator...`);
    const fallbackCode = generateSyncedEndpointCode(body);
    console.log(`[GENERATE_CODE_API] Deterministic endpoint code generated (length=${fallbackCode.length} chars)`);
    return NextResponse.json({ code: fallbackCode, source: "fallback" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[GENERATE_CODE_API] Unexpected error in /api/generate-code handler:", error);
    try {
      const fallbackCode = generateSyncedEndpointCode({});
      console.log(`[GENERATE_CODE_API] Emergency deterministic fallback executed after error.`);
      return NextResponse.json({ code: fallbackCode, source: "emergency-fallback" });
    } catch (emergencyErr) {
      console.error("[GENERATE_CODE_API] Emergency fallback also failed:", emergencyErr);
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }
  }
}

