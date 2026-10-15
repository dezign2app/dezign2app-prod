"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Database,
  Rocket,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Zap,
  CheckCircle2,
  Trash2,
  Download,
} from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  checkDbTableSync,
  applyDbTableSync,
  CheckDbTableSyncResult,
  CanvasForeignKey,
  PrerequisiteTableDefinition,
} from "@/lib/services/databaseService";
import { toast } from "sonner";

export interface EntityDbSyncBannerProps {
  entityId: string;
  tableName: string;
  schema?: string;
  columns: Array<{
    name: string;
    type: string;
    isPrimaryKey?: boolean;
    isNotNull?: boolean;
    isUnique?: boolean;
    isForeignKey?: boolean;
    references?: {
      table: string;
      column: string;
    };
  }>;
  indexes?: Array<{
    name: string;
    columns: string;
    isUnique?: boolean;
  }>;
  foreignKeys?: Array<CanvasForeignKey>;
  databaseNode?: BackendNode;
}

export const EntityDbSyncBanner: React.FC<EntityDbSyncBannerProps> = ({
  entityId,
  tableName,
  schema,
  columns,
  indexes = [],
  foreignKeys,
  databaseNode,
}) => {
  const [syncStatus, setSyncStatus] = useState<CheckDbTableSyncResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dbData = (databaseNode?.data || {}) as NonNullable<BackendNode["data"]>;
  const engine = (dbData.dbEngine || "postgres").toLowerCase();
  const isSupportedEngine = engine === "postgres" || engine === "sqlite";

  // Derive foreign keys from columns or explicit prop
  const derivedForeignKeys = React.useMemo<CanvasForeignKey[]>(() => {
    if (foreignKeys && foreignKeys.length > 0) return foreignKeys;
    return (columns || [])
      .filter((c) => c.isForeignKey && c.references?.table && c.references?.column)
      .map((c) => ({
        column: c.name,
        foreignTable: c.references!.table,
        foreignColumn: c.references!.column,
        onDelete: "CASCADE",
      }));
  }, [columns, foreignKeys]);

  // Check if database has active connection config
  const hasConnectionConfig = Boolean(
    dbData.connectionString ||
      dbData.connectionStringEnv ||
      dbData.connectionStringPooled ||
      dbData.connectionStringPooledEnv ||
      dbData.host ||
      dbData.dbFilePath ||
      dbData.dbFilePathEnv,
  );

  const dbLabel = dbData.label || "Database";
  const dbProvider = dbData.provider || "PostgreSQL";

  // Resolves prerequisite tables on canvas that need to be created first in the live DB
  const resolvePrerequisiteTables = useCallback((): PrerequisiteTableDefinition[] => {
    if (!databaseNode || !derivedForeignKeys.length) return [];
    const store = useBackendCanvasStore.getState();
    const allNodes = store.nodes;
    const missingFks = syncStatus?.missingForeignKeys || derivedForeignKeys;
    const prereqs: PrerequisiteTableDefinition[] = [];
    const visited = new Set<string>();

    for (const fk of missingFks) {
      const targetTableName = fk.foreignTable.trim().toLowerCase();
      if (!targetTableName || visited.has(targetTableName)) continue;
      visited.add(targetTableName);

      const targetNode = allNodes.find(
        (n) =>
          n.type === "entity" &&
          n.id !== entityId &&
          (n.data?.label || "").trim().toLowerCase() === targetTableName,
      );

      if (targetNode && targetNode.data) {
        prereqs.push({
          tableName: targetNode.data.label || fk.foreignTable,
          schema: targetNode.data.schema || schema || "public",
          columns: (targetNode.data.columns || []).map((c) => ({
            name: c.name,
            type: c.type,
            isPrimaryKey: Boolean(c.isPrimaryKey || c.name === "id"),
            isNotNull: Boolean(c.isNotNull),
            isUnique: Boolean(c.isUnique),
          })),
          indexes: (targetNode.data.indexes || []).map((i) => ({
            name: i.name,
            columns: i.columns,
            isUnique: Boolean(i.isUnique),
          })),
        });
      }
    }
    return prereqs;
  }, [databaseNode, derivedForeignKeys, syncStatus?.missingForeignKeys, entityId, schema]);

  const performCheck = useCallback(async () => {
    if (!databaseNode || !isSupportedEngine || !hasConnectionConfig || !tableName) {
      return;
    }

    setIsChecking(true);
    try {
      const result = await checkDbTableSync({
        engine,
        connection: {
          host: dbData.host,
          port: dbData.port,
          database: dbData.database,
          user: dbData.user || dbData.username,
          password: dbData.password,
          connectionString: dbData.connectionString || dbData.connectionStringPooled,
          connectionStringEnv: dbData.connectionStringEnv,
          connectionStringPooled: dbData.connectionStringPooled,
          connectionStringPooledEnv: dbData.connectionStringPooledEnv,
          sslMode: dbData.sslMode,
          provider: dbData.provider,
          dbFilePath: dbData.dbFilePath,
          dbFilePathEnv: dbData.dbFilePathEnv,
        },
        tableName,
        schema,
        columns,
        indexes,
        foreignKeys: derivedForeignKeys,
      });

      setSyncStatus(result);
    } catch {
      // Keep quiet on unhandled network issues
    } finally {
      setIsChecking(false);
    }
  }, [databaseNode, isSupportedEngine, hasConnectionConfig, tableName, schema, columns, indexes, derivedForeignKeys, engine, dbData]);

  // Debounced check on entity schema change or DB configuration change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      performCheck();
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [performCheck]);

  const handleApplySync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!databaseNode || isApplying) return;

    setIsApplying(true);
    try {
      const prerequisiteTables = resolvePrerequisiteTables();
      const res = await applyDbTableSync({
        engine,
        connection: {
          host: dbData.host,
          port: dbData.port,
          database: dbData.database,
          user: dbData.user || dbData.username,
          password: dbData.password,
          connectionString: dbData.connectionString || dbData.connectionStringPooled,
          connectionStringEnv: dbData.connectionStringEnv,
          connectionStringPooled: dbData.connectionStringPooled,
          connectionStringPooledEnv: dbData.connectionStringPooledEnv,
          sslMode: dbData.sslMode,
          provider: dbData.provider,
          dbFilePath: dbData.dbFilePath,
          dbFilePathEnv: dbData.dbFilePathEnv,
        },
        tableName,
        schema,
        columns,
        indexes,
        foreignKeys: derivedForeignKeys,
        prerequisiteTables,
      });

      if (res.success) {
        if (res.appliedPrerequisiteTables && res.appliedPrerequisiteTables.length > 0) {
          toast.success(`Created prerequisite table(s) (${res.appliedPrerequisiteTables.join(", ")})!`);
        }
        if (res.createdTable) {
          const idxMsg = res.appliedIndexes && res.appliedIndexes.length > 0
            ? ` with ${res.appliedIndexes.length} index(es)`
            : "";
          toast.success(`Created table "${tableName}" in ${dbLabel}${idxMsg}!`);
        } else {
          const parts: string[] = [];
          if (res.appliedColumns.length > 0) {
            parts.push(`added ${res.appliedColumns.length} col(s) (${res.appliedColumns.join(", ")})`);
          }
          if (res.appliedIndexes && res.appliedIndexes.length > 0) {
            parts.push(`created ${res.appliedIndexes.length} index(es) (${res.appliedIndexes.join(", ")})`);
          }
          if (res.appliedForeignKeys && res.appliedForeignKeys.length > 0) {
            parts.push(`linked ${res.appliedForeignKeys.length} FK(s) (${res.appliedForeignKeys.join(", ")})`);
          }
          if (res.droppedColumns && res.droppedColumns.length > 0) {
            parts.push(`removed ${res.droppedColumns.length} col(s) (${res.droppedColumns.join(", ")})`);
          }
          if (res.droppedIndexes && res.droppedIndexes.length > 0) {
            parts.push(`dropped ${res.droppedIndexes.length} index(es) (${res.droppedIndexes.join(", ")})`);
          }
          if (res.droppedForeignKeys && res.droppedForeignKeys.length > 0) {
            parts.push(`removed ${res.droppedForeignKeys.length} FK(s)`);
          }
          toast.success(`Updated "${tableName}" in ${dbLabel}: ${parts.join(", ") || "synced"}!`);
        }
        if (res.error) {
          toast.warning(res.error);
        }
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 4000);
        await performCheck();
      } else {
        toast.error(res.error || `Failed to push table schema to ${dbLabel}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error applying table schema");
    } finally {
      setIsApplying(false);
    }
  };

  const handlePullFromDb = (e: React.MouseEvent) => {
    e.stopPropagation();
    const extraCols = syncStatus?.extraColumns || [];
    const extraIdxs = syncStatus?.extraIndexes || [];
    const extraFks = syncStatus?.extraForeignKeys || [];
    if (!extraCols.length && !extraIdxs.length && !extraFks.length) return;
    const store = useBackendCanvasStore.getState();
    const entityNode = store.nodes.find((n) => n.id === entityId);
    if (!entityNode) return;

    let updatedData = { ...entityNode.data };
    let currentCols = [...columns];

    if (extraCols.length > 0) {
      const importedCols = extraCols.map((c) => ({
        name: c.name,
        type: c.type.toLowerCase().includes("time") ? "TIMESTAMPTZ" : c.type.toUpperCase(),
      }));
      currentCols = [...currentCols, ...importedCols];
    }

    if (extraFks.length > 0) {
      currentCols = currentCols.map((col) => {
        const matchedFk = extraFks.find(
          (fk) => fk.column.toLowerCase() === col.name.toLowerCase(),
        );
        if (matchedFk) {
          return {
            ...col,
            isForeignKey: true,
            references: {
              table: matchedFk.foreignTable,
              column: matchedFk.foreignColumn,
            },
          };
        }
        return col;
      });
    }

    updatedData.columns = currentCols;

    if (extraIdxs.length > 0) {
      const importedIdxs = extraIdxs.map((i) => ({
        name: i.name,
        columns: i.columns,
        isUnique: Boolean(i.isUnique),
      }));
      updatedData.indexes = [...(indexes || []), ...importedIdxs];
    }

    store.updateNode(entityId, { data: updatedData });
    const pulledParts = [];
    if (extraCols.length > 0) pulledParts.push(`${extraCols.length} column(s)`);
    if (extraIdxs.length > 0) pulledParts.push(`${extraIdxs.length} index(es)`);
    if (extraFks.length > 0) pulledParts.push(`${extraFks.length} FK(s)`);
    toast.success(`Imported ${pulledParts.join(" & ")} into canvas!`);
  };

  // If no DB node attached, or not a supported engine, or DB is completely unreachable/untested
  if (!databaseNode || !isSupportedEngine || !hasConnectionConfig) {
    return null;
  }

  // If table is verified and in sync (and not just synced), hide banner to keep canvas clean
  if (syncStatus?.inSync && !justSynced) {
    return null;
  }

  // If DB server is unreachable, don't show false alarms unless expanded
  if (syncStatus && !syncStatus.serverReachable && !isExpanded) {
    return null;
  }

  // Just synced confirmation notice
  if (justSynced && syncStatus?.inSync) {
    return (
      <div className="mx-3 my-1.5 p-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 flex items-center justify-between text-[10px] nodrag animate-in fade-in duration-200">
        <div className="flex items-center gap-1.5 font-semibold">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <span>Table &quot;{tableName}&quot; in sync with {dbLabel}</span>
        </div>
      </div>
    );
  }

  const isMissingTable = Boolean(syncStatus?.serverReachable && syncStatus?.tableExists === false);
  const missingCols = syncStatus?.missingColumns || [];
  const extraCols = syncStatus?.extraColumns || [];
  const missingIdxs = syncStatus?.missingIndexes || [];
  const extraIdxs = syncStatus?.extraIndexes || [];
  const missingFks = syncStatus?.missingForeignKeys || [];
  const extraFks = syncStatus?.extraForeignKeys || [];
  const missingPrereqs = syncStatus?.missingPrerequisiteTables || [];

  const totalAdditions = missingCols.length + missingIdxs.length + missingFks.length;
  const totalRemovals = extraCols.length + extraIdxs.length + extraFks.length;
  const hasRemovalsOnly = totalAdditions === 0 && totalRemovals > 0;
  const hasAdditionsOnly = totalAdditions > 0 && totalRemovals === 0;

  return (
    <div className="mx-3 my-1.5 p-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 dark:text-emerald-200 flex flex-col gap-1.5 shadow-xs nodrag transition-all animate-in fade-in duration-200">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Database size={13} className="text-emerald-400 shrink-0" />
          <span className="text-[10px] font-bold text-emerald-300 truncate">
            DB Out of Sync
          </span>
          <span className="text-[7.5px] font-mono px-1 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-300 shrink-0 uppercase tracking-wide">
            {isMissingTable
              ? "TABLE MISSING"
              : hasRemovalsOnly
                ? `${totalRemovals} REMOVED`
                : hasAdditionsOnly
                  ? `${totalAdditions} PENDING`
                  : `${totalAdditions + totalRemovals} PENDING`}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleApplySync}
            disabled={isApplying || isChecking}
            className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[9.5px] transition-colors flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-60"
            title={
              isMissingTable
                ? "Create table, foreign keys, and indexes in live database"
                : hasRemovalsOnly
                  ? "Remove deleted columns/indexes/FKs from live database"
                  : "Push schema changes, foreign keys & indexes to live database"
            }
          >
            {isApplying ? (
              <RefreshCw size={10} className="animate-spin" />
            ) : isMissingTable ? (
              <Plus size={10} />
            ) : hasRemovalsOnly ? (
              <Trash2 size={10} />
            ) : (
              <Rocket size={10} />
            )}
            <span>
              {isApplying
                ? "Pushing..."
                : isMissingTable
                  ? "Create Table"
                  : hasRemovalsOnly
                    ? "Sync Deletions"
                    : "Push to DB"}
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="text-emerald-400/80 hover:text-emerald-200 p-0.5 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer shrink-0"
            title={isExpanded ? "Collapse banner" : "Expand banner"}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Summary Message */}
      <div className="text-[9.5px] text-emerald-200/90 leading-tight">
        {isMissingTable ? (
          <>
            Table <span className="font-semibold text-emerald-100">&quot;{tableName}&quot;</span> does not exist in{" "}
            <span className="font-semibold text-emerald-100">{dbLabel}</span>.
            {missingPrereqs.length > 0 && (
              <span className="text-amber-300 font-semibold ml-1">
                (Will auto-create prerequisite table: {missingPrereqs.join(", ")})
              </span>
            )}
          </>
        ) : hasRemovalsOnly ? (
          <>
            {totalRemovals} item{totalRemovals === 1 ? "" : "s"} (
            {[
              ...extraCols.map((c) => c.name),
              ...extraIdxs.map((i) => `idx:${i.name}`),
              ...extraFks.map((f) => `fk:${f.column}`),
            ].join(", ")}
            ) removed from canvas; pending removal in{" "}
            <span className="font-semibold text-emerald-100">{dbLabel}</span>.
          </>
        ) : hasAdditionsOnly ? (
          <>
            {totalAdditions} item{totalAdditions === 1 ? "" : "s"} (
            {[
              ...missingCols.map((c) => c.name),
              ...missingIdxs.map((i) => `idx:${i.name}`),
              ...missingFks.map((f) => `fk:${f.column}`),
            ].join(", ")}
            ) not yet applied to{" "}
            <span className="font-semibold text-emerald-100">{dbLabel}</span>.
            {missingPrereqs.length > 0 && (
              <span className="text-amber-300 font-semibold ml-1">
                (Will auto-create prerequisite table: {missingPrereqs.join(", ")})
              </span>
            )}
          </>
        ) : (
          <>
            +{totalAdditions} added, -{totalRemovals} removed; pending synchronization with{" "}
            <span className="font-semibold text-emerald-100">{dbLabel}</span>.
          </>
        )}
      </div>

      {/* Expanded Diff & Details */}
      {isExpanded && (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-emerald-500/20 mt-0.5">
          {/* Target DB details */}
          <div className="flex items-center justify-between text-[8.5px] text-emerald-300/80 font-mono">
            <span>Target: {dbLabel} ({dbProvider})</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                performCheck();
              }}
              disabled={isChecking}
              className="hover:text-emerald-100 flex items-center gap-1 cursor-pointer"
              title="Re-check database schema"
            >
              <RefreshCw size={9} className={isChecking ? "animate-spin" : ""} />
              <span>{isChecking ? "Checking..." : "Re-check"}</span>
            </button>
          </div>

          {/* Prerequisite tables notification */}
          {missingPrereqs.length > 0 && (
            <div className="px-1.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[8px] font-mono text-amber-200 flex items-center gap-1">
              <span className="text-amber-400 font-bold shrink-0">AUTO-PREREQUISITES:</span>
              <span className="truncate">Will create canvas table(s): <strong>{missingPrereqs.join(", ")}</strong> first</span>
            </div>
          )}

          {/* Pending columns & indexes & foreign keys diff list */}
          <div className="flex flex-col gap-1 max-h-[110px] overflow-y-auto pr-0.5">
            {isMissingTable ? (
              <>
                <span className="text-[8.5px] font-mono text-emerald-300/90 bg-black/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  + Entire table &quot;{tableName}&quot; ({columns.length} columns{indexes.length > 0 ? `, ${indexes.length} indexes` : ""}{missingFks.length > 0 ? `, ${missingFks.length} FKs` : ""}) will be created
                </span>
                {missingFks.map((fk) => (
                  <div
                    key={`missing-table-fk-${fk.column}-${fk.foreignTable}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-sky-500/30 text-[8.5px] font-mono text-sky-200 flex items-center justify-between"
                  >
                    <span className="text-sky-400 font-semibold flex items-center gap-1">
                      + <span className="text-[7px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold">FK</span> {fk.column}
                    </span>
                    <span className="text-sky-300/70 text-[8px] truncate max-w-[130px]">
                      &rarr; {fk.foreignTable}({fk.foreignColumn})
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <>
                {missingCols.map((col) => (
                  <div
                    key={`add-col-${col.name}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/30 text-[8.5px] font-mono text-emerald-200 flex items-center justify-between"
                  >
                    <span className="text-emerald-400 font-semibold">+ {col.name}</span>
                    <span className="text-emerald-300/70 uppercase text-[8px]">{col.type}</span>
                  </div>
                ))}
                {missingIdxs.map((idx) => (
                  <div
                    key={`add-idx-${idx.name}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/30 text-[8.5px] font-mono text-emerald-200 flex items-center justify-between"
                  >
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      + <span className="text-[7px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">IDX</span> {idx.name}
                    </span>
                    <span className="text-emerald-300/70 text-[8px] truncate max-w-[120px]">
                      {idx.isUnique ? "UQ " : ""}({idx.columns})
                    </span>
                  </div>
                ))}
                {missingFks.map((fk) => (
                  <div
                    key={`add-fk-${fk.column}-${fk.foreignTable}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-sky-500/30 text-[8.5px] font-mono text-sky-200 flex items-center justify-between"
                  >
                    <span className="text-sky-400 font-semibold flex items-center gap-1">
                      + <span className="text-[7px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold">FK</span> {fk.column}
                    </span>
                    <span className="text-sky-300/70 text-[8px] truncate max-w-[130px]">
                      &rarr; {fk.foreignTable}({fk.foreignColumn})
                    </span>
                  </div>
                ))}
                {extraCols.map((col) => (
                  <div
                    key={`drop-col-${col.name}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/30 text-[8.5px] font-mono text-rose-300 flex items-center justify-between"
                  >
                    <span className="text-rose-400 font-semibold">- {col.name}</span>
                    <span className="text-rose-300/70 uppercase text-[8px]">{col.type} (will be dropped)</span>
                  </div>
                ))}
                {extraIdxs.map((idx) => (
                  <div
                    key={`drop-idx-${idx.name}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/30 text-[8.5px] font-mono text-rose-300 flex items-center justify-between"
                  >
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      - <span className="text-[7px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">IDX</span> {idx.name}
                    </span>
                    <span className="text-rose-300/70 text-[8px] truncate max-w-[120px]">
                      ({idx.columns}) (will be dropped)
                    </span>
                  </div>
                ))}
                {extraFks.map((fk) => (
                  <div
                    key={`drop-fk-${fk.name || fk.column}`}
                    className="px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/30 text-[8.5px] font-mono text-rose-300 flex items-center justify-between"
                  >
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      - <span className="text-[7px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">FK</span> {fk.column}
                    </span>
                    <span className="text-rose-300/70 text-[8px] truncate max-w-[130px]">
                      &rarr; {fk.foreignTable}({fk.foreignColumn}) (will be dropped)
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 2-Way Sync: Option to import live DB columns/indexes onto canvas */}
          {totalRemovals > 0 && !isMissingTable && (
            <div className="pt-1.5 flex items-center justify-between border-t border-emerald-500/20 text-[8.5px]">
              <span className="text-emerald-300/80">Want to keep these items?</span>
              <button
                onClick={handlePullFromDb}
                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-[8.5px] flex items-center gap-1 cursor-pointer border border-emerald-500/40 transition-colors"
                title="Import these columns & indexes from live database onto the canvas"
              >
                <Download size={9} />
                <span>Pull {totalRemovals} to Canvas</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
