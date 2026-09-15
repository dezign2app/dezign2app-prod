"use client";

import React, { useMemo, useEffect } from "react";
import {
  Database,
  Table as TableIcon,
  Code2,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  BackendNode,
  BackendEdge,
  DbOperationFunction,
} from "@workspace/canvas/types";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toTableName, toVarName } from "@/lib/compiler/utils";
import { Label } from "@workspace/ui/components/label";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { PipelineStepDraft, PipelineStepCacheMiss, ExpectedArg, StepBinding, AvailableSource } from "./types";
import { cn } from "@workspace/ui/lib/utils";
import { ArgumentBindingsSection } from "./ArgumentBindingsSection";
import { isPathMatch } from "./utils";

export interface RedisCacheMissSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges?: BackendEdge[];
  availableSources?: AvailableSource[];
  onChange: (updated: PipelineStepDraft) => void;
}

function computeFallbackExpectedArgs(
  tableNode: BackendNode | undefined,
  op: DbOperationFunction | undefined,
): ExpectedArg[] {
  if (!tableNode) return [];

  if (op?.params && op.params.length > 0) {
    return op.params
      .filter((p) => p && p.name && p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        type: p.type || "string",
        required: p.required !== false,
      }));
  }

  const columns = tableNode.data?.columns || [];
  const pkCol = columns.find((c) => c.isPrimaryKey) || columns[0];
  const pkName = pkCol?.name || "id";
  const pkType = pkCol?.type || "string";
  const writableCols = columns.filter((c) => !c.isPrimaryKey && c.name && c.name.trim());

  const opName = (op?.name || "").toLowerCase();
  if (opName.includes("create") || opName.includes("insert")) {
    return writableCols.map((c) => ({
      name: toVarName(c.name),
      type: c.type || "string",
      required: c.isNotNull,
    }));
  }
  if (opName.includes("update")) {
    return [
      { name: toVarName(pkName), type: pkType, required: true },
      ...writableCols.map((c) => ({
        name: toVarName(c.name),
        type: c.type || "string",
        required: false,
      })),
    ];
  }
  if (opName.includes("byid") || opName.includes("findone") || opName.includes("delete")) {
    return [{ name: toVarName(pkName), type: pkType, required: true }];
  }

  return writableCols.map((c) => ({
    name: toVarName(c.name),
    type: c.type || "string",
    required: false,
  }));
}

export const RedisCacheMissSection: React.FC<RedisCacheMissSectionProps> = ({
  step,
  allNodes,
  allEdges = [],
  availableSources = [],
  onChange,
}) => {
  const cacheMiss = step.cacheMiss;
  const isEnabled = Boolean(cacheMiss?.enabled);
  const action = cacheMiss?.action || "fallback_db";

  // Filter relational database tables (non-Redis entities)
  const relationalTableNodes = useMemo(() => {
    return allNodes.filter(
      (n) =>
        (n.type === "entity" || n.type === "db_ref") &&
        n.data?.dbType !== "redis",
    );
  }, [allNodes]);

  // Selected fallback table node
  const selectedTableNode = useMemo(() => {
    if (!cacheMiss?.tableNodeId) return undefined;
    return relationalTableNodes.find((n) => n.id === cacheMiss.tableNodeId);
  }, [relationalTableNodes, cacheMiss?.tableNodeId]);

  // Operations available on the selected table
  const availableOps: DbOperationFunction[] = useMemo(() => {
    if (!selectedTableNode) return [];
    return getEntityDbOperations(selectedTableNode, allNodes);
  }, [selectedTableNode, allNodes]);

  const selectedOp = useMemo(() => {
    if (!availableOps.length) return undefined;
    return (
      availableOps.find(
        (op) =>
          op.name === cacheMiss?.functionRef?.name ||
          op.id === cacheMiss?.operationId,
      ) || availableOps[0]
    );
  }, [availableOps, cacheMiss?.functionRef?.name, cacheMiss?.operationId]);

  const fallbackExpectedArgs = useMemo((): ExpectedArg[] => {
    return computeFallbackExpectedArgs(selectedTableNode, selectedOp);
  }, [selectedTableNode, selectedOp]);

  const autoMapBindings = (
    expected: ExpectedArg[],
    existing: StepBinding[] = [],
  ): StepBinding[] => {
    const newBindings: StepBinding[] = [];

    for (const arg of expected) {
      const alreadyBound = existing.find((b) => b.argName === arg.name);
      if (alreadyBound) {
        newBindings.push(alreadyBound);
        continue;
      }

      // 1. Check parent step bindings (e.g. if the Redis step already has an 'id' or 'key' mapped)
      const parentBinding = step.inputBindings?.find(
        (b) =>
          b.argName.toLowerCase() === arg.name.toLowerCase() ||
          ("field" in b.source &&
            typeof b.source.field === "string" &&
            b.source.field.toLowerCase() === arg.name.toLowerCase()) ||
          (arg.name.toLowerCase().includes("id") && b.argName.toLowerCase().includes("id")),
      );
      if (parentBinding) {
        newBindings.push({
          argName: arg.name,
          source: { ...parentBinding.source },
        });
        continue;
      }

      // 2. Try to find match in availableSources
      let matchedSource: StepBinding["source"] | undefined;
      for (const src of availableSources) {
        const match = src.paths.find((p) => isPathMatch(p.path, arg.name));
        if (match) {
          if (src.kind === "step_output" && src.stepId) {
            matchedSource = { kind: "step_output", stepId: src.stepId, field: match.path };
          } else if (
            src.kind === "req_body" ||
            src.kind === "req_params" ||
            src.kind === "req_query" ||
            src.kind === "req_headers"
          ) {
            matchedSource = { kind: src.kind, field: match.path };
          }
          break;
        }
      }

      newBindings.push({
        argName: arg.name,
        source: matchedSource || { kind: "req_body", field: arg.name },
      });
    }

    return newBindings;
  };

  const updateCacheMiss = (patch: Partial<PipelineStepCacheMiss>) => {
    const next: PipelineStepCacheMiss = {
      enabled: true,
      action: action,
      statusCode: cacheMiss?.statusCode ?? 404,
      errorMessage: cacheMiss?.errorMessage ?? "Record not found",
      fallbackValue: cacheMiss?.fallbackValue ?? "null",
      writeBackToCache: cacheMiss?.writeBackToCache ?? true,
      ttlSeconds: cacheMiss?.ttlSeconds,
      databaseId: cacheMiss?.databaseId,
      tableNodeId: cacheMiss?.tableNodeId,
      operationId: cacheMiss?.operationId,
      functionRef: cacheMiss?.functionRef,
      inputBindings: cacheMiss?.inputBindings ?? [],
      ...patch,
    };
    onChange({
      ...step,
      cacheMiss: next,
    });
  };

  const handleAddBinding = () => {
    const existing = cacheMiss?.inputBindings || [];
    const unboundArg = fallbackExpectedArgs.find(
      (arg) => !existing.some((b) => b.argName === arg.name),
    );
    const argName = unboundArg ? unboundArg.name : `arg${existing.length + 1}`;
    const nextBindings: StepBinding[] = [
      ...existing,
      {
        argName,
        source: { kind: "req_body", field: argName },
      },
    ];
    updateCacheMiss({ inputBindings: nextBindings });
  };

  const handleUpdateBinding = (index: number, updated: StepBinding) => {
    const existing = [...(cacheMiss?.inputBindings || [])];
    existing[index] = updated;
    updateCacheMiss({ inputBindings: existing });
  };

  const handleRemoveBinding = (index: number) => {
    const existing = [...(cacheMiss?.inputBindings || [])];
    existing.splice(index, 1);
    updateCacheMiss({ inputBindings: existing });
  };

  const handleAutoMapArguments = () => {
    if (fallbackExpectedArgs.length === 0) return;
    const mapped = autoMapBindings(
      fallbackExpectedArgs,
      cacheMiss?.inputBindings || [],
    );
    updateCacheMiss({ inputBindings: mapped });
  };

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Default to first table if available
      const defaultTable = relationalTableNodes[0];
      let defaultOp: DbOperationFunction | undefined;
      let importPath: string | undefined;
      let initialBindings: StepBinding[] = [];

      if (defaultTable) {
        const ops = getEntityDbOperations(defaultTable, allNodes);
        defaultOp =
          ops.find(
            (o) =>
              o.name.toLowerCase().includes("byid") ||
              o.name.toLowerCase().includes("findone"),
          ) || ops[0];
        const tableLabel =
          defaultTable.data?.label || defaultTable.data?.tableRef || "table";
        importPath = `@workspace/db/helpers/${toTableName(tableLabel)}`;
        const expected = computeFallbackExpectedArgs(defaultTable, defaultOp);
        initialBindings = autoMapBindings(expected, []);
      }

      updateCacheMiss({
        enabled: true,
        action: "fallback_db",
        tableNodeId: defaultTable?.id,
        operationId: defaultOp?.id,
        functionRef: defaultOp
          ? {
              name: defaultOp.name,
              importPath: importPath || "@workspace/db",
              signature: defaultOp.signature,
            }
          : undefined,
        inputBindings: initialBindings,
        writeBackToCache: true,
      });
    } else {
      onChange({
        ...step,
        cacheMiss: {
          ...(step.cacheMiss || { action: "fallback_db" }),
          enabled: false,
        },
      });
    }
  };

  const handleSelectTable = (tableId: string) => {
    const cleanId = tableId === "__none__" ? undefined : tableId;
    const target = relationalTableNodes.find((t) => t.id === cleanId);
    if (!target) {
      updateCacheMiss({
        tableNodeId: undefined,
        operationId: undefined,
        functionRef: undefined,
        inputBindings: [],
      });
      return;
    }

    const ops = getEntityDbOperations(target, allNodes);
    const readOp =
      ops.find(
        (o) =>
          o.name.toLowerCase().includes("byid") ||
          o.name.toLowerCase().includes("findone"),
      ) || ops[0];
    const tableLabel = target.data?.label || target.data?.tableRef || "table";
    const importPath = `@workspace/db/helpers/${toTableName(tableLabel)}`;
    const expected = computeFallbackExpectedArgs(target, readOp);
    const initialBindings = autoMapBindings(expected, []);

    updateCacheMiss({
      tableNodeId: cleanId,
      operationId: readOp?.id,
      functionRef: readOp
        ? {
            name: readOp.name,
            importPath,
            signature: readOp.signature,
          }
        : undefined,
      inputBindings: initialBindings,
    });
  };

  const handleSelectOperation = (opName: string) => {
    const op = availableOps.find((o) => o.name === opName || o.id === opName);
    if (!op || !selectedTableNode) return;
    const tableLabel =
      selectedTableNode.data?.label ||
      selectedTableNode.data?.tableRef ||
      "table";
    const importPath = `@workspace/db/helpers/${toTableName(tableLabel)}`;
    const expected = computeFallbackExpectedArgs(selectedTableNode, op);
    const initialBindings = autoMapBindings(expected, cacheMiss?.inputBindings || []);

    updateCacheMiss({
      operationId: op.id,
      functionRef: {
        name: op.name,
        importPath,
        signature: op.signature,
      },
      inputBindings: initialBindings,
    });
  };

  const badgeText = useMemo(() => {
    if (!isEnabled) return "Disabled (Proceed with null)";
    if (action === "fallback_db") {
      const tableName = selectedTableNode?.data?.label || "Database";
      return `Cache-Aside (${tableName})`;
    }
    if (action === "early_return") {
      return `Return ${cacheMiss?.statusCode || 404}`;
    }
    if (action === "fallback_value") {
      return `Fallback: ${cacheMiss?.fallbackValue || "null"}`;
    }
    if (action === "throw_error") {
      return "Fail & Throw";
    }
    return "Configured";
  }, [isEnabled, action, selectedTableNode, cacheMiss]);

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
      {/* Header / Toggle */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={`cache-miss-toggle-${step.id}`}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <Checkbox
            id={`cache-miss-toggle-${step.id}`}
            checked={isEnabled}
            onCheckedChange={handleToggle}
          />
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
            <Layers size={13} className="text-amber-500" />
            <span>Cache Miss Handling</span>
          </div>
        </label>

        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.2 rounded border transition-colors",
            isEnabled
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-muted/40 text-muted-foreground border-border/40",
          )}
        >
          {badgeText}
        </span>
      </div>

      {isEnabled && (
        <div className="flex flex-col gap-2.5 p-2.5 rounded-lg border border-border/60 bg-background/50 mt-1">
          {/* Action Selector */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">
              On Cache Miss (Key Not Found)
            </Label>
            <Select
              value={action}
              onValueChange={(val: any) => updateCacheMiss({ action: val })}
            >
              <SelectTrigger className="h-7 text-xs bg-background border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fallback_db" className="text-xs">
                  🗄️ Fetch from Database (Cache-Aside Pattern)
                </SelectItem>
                <SelectItem value="early_return" className="text-xs">
                  🚪 Early Return (404 / Custom Response)
                </SelectItem>
                <SelectItem value="fallback_value" className="text-xs">
                  📦 Use Default Fallback Value
                </SelectItem>
                <SelectItem value="throw_error" className="text-xs">
                  ⚠️ Fail & Stop (Throw Error)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action 1: Database Fallback (Cache-Aside) */}
          {action === "fallback_db" && (
            <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
              {/* Table Selector */}
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <TableIcon size={10} /> Fallback Database Entity / Table
                </Label>
                <Select
                  value={cacheMiss?.tableNodeId || "__none__"}
                  onValueChange={handleSelectTable}
                >
                  <SelectTrigger className="h-7 text-xs font-mono bg-background border-border/60">
                    <SelectValue placeholder="Select Database Table..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs text-muted-foreground">
                      Select table...
                    </SelectItem>
                    {relationalTableNodes.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs font-mono">
                        📄 {t.data?.label || t.data?.tableRef || "Table"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operation Selector */}
              {selectedTableNode && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Code2 size={10} /> Query Operation
                  </Label>
                  <Select
                    value={cacheMiss?.functionRef?.name || cacheMiss?.operationId || "__none__"}
                    onValueChange={handleSelectOperation}
                  >
                    <SelectTrigger className="h-7 text-xs font-mono bg-background border-border/60">
                      <SelectValue placeholder="Select Query Function..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOps.map((op) => (
                        <SelectItem key={op.id} value={op.name} className="text-xs font-mono">
                          <span className="font-semibold text-foreground">{op.name}</span>
                          <span className="text-[9px] text-muted-foreground ml-1.5 uppercase">
                            ({op.kind})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Fallback DB Query Arguments */}
              {selectedTableNode && (
                <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
                  {fallbackExpectedArgs.length > 0 && (
                    <div className="flex flex-col gap-1 p-2 rounded bg-muted/20 border border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                          <Sparkles size={11} className="text-amber-500" />
                          Expected Query Arguments
                        </span>
                        <button
                          type="button"
                          className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                          onClick={handleAutoMapArguments}
                        >
                          Auto-Map
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {fallbackExpectedArgs.map((arg) => (
                          <span
                            key={arg.name}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background/80 border border-border/40 text-foreground/80"
                          >
                            {arg.name}
                            {arg.required && <span className="text-destructive">*</span>}
                            <span className="text-muted-foreground ml-1">({arg.type})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <ArgumentBindingsSection
                    bindings={cacheMiss?.inputBindings || []}
                    expectedArgs={fallbackExpectedArgs}
                    availableSources={availableSources}
                    onAddBinding={handleAddBinding}
                    onUpdateBinding={handleUpdateBinding}
                    onRemoveBinding={handleRemoveBinding}
                    onAutoMapArguments={handleAutoMapArguments}
                  />
                </div>
              )}

              {/* Cache Write-back toggle */}
              <div className="flex items-center justify-between p-1.5 rounded bg-muted/20 border border-border/40 mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium text-foreground">
                    Repopulate Redis Cache on Miss
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    Automatically writes the fetched DB record back into Redis for next time.
                  </span>
                </div>
                <Checkbox
                  checked={cacheMiss?.writeBackToCache ?? true}
                  onCheckedChange={(checked) =>
                    updateCacheMiss({ writeBackToCache: Boolean(checked) })
                  }
                />
              </div>

              {/* Optional TTL override */}
              {cacheMiss?.writeBackToCache && (
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock size={10} /> Write-back TTL (seconds)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Default (Schema TTL)"
                    value={cacheMiss?.ttlSeconds ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      updateCacheMiss({
                        ttlSeconds: isNaN(val) ? undefined : val,
                      });
                    }}
                    className="h-6 w-28 text-right font-mono text-[11px] bg-background"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action 2: Early Return (404) */}
          {action === "early_return" && (
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Status Code</Label>
                <Input
                  type="number"
                  value={cacheMiss?.statusCode ?? 404}
                  onChange={(e) =>
                    updateCacheMiss({ statusCode: parseInt(e.target.value) || 404 })
                  }
                  className="h-7 text-xs font-mono bg-background"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Error Message</Label>
                <Input
                  value={cacheMiss?.errorMessage ?? "Record not found"}
                  onChange={(e) => updateCacheMiss({ errorMessage: e.target.value })}
                  placeholder="Record not found in cache"
                  className="h-7 text-xs bg-background"
                />
              </div>
            </div>
          )}

          {/* Action 3: Fallback Default Value */}
          {action === "fallback_value" && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border/30">
              <Label className="text-[10px] text-muted-foreground">Fallback Default Value</Label>
              <Input
                value={cacheMiss?.fallbackValue ?? "null"}
                onChange={(e) => updateCacheMiss({ fallbackValue: e.target.value })}
                placeholder="e.g. null, {}, or []"
                className="h-7 text-xs font-mono bg-background"
              />
            </div>
          )}

          {/* Action 4: Throw Error */}
          {action === "throw_error" && (
            <div className="flex flex-col gap-1 pt-1 border-t border-border/30">
              <Label className="text-[10px] text-muted-foreground">Exception Message</Label>
              <Input
                value={cacheMiss?.errorMessage ?? "Cache miss: record not found"}
                onChange={(e) => updateCacheMiss({ errorMessage: e.target.value })}
                placeholder="Cache miss: record not found"
                className="h-7 text-xs bg-background"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
