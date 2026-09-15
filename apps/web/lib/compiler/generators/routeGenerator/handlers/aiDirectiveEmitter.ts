// ═══════════════════════════════════════════════════════════════
// MODULE: AIDirectiveEmitter
// LAYER:  generators / routeGenerator / handlers
// EMITS:  AI coding agent directive comments with inbound/outbound traces & entity types
// ═══════════════════════════════════════════════════════════════

import { Endpoint, TargetDbOperation, EndpointTraceResult, CanvasEntityColumn } from "@workspace/canvas/types";
import { BackendNode } from "@/types/canvas";
import { parseSchemaJson, toVarName, toPascalCase } from "../../../utils";

export function toTsType(colType: string): string {
  const t = (colType || "string").toLowerCase();
  if (["int", "integer", "bigint", "number"].includes(t)) return "number";
  if (["boolean", "bool"].includes(t)) return "boolean";
  return "string";
}

export interface EmitAiDirectiveParams {
  ep: Endpoint & { nodeId: string };
  trace: EndpointTraceResult;
  allNodes: BackendNode[];
  pickedDbOps: TargetDbOperation[];
}

/**
 * Emits comprehensive AI coding agent directive comments including caller context,
 * schemas, entity definitions, and step-by-step instructions.
 */
export function emitAiDirective(params: EmitAiDirectiveParams): string {
  const { ep, trace, allNodes, pickedDbOps } = params;
  const promptText = (ep.businessLogic || ep.prompt || "").trim();

  if (!promptText && trace.incoming.length === 0 && trace.outgoing.length === 0) {
    return "";
  }

  let code = `    // =========================================================================\n`;
  code += `    // AI CODING AGENT DIRECTIVE:\n`;

  if (ep.summary && !ep.summary.startsWith("Handler for ")) {
    code += `    // Goal: ${ep.summary.trim()}\n`;
  }

  if (trace.incoming.length > 0) {
    code += `    //\n    // INBOUND TRIGGER / CALLER:\n`;
    trace.incoming.forEach((inc) => {
      code += `    // - ${inc.nodeType}: "${inc.nodeName}" (${inc.detail})\n`;
      if (inc.dataContext) {
        code += `    //   Data Context: ${inc.dataContext.replace(/\n/g, "\n    //     ")}\n`;
      }
    });
  }

  const reqBodyFields = ep.requestBody?.fields;
  if (Array.isArray(reqBodyFields) && reqBodyFields.length > 0) {
    const fieldStr = reqBodyFields
      .filter((f) => f && f.name)
      .map((f) => `${f.name}${f.required === false ? "?" : ""}: ${f.type || "string"}`)
      .join(", ");
    if (fieldStr) {
      code += `    //\n    // CONFIGURED REQUEST BODY SCHEMA:\n`;
      code += `    // - Body: { ${fieldStr} }\n`;
    }
  }

  if (trace.outgoing.length > 0) {
    code += `    //\n    // RESOURCE DEPENDENCIES:\n`;
    trace.outgoing.forEach((out) => {
      code += `    // - ${out.nodeType}: "${out.nodeName}"\n`;
      if (out.dataContext) {
        code += `    //   ${out.dataContext.replace(/\n/g, "\n    //     ")}\n`;
      }
    });
  }

  if (ep.crudOperations && Object.keys(ep.crudOperations).length > 0) {
    const activeOps = Object.entries(ep.crudOperations).filter(
      ([_, ops]) => ops && ops.length > 0,
    );
    if (activeOps.length > 0) {
      code += `    //\n    // DATABASE OPERATIONS REQUIRED:\n`;
      for (const [tableId, ops] of activeOps) {
        const tableNode = allNodes.find((n) => n.id === tableId);
        const tableName =
          tableNode?.data?.label ||
          tableNode?.data?.tableRef ||
          "Unknown Table";
        code += `    // - Table [${tableName}]: ${ops.map((o) => o.toUpperCase()).join(", ")}\n`;
        if (ep.crudExplanations && ep.crudExplanations[tableId]) {
          for (const op of ops) {
            const explanation = ep.crudExplanations[tableId][op];
            if (explanation) {
              code += `    //   * ${op.toUpperCase()} Context: ${explanation.replace(/\n/g, "\n    //     ")}\n`;
            }
          }
        }
      }
    }
  }

  const traceTargetDbNodeIds = trace.outgoing
    .filter((out) => out.nodeType === "Database Table" || out.nodeType === "Redis Cache")
    .map((out) => out.nodeId);

  // Embed detailed database entity type definitions and schemas for AI coding agents
  const targetDbNodeIds = new Set<string>([
    ...(ep.databaseNodeIds || []),
    ...(ep.databaseNodeId && ep.databaseNodeId !== "none" ? [ep.databaseNodeId] : []),
    ...(ep.crudOperations ? Object.keys(ep.crudOperations) : []),
    ...traceTargetDbNodeIds,
    ...pickedDbOps
      .map((op) => op.tableNodeId)
      .filter((id): id is string => Boolean(id)),
  ]);

  if (targetDbNodeIds.size > 0) {
    code += `    //\n    // DATABASE & CACHE SCHEMAS & FULL TYPE DEFINITIONS:\n`;
    targetDbNodeIds.forEach((tableId) => {
      const tableNode = allNodes.find((n) => n.id === tableId);
      if (!tableNode) return;
      const entityNode =
        tableNode.type === "db_ref" && tableNode.data?.tableRef
          ? allNodes.find((n) => n.id === tableNode.data?.tableRef)
          : tableNode.type === "redis-cache" && tableNode.data?.schemaRef
            ? allNodes.find((n) => n.id === tableNode.data?.schemaRef)
            : tableNode;
      if (!entityNode) return;

      const tableName = entityNode.data?.label || "Table";
      const cleanTableName = toVarName(tableName.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
      const Pascal = toPascalCase(cleanTableName);

      const isRedis =
        entityNode.type === "redis_schema" ||
        entityNode.type === "redis-cache" ||
        entityNode.data?.dbType === "redis";

      const rawCols = entityNode.data?.columns;
      const cols: CanvasEntityColumn[] = Array.isArray(rawCols) ? rawCols : [];

      if (cols.length > 0) {
        const allColFields = cols
          .map((c) => `${c.name || "col"}: ${toTsType(c.type || "string")}`)
          .join("; ");
        const writableColFields = cols
          .filter((c) => !c.isPrimaryKey)
          .map((c) => `${c.name || "col"}: ${toTsType(c.type || "string")}`)
          .join("; ");

        if (isRedis) {
          code += `    // - Redis Cache Schema: "${tableName}" (@workspace/redis)\n`;
          code += `    //   interface ${Pascal} { ${allColFields} }\n`;
        } else {
          code += `    // - Table: "${tableName}" (@workspace/db)\n`;
          code += `    //   type ${Pascal}Row = { ${allColFields} };\n`;
          code += `    //   type Create${Pascal}Data = { ${writableColFields} };\n`;
          code += `    //   type Update${Pascal}Data = Partial<Create${Pascal}Data>;\n`;
        }
      }

      const tablePickedFns = pickedDbOps.filter(
        (op) =>
          op.tableNodeId === tableId ||
          (op.fn.targetName || "").toLowerCase() === tableName.toLowerCase(),
      );
      if (tablePickedFns.length > 0) {
        code += `    //   Available Helper Functions:\n`;
        tablePickedFns.forEach((op) => {
          code += `    //     * ${op.fn.signature || op.fn.name}\n`;
        });
      }
    });
  }

  code += `    // =========================================================================\n`;

  if (promptText) {
    promptText.split("\n").forEach((line: string, idx: number) => {
      if (line.trim()) {
        code += `    // STEP ${idx + 1}: ${line.trim()}\n`;
      }
    });
    code += `\n`;
  }

  return code;
}
