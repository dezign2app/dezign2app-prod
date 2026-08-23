"use client";

import React, { useMemo } from "react";
import {
  BackendNode,
  BackendEdge,
  DbOperationFunction,
} from "@workspace/canvas/types";

import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toTableName, toVarName } from "@/lib/compiler/utils";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Database, Table as TableIcon, Code2, Settings2, Sparkles } from "lucide-react";
import { PipelineStepDraft, ExpectedArg } from "./types";

export interface DbOperationStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  expectedArgs: ExpectedArg[];
  selectedDbId: string;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments: () => void;
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

  const handleSelectTable = (tableId: string) => {
    const cleanTableId = tableId === "__none__" ? undefined : tableId;
    const targetNode = allEntityNodes.find((n) => n.id === cleanTableId);
    if (!targetNode) {
      onChange({
        ...step,
        tableNodeId: undefined,
        operationId: undefined,
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

    const varName = defaultOp ? `${toVarName(defaultOp.name)}Result` : step.outputVariable;

    onChange({
      ...step,
      tableNodeId: cleanTableId,
      operationId: defaultOp?.id,
      functionRef: defaultOp
        ? {
            name: defaultOp.name,
            importPath: importPath,
            signature: defaultOp.signature,
          }
        : step.functionRef,
      name: varName,
      outputVariable: varName,
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

    onChange({
      ...step,
      operationId: op.id,
      functionRef: {
        name: op.name,
        importPath: importPath,
        signature: op.signature,
      },
      name: varName,
      outputVariable: varName,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
        <Database size={13} />
        <span>Database & Table Operation</span>
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
              {dbNodes.map((db) => {
                const isRedisInstance = db.type === "redis_instance";
                return (
                  <SelectItem key={db.id} value={db.id} className="text-xs font-mono">
                    {isRedisInstance ? "🔴" : "🛢"}{" "}
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
              {filteredEntityNodes.map((t) => {
                const isRedis =
                  t.type === "redis_schema" ||
                  t.type === "redis-cache" ||
                  t.data?.dbType === "redis";
                const icon = isRedis ? "🔴" : "📄";
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
              {availableDbOperations.map((op) => (
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

      {/* Expected arguments preview & quick mapping buttons */}
      {selectedOp && expectedArgs.length > 0 && (
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

      {/* Advanced function settings toggle */}
      <div className="flex flex-col gap-1.5 pt-1">
        <button
          type="button"
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors self-start"
          onClick={onToggleAdvancedSettings}
        >
          <Settings2 size={10} />
          <span>{showAdvancedSettings ? "Hide" : "Show"} Advanced Import & Function Overrides</span>
        </button>

        {showAdvancedSettings && (
          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-muted/20 border border-border/40">
            <div className="flex flex-col gap-1">
              <Label className="text-[9px] text-muted-foreground">Compiled Function Name</Label>
              <Input
                className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                value={step.functionRef?.name ?? ""}
                onChange={(e) =>
                  onChange({
                    ...step,
                    functionRef: {
                      ...(step.functionRef ?? { importPath: "" }),
                      name: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[9px] text-muted-foreground">Compiled Import Path</Label>
              <Input
                className="h-6 text-[11px] font-mono bg-background/60 border-border/60"
                value={step.functionRef?.importPath ?? ""}
                onChange={(e) =>
                  onChange({
                    ...step,
                    functionRef: {
                      ...(step.functionRef ?? { name: "" }),
                      importPath: e.target.value,
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
