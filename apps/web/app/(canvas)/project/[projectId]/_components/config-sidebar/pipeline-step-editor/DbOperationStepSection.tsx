"use client";

import React, { useMemo } from "react";
import {
  BackendNode,
  BackendEdge,
  DbOperationFunction,
  EntityColumn,
  Endpoint,
} from "@workspace/canvas/types";

import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toTableName, toVarName } from "@/lib/compiler/utils";
import { BufferedInput } from "./BufferedInput";
import { Label } from "@workspace/ui/components/label";
import { StepCombobox, StepComboboxOption } from "./StepCombobox";
import { Database, Table as TableIcon, Code2, Settings, Sparkles, ExternalLink, CheckCircle2 } from "lucide-react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  inferDbOperationReturnType,
  deriveDbFunctionSignature,
  getDbOperationExpectedArgs,
  computeDbOpBindings,
} from "@/lib/utils/entityOperationsHelper";
import { PipelineStepDraft, ExpectedArg, StepBinding, AvailableSource } from "./types";

export { computeDbOpBindings };

export function isDbOperationPaginated(
  op?: DbOperationFunction | null,
  expectedArgs?: ExpectedArg[],
): boolean {
  if (!op) return false;
  const opNameLower = (op.name || "").toLowerCase();
  return (
    Boolean(op.pagination?.enabled) ||
    op.kind === "findAll" ||
    opNameLower.includes("findall") ||
    Boolean(
      op.params?.some(
        (p) => p.name.toLowerCase() === "limit" || p.name.toLowerCase() === "offset",
      ),
    ) ||
    Boolean(
      (expectedArgs || []).some(
        (a) => a.name.toLowerCase() === "limit" || a.name.toLowerCase() === "offset",
      ),
    )
  );
}

export function isPaginationNeededByOtherSteps(
  currentStepId: string | undefined,
  steps: PipelineStepDraft[] = [],
  allNodes: BackendNode[] = [],
): boolean {
  for (const s of steps) {
    if (currentStepId && s.id === currentStepId) continue;
    if (s.enabled === false) continue;

    // 1. Check if step explicitly maps limit or offset from query
    const hasQueryBinding = s.inputBindings?.some((b) => {
      if (b.source.kind === "req_query") {
        const field = b.source.field?.trim().toLowerCase();
        return field === "limit" || field === "offset";
      }
      return false;
    });
    if (hasQueryBinding) return true;

    // 2. Check if step is a paginated DB operation
    if (s.type === "db_operation" && s.tableNodeId) {
      const tableNode = allNodes.find((n) => n.id === s.tableNodeId);
      if (tableNode) {
        const ops = getEntityDbOperations(tableNode, allNodes);
        const op = ops.find(
          (o) => o.id === s.operationId || o.name === s.functionRef?.name,
        );
        if (op && isDbOperationPaginated(op)) {
          return true;
        }
      }
    }
  }

  return false;
}

export interface DbOperationStepSectionProps {
  step: PipelineStepDraft;
  allSteps?: PipelineStepDraft[];
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  expectedArgs?: ExpectedArg[];
  availableSources?: AvailableSource[];
  selectedDbId: string;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
  endpoint?: Endpoint;
  onEndpointChange?: (changes: Partial<Endpoint>) => void;
  children?: React.ReactNode;
}

export const DbOperationStepSection = ({
  step,
  allSteps,
  allNodes,
  allEdges,
  expectedArgs,
  availableSources = [],
  selectedDbId,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  onChange,
  onAutoMapArguments,
  endpoint,
  onEndpointChange,
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
      allNodes.filter((n) => {
        if (
          n.type === "entity" ||
          n.type === "redis_schema" ||
          n.type === "redis-cache"
        ) {
          return true;
        }
        if (n.type === "db_ref") {
          // Only show standalone db_ref if there is no master entity node for it
          const hasMasterEntity = Boolean(
            n.data?.tableRef &&
              allNodes.some(
                (other) =>
                  other.id === n.data.tableRef && other.type === "entity",
              ),
          );
          return !hasMasterEntity;
        }
        return false;
      }),
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

  const selectedTableNode = useMemo(() => {
    const found = allNodes.find((n) => n.id === step.tableNodeId);
    if (found?.type === "db_ref" && found.data?.tableRef) {
      return allNodes.find((n) => n.id === found.data!.tableRef) || found;
    }
    return found;
  }, [allNodes, step.tableNodeId]);

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

  const lastSyncedOpRef = React.useRef<string | null>(null);

  const syncPaginationQueryParams = React.useCallback(
    (op?: DbOperationFunction | null, force: boolean = false) => {
      if (!op || !endpoint || !endpoint.id) return;
      if (endpoint.type === "EVENT_CONSUMER") return;

      const syncKey = `${endpoint.id}:${op.id || op.name}`;
      if (!force && lastSyncedOpRef.current === syncKey) return;

      if (!isDbOperationPaginated(op, expectedArgs)) return;

      const currentQueryParams = endpoint.queryParams || [];
      const hasLimit = currentQueryParams.some(
        (qp) => qp.name.trim().toLowerCase() === "limit",
      );
      const hasOffset = currentQueryParams.some(
        (qp) => qp.name.trim().toLowerCase() === "offset",
      );

      if (hasLimit && hasOffset) {
        lastSyncedOpRef.current = syncKey;
        return;
      }

      const nextQueryParams = [...currentQueryParams];
      const defaultLimitVal = String(
        op.pagination?.defaultLimit ||
          op.params?.find((p) => p.name.toLowerCase() === "limit")?.defaultValue ||
          20,
      );
      const defaultOffsetVal = String(
        op.params?.find((p) => p.name.toLowerCase() === "offset")?.defaultValue ||
          0,
      );

      const opNameLower = (op.name || "").toLowerCase();
      const hasLimitArg =
        Boolean(op.pagination?.enabled) ||
        op.kind === "findAll" ||
        opNameLower.includes("findall") ||
        Boolean(op.params?.some((p) => p.name.toLowerCase() === "limit")) ||
        Boolean((expectedArgs || []).some((a) => a.name.toLowerCase() === "limit"));

      const hasOffsetArg =
        Boolean(op.pagination?.enabled) ||
        op.kind === "findAll" ||
        opNameLower.includes("findall") ||
        Boolean(op.params?.some((p) => p.name.toLowerCase() === "offset")) ||
        Boolean((expectedArgs || []).some((a) => a.name.toLowerCase() === "offset"));

      if (hasLimitArg && !hasLimit) {
        nextQueryParams.push({
          id: `qp-limit-${Date.now()}`,
          name: "limit",
          type: "number",
          required: false,
          defaultValue: defaultLimitVal,
          description: "Page size",
        });
      }

      if (hasOffsetArg && !hasOffset) {
        nextQueryParams.push({
          id: `qp-offset-${Date.now() + 1}`,
          name: "offset",
          type: "number",
          required: false,
          defaultValue: defaultOffsetVal,
          description: "Offset / skip count",
        });
      }

      lastSyncedOpRef.current = syncKey;
      if (onEndpointChange) {
        onEndpointChange({ queryParams: nextQueryParams });
      } else {
        useBackendCanvasStore.getState().updateEndpoint(endpoint.id, {
          queryParams: nextQueryParams,
        });
      }
    },
    [endpoint, onEndpointChange, expectedArgs],
  );

  const prunePaginationQueryParamsIfUnused = React.useCallback(
    (op?: DbOperationFunction | null) => {
      if (!endpoint || !endpoint.id) return;
      if (endpoint.type === "EVENT_CONSUMER") return;

      const stepsToCheck = allSteps || endpoint.pipelineSteps || [];
      const isNeededElsewhere = isPaginationNeededByOtherSteps(
        step.id,
        stepsToCheck,
        allNodes,
      );

      if (isNeededElsewhere) return;

      const currentQueryParams = endpoint.queryParams || [];
      const nextQueryParams = currentQueryParams.filter((qp) => {
        const name = (qp.name || "").trim().toLowerCase();
        return name !== "limit" && name !== "offset";
      });

      if (nextQueryParams.length !== currentQueryParams.length) {
        lastSyncedOpRef.current = null;
        if (onEndpointChange) {
          onEndpointChange({ queryParams: nextQueryParams });
        } else {
          useBackendCanvasStore.getState().updateEndpoint(endpoint.id, {
            queryParams: nextQueryParams,
          });
        }
      }
    },
    [endpoint, onEndpointChange, allSteps, step.id, allNodes],
  );

  const prevOpRef = React.useRef<string | null>(null);

  // Auto-sync or prune pagination parameters when operation changes
  React.useEffect(() => {
    if (!endpoint) return;
    const currentOpKey = selectedOp ? (selectedOp.id || selectedOp.name) : null;
    const prevOpKey = prevOpRef.current;
    prevOpRef.current = currentOpKey;

    if (selectedOp && isDbOperationPaginated(selectedOp, expectedArgs)) {
      syncPaginationQueryParams(selectedOp);
    } else if (prevOpKey && (!selectedOp || !isDbOperationPaginated(selectedOp, expectedArgs))) {
      // Switched away from a paginated operation
      prunePaginationQueryParamsIfUnused(selectedOp);
    }
  }, [
    selectedOp,
    endpoint,
    syncPaginationQueryParams,
    prunePaginationQueryParamsIfUnused,
    expectedArgs,
  ]);

  const lastPopulatedOpRef = React.useRef<string | null>(null);

  // Automatically populate argument bindings if the DB operation has expected parameters
  // and the step currently has NO bindings yet.
  React.useEffect(() => {
    if (!selectedOp || !selectedTableNode) return;
    const opKey = selectedOp.id || selectedOp.name;
    if (
      lastPopulatedOpRef.current !== opKey &&
      (!step.inputBindings || step.inputBindings.length === 0)
    ) {
      lastPopulatedOpRef.current = opKey;
      const initial = computeDbOpBindings(
        selectedOp,
        selectedTableNode,
        [],
        availableSources,
        { name: selectedOp.name, signature: liveSignature },
      );
      if (initial.length > 0) {
        onChange({
          ...step,
          inputBindings: initial,
        });
      }
    }
  }, [
    selectedOp?.id,
    selectedOp?.name,
    selectedTableNode?.id,
    step.inputBindings?.length,
  ]);

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
    let targetNode = allNodes.find((n) => n.id === cleanTableId) || allEntityNodes.find((n) => n.id === cleanTableId);
    if (targetNode?.type === "db_ref" && targetNode.data?.tableRef) {
      targetNode = allNodes.find((n) => n.id === targetNode!.data!.tableRef) || targetNode;
    }
    if (!targetNode) {
      onChange({
        ...step,
        tableNodeId: undefined,
        operationId: undefined,
        inputBindings: [],
      });
      prunePaginationQueryParamsIfUnused(null);
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

    const liveSig = defaultOp
      ? deriveDbFunctionSignature(defaultOp.name, defaultOp.params, defaultOp.returnType) ||
        defaultOp.signature
      : undefined;

    const nextBindings = computeDbOpBindings(
      defaultOp,
      targetNode,
      [],
      availableSources,
      defaultOp ? { name: defaultOp.name, signature: liveSig } : undefined,
    );
    lastPopulatedOpRef.current = defaultOp?.id || defaultOp?.name || null;

    const returnTypeStr = defaultOp
      ? (defaultOp.code && defaultOp.code.trim()
          ? inferDbOperationReturnType(defaultOp.code)
          : null) ||
        defaultOp.returnType ||
        "any"
      : undefined;

    const isArrayOp = Boolean(
      defaultOp &&
        (defaultOp.kind === "findAll" ||
          (defaultOp.name || "").toLowerCase().includes("findall") ||
          (returnTypeStr && (returnTypeStr.includes("[]") || returnTypeStr.includes("Array<")))),
    );

    const schemaFields = isArrayOp
      ? []
      : defaultOp?.kind === "delete"
      ? [
          { name: "success", type: "boolean", required: true },
          { name: "message", type: "string", required: true },
        ]
      : (targetNode.data?.columns || []).map((c: any) => ({
          name: c.name,
          type: c.type || "string",
          required: Boolean(c.isPrimaryKey || c.isNotNull),
        }));

    onChange({
      ...step,
      dbRefNodeId: undefined,
      tableNodeId: targetNode.id,
      operationId: defaultOp?.id,
      functionRef: defaultOp
        ? {
            name: defaultOp.name,
            importPath: importPath,
            signature: liveSig,
            returnIsArray: isArrayOp,
          }
        : step.functionRef,
      outputSchema: schemaFields,
      name: varName,
      outputVariable: varName,
      inputBindings: nextBindings,
    });
    if (defaultOp) {
      if (isDbOperationPaginated(defaultOp)) {
        syncPaginationQueryParams(defaultOp);
      } else {
        prunePaginationQueryParamsIfUnused(defaultOp);
      }
    } else {
      prunePaginationQueryParamsIfUnused(null);
    }
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

    const liveSig =
      deriveDbFunctionSignature(op.name, op.params, op.returnType) || op.signature;

    const nextBindings = computeDbOpBindings(
      op,
      selectedTableNode,
      step.inputBindings || [],
      availableSources,
      { name: op.name, signature: liveSig },
    );
    lastPopulatedOpRef.current = op.id || op.name;

    const returnTypeStr =
      (op.code && op.code.trim() ? inferDbOperationReturnType(op.code) : null) ||
      op.returnType ||
      "any";

    const isArrayOp =
      op.kind === "findAll" ||
      (op.name || "").toLowerCase().includes("findall") ||
      returnTypeStr.includes("[]") ||
      returnTypeStr.includes("Array<");

    const schemaFields = isArrayOp
      ? []
      : op.kind === "delete"
      ? [
          { name: "success", type: "boolean", required: true },
          { name: "message", type: "string", required: true },
        ]
      : (selectedTableNode.data?.columns || []).map((c: any) => ({
          name: c.name,
          type: c.type || "string",
          required: Boolean(c.isPrimaryKey || c.isNotNull),
        }));

    onChange({
      ...step,
      operationId: op.id,
      functionRef: {
        name: op.name,
        importPath: importPath,
        signature: liveSig,
        returnIsArray: isArrayOp,
      },
      outputSchema: schemaFields,
      name: varName,
      outputVariable: varName,
      inputBindings: nextBindings,
    });
    if (isDbOperationPaginated(op)) {
      syncPaginationQueryParams(op);
    } else {
      prunePaginationQueryParamsIfUnused(op);
    }
  };

  const databaseOptions: StepComboboxOption[] = useMemo(() => {
    const opts: StepComboboxOption[] = [
      {
        value: "all",
        label: "All Databases",
      },
    ];
    dbNodes
      .filter((db) => Boolean(db && db.id && db.id.trim()))
      .forEach((db) => {
        const isRedisInstance = db.type === "redis_instance";
        opts.push({
          value: db.id,
          label: `${isRedisInstance ? "⚡" : "🛢"} ${
            db.data?.label || (isRedisInstance ? "Redis Instance" : "Database")
          }`,
        });
      });
    return opts;
  }, [dbNodes]);

  const tableOptions: StepComboboxOption[] = useMemo(() => {
    return filteredEntityNodes
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
        return {
          value: t.id,
          label: `${icon} ${label}`,
        };
      });
  }, [filteredEntityNodes]);

  const operationOptions: StepComboboxOption[] = useMemo(() => {
    return availableDbOperations
      .filter((op) => Boolean(op && op.name && op.name.trim()))
      .map((op) => ({
        value: op.name,
        label: op.name,
        badge: (
          <span className="text-[9px] text-muted-foreground uppercase font-sans">
            ({op.kind})
          </span>
        ),
      }));
  }, [availableDbOperations]);

  const isPaginationSynced = useMemo(() => {
    if (!selectedOp || !endpoint) return false;
    if (!isDbOperationPaginated(selectedOp, expectedArgs)) return false;

    const qps = endpoint.queryParams || [];
    return qps.some((q) => q.name.trim().toLowerCase() === "limit");
  }, [selectedOp, endpoint, expectedArgs]);

  const limitDefault = useMemo(() => {
    const qp = endpoint?.queryParams?.find((q) => q.name.trim().toLowerCase() === "limit");
    return qp?.defaultValue || selectedOp?.pagination?.defaultLimit || "20";
  }, [endpoint?.queryParams, selectedOp]);

  const offsetDefault = useMemo(() => {
    const qp = endpoint?.queryParams?.find((q) => q.name.trim().toLowerCase() === "offset");
    return qp?.defaultValue || "0";
  }, [endpoint?.queryParams]);

  const handleAutoMapWithSync = () => {
    if (selectedOp) {
      syncPaginationQueryParams(selectedOp, true);
    }
    onAutoMapArguments?.();
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
          <StepCombobox
            value={selectedDbId}
            onValueChange={(v) => onChange({ ...step, databaseId: v })}
            options={databaseOptions}
            placeholder="Select Database..."
            className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full"
          />
        </div>

        {/* Table / Entity selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <TableIcon size={10} /> Table / Entity
          </Label>
          <StepCombobox
            value={selectedTableNode?.id || step.tableNodeId || ""}
            onValueChange={handleSelectTable}
            options={tableOptions}
            placeholder="Select Table..."
            className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full"
          />
        </div>

        {/* Operation / Function selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 size={10} /> Operation / Function
          </Label>
          <StepCombobox
            value={step.functionRef?.name || step.operationId || ""}
            onValueChange={handleSelectOperation}
            options={operationOptions}
            placeholder={
              !selectedTableNode
                ? "Select table first"
                : availableDbOperations.length === 0
                ? "No operations"
                : "Choose operation..."
            }
            disabled={!selectedTableNode || availableDbOperations.length === 0}
            className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full"
          />
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

      {/* Synced Pagination Badge */}
      {isPaginationSynced && (
        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded bg-sky-500/10 border border-sky-500/25 text-[10px] text-sky-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-sky-400 shrink-0" />
            <span>
              Query parameters <strong className="font-mono text-sky-200">limit</strong> (default: {limitDefault}) &amp;{" "}
              <strong className="font-mono text-sky-200">offset</strong> (default: {offsetDefault}) synced to endpoint
            </span>
          </div>
          <span className="text-[9px] font-mono text-sky-400/80 bg-sky-500/20 px-1.5 py-0.2 rounded uppercase shrink-0 font-medium">
            Synced Contract
          </span>
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
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors cursor-pointer"
                onClick={handleAutoMapWithSync}
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
