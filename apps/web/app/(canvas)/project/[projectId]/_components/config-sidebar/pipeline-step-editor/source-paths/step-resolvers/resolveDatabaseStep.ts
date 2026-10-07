import { BackendNode, CanvasEntityColumn } from "@workspace/canvas/types";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { AvailablePath, PipelineStepDraft } from "../../types";

export function resolveDatabaseStepPaths(
  step: PipelineStepDraft,
  allNodes: BackendNode[],
  stepPaths: AvailablePath[],
): void {
  const isDbStep = step.tableNodeId || step.type === "db_operation" || step.type === "redis_operation";
  if (!isDbStep) return;

  let tableNode = step.tableNodeId ? allNodes.find((n) => n.id === step.tableNodeId) : undefined;
  if (tableNode?.type === "db_ref" && tableNode.data?.tableRef) {
    const master = allNodes.find((n) => n.id === tableNode?.data?.tableRef);
    if (master) tableNode = master;
  }
  if (!tableNode && step.databaseId) {
    tableNode = allNodes.find(
      (n) => n.id === step.databaseId && (n.type === "entity" || n.type === "db_ref"),
    );
    if (tableNode?.type === "db_ref" && tableNode.data?.tableRef) {
      const master = allNodes.find((n) => n.id === tableNode?.data?.tableRef);
      if (master) tableNode = master;
    }
  }
  if (!tableNode && step.functionRef?.name) {
    tableNode = allNodes.find((n) => {
      if (n.type !== "entity" && n.type !== "db_ref") return false;
      const target =
        n.type === "db_ref" && n.data?.tableRef
          ? allNodes.find((m) => m.id === n.data?.tableRef)
          : n;
      const ops = target ? getEntityDbOperations(target, allNodes) : [];
      return ops.some((op) => op.name === step.functionRef?.name || op.id === step.operationId);
    });
    if (tableNode?.type === "db_ref" && tableNode.data?.tableRef) {
      const master = allNodes.find((n) => n.id === tableNode?.data?.tableRef);
      if (master) tableNode = master;
    }
  }

  // ── Redis step: derive paths based on operation kind ──────────────────
  const isRedisNode =
    tableNode?.type === "redis_schema" ||
    tableNode?.type === "redis-cache" ||
    (tableNode?.type === "entity" && tableNode.data?.dbType === "redis") ||
    step.type === "redis_operation";

  if (isRedisNode && tableNode?.data) {
    const selectedOpId = step.operationId;
    const selectedFnName = step.functionRef?.name;
    const ops = tableNode.data.dbOperations;

    let opKind: string | undefined;
    if (Array.isArray(ops) && (selectedOpId || selectedFnName)) {
      const matchedOp = ops.find(
        (op) =>
          (selectedOpId && (op.id === selectedOpId || op.name === selectedOpId)) ||
          (selectedFnName && op.name === selectedFnName),
      );
      opKind = matchedOp?.kind;
    }

    // Fallback: infer from function name pattern
    if (!opKind && selectedFnName) {
      const fnLower = selectedFnName.toLowerCase();
      if (
        fnLower.startsWith("getrecent") ||
        fnLower.startsWith("findall") ||
        fnLower.startsWith("getall") ||
        fnLower.startsWith("gettop") ||
        (fnLower.startsWith("get") && fnLower.endsWith("list")) ||
        fnLower.startsWith("search") ||
        (fnLower.startsWith("read") && fnLower.endsWith("stream"))
      ) {
        opKind = "findAll";
      }
    }

    const isArrayReturn = opKind === "findAll";
    const schemaColumns: readonly CanvasEntityColumn[] = tableNode.data.columns || [];

    // Expose standard Success | Failure envelope paths
    if (!stepPaths.some((p) => p.path === "success")) {
      stepPaths.push({
        path: "success",
        type: "boolean",
        description: "Whether the operation succeeded",
      });
    }
    if (!stepPaths.some((p) => p.path === "data")) {
      stepPaths.push({
        path: "data",
        type: isArrayReturn ? "array" : "object",
        description: "Returned data payload on success",
      });
    }
    if (!stepPaths.some((p) => p.path === "error.message")) {
      stepPaths.push({
        path: "error.message",
        type: "string",
        description: "Error message if operation failed",
      });
    }

    if (isArrayReturn) {
      if (!stepPaths.some((p) => p.path === "data.length")) {
        stepPaths.push({
          path: "data.length",
          type: "number",
          description: "Number of items in the returned array",
        });
      }
      if (!stepPaths.some((p) => p.path === "length")) {
        stepPaths.push({
          path: "length",
          type: "number",
          description: "Number of items (legacy alias for data.length)",
        });
      }
      schemaColumns.forEach((col) => {
        if (!col.name) return;
        const hint = `data[n].${col.name}`;
        if (!stepPaths.some((p) => p.path === hint)) {
          stepPaths.push({
            path: hint,
            type: col.type || "string",
            description: "Field on each array element",
          });
        }
      });
    } else {
      schemaColumns.forEach((col) => {
        if (col.name) {
          const dataPath = `data.${col.name}`;
          if (!stepPaths.some((p) => p.path === dataPath)) {
            stepPaths.push({ path: dataPath, type: col.type || "string" });
          }
          // Also keep flat path for backward compatibility
          if (!stepPaths.some((p) => p.path === col.name)) {
            stepPaths.push({ path: col.name, type: col.type || "string" });
          }
        }
      });
    }
  } else {
    // ── Relational Database step (SQLite, Postgres, MySQL) ──────────────
    const ops = tableNode ? getEntityDbOperations(tableNode, allNodes) : [];
    const selectedOp = ops.find(
      (op) =>
        (step.operationId && (op.id === step.operationId || op.name === step.operationId)) ||
        (step.functionRef?.name && op.name === step.functionRef.name),
    );

    const fnLower = (
      step.functionRef?.name ||
      step.operationId ||
      step.name ||
      selectedOp?.name ||
      ""
    ).toLowerCase();
    const opKind = selectedOp?.kind;
    const returnTypeStr = selectedOp?.returnType || "";
    const isArrayReturn =
      step.functionRef?.returnIsArray === true ||
      opKind === "findAll" ||
      fnLower.startsWith("findall") ||
      fnLower.startsWith("getall") ||
      fnLower.startsWith("list") ||
      returnTypeStr.includes("[]") ||
      returnTypeStr.includes("Array<") ||
      Boolean(selectedOp?.code && selectedOp.code.includes(".all("));

    const isDeleteReturn =
      opKind === "delete" ||
      fnLower.startsWith("delete") ||
      returnTypeStr.includes("{ success: boolean");

    const isCreateReturn =
      opKind === "create" ||
      fnLower.startsWith("create") ||
      fnLower.startsWith("insert");

    // Remove any dummy placeholder 'result' if present
    const dummyIdx = stepPaths.findIndex((p) => p.path === "result");
    if (dummyIdx !== -1) {
      stepPaths.splice(dummyIdx, 1);
    }

    if (isArrayReturn) {
      if (!stepPaths.some((p) => p.path === "length")) {
        stepPaths.push({
          path: "length",
          type: "number",
          description: "Number of items in the returned array",
        });
      }
      const columns = tableNode?.data?.columns || [];
      columns.forEach((col) => {
        if (!col.name) return;
        const hint = `[0].${col.name}`;
        if (!stepPaths.some((p) => p.path === hint)) {
          stepPaths.push({
            path: hint,
            type: col.type || "string",
            description: "Field on first item in array",
          });
        }
      });
    } else if (isDeleteReturn) {
      if (!stepPaths.some((p) => p.path === "success")) {
        stepPaths.push({
          path: "success",
          type: "boolean",
          description: "Whether the operation succeeded",
        });
      }
      if (!stepPaths.some((p) => p.path === "message")) {
        stepPaths.push({
          path: "message",
          type: "string",
          description: "Operation result message",
        });
      }
    } else {
      // Single record return (create, update, findById, etc.)
      const columns = tableNode?.data?.columns || [];
      columns.forEach((col) => {
        if (col.name && !stepPaths.some((p) => p.path === col.name)) {
          stepPaths.push({ path: col.name, type: col.type || "string" });
        }
      });

      // Operational fields for create (matching compileSqlitePrimaryKeyAndMessage)
      if (isCreateReturn) {
        if (!stepPaths.some((p) => p.path === "message")) {
          stepPaths.push({ path: "message", type: "string" });
        }
        if (!stepPaths.some((p) => p.path === "success")) {
          stepPaths.push({ path: "success", type: "boolean" });
        }
      } else if (!tableNode && step.type === "db_operation") {
        // Fallback for unconfigured db_operation without table node
        if (!stepPaths.some((p) => p.path === "id")) {
          stepPaths.unshift({ path: "id", type: "string" });
        }
        if (!stepPaths.some((p) => p.path === "message")) {
          stepPaths.push({ path: "message", type: "string" });
        }
        if (!stepPaths.some((p) => p.path === "success")) {
          stepPaths.push({ path: "success", type: "boolean" });
        }
      }

      // Ensure 'id' column appears at the front of the list if present
      const idIdx = stepPaths.findIndex((p) => p.path === "id");
      if (idIdx > 0) {
        const [idItem] = stepPaths.splice(idIdx, 1);
        if (idItem) {
          stepPaths.unshift(idItem);
        }
      }
    }
  }
}
