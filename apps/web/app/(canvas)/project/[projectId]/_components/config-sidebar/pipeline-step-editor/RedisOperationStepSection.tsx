"use client";

import React, { useMemo } from "react";
import {
  BackendNode,
  BackendEdge,
  DbOperationFunction,
  DirectRedisCommand,
  Endpoint,
  AnyMessagingResource,
} from "@workspace/canvas/types";
import { DIRECT_REDIS_COMMANDS } from "@workspace/canvas/constants";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toFolderName, toVarName } from "@/lib/compiler/utils";
import { cn } from "@workspace/ui/lib/utils";
import { BufferedInput } from "./BufferedInput";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Zap, Database, Code2, Settings, Sparkles, Layers, Search, PencilLine } from "lucide-react";
import { PipelineStepDraft, ExpectedArg, AvailableSource, StepBinding } from "./types";
import { ensureRedisCacheConnection } from "./utils";
import { RedisCacheMissSection } from "./RedisCacheMissSection";

function computeRedisOpBindings(
  opIdentifier: string,
  schemaOp?: DbOperationFunction,
  currentBindings: StepBinding[] = [],
): StepBinding[] {
  let argNames: string[] = [];

  if (schemaOp && schemaOp.params && schemaOp.params.length > 0) {
    argNames = schemaOp.params.filter((p) => p && p.name && p.name.trim()).map((p) => p.name.trim());
  } else {
    const fn = opIdentifier.toLowerCase();
    if (fn.includes("ping") || fn.includes("dbsize") || fn.includes("flushdb") || fn.includes("time") || fn.includes("info")) {
      argNames = [];
    } else if (fn.includes("setex")) {
      argNames = ["key", "seconds", "value"];
    } else if (fn.includes("hset")) {
      argNames = ["key", "field", "value"];
    } else if (fn.includes("hget") || fn.includes("hdel")) {
      argNames = ["key", "field"];
    } else if (fn.includes("set") || fn.includes("lpush") || fn.includes("rpush")) {
      argNames = ["key", "value"];
    } else if (fn.includes("publish")) {
      argNames = ["channel", "message"];
    } else if (fn.includes("xadd")) {
      argNames = ["stream", "fields"];
    } else if (fn.includes("expire")) {
      argNames = ["key", "seconds"];
    } else {
      argNames = ["key"];
    }
  }

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

export type { DirectRedisCommand };
export { DIRECT_REDIS_COMMANDS };

export type RedisOperationMode = "read" | "write";

const REDIS_READ_IDENTIFIERS = new Set<string>([
  "redis.get",
  "redis-get",
  "redis.exists",
  "redis-exists",
  "redis.ttl",
  "redis-ttl",
  "redis.hget",
  "redis-hget",
  "redis.hgetall",
  "redis-hgetall",
  "redis.smembers",
  "redis-smembers",
  "redis.json.get",
  "redis-json-get",
  "redis.json.arrlen",
  "redis-json-arrlen",
]);

export function isRedisCommandRead(cmdOrName?: string): boolean {
  if (!cmdOrName) return true;
  if (REDIS_READ_IDENTIFIERS.has(cmdOrName)) return true;
  const name = cmdOrName.replace(/^redis[-.]/, "").toLowerCase();
  if (
    name.startsWith("get") ||
    name.startsWith("find") ||
    name.startsWith("read") ||
    name.startsWith("fetch") ||
    name.startsWith("exists") ||
    name.startsWith("ttl") ||
    name.startsWith("hget") ||
    name.startsWith("mget") ||
    name.startsWith("smembers") ||
    name.startsWith("scard") ||
    name.startsWith("lrange") ||
    name.startsWith("llen") ||
    name.startsWith("json.get") ||
    name.startsWith("json-get") ||
    name.startsWith("json.arrlen") ||
    name.startsWith("json-arrlen")
  ) {
    return true;
  }
  return false;
}

export function isDbOperationRead(op: DbOperationFunction): boolean {
  if (
    op.kind === "findAll" ||
    op.kind === "findById" ||
    op.kind === "fetchByIndex" ||
    op.kind === "join"
  ) {
    return true;
  }
  if (op.kind === "create" || op.kind === "update" || op.kind === "delete") {
    return false;
  }
  const name = op.name.toLowerCase();
  if (
    name.startsWith("set") ||
    name.startsWith("put") ||
    name.startsWith("del") ||
    name.startsWith("remove") ||
    name.startsWith("update") ||
    name.startsWith("create") ||
    name.startsWith("add") ||
    name.startsWith("insert") ||
    name.startsWith("write") ||
    name.startsWith("save") ||
    name.startsWith("push") ||
    name.startsWith("pop") ||
    name.startsWith("expire") ||
    name.startsWith("incr") ||
    name.startsWith("decr")
  ) {
    return false;
  }
  return true;
}

export interface RedisOperationStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  expectedArgs?: ExpectedArg[];
  availableSources?: AvailableSource[];
  selectedDbId?: string;
  serviceNodeId?: string;
  endpoint?: Endpoint;
  consumedEvent?: AnyMessagingResource;
  endpointId?: string;
  consumedEventId?: string;
  depth?: number;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
  onChange: (updated: PipelineStepDraft) => void;
  onAutoMapArguments?: () => void;
  children?: React.ReactNode;
}

export const RedisOperationStepSection = ({
  step,
  allNodes,
  allEdges,
  expectedArgs,
  availableSources,
  selectedDbId = "all",
  serviceNodeId,
  endpoint,
  consumedEvent,
  endpointId,
  consumedEventId,
  depth = 0,
  showAdvancedSettings,
  onToggleAdvancedSettings,
  onChange,
  onAutoMapArguments,
  children,
}: RedisOperationStepSectionProps) => {
  // 1. Redis instance nodes
  const redisInstances = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          n.type === "redis_instance" ||
          (n.type === "database" &&
            (n.data?.dbEngine === "redis" || n.data?.dbType === "redis")),
      ),
    [allNodes],
  );

  // 2. Redis Schema / Cache nodes
  const allRedisSchemas = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          n.type === "redis_schema" ||
          n.type === "redis-cache" ||
          (n.type === "entity" && n.data?.dbType === "redis"),
      ),
    [allNodes],
  );

  const filteredRedisSchemas = useMemo(() => {
    if (selectedDbId === "all") return allRedisSchemas;
    return allRedisSchemas.filter((schema) => {
      if (schema.data?.databaseId === selectedDbId) return true;
      return allEdges.some(
        (e) =>
          (e.source === selectedDbId && e.target === schema.id) ||
          (e.target === selectedDbId && e.source === schema.id),
      );
    });
  }, [allRedisSchemas, selectedDbId, allEdges]);

  const selectedSchemaNode = useMemo(
    () => allRedisSchemas.find((n) => n.id === step.tableNodeId),
    [allRedisSchemas, step.tableNodeId],
  );

  const isDirectMode = step.tableNodeId === "__direct__" || (!selectedSchemaNode && !step.tableNodeId);

  // 3. Available operations based on selected schema or direct mode
  const schemaOperations: DbOperationFunction[] = useMemo(() => {
    if (!selectedSchemaNode) return [];
    return getEntityDbOperations(selectedSchemaNode, allNodes);
  }, [selectedSchemaNode, allNodes]);

  const selectedDirectCommand = useMemo(() => {
    return DIRECT_REDIS_COMMANDS.find(
      (cmd) =>
        cmd.id === step.operationId ||
        cmd.name === step.functionRef?.name ||
        cmd.name === step.operationId,
    );
  }, [step.operationId, step.functionRef?.name]);

  const selectedSchemaOp = useMemo(() => {
    return schemaOperations.find(
      (op) =>
        op.name === step.functionRef?.name || op.id === step.operationId,
    );
  }, [schemaOperations, step.functionRef?.name, step.operationId]);

  // Determine current operation mode: Read (cache lookup) vs Write (cache mutation)
  const isCurrentOpRead = useMemo((): boolean => {
    if (selectedDirectCommand) {
      return isRedisCommandRead(selectedDirectCommand.name);
    }
    if (selectedSchemaOp) {
      return isDbOperationRead(selectedSchemaOp);
    }
    if (step.functionRef?.name) {
      return isRedisCommandRead(step.functionRef.name);
    }
    if (step.operationId) {
      const direct = DIRECT_REDIS_COMMANDS.find((cmd) => cmd.id === step.operationId);
      if (direct) {
        return isRedisCommandRead(direct.name);
      }
      const schemaOp = schemaOperations.find((o) => o.id === step.operationId);
      if (schemaOp) {
        return isDbOperationRead(schemaOp);
      }
    }
    return true;
  }, [selectedDirectCommand, selectedSchemaOp, step.functionRef?.name, step.operationId, schemaOperations]);

  const currentMode: RedisOperationMode = isCurrentOpRead ? "read" : "write";

  // Filter available operations by current mode
  const filteredDirectCommands = useMemo(() => {
    return DIRECT_REDIS_COMMANDS.filter((cmd) =>
      currentMode === "read" ? isRedisCommandRead(cmd.name) : !isRedisCommandRead(cmd.name),
    );
  }, [currentMode]);

  const filteredSchemaOperations = useMemo(() => {
    return schemaOperations.filter((op) =>
      currentMode === "read" ? isDbOperationRead(op) : !isDbOperationRead(op),
    );
  }, [schemaOperations, currentMode]);

  // Handle selecting a Redis Instance
  const handleSelectInstance = (instanceId: string) => {
    const cleanInstanceId = instanceId === "all" ? undefined : instanceId;
    onChange({
      ...step,
      databaseId: cleanInstanceId,
    });
    if (isDirectMode && serviceNodeId) {
      ensureRedisCacheConnection({
        schemaId: "__direct__",
        instanceId: cleanInstanceId,
        serviceNodeId,
        endpointId,
        consumedEventId,
      });
    }
  };

  // Handle selecting a Redis Schema / Model
  const handleSelectSchema = (schemaId: string) => {
    if (schemaId === "__direct__") {
      const defaultDirect =
        DIRECT_REDIS_COMMANDS.find((cmd) =>
          currentMode === "write" ? !isRedisCommandRead(cmd.name) : isRedisCommandRead(cmd.name),
        ) || DIRECT_REDIS_COMMANDS[0];
      if (!defaultDirect) return;
      const varName = `${toVarName(defaultDirect.name.replace("redis.", ""))}Result`;
      onChange({
        ...step,
        tableNodeId: "__direct__",
        operationId: defaultDirect.id,
        functionRef: {
          name: defaultDirect.name,
          importPath: "@workspace/primary-redis-cache",
          signature: defaultDirect.signature,
        },
        name: varName,
        outputVariable: varName,
      });

      if (serviceNodeId) {
        ensureRedisCacheConnection({
          schemaId: "__direct__",
          instanceId: step.databaseId,
          serviceNodeId,
          endpointId,
          consumedEventId,
        });
      }
      return;
    }

    if (schemaId === "__none__") {
      onChange({
        ...step,
        tableNodeId: undefined,
        operationId: undefined,
      });
      return;
    }

    const targetNode = allRedisSchemas.find((n) => n.id === schemaId);
    if (!targetNode) return;

    const ops = getEntityDbOperations(targetNode, allNodes);
    const defaultOp =
      ops.find((op) =>
        currentMode === "write" ? !isDbOperationRead(op) : isDbOperationRead(op),
      ) || ops[0];
    const targetInstance = redisInstances.find((i) => i.id === step.databaseId || i.id === targetNode.data?.databaseId);
    const instanceLabel = targetInstance?.data?.label || "primary-redis-cache";
    const importPath = `@workspace/${toFolderName(instanceLabel)}`;
    const varName = defaultOp
      ? `${toVarName(defaultOp.name)}Result`
      : step.outputVariable || step.name || "cachedResult";

    onChange({
      ...step,
      tableNodeId: schemaId,
      operationId: defaultOp?.id,
      functionRef: defaultOp
        ? {
            name: defaultOp.name,
            importPath,
            signature: defaultOp.signature,
          }
        : step.functionRef,
      name: varName,
      outputVariable: varName,
    });

    if (serviceNodeId) {
      ensureRedisCacheConnection({
        schemaId,
        instanceId: step.databaseId || targetNode.data?.databaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
      });
    }
  };

  // Handle selecting an Operation
  const handleSelectOperation = (opIdentifier: string) => {
    if (isDirectMode || !selectedSchemaNode) {
      const direct = DIRECT_REDIS_COMMANDS.find(
        (cmd) => cmd.id === opIdentifier || cmd.name === opIdentifier,
      );
      if (!direct) return;
      const targetInstance = redisInstances.find((i) => i.id === step.databaseId);
      const instanceLabel = targetInstance?.data?.label || "primary-redis-cache";
      const varName = `${toVarName(direct.name.replace("redis.", ""))}Result`;
      const nextBindings = computeRedisOpBindings(direct.name, undefined, step.inputBindings || []);

      onChange({
        ...step,
        tableNodeId: "__direct__",
        operationId: direct.id,
        functionRef: {
          name: direct.name,
          importPath: `@workspace/${toFolderName(instanceLabel)}`,
          signature: direct.signature,
        },
        name: varName,
        outputVariable: varName,
        inputBindings: nextBindings,
      });

      if (serviceNodeId) {
        ensureRedisCacheConnection({
          schemaId: "__direct__",
          instanceId: step.databaseId,
          serviceNodeId,
          endpointId,
          consumedEventId,
        });
      }
      return;
    }

    const op = schemaOperations.find(
      (o) => o.id === opIdentifier || o.name === opIdentifier,
    );
    if (!op) return;

    const targetInstance = redisInstances.find((i) => i.id === step.databaseId || i.id === selectedSchemaNode.data?.databaseId);
    const instanceLabel = targetInstance?.data?.label || "primary-redis-cache";
    const importPath = `@workspace/${toFolderName(instanceLabel)}`;
    const varName = `${toVarName(op.name)}Result`;
    const nextBindings = computeRedisOpBindings(op.name, op, step.inputBindings || []);

    onChange({
      ...step,
      operationId: op.id,
      functionRef: {
        name: op.name,
        importPath,
        signature: op.signature,
      },
      name: varName,
      outputVariable: varName,
      inputBindings: nextBindings,
    });

    if (serviceNodeId) {
      ensureRedisCacheConnection({
        schemaId: selectedSchemaNode.id,
        instanceId: step.databaseId || selectedSchemaNode.data?.databaseId,
        serviceNodeId,
        endpointId,
        consumedEventId,
      });
    }
  };

  // Handle toggling between Read (cache lookup) and Write (cache mutate)
  const handleModeChange = (newMode: RedisOperationMode) => {
    if (newMode === currentMode) return;

    if (isDirectMode || !selectedSchemaNode) {
      const targetCommand = DIRECT_REDIS_COMMANDS.find((cmd) =>
        newMode === "read" ? isRedisCommandRead(cmd.name) : !isRedisCommandRead(cmd.name),
      );
      if (targetCommand) {
        handleSelectOperation(targetCommand.id);
      }
    } else {
      const targetOp = schemaOperations.find((op) =>
        newMode === "read" ? isDbOperationRead(op) : !isDbOperationRead(op),
      );
      if (targetOp) {
        handleSelectOperation(targetOp.id || targetOp.name);
      } else {
        // If the schema does not provide operations for this mode, switch to direct command
        const targetCommand = DIRECT_REDIS_COMMANDS.find((cmd) =>
          newMode === "read" ? isRedisCommandRead(cmd.name) : !isRedisCommandRead(cmd.name),
        );
        if (targetCommand) {
          const targetInstance = redisInstances.find(
            (i) => i.id === step.databaseId || i.id === selectedSchemaNode.data?.databaseId,
          );
          const instanceLabel = targetInstance?.data?.label || "primary-redis-cache";
          const varName = `${toVarName(targetCommand.name.replace("redis.", ""))}Result`;
          onChange({
            ...step,
            tableNodeId: "__direct__",
            operationId: targetCommand.id,
            functionRef: {
              name: targetCommand.name,
              importPath: `@workspace/${toFolderName(instanceLabel)}`,
              signature: targetCommand.signature,
            },
            name: varName,
            outputVariable: varName,
          });
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <Zap size={13} className="text-amber-500" />
          <span>Redis Cache & Key-Value Operation</span>
        </div>
        {(selectedSchemaOp || selectedDirectCommand) && (
          <span className="text-[10px] font-mono text-foreground/80 bg-muted/60 border border-border/60 px-1.5 py-0.2 rounded font-medium">
            {selectedSchemaOp?.name || selectedDirectCommand?.name}
          </span>
        )}
      </div>

      {/* Operation Mode Segmented Switch (Read / Write) */}
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-2 p-0.5 rounded-md border border-border/70 bg-background/80 shadow-xs">
          <button
            type="button"
            onClick={() => handleModeChange("read")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-medium transition-all",
              currentMode === "read"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Search size={12} className={currentMode === "read" ? "text-emerald-500" : "text-muted-foreground"} />
            <span>Read (Lookup)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("write")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-medium transition-all",
              currentMode === "write"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30 shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <PencilLine size={12} className={currentMode === "write" ? "text-amber-500" : "text-muted-foreground"} />
            <span>Write (Mutate)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* 1. Redis Instance selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Database size={10} /> Redis Instance
          </Label>
          <Select
            value={step.databaseId || "all"}
            onValueChange={handleSelectInstance}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Select Redis Instance..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                ⚡ All Redis Instances (Default)
              </SelectItem>
              {redisInstances
                .filter((inst) => Boolean(inst && inst.id && inst.id.trim()))
                .map((inst) => (
                  <SelectItem key={inst.id} value={inst.id} className="text-xs font-mono">
                    ⚡ {inst.data?.label || "Redis Instance"} ({inst.data?.host || "localhost"}:{inst.data?.port || 6379})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Redis Schema / Model selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Layers size={10} /> Redis Schema / Structure
          </Label>
          <Select
            value={step.tableNodeId || "__direct__"}
            onValueChange={handleSelectSchema}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Select Schema or Direct Command..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__direct__" className="text-xs font-mono text-primary font-semibold">
                ⚡ Direct Redis Commands ({currentMode === "read" ? "get, hget, exists, etc." : "set, del, expire, etc."})
              </SelectItem>
              {filteredRedisSchemas
                .filter((schema) => Boolean(schema && schema.id && schema.id.trim()))
                .map((schema) => {
                  const label = schema.data?.label || schema.data?.tableRef || "Redis Cache";
                  const structure = schema.data?.redisDataStructure || "hash";
                  return (
                    <SelectItem key={schema.id} value={schema.id} className="text-xs font-mono">
                      📑 {label} ({structure})
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Operation / Function selector */}
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Code2 size={10} /> Redis Operation ({currentMode === "read" ? "Read / Lookup" : "Write / Mutation"})
          </Label>
          <Select
            value={step.functionRef?.name || step.operationId || "__none__"}
            onValueChange={handleSelectOperation}
          >
            <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono w-full">
              <SelectValue placeholder="Choose Redis Operation..." />
            </SelectTrigger>
            <SelectContent>
              {isDirectMode || !selectedSchemaNode ? (
                filteredDirectCommands
                  .filter((cmd) => Boolean(cmd && cmd.id && cmd.id.trim()))
                  .map((cmd) => (
                    <SelectItem key={cmd.id} value={cmd.id} className="text-xs font-mono">
                      <span className="font-semibold text-foreground">{cmd.name}</span>
                      <span className="text-[9px] text-muted-foreground ml-1.5">
                        — {cmd.description}
                      </span>
                    </SelectItem>
                  ))
              ) : filteredSchemaOperations.length > 0 ? (
                filteredSchemaOperations
                  .filter((op) => Boolean(op && op.name && op.name.trim()))
                  .map((op) => (
                    <SelectItem key={op.id} value={op.name} className="text-xs font-mono">
                      <span className="font-semibold text-foreground">{op.name}</span>
                      <span className="text-[9px] text-muted-foreground ml-1.5 uppercase">
                        ({op.kind})
                      </span>
                    </SelectItem>
                  ))
              ) : (
                <SelectItem value="__none__" disabled className="text-xs text-muted-foreground italic">
                  No {currentMode} operations found in schema
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expected arguments preview & quick mapping button */}
      {expectedArgs && expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border/40">
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
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-secondary/80 text-secondary-foreground hover:bg-secondary border border-border/60 transition-colors"
                onClick={onAutoMapArguments}
                title="Smart map missing arguments from route params, query, request body, and prior steps"
              >
                <Sparkles size={10} />
                Auto-map arguments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Argument Bindings */}
      {children}

      {/* Dedicated Cache Miss Handling - Only available for Read operations */}
      {currentMode === "read" && (
        <RedisCacheMissSection
          step={step}
          allNodes={allNodes}
          allEdges={allEdges}
          availableSources={availableSources}
          endpoint={endpoint}
          consumedEvent={consumedEvent}
          serviceNodeId={serviceNodeId}
          depth={depth}
          onChange={onChange}
        />
      )}

      {/* Advanced function settings toggle */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40">
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

