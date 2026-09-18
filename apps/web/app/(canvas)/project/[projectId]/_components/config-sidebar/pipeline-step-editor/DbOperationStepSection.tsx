"use client";

import React, { useMemo } from "react";
import {
  BackendNode,
  BackendEdge,
  DbOperationFunction,
  EntityColumn,
} from "@workspace/canvas/types";

import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toTableName, toVarName } from "@/lib/compiler/utils";
import { BufferedInput } from "./BufferedInput";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Database, Table as TableIcon, Code2, Settings, Sparkles, ExternalLink } from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  inferDbOperationReturnType,
  deriveDbFunctionSignature,
} from "@/lib/utils/entityOperationsHelper";
import { PipelineStepDraft, ExpectedArg, StepBinding } from "./types";

function computeDbOpBindings(
  op: DbOperationFunction | undefined,
  targetNode: BackendNode | undefined,
  currentBindings: StepBinding[] = [],
): StepBinding[] {
  if (!op || !targetNode) return [];

  const opName = (op.name || op.id || "").toLowerCase();

  // 1. findAll operations have NO input arguments
  if (op.kind === "findAll" || opName.includes("findall")) {
    return [];
  }

  const columns: EntityColumn[] = targetNode.data?.columns || [];
  const pkCol = columns.find((c) => c.isPrimaryKey) || columns[0];
  const pkName = pkCol?.name || "id";
  const writableCols = columns.filter((c) => !c.isPrimaryKey && c.name && c.name.trim());

  let argNames: string[] = [];

  if (opName.includes("create") || opName.includes("insert")) {
    argNames = writableCols.map((c) => toVarName(c.name));
  } else if (opName.includes("update")) {
    argNames = [toVarName(pkName), ...writableCols.map((c) => toVarName(c.name))];
  } else if (
    opName.includes("byid") ||
    opName.includes("findone") ||
    opName.includes("delete")
  ) {
    argNames = [toVarName(pkName)];
  } else if (op.params && op.params.length > 0) {
    argNames = op.params
      .filter((p) => p && p.name && p.name.trim())
      .map((p) => p.name.trim());
  }

  // Pre-populate bindings: preserve existing configured binding if present, else empty map
  return argNames.map((argName) => {
    const existing = currentBindings.find(
      (b) => (b.argName || "").trim().toLowerCase() === argName.toLowerCase(),
    );
    if (existing) {
      return existing;
    }
    return {
      argName,
      source: { kind: "req_body", field: "" },
    };
  });
}

export interface DbOperationStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  expectedArgs?: ExpectedArg[];
  selectedDbId: string;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
  children?: React.ReactNode;
}

export const DbOperationStepSection = ({
  step,
  allNodes,
  allEdges,
  expectedArgs,
  selectedDbId,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  onChange,
  onAutoMapArguments,
  children,
}: DbOperationStepSectionProps) => {
  const dbNodes = useMemo(
    () =>
      allNodes.filter(
        (n) => n.type === "database" || n.type === "redis_instance",
      ),
    [allNodes],
  );

  const allEntityNodes = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          n.type === "entity" ||
          n.type === "redis_schema" ||
          n.type === "redis-cache" ||
          n.type === "db_ref",
      ),
    [allNodes],
  );

  const filteredEntityNodes = useMemo(() => {
    if (selectedDbId === "all") return allEntityNodes;
    return allEntityNodes.filter((entity) => {
      if (entity.data?.databaseId === selectedDbId) return true;
      return allEdges.some(
        (e) =>
          (e.source === selectedDbId && e.target === entity.id) ||
          (e.target === selectedDbId && e.source === entity.id),
      );
    });
  }, [allEntityNodes, selectedDbId, allEdges]);

  const selectedTableNode = useMemo(
    () => allEntityNodes.find((n) => n.id === step.tableNodeId),
    [allEntityNodes, step.tableNodeId],
  );

  const availableDbOperations: DbOperationFunction[] = useMemo(() => {
    if (!selectedTableNode) return [];
    return getEntityDbOperations(selectedTableNode, allNodes);
  }, [selectedTableNode, allNodes]);

  const selectedOp = useMemo(() => {
    return availableDbOperations.find(
      (op) =>
        op.name === step.functionRef?.name || op.id === step.operationId,
    );
  }, [availableDbOperations, step.functionRef?.name, step.operationId]);

  const effectiveReturnType = useMemo(() => {
    if (!selectedOp) return undefined;
    const inferred =
      selectedOp.code && selectedOp.code.trim()
        ? inferDbOperationReturnType(selectedOp.code)
        : null;
    return inferred || selectedOp.returnType;
  }, [selectedOp]);

  const liveSignature = useMemo(() => {
    if (!selectedOp) return undefined;
    return (
      deriveDbFunctionSignature(selectedOp.name, selectedOp.params, effectiveReturnType) ||
      selectedOp.signature
    );
  }, [selectedOp, effectiveReturnType]);

  const handleOpenEntityConfig = () => {
    if (!selectedTableNode?.id) return;
    useBackendCanvasStore.getState().setActiveConfigItem({
      type: selectedTableNode.type as any,
      id: selectedTableNode.id,
      nodeId: selectedTableNode.id,
    });
  };

  const handleSelectTable = (tableId: string) => {
    const cleanTableId = tableId === "__none__" ? undefined : tableId;
    const targetNode = allEntityNodes.find((n) => n.id === cleanTableId);
    if (!targetNode) {
      onChange({
        ...step,
        tableNodeId: undefined,
        operationId: undefined,
        inputBindings: [],
      });
      return;
    }

    const ops = getEntityDbOperations(targetNode, allNodes);
    const defaultOp = ops[0];
    const tableLabel = targetNode.data?.label || targetNode.data?.tableRef || "table";
    const isRedis =
      targetNode.type === "redis_schema" ||
      targetNode.type === "redis-cache" ||
      targetNode.data?.dbType === "redis";

    const importPath = isRedis
      ? "@workspace/primary-redis-cache"
      : `@workspace/db/helpers/${toTableName(tableLabel)}`;

    const varName = defaultOp
      ? `${toVarName(defaultOp.name)}Result`
      : step.outputVariable || step.name || "dbResult";

    const nextBindings = computeDbOpBindings(defaultOp, targetNode, []);

    const liveSig = defaultOp
      ? deriveDbFunctionSignature(defaultOp.name, defaultOp.params, defaultOp.returnType) ||
        defaultOp.signature
      : undefined;

    const returnTypeStr = defaultOp
      ? (defaultOp.code && defaultOp.code.trim()
          ? inferDbOperationReturnType(defaultOp.code)
          : null) ||
        defaultOp.returnType ||
        "any"
      : undefined;

    onChange({
      ...step,
      tableNodeId: cleanTableId,
      operationId: defaultOp?.id,
      functionRef: defaultOp
        ? {
            name: defaultOp.name,
            importPath: importPath,
            signature: liveSig,
          }
        : step.functionRef,
      outputSchema: returnTypeStr
        ? [
            {
              name: "result",
              type: returnTypeStr,
              required: true,
            },
          ]
        : step.outputSchema,
      name: varName,
      outputVariable: varName,
      inputBindings: nextBindings,
    });
  };

  const handleSelectOperation = (opIdentifier: string) => {
    const op = availableDbOperations.find(
      (o) => o.id === opIdentifier || o.name === opIdentifier,
    );
    if (!op || !selectedTableNode) return;

    const tableLabel = selectedTableNode.data?.label || selectedTableNode.data?.tableRef || "table";
    const isRedis =
      selectedTableNode.type === "redis_schema" ||
      selectedTableNode.type === "redis-cache" ||
      selectedTableNode.data?.dbType === "redis";

    const importPath = isRedis
      ? "@workspace/primary-redis-cache"
      : `@workspace/db/helpers/${toTableName(tableLabel)}`;

    const varName = `${toVarName(op.name)}Result`;
    const nextBindings = computeDbOpBindings(op, selectedTableNode, step.inputBindings || []);

    const liveSig =
      deriveDbFunctionSignature(op.name, op.params, op.returnType) || op.signature;

    const returnTypeStr =
      (op.code && op.code.trim() ? inferDbOperationReturnType(op.code) : null) ||
      op.returnType ||
      "any";

    onChange({
      ...step,
      operationId: op.id,
      functionRef: {
        name: op.name,
        importPath: importPath,
        signature: liveSig,
      },
      outputSchema: [
        {
          name: "result",
          type: returnTypeStr,
          required: true,
        },
      ],
      name: varName,
      outputVariable: varName,
      inputBindings: nextBindings,
    });
  };

  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.04]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
          <Database size={13} />
          <span>Database & Table Operation</span>
        </div>
        {selectedOp && (
          <span className="text-[10px] font-mono text-blue-300 bg-blue-500/15 border border-blue-500/25 px-1.5 py-0.2 rounded font-medium">
            {selectedOp.name}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Database selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Database size={10} /> Database
          </Label>
          <Select
            value={selectedDbId}
            onValueChange={(v) => onChange({ ...step, databaseId: v })}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Select Database..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Databases
              </SelectItem>
              {dbNodes
                .filter((db) => Boolean(db && db.id && db.id.trim()))
                .map((db) => {
                  const isRedisInstance = db.type === "redis_instance";
                  return (
                    <SelectItem key={db.id} value={db.id} className="text-xs font-mono">
                      {isRedisInstance ? "⚡" : "🛢"}{" "}
                      {db.data?.label || (isRedisInstance ? "Redis Instance" : "Database")}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>

        {/* Table / Entity selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <TableIcon size={10} /> Table / Entity
          </Label>
          <Select
            value={step.tableNodeId || "__none__"}
            onValueChange={handleSelectTable}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Select Table..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs text-muted-foreground">
                Select a table...
              </SelectItem>
              {filteredEntityNodes
                .filter((t) => Boolean(t && t.id && t.id.trim()))
                .map((t) => {
                  const isRedis =
                    t.type === "redis_schema" ||
                    t.type === "redis-cache" ||
                    t.data?.dbType === "redis";
                  const icon = isRedis ? "⚡" : "📄";
                  const label =
                    t.data?.label ||
                    t.data?.tableRef ||
                    (isRedis ? "Redis Cache" : "Table");
                  return (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                      {icon} {label}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>

        {/* Operation / Function selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 size={10} /> Operation / Function
          </Label>
          <Select
            value={step.functionRef?.name || step.operationId || "__none__"}
            onValueChange={handleSelectOperation}
            disabled={!selectedTableNode || availableDbOperations.length === 0}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue
                placeholder={
                  !selectedTableNode
                    ? "Select table first"
                    : availableDbOperations.length === 0
                    ? "No operations"
                    : "Choose operation..."
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs text-muted-foreground">
                Select an operation...
              </SelectItem>
              {availableDbOperations
                .filter((op) => Boolean(op && op.name && op.name.trim()))
                .map((op) => (
                  <SelectItem key={op.id} value={op.name} className="text-xs font-mono">
                    <span className="font-semibold text-primary/90">{op.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5 uppercase">
                      ({op.kind})
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selected DB Operation Info Card */}
      {selectedOp && (
        <div className="flex flex-col gap-1.5 p-2 rounded bg-background/60 border border-blue-500/20 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-blue-300 font-semibold">
                {selectedOp.name}
              </span>
              <span className="text-[8px] font-mono px-1 py-0.2 rounded font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                {selectedOp.kind === "fetchByIndex" ? "INDEX" : selectedOp.kind}
              </span>
              {selectedOp.pagination?.enabled && (
                <span className="text-[8px] font-mono px-1 py-0.2 rounded font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  PAGE ({selectedOp.pagination.mode || "offset"})
                </span>
              )}

              {selectedTableNode && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[9px] text-blue-300 hover:text-blue-200 hover:underline ml-1 cursor-pointer"
                  onClick={handleOpenEntityConfig}
                  title="Configure Entity & Functions"
                >
                  <ExternalLink size={9} />
                  <span>Configure Function</span>
                </button>
              )}
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/70">
              import from &quot;{step.functionRef?.importPath || `@workspace/db/helpers/${toTableName(selectedTableNode?.data?.label || selectedTableNode?.data?.tableRef || "table")}`}&quot;
            </span>
          </div>

          {liveSignature && (
            <div className="text-[10px] font-mono text-muted-foreground/90 truncate">
              {liveSignature}
            </div>
          )}

          {selectedOp.description && (
            <p className="text-[10px] text-muted-foreground/80 italic">
              {selectedOp.description}
            </p>
          )}

          {/* Return Type Badge */}
          {effectiveReturnType && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-0.5">
              <span className="text-[9px] text-muted-foreground/70">Returns:</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {effectiveReturnType}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Expected arguments preview & quick mapping buttons */}
      {selectedOp && expectedArgs && expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-blue-500/15">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>Expected args:</span>
              <div className="flex flex-wrap gap-1">
                {expectedArgs.map((arg) => (
                  <span
                    key={arg.name}
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-background/80 border border-border/50 text-foreground/80"
                    title={`Type: ${arg.type}${arg.required ? " (required)" : ""}`}
                  >
                    {arg.name}
                    <span className="text-muted-foreground/60 text-[8px] ml-0.5">
                      :{arg.type}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
                onClick={onAutoMapArguments}
                title="Smart map missing arguments from route params, query, request body, and prior steps while preserving existing bindings"
              >
                <Sparkles size={10} />
                Auto-map arguments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Argument Bindings (Inputs for this DB Operation) */}
      {children}

      {/* Advanced function settings toggle */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-blue-500/15">
        <button
          type="button"
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors self-start"
          onClick={onToggleAdvancedSettings}
        >
          <Settings size={10} />
          <span>{showAdvancedSettings ? "Hide" : "Show"} Advanced Import & Function Overrides</span>
        </button>

        {showAdvancedSettings && (
          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/20 border border-border/40">
            <div className="flex flex-col gap-1">
              <Label className="text-[9px] text-muted-foreground">Compiled Function Name</Label>
              <BufferedInput
                className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                value={step.functionRef?.name ?? ""}
                onCommit={(val) =>
                  onChange({
                    ...step,
                    functionRef: {
                      ...(step.functionRef ?? { importPath: "" }),
                      name: val,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[9px] text-muted-foreground">Compiled Import Path</Label>
              <BufferedInput
                className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                value={step.functionRef?.importPath ?? ""}
                onCommit={(val) =>
                  onChange({
                    ...step,
                    functionRef: {
                      ...(step.functionRef ?? { name: "" }),
                      importPath: val,
                    },
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
