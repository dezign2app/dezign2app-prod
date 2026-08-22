import React, { useState } from "react";
import { Database, Table, Plus, Trash2, FunctionSquare, Check, Server } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { TableCrudConfig } from "../types";
import { BackendNode } from "@/types/canvas";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { DbOperationFunction } from "@workspace/canvas/types";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

interface CrudConfigSectionProps {
  crudConfig: TableCrudConfig[];
  onCrudConfigChange: (config: TableCrudConfig[]) => void;
  availableTableNodes?: { id: string; label: string }[];
  allNodes?: BackendNode[];
  serviceNodeId?: string;
  endpointId?: string;
}

export function ensureDbRefNodeForEntity(
  entityId: string,
  serviceNodeId?: string,
  endpointId?: string,
) {
  if (!entityId || entityId === "__none__") return;

  const store = useBackendCanvasStore.getState();
  const allNodes = store.nodes;
  const targetNode = allNodes.find(
    (n) =>
      n.id === entityId &&
      (n.type === "entity" || n.type === "redis_schema" || n.type === "redis-cache"),
  );
  if (!targetNode) return;

  const isRedis =
    targetNode.type === "redis_schema" ||
    targetNode.type === "redis-cache" ||
    targetNode.data?.dbType === "redis";

  if (isRedis) {
    let cacheRefNode = allNodes.find(
      (n) =>
        n.type === "redis-cache" &&
        (n.data?.schemaRef === entityId || n.id === entityId),
    );

    if (!cacheRefNode && targetNode.type === "redis_schema") {
      const newCacheRefId = crypto.randomUUID();
      const schemaPos = targetNode.position || { x: 200, y: 200 };
      const schemaLabel = targetNode.data?.label || "Redis Cache";

      store.addNode({
        id: newCacheRefId,
        type: "redis-cache",
        position: { x: Math.max(0, schemaPos.x - 240), y: schemaPos.y + 40 },
        data: {
          label: schemaLabel,
          schemaRef: entityId,
          description: `Reference to ${schemaLabel} cache schema`,
        },
      });

      cacheRefNode = useBackendCanvasStore
        .getState()
        .nodes.find((n) => n.id === newCacheRefId);
    }

    const refNodeToConnect = cacheRefNode || (targetNode.type === "redis-cache" ? targetNode : undefined);

    if (serviceNodeId && refNodeToConnect) {
      const storeState = useBackendCanvasStore.getState();

      let sourceHandle = endpointId ? `endpoint-out-${endpointId}` : "";
      if (!sourceHandle) {
        const srcNode = storeState.nodes.find((n) => n.id === serviceNodeId);
        const ep =
          storeState.endpoints.find((e) => e.nodeId === serviceNodeId) ||
          srcNode?.data?.endpoints?.[0];
        if (ep?.id) {
          sourceHandle = `endpoint-out-${ep.id}`;
        } else {
          sourceHandle = `endpoint-out-${serviceNodeId}`;
        }
      }

      const existingEdge = storeState.edges.find(
        (e) =>
          (e.source === serviceNodeId && e.target === refNodeToConnect.id) ||
          (e.target === serviceNodeId && e.source === refNodeToConnect.id),
      );

      if (!existingEdge) {
        storeState.addEdge({
          id: `edge-rediscache-${Date.now()}`,
          source: serviceNodeId,
          target: refNodeToConnect.id,
          sourceHandle,
          targetHandle: "database-target",
          type: "connection",
        });
      }
    }
    return;
  }

  // Check if a db_ref node already exists for this entity
  let dbRefNode = allNodes.find(
    (n) => n.type === "db_ref" && n.data?.tableRef === entityId,
  );

  if (!dbRefNode) {
    const newDbRefId = crypto.randomUUID();
    const entityPos = targetNode.position || { x: 200, y: 200 };
    const entityLabel = targetNode.data?.label || "Table";

    store.addNode({
      id: newDbRefId,
      type: "db_ref",
      position: { x: Math.max(0, entityPos.x - 240), y: entityPos.y + 40 },
      data: {
        label: entityLabel,
        tableRef: entityId,
        description: `Reference to ${entityLabel} table`,
      },
    });

    dbRefNode = useBackendCanvasStore
      .getState()
      .nodes.find((n) => n.id === newDbRefId);
  }

  // Connect ServiceNode to db_ref node if serviceNodeId is provided
  if (serviceNodeId && dbRefNode) {
    const storeState = useBackendCanvasStore.getState();

    let sourceHandle = endpointId ? `endpoint-out-${endpointId}` : "";
    if (!sourceHandle) {
      const srcNode = storeState.nodes.find((n) => n.id === serviceNodeId);
      const ep =
        storeState.endpoints.find((e) => e.nodeId === serviceNodeId) ||
        srcNode?.data?.endpoints?.[0];
      if (ep?.id) {
        sourceHandle = `endpoint-out-${ep.id}`;
      } else {
        sourceHandle = `endpoint-out-${serviceNodeId}`;
      }
    }

    const existingEdge = storeState.edges.find(
      (e) =>
        (e.source === serviceNodeId && e.target === dbRefNode.id) ||
        (e.target === serviceNodeId && e.source === dbRefNode.id),
    );

    if (!existingEdge) {
      storeState.addEdge({
        id: `edge-dbref-${Date.now()}`,
        source: serviceNodeId,
        target: dbRefNode.id,
        sourceHandle,
        targetHandle: "database-target",
        type: "connection",
      });
    }
  }
}

interface CrudConfigCardProps {
  configItem: TableCrudConfig;
  idx: number;
  allNodes: BackendNode[];
  dbNodes: BackendNode[];
  entityNodes: BackendNode[];
  availableTableNodes: { id: string; label: string }[];
  crudConfig: TableCrudConfig[];
  onCrudConfigChange: (config: TableCrudConfig[]) => void;
  onRemoveDraft?: () => void;
  serviceNodeId?: string;
  endpointId?: string;
}

function CrudConfigCard({
  configItem,
  idx,
  allNodes,
  dbNodes,
  entityNodes,
  availableTableNodes,
  crudConfig,
  onCrudConfigChange,
  onRemoveDraft,
  serviceNodeId,
  endpointId,
}: CrudConfigCardProps) {
  const tableNode = allNodes.find((n) => n.id === configItem.tableNodeId);
  const resolvedEntityNode =
    tableNode?.type === "redis-cache" && tableNode.data?.schemaRef
      ? allNodes.find((n) => n.id === tableNode.data?.schemaRef)
      : tableNode?.type === "db_ref" && tableNode.data?.tableRef
        ? allNodes.find((n) => n.id === tableNode.data?.tableRef)
        : tableNode;

  // Find associated database node ID for this entity node
  const tableDbId =
    resolvedEntityNode?.data?.databaseId || tableNode?.data?.databaseId || "all";
  const [selectedDbId, setSelectedDbId] = useState<string>(tableDbId);

  // Level 2: Filter entity nodes based on selected Level 1 Database
  const filteredEntityNodes = entityNodes.filter((e) => {
    if (!selectedDbId || selectedDbId === "all") return true;
    if (e.data?.databaseId) return e.data.databaseId === selectedDbId;
    return true;
  });

  // Label for the selected entity table
  const label =
    resolvedEntityNode?.data?.label ||
    tableNode?.data?.label ||
    availableTableNodes.find((t) => t.id === configItem.tableNodeId)?.label ||
    "Table";

  const entityOps: DbOperationFunction[] = getEntityDbOperations(
    resolvedEntityNode,
    allNodes,
  );
  const selectedOps = configItem.operations || [];

  return (
    <div className="flex flex-col gap-3 p-3 bg-background/60 rounded-xl border border-border/50 shadow-sm">
      {/* 2-Level Filtering: Database Selector & Entity Table Selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Level 1: Database Selector (shown when database nodes exist on canvas) */}
          {dbNodes.length > 0 && (
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
                <Server size={10} className="text-amber-500" /> Database
              </span>
              <Select
                value={selectedDbId}
                onValueChange={(dbId) => {
                  setSelectedDbId(dbId);
                  if (configItem.tableNodeId && idx < crudConfig.length) {
                    const next = [...crudConfig];
                    if (next[idx]) {
                      next[idx] = {
                        ...next[idx],
                        tableNodeId: "",
                      };
                      onCrudConfigChange(next);
                    }
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs font-mono bg-background">
                  <SelectValue placeholder="Select Database..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-mono text-muted-foreground">
                    All Databases
                  </SelectItem>
                  {dbNodes.map((db) => {
                    const isRedisInstance = db.type === "redis_instance";
                    return (
                      <SelectItem key={db.id} value={db.id} className="text-xs font-mono">
                        {isRedisInstance ? "🔴" : "🛢"} {db.data?.label || (isRedisInstance ? "Redis Instance" : "Database")}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Level 2: Entity Table Selector */}
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
              <Table size={10} className="text-blue-500" /> Entity Table
            </span>
            <div className="flex items-center gap-1.5">
              <Select
                value={configItem.tableNodeId || "__none__"}
                onValueChange={(tableId) => {
                  const cleanTableId = tableId === "__none__" ? "" : tableId;
                  if (cleanTableId) {
                    ensureDbRefNodeForEntity(cleanTableId, serviceNodeId, endpointId);
                  }
                  if (idx < crudConfig.length) {
                    const next = [...crudConfig];
                    if (next[idx]) {
                      next[idx] = {
                        ...next[idx],
                        tableNodeId: cleanTableId,
                      };
                      onCrudConfigChange(next);
                    }
                  } else {
                    onCrudConfigChange([
                      ...crudConfig,
                      { tableNodeId: cleanTableId, operations: [] },
                    ]);
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs flex-1 font-mono bg-background">
                  <SelectValue placeholder="Select Entity Node..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="__none__"
                    className="text-xs font-mono text-muted-foreground"
                  >
                    Select an Entity Table...
                  </SelectItem>
                  {(filteredEntityNodes.length > 0
                    ? filteredEntityNodes
                    : entityNodes.length > 0
                    ? entityNodes
                    : availableTableNodes
                  ).map((t: BackendNode | { id: string; label: string; data?: BackendNode["data"] }) => {
                    const tData = "data" in t ? t.data : undefined;
                    const isRedis =
                      tData?.dbType === "redis" ||
                      ("type" in t && (t.type === "redis_schema" || t.type === "redis-cache"));
                    const icon = isRedis ? "🔴" : "📄";
                    const tLabel =
                      tData?.label ||
                      tData?.tableRef ||
                      ("label" in t ? t.label : "") ||
                      (isRedis ? "Redis Cache" : "Table");
                    return (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        className="text-xs font-mono"
                      >
                        {icon} {tLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Remove Table Config */}
              <button
                type="button"
                title="Remove Entity Reference"
                onClick={() => {
                  if (onRemoveDraft) {
                    onRemoveDraft();
                  } else {
                    const next = crudConfig.filter((_, i) => i !== idx);
                    onCrudConfigChange(next);
                  }
                }}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Level 3: Associated Entity DB Functions Selector List */}
      {configItem.tableNodeId && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
          <span className="text-[10px] font-bold text-muted-foreground uppercase font-mono flex items-center gap-1">
            <FunctionSquare size={11} className="text-emerald-500" /> Associated Functions for {label}:
          </span>

          {entityOps.filter((op) => op.enabled !== false).length === 0 ? (
            <span className="text-[10px] text-muted-foreground italic font-mono">
              No helper functions generated for {label}
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {entityOps
                .filter((op) => op.enabled !== false)
                .map((op) => {
                  const isSelected = selectedOps.includes(op.name);

                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        const curr = configItem.operations || [];
                        const nextOps = isSelected
                          ? curr.filter(
                              (o) =>
                                o !== op.name &&
                                o !== op.kind &&
                                o !== "read",
                            )
                          : [...curr, op.name];
                        const next = [...crudConfig];
                        if (next[idx]) {
                          next[idx] = {
                            ...next[idx],
                            operations: nextOps,
                          };
                          onCrudConfigChange(next);
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all border ${
                        isSelected
                          ? "bg-primary/15 text-primary border-primary/40 font-semibold shadow-xs"
                          : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary hover:text-foreground"
                      }`}
                      title={op.description || op.signature || op.name}
                    >
                      {isSelected && <Check size={11} />}
                      <span>{op.name}</span>
                      <span className="text-[9px] font-bold uppercase opacity-60 ml-0.5">
                        ({op.kind})
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CrudConfigSection({
  crudConfig,
  onCrudConfigChange,
  availableTableNodes = [],
  allNodes = [],
  serviceNodeId,
  endpointId,
}: CrudConfigSectionProps) {
  const [draftCount, setDraftCount] = useState<number>(0);

  // Database server nodes (DatabaseNode.tsx, RedisInstanceNode.tsx)
  const dbNodes = allNodes.filter(
    (n) => n.type === "database" || n.type === "redis_instance",
  );

  // Entity table nodes (EntityNode.tsx, RedisSchemaNode.tsx, RedisCacheNode.tsx)
  const entityNodes = allNodes.filter(
    (n) =>
      n.type === "entity" ||
      n.type === "redis_schema" ||
      n.type === "redis-cache",
  );

  const displayConfig: TableCrudConfig[] = [
    ...crudConfig,
    ...Array.from({ length: draftCount }, () => ({
      tableNodeId: "",
      operations: [],
    })),
  ];

  return (
    <div className="flex flex-col gap-2.5 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider font-mono">
            Connected Database Operation Functions
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1 px-2 border-border"
          onClick={() => {
            setDraftCount((prev) => prev + 1);
          }}
        >
          <Plus className="w-3 h-3" />
          <span>Add Entity Ref</span>
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {displayConfig.map((configItem, idx) => (
          <CrudConfigCard
            key={`${configItem.tableNodeId || "draft"}_${idx}`}
            configItem={configItem}
            idx={idx}
            allNodes={allNodes}
            dbNodes={dbNodes}
            entityNodes={entityNodes}
            availableTableNodes={availableTableNodes}
            crudConfig={crudConfig}
            onCrudConfigChange={(next) => {
              if (idx >= crudConfig.length) {
                setDraftCount((prev) => Math.max(0, prev - 1));
              }
              onCrudConfigChange(next);
            }}
            onRemoveDraft={() => {
              if (idx >= crudConfig.length) {
                setDraftCount((prev) => Math.max(0, prev - 1));
              } else {
                const next = crudConfig.filter((_, i) => i !== idx);
                onCrudConfigChange(next);
              }
            }}
            serviceNodeId={serviceNodeId}
            endpointId={endpointId}
          />
        ))}

        {displayConfig.length === 0 && (
          <span className="text-[10px] text-muted-foreground italic px-1 font-mono">
            No database functions selected. Click &quot;+ Add Entity Ref&quot; to link entity DB operations to this endpoint.
          </span>
        )}
      </div>
    </div>
  );
}
