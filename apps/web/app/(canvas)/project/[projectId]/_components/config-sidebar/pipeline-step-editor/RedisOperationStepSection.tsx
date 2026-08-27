"use client";

import React, { useMemo } from "react";
import {
  BackendNode,
  BackendEdge,
  DbOperationFunction,
} from "@workspace/canvas/types";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { toFolderName, toVarName } from "@/lib/compiler/utils";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Zap, Database, Code2, Settings2, Sparkles, Layers } from "lucide-react";
import { PipelineStepDraft, ExpectedArg } from "./types";
import { ensureRedisCacheConnection } from "./utils";

export interface DirectRedisCommand {
  id: string;
  name: string;
  category: "String / Key-Value" | "Hash" | "List" | "Set" | "PubSub & Streams";
  description: string;
  signature: string;
  params: { name: string; type: string; required: boolean }[];
}

export const DIRECT_REDIS_COMMANDS: DirectRedisCommand[] = [
  // Key-Value
  {
    id: "redis-get",
    name: "redis.get",
    category: "String / Key-Value",
    description: "Get value by key",
    signature: "get(key: string): Promise<string | null>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-set",
    name: "redis.set",
    category: "String / Key-Value",
    description: "Set key to hold the string value",
    signature: "set(key: string, value: string): Promise<'OK'>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-setex",
    name: "redis.setex",
    category: "String / Key-Value",
    description: "Set key with TTL expiration in seconds",
    signature: "setex(key: string, seconds: number, value: string): Promise<'OK'>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "seconds", type: "number", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-del",
    name: "redis.del",
    category: "String / Key-Value",
    description: "Delete key",
    signature: "del(key: string): Promise<number>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-exists",
    name: "redis.exists",
    category: "String / Key-Value",
    description: "Determine if key exists",
    signature: "exists(key: string): Promise<number>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-expire",
    name: "redis.expire",
    category: "String / Key-Value",
    description: "Set a key's time to live in seconds",
    signature: "expire(key: string, seconds: number): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "seconds", type: "number", required: true },
    ],
  },
  {
    id: "redis-ttl",
    name: "redis.ttl",
    category: "String / Key-Value",
    description: "Get the time to live for a key in seconds",
    signature: "ttl(key: string): Promise<number>",
    params: [{ name: "key", type: "string", required: true }],
  },
  // Hash
  {
    id: "redis-hget",
    name: "redis.hget",
    category: "Hash",
    description: "Get the value of a hash field",
    signature: "hget(key: string, field: string): Promise<string | null>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "field", type: "string", required: true },
    ],
  },
  {
    id: "redis-hset",
    name: "redis.hset",
    category: "Hash",
    description: "Set the value of a hash field",
    signature: "hset(key: string, field: string, value: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "field", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-hgetall",
    name: "redis.hgetall",
    category: "Hash",
    description: "Get all fields and values in a hash",
    signature: "hgetall(key: string): Promise<Record<string, string>>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-hdel",
    name: "redis.hdel",
    category: "Hash",
    description: "Delete one or more hash fields",
    signature: "hdel(key: string, field: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "field", type: "string", required: true },
    ],
  },
  // List
  {
    id: "redis-lpush",
    name: "redis.lpush",
    category: "List",
    description: "Prepend value to a list",
    signature: "lpush(key: string, value: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-rpush",
    name: "redis.rpush",
    category: "List",
    description: "Append value to a list",
    signature: "rpush(key: string, value: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true },
    ],
  },
  {
    id: "redis-lpop",
    name: "redis.lpop",
    category: "List",
    description: "Remove and get first element in a list",
    signature: "lpop(key: string): Promise<string | null>",
    params: [{ name: "key", type: "string", required: true }],
  },
  {
    id: "redis-rpop",
    name: "redis.rpop",
    category: "List",
    description: "Remove and get last element in a list",
    signature: "rpop(key: string): Promise<string | null>",
    params: [{ name: "key", type: "string", required: true }],
  },
  // Set
  {
    id: "redis-sadd",
    name: "redis.sadd",
    category: "Set",
    description: "Add member to a set",
    signature: "sadd(key: string, member: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "member", type: "string", required: true },
    ],
  },
  {
    id: "redis-srem",
    name: "redis.srem",
    category: "Set",
    description: "Remove member from a set",
    signature: "srem(key: string, member: string): Promise<number>",
    params: [
      { name: "key", type: "string", required: true },
      { name: "member", type: "string", required: true },
    ],
  },
  {
    id: "redis-smembers",
    name: "redis.smembers",
    category: "Set",
    description: "Get all members in a set",
    signature: "smembers(key: string): Promise<string[]>",
    params: [{ name: "key", type: "string", required: true }],
  },
  // PubSub & Streams
  {
    id: "redis-publish",
    name: "redis.publish",
    category: "PubSub & Streams",
    description: "Post a message to a Redis channel",
    signature: "publish(channel: string, message: string): Promise<number>",
    params: [
      { name: "channel", type: "string", required: true },
      { name: "message", type: "string", required: true },
    ],
  },
  {
    id: "redis-xadd",
    name: "redis.xadd",
    category: "PubSub & Streams",
    description: "Appends message to Redis stream",
    signature: "xadd(stream: string, fields: Record<string, string>): Promise<string>",
    params: [
      { name: "stream", type: "string", required: true },
      { name: "fields", type: "Record<string, string>", required: true },
    ],
  },
];

export interface RedisOperationStepSectionProps {
  step: PipelineStepDraft;
  allNodes: BackendNode[];
  allEdges: BackendEdge[];
  expectedArgs?: ExpectedArg[];
  selectedDbId?: string;
  serviceNodeId?: string;
  endpointId?: string;
  consumedEventId?: string;
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
  selectedDbId = "all",
  serviceNodeId,
  endpointId,
  consumedEventId,
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
      const defaultDirect = DIRECT_REDIS_COMMANDS[0]!;
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
    const defaultOp = ops[0];
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

  return (
    <div className="flex flex-col gap-3 p-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.04]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <Zap size={13} />
          <span>Redis Cache & Key-Value Operation</span>
        </div>
        {(selectedSchemaOp || selectedDirectCommand) && (
          <span className="text-[10px] font-mono text-red-300 bg-red-500/15 border border-red-500/25 px-1.5 py-0.2 rounded font-medium">
            {selectedSchemaOp?.name || selectedDirectCommand?.name}
          </span>
        )}
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
                🔴 All Redis Instances (Default)
              </SelectItem>
              {redisInstances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id} className="text-xs font-mono">
                  🔴 {inst.data?.label || "Redis Instance"} ({inst.data?.host || "localhost"}:{inst.data?.port || 6379})
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
                ⚡ Direct Redis Commands (get, set, hget, etc.)
              </SelectItem>
              {filteredRedisSchemas.map((schema) => {
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
            <Code2 size={10} /> Redis Operation / Function
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
                DIRECT_REDIS_COMMANDS.map((cmd) => (
                  <SelectItem key={cmd.id} value={cmd.id} className="text-xs font-mono">
                    <span className="font-semibold text-red-300">{cmd.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5">
                      — {cmd.description}
                    </span>
                  </SelectItem>
                ))
              ) : (
                schemaOperations.map((op) => (
                  <SelectItem key={op.id} value={op.name} className="text-xs font-mono">
                    <span className="font-semibold text-red-300">{op.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5 uppercase">
                      ({op.kind})
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expected arguments preview & quick mapping button */}
      {expectedArgs && expectedArgs.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-red-500/15">
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
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors"
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

      {/* Advanced function settings toggle */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-red-500/15">
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
