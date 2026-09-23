// ═══════════════════════════════════════════════════════════════
// MODULE: LegacyDbRedisEmitter
// LAYER:  generators / routeGenerator / handlers
// EMITS:  Auto-inferred DB & Redis cache-aside statements when no pipeline steps are configured
// ═══════════════════════════════════════════════════════════════

import { Endpoint, TargetDbOperation } from "@workspace/canvas/types";
import { toVarName, toPascalCase } from "../../../utils";

export interface LegacyDbRedisEmitterParams {
  method: string;
  path: string;
  ep: Endpoint & { nodeId: string };
  payloadVar: string;
  pickedDbOps: TargetDbOperation[];
  codeBlock: string;
  targetVarMap: Map<string, string>;
}

export interface LegacyDbRedisResult {
  code: string;
  sqlOps: TargetDbOperation[];
  redisOps: TargetDbOperation[];
}

/**
 * Emits legacy auto-inferred SQL DB operations, Redis cache-aside reads, writes,
 * invalidations, and cache miss population logic.
 */
export function emitLegacyDbRedisOperations(
  params: LegacyDbRedisEmitterParams,
): LegacyDbRedisResult {
  const { method, path, ep, payloadVar, pickedDbOps, codeBlock, targetVarMap } = params;

  let code = "";
  const hasDbInCodeBlock = Boolean(
    codeBlock &&
      (codeBlock.includes("findAll") ||
        codeBlock.includes("find") ||
        codeBlock.includes("create") ||
        codeBlock.includes("update") ||
        codeBlock.includes("delete") ||
        codeBlock.includes("db.")),
  );

  const isRedisOp = (op: TargetDbOperation): boolean =>
    op.fn.importPath.includes("redis") || op.fn.name.toLowerCase().includes("cache");

  const sqlOps = pickedDbOps.filter((op) => !isRedisOp(op));
  const redisOps = pickedDbOps.filter((op) => isRedisOp(op));

  // 1. Redis Cache Lookup (Cache-Aside for GET requests)
  if (method === "get" && redisOps.length > 0 && !hasDbInCodeBlock) {
    const readRedisOps = redisOps.filter((op) => op.operationKind === "read");
    if (readRedisOps.length > 0) {
      code += `    // --- Redis Cache Lookup (Cache-Aside) ---\n`;
      readRedisOps.forEach((op) => {
        const callExpr = op.callExpr.replaceAll("PAYLOAD_VAR", payloadVar);
        const rawTableName = op.fn.targetName || "Cache";
        const cleanTableName = toVarName(rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
        const Pascal = toPascalCase(cleanTableName);
        const cachedVar = `cached${Pascal || "Data"}`;
        if (op.tableNodeId) {
          targetVarMap.set(op.tableNodeId, cachedVar);
        }
        code += `    const ${cachedVar} = ${callExpr};\n`;
        code += `    if (${cachedVar} !== undefined && ${cachedVar} !== null) {\n`;
        code += `      logger.debug("Returning cached ${rawTableName} data");\n`;
        code += `      return res.status(200).json({ message: "Successfully executed ${ep.type || "GET"} ${path}", data: ${cachedVar} });\n`;
        code += `    }\n\n`;
      });
    }
  }

  // 2. SQL DB Calls
  if (sqlOps.length > 0 && !hasDbInCodeBlock) {
    code += `    // --- Database Operation(s) (via @workspace/db prepared statement) ---\n`;
    sqlOps.forEach((op) => {
      const callExpr = op.callExpr.replaceAll("PAYLOAD_VAR", payloadVar);
      const rawTableName = op.fn.targetName || "record";
      const cleanTableName = toVarName(rawTableName.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
      const Pascal = toPascalCase(cleanTableName);

      let varName = `${op.fn.name}Result`;
      if (op.operationKind === "create") {
        varName = `created${Pascal || "Record"}`;
      } else if (op.operationKind === "update") {
        varName = `updated${Pascal || "Record"}`;
      } else if (op.operationKind === "read") {
        varName = (path.includes(":id") || path.includes("{id}")) ? cleanTableName : `${cleanTableName}List`;
      } else if (op.operationKind === "delete") {
        varName = `deleted${Pascal || "Record"}Result`;
      }

      if (op.tableNodeId) {
        targetVarMap.set(op.tableNodeId, varName);
      }

      if (op.operationKind === "read" && (path.includes(":id") || path.includes("{id}"))) {
        code += `    const ${varName} = ${callExpr};\n`;
        code += `    if (${varName} === undefined || ${varName} === null) {\n`;
        code += `      return res.status(404).json({ error: "Not found" });\n`;
        code += `    }\n\n`;
      } else {
        code += `    const ${varName} = ${callExpr};\n\n`;
      }
    });
  }

  // 3. Redis Cache Mutations / Writes (POST / PUT / PATCH)
  if (["post", "put", "patch"].includes(method) && redisOps.length > 0 && !hasDbInCodeBlock) {
    const writeRedisOps = redisOps.filter((op) => op.operationKind === "create" || op.operationKind === "update");
    if (writeRedisOps.length > 0) {
      code += `    // --- Update Redis Cache ---\n`;
      writeRedisOps.forEach((op) => {
        let callExpr = op.callExpr.replaceAll("PAYLOAD_VAR", payloadVar);
        if (sqlOps.length > 0) {
          const primarySql = sqlOps[0];
          const rawSqlName = primarySql?.fn.targetName || "record";
          const cleanSqlName = toVarName(rawSqlName.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
          const sqlPascal = toPascalCase(cleanSqlName);
          const sqlVarName = primarySql?.operationKind === "create" ? `created${sqlPascal || "Record"}` : cleanSqlName;
          callExpr = callExpr.replaceAll(`${payloadVar}?.id || "default"`, `${sqlVarName}?.id || ${payloadVar}?.id || "default"`);
        }
        const varName = `${toVarName(op.fn.name)}Result`;
        code += `    const ${varName} = ${callExpr};\n\n`;
        if (op.tableNodeId && sqlOps.length === 0) {
          targetVarMap.set(op.tableNodeId, payloadVar);
        }
      });
    }
  }

  // 4. Redis Cache Invalidation (DELETE)
  if (method === "delete" && redisOps.length > 0 && !hasDbInCodeBlock) {
    const deleteRedisOps = redisOps.filter((op) => op.operationKind === "delete");
    if (deleteRedisOps.length > 0) {
      code += `    // --- Invalidate Redis Cache ---\n`;
      deleteRedisOps.forEach((op) => {
        const callExpr = op.callExpr.replaceAll("PAYLOAD_VAR", payloadVar);
        const varName = `${toVarName(op.fn.name)}Result`;
        code += `    const ${varName} = ${callExpr};\n\n`;
      });
    }
  }

  // 5. Populate Redis Cache on GET cache miss
  if (method === "get" && sqlOps.length > 0 && redisOps.length > 0 && !hasDbInCodeBlock) {
    const setOp = redisOps.find((op) => op.fn.name.toLowerCase().startsWith("set"));
    if (setOp) {
      const primarySql = sqlOps[0];
      const rawSqlName = primarySql?.fn.targetName || "record";
      const cleanSqlName = toVarName(rawSqlName.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
      const sqlVarName = (path.includes(":id") || path.includes("{id}")) ? cleanSqlName : `${cleanSqlName}List`;
      const keyArg = path.includes(":id") || path.includes("{id}") ? "req.params.id" : `"${cleanSqlName}_list"`;
      code += `    // --- Populate Redis Cache ---\n`;
      code += `    await ${setOp.fn.name}(${keyArg}, ${sqlVarName});\n\n`;
    }
  }

  return {
    code,
    sqlOps,
    redisOps,
  };
}
