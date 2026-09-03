"use client";

import React, { useMemo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Database, Server, Table2, Settings, Trash, Code2 } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  useSimulationNodeState,
  getSimulationNodeBorderClass,
} from "../../common";
import { getEntityDbOperations } from "@/lib/utils/entityOperationsHelper";
import { DbOperationFunction } from "@workspace/canvas/types";

export const DatabaseTableRefNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const requestDeleteNode = useBackendCanvasStore((s) => s.requestDeleteNode);
  const deleteEdge = useBackendCanvasStore((s) => s.deleteEdge);
  const edges = useBackendCanvasStore((s) => s.edges);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const setActiveConfigItem = useBackendCanvasStore(
    (s) => s.setActiveConfigItem,
  );

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
  );

  const databaseInstances = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) =>
          n?.type === "database" &&
          n.data?.dbEngine !== "redis" &&
          n.data?.dbType !== "redis",
      ),
    ),
  );

  const allEntities = useBackendCanvasStore(
    useShallow((s) =>
      s.nodes.filter(
        (n) =>
          n?.type === "entity" &&
          n.data?.dbType !== "vector" &&
          n.data?.dbType !== "redis",
      ),
    ),
  );

  const selectedTable = allEntities.find((e) => e.id === data.tableRef);
  const selectedDatabaseId =
    data.databaseId || selectedTable?.data?.databaseId;
  const selectedDatabase = databaseInstances.find(
    (n) => n.id === selectedDatabaseId,
  );
  const parentDatabase = nodes.find(
    (n) => n.id === (selectedTable?.data?.databaseId || selectedDatabaseId),
  );

  const filteredEntities = useMemo(() => {
    if (!selectedDatabaseId || selectedDatabaseId === "__all__")
      return allEntities;
    const directMatches = allEntities.filter(
      (e) =>
        e.data?.databaseId === selectedDatabaseId ||
        edges.some(
          (edge) =>
            (edge.source === selectedDatabaseId && edge.target === e.id) ||
            (edge.target === selectedDatabaseId && edge.source === e.id),
        ),
    );
    return directMatches.length > 0 ? directMatches : allEntities;
  }, [allEntities, selectedDatabaseId, edges]);

  const operations: DbOperationFunction[] = useMemo(() => {
    if (!selectedTable) return [];
    return getEntityDbOperations(selectedTable, nodes);
  }, [selectedTable, nodes]);

  const engineName =
    selectedDatabase?.data?.dbEngine ||
    parentDatabase?.data?.dbEngine ||
    selectedDatabase?.data?.dbType ||
    parentDatabase?.data?.dbType;

  const handleOpenConfig = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveConfigItem({
      id,
      nodeId: id,
      type: "db_ref",
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestDeleteNode(id);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 p-2.5 rounded-xl bg-card/95 backdrop-blur border-2 min-w-[210px] max-w-[260px] shadow-md transition-all duration-150 cursor-pointer select-none",
        selected
          ? "border-orange-500 shadow-orange-500/15 ring-1 ring-orange-500/20"
          : "border-border/80 hover:border-orange-500/50 hover:shadow-lg",
        borderClass,
      )}
      onDoubleClick={handleOpenConfig}
    >
      {/* Top row: Icon + Title + Engine Badge + Action Buttons */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25 shrink-0">
            <Database size={12} />
          </div>
          <span className="text-[9px] uppercase font-bold tracking-wider text-orange-600 dark:text-orange-400 truncate">
            Table Ref
          </span>
          {engineName && (
            <span className="text-[7px] font-mono px-1 py-0.2 rounded font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 uppercase shrink-0">
              {engineName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
            onClick={handleOpenConfig}
            title="Configure Database"
          >
            <Settings size={12} />
          </button>
          <button
            className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleDelete}
            title="Delete Node"
          >
            <Trash size={12} />
          </button>
        </div>
      </div>

      {/* Dropdowns in flex-col */}
      <div className="flex flex-col gap-1.5 nodrag">
        {/* 1. Database Selector */}
        <Select
          value={selectedDatabaseId || "__all__"}
          onValueChange={(val) => {
            const newDbId = val === "__all__" ? "" : val;
            const currentTable = allEntities.find((e) => e.id === data.tableRef);
            const belongsToNew =
              !newDbId ||
              (currentTable &&
                (currentTable.data?.databaseId === newDbId ||
                  edges.some(
                    (e) =>
                      (e.source === newDbId && e.target === currentTable.id) ||
                      (e.target === newDbId && e.source === currentTable.id),
                  )));

            updateNode(id, {
              data: {
                ...data,
                databaseId: newDbId || undefined,
                tableRef: belongsToNew ? data.tableRef : undefined,
                label: belongsToNew ? data.label : "Table Ref",
              },
            });
          }}
        >
          <SelectTrigger className="h-6 w-full text-[11px] font-medium bg-background/50 border-border/70 hover:border-orange-500/50 px-2 py-0 truncate overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Server size={11} className="text-orange-500/80 shrink-0" />
              <span className="truncate">
                {selectedDatabase?.data?.label || (selectedDatabaseId && selectedDatabaseId !== "__all__" ? "Database" : "All Databases")}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="nodrag z-[100]">
            <SelectItem value="__all__" className="text-xs">
              All Databases
            </SelectItem>
            {databaseInstances.map((inst) => (
              <SelectItem key={inst.id} value={inst.id} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                  <span className="truncate">{inst.data?.label || "Database"}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 2. Table Selector */}
        <Select
          value={data.tableRef || ""}
          onValueChange={(val) => {
            const entity = allEntities.find((e) => e.id === val);
            updateNode(id, {
              data: {
                ...data,
                tableRef: val,
                databaseId:
                  entity?.data?.databaseId || selectedDatabaseId || data.databaseId,
                label: entity?.data?.label || "Table Ref",
                graphPosition: entity?.position,
              },
            });
          }}
        >
          <SelectTrigger className="h-6 w-full text-[11px] font-semibold bg-background/50 border-border/70 hover:border-orange-500/50 px-2 py-0 truncate overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Table2 size={11} className="text-orange-500 shrink-0" />
              <span className="truncate">
                {selectedTable?.data?.label || "Select Table..."}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="nodrag z-[100]">
            {filteredEntities.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic">
                {selectedDatabaseId && selectedDatabaseId !== "__all__"
                  ? "No tables for this database"
                  : "No tables defined"}
              </div>
            ) : (
              filteredEntities.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs">
                  {e.data?.label || "Untitled Table"}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Functions / Operations List */}
      {selectedTable && operations.length > 0 && (
        <div className="flex flex-col gap-1 pt-1.5 border-t border-border/50">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1">
              <Code2 size={10} className="text-orange-500" />
              Operations
            </span>
            <span className="text-[8px] font-mono text-muted-foreground/60">
              {operations.length}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {operations.map((op) => {
              const isConnected = edges.some(
                (e) =>
                  e.target === id &&
                  (e.targetHandle === `func-${op.name}` ||
                    e.targetHandle === `func-${op.id}` ||
                    (!e.targetHandle && op === operations[0])),
              );

              const badgeColor =
                op.kind === "findAll" || op.kind === "findById"
                  ? "bg-blue-500/15 text-blue-500 border-blue-500/25"
                  : op.kind === "create"
                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                  : op.kind === "update"
                  ? "bg-amber-500/15 text-amber-500 border-amber-500/25"
                  : op.kind === "delete"
                  ? "bg-rose-500/15 text-rose-500 border-rose-500/25"
                  : "bg-purple-500/15 text-purple-500 border-purple-500/25";

              const badgeLabel =
                op.kind === "findAll"
                  ? "ALL"
                  : op.kind === "findById"
                  ? "BY ID"
                  : op.kind === "create"
                  ? "NEW"
                  : op.kind === "update"
                  ? "SET"
                  : op.kind === "delete"
                  ? "DEL"
                  : "FN";

              return (
                <div
                  key={op.id || op.name}
                  className={cn(
                    "relative flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[10px] border transition-colors",
                    isConnected
                      ? "bg-orange-500/10 border-orange-500/40 text-foreground font-medium"
                      : "bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {/* Target Handle for this specific function */}
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={`func-${op.name}`}
                    className={cn(
                      "w-2 h-2 -left-1 border border-background transition-all",
                      isConnected
                        ? "!bg-orange-500 ring-2 ring-orange-500/30"
                        : "!bg-muted-foreground/50 hover:!bg-orange-400",
                    )}
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                  />
                  {op.id && op.id !== op.name && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={`func-${op.id}`}
                      className="opacity-0 pointer-events-none -left-1"
                      style={{ top: "50%", transform: "translateY(-50%)" }}
                    />
                  )}

                  <span className="font-mono truncate" title={op.signature || op.name}>
                    {op.name}
                  </span>

                  <span
                    className={cn(
                      "text-[8px] font-bold px-1 py-0.2 rounded border uppercase shrink-0 font-mono",
                      badgeColor,
                    )}
                  >
                    {badgeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback Target Handle on Left for backward compatibility */}
      <Handle
        type="target"
        position={Position.Left}
        id="database-target"
        className="w-2.5 h-2.5 !bg-orange-500 border-2 border-background"
        style={{ top: "20px" }}
      />
    </div>
  );
};
