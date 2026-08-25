"use client";

import React, { useMemo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Database, Server, Table2, Settings2, Trash2 } from "lucide-react";
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

export const DatabaseTableRefNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const deleteNode = useBackendCanvasStore((s) => s.deleteNode);
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
    edges
      .filter((e) => e.source === id || e.target === id)
      .forEach((e) => deleteEdge(e.id));
    deleteNode(id);
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
            <Settings2 size={12} />
          </button>
          <button
            className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleDelete}
            title="Delete Node"
          >
            <Trash2 size={12} />
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

      {/* Target Handle on Left */}
      <Handle
        type="target"
        position={Position.Left}
        id="database-target"
        className="w-2.5 h-2.5 !bg-orange-500 border-2 border-background"
      />
    </div>
  );
};
