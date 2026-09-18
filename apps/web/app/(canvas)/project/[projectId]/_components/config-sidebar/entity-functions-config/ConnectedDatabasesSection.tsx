"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Database, Plus, Table, Layers, ArrowRightLeft, X } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Badge } from "@workspace/ui/components/badge";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Button } from "@workspace/ui/components/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@workspace/ui/components/combobox";
import { cn } from "@workspace/ui/lib/utils";
import { toVarName } from "@/lib/compiler/utils";

export interface ConnectedDatabaseTableInfo {
  id: string;
  name: string;
  columns: Array<{ name: string; type: string; isPrimaryKey?: boolean }>;
  isCurrent: boolean;
}

export interface ConnectedDatabaseInfo {
  id: string;
  label: string;
  engine: string;
  isRedis: boolean;
  isPrimary: boolean;
  varName: string;
  importPath: string;
  tables?: ConnectedDatabaseTableInfo[];
}

interface ConnectedDatabasesSectionProps {
  allNodes: BackendNode[];
  parentDb?: BackendNode;
  currentTableName?: string;
  selectedDbIds?: string[];
  connectedTableNames?: string[];
  onToggleDb: (dbId: string) => void;
  onUpdateConnectedTables?: (tableNames: string[]) => void;
  onInsertSnippet?: (snippet: string) => void;
}

export const ConnectedDatabasesSection: React.FC<ConnectedDatabasesSectionProps> = React.memo(({
  allNodes = [],
  parentDb,
  currentTableName = "",
  selectedDbIds = [],
  connectedTableNames,
  onToggleDb,
  onUpdateConnectedTables,
  onInsertSnippet,
}) => {
  const primaryDbLabel = parentDb?.data?.label || "Primary Database";
  const primaryDbEngine = parentDb?.data?.dbEngine || parentDb?.data?.dbType || "sqlite";

  // Tables belonging to the primary database
  const primaryTables: ConnectedDatabaseTableInfo[] = useMemo(() => {
    return allNodes
      .filter((n) => n.type === "entity")
      .map((n) => {
        const tableName = n.data?.label || "table";
        const cols = (n.data?.columns || []).map((c) => ({
          name: c.name || "column",
          type: c.type || "string",
          isPrimaryKey: c.isPrimaryKey,
        }));
        const isCurrent =
          tableName.toLowerCase() === currentTableName.toLowerCase();
        return {
          id: n.id,
          name: tableName,
          columns: cols,
          isCurrent,
        };
      });
  }, [allNodes, currentTableName]);

  const tableMap: Map<string, ConnectedDatabaseTableInfo> = useMemo(() => {
    const map = new Map<string, ConnectedDatabaseTableInfo>();
    for (const t of primaryTables) {
      map.set(t.name.toLowerCase(), t);
    }
    return map;
  }, [primaryTables]);

  const currentTable: ConnectedDatabaseTableInfo | undefined = useMemo(() => {
    return primaryTables.find((t) => t.isCurrent);
  }, [primaryTables]);

  // Added table names state (local or controlled via props)
  const [localAddedTableNames, setLocalAddedTableNames] = useState<string[]>(
    () => connectedTableNames || [],
  );

  useEffect(() => {
    if (connectedTableNames) {
      setLocalAddedTableNames(connectedTableNames);
    }
  }, [connectedTableNames]);

  const activeAddedTableNames = connectedTableNames ?? localAddedTableNames;

  // Tables that are already added to this section
  const displayedAddedTables: ConnectedDatabaseTableInfo[] = useMemo(() => {
    return primaryTables.filter(
      (t) =>
        !t.isCurrent &&
        activeAddedTableNames.some(
          (name) => name.toLowerCase() === t.name.toLowerCase(),
        ),
    );
  }, [primaryTables, activeAddedTableNames]);

  // Tables remaining to be added (excluding current table and already added tables)
  const availableTablesToAdd: ConnectedDatabaseTableInfo[] = useMemo(() => {
    return primaryTables.filter(
      (t) =>
        !t.isCurrent &&
        !activeAddedTableNames.some(
          (name) => name.toLowerCase() === t.name.toLowerCase(),
        ),
    );
  }, [primaryTables, activeAddedTableNames]);

  const availableTableNames: string[] = useMemo(() => {
    return availableTablesToAdd.map((t) => t.name);
  }, [availableTablesToAdd]);

  const handleAddTable = (tableName: string) => {
    const trimmed = tableName.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === currentTableName.toLowerCase()) return;
    if (
      activeAddedTableNames.some(
        (t) => t.toLowerCase() === trimmed.toLowerCase(),
      )
    )
      return;

    const next = [...activeAddedTableNames, trimmed];
    setLocalAddedTableNames(next);
    if (onUpdateConnectedTables) {
      onUpdateConnectedTables(next);
    }
  };

  const handleRemoveTable = (tableName: string) => {
    const next = activeAddedTableNames.filter(
      (t) => t.toLowerCase() !== tableName.toLowerCase(),
    );
    setLocalAddedTableNames(next);
    if (onUpdateConnectedTables) {
      onUpdateConnectedTables(next);
    }
  };

  const handleAddAll = () => {
    const allNonCurrent = primaryTables
      .filter((t) => !t.isCurrent)
      .map((t) => t.name);
    setLocalAddedTableNames(allNonCurrent);
    if (onUpdateConnectedTables) {
      onUpdateConnectedTables(allNonCurrent);
    }
  };

  const handleClearAll = () => {
    setLocalAddedTableNames([]);
    if (onUpdateConnectedTables) {
      onUpdateConnectedTables([]);
    }
  };

  // Other relational databases on canvas (strictly excluding Redis)
  const otherDbs: ConnectedDatabaseInfo[] = useMemo(() => {
    return allNodes
      .filter(
        (n) =>
          n.type === "database" &&
          n.data?.dbEngine !== "redis" &&
          n.data?.dbType !== "redis" &&
          n.id !== parentDb?.id,
      )
      .map((n) => {
        const engine = n.data?.dbEngine || n.data?.dbType || "sqlite";
        const rawLabel = n.data?.label || `${engine.toUpperCase()} DB`;
        const cleanVar = `${toVarName(rawLabel)}Db`;
        const dbTables: ConnectedDatabaseTableInfo[] = allNodes
          .filter((t) => t.type === "entity" && t.data?.databaseId === n.id)
          .map((t) => ({
            id: t.id,
            name: t.data?.label || "table",
            columns: (t.data?.columns || []).map((c) => ({
              name: c.name || "column",
              type: c.type || "string",
              isPrimaryKey: c.isPrimaryKey,
            })),
            isCurrent: false,
          }));

        return {
          id: n.id,
          label: rawLabel,
          engine,
          isRedis: false,
          isPrimary: false,
          varName: cleanVar,
          importPath: `@/lib/db/${cleanVar}`,
          tables: dbTables,
        };
      });
  }, [allNodes, parentDb?.id]);

  const selectedSet = useMemo(() => new Set(selectedDbIds || []), [selectedDbIds]);

  const totalVisibleCount = (currentTable ? 1 : 0) + displayedAddedTables.length;

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border/60 bg-card/40 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Database & Tables
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Tables available for queries and joins in this function
        </span>
      </div>

      {/* Primary Database Badge */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-[11px] text-muted-foreground">Primary Database:</span>
        <Badge
          variant="outline"
          className="gap-1.5 font-mono text-[11px] bg-blue-500/10 text-blue-400 border-blue-500/30 py-0.5"
        >
          <Database size={11} />
          <span>{primaryDbLabel}</span>
          <span className="text-[9px] opacity-75 font-sans uppercase">
            ({primaryDbEngine} · `db` client)
          </span>
        </Badge>
      </div>

      {/* Tables in this Function */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
            <Layers size={11} />
            <span>
              Active Tables for this Function ({totalVisibleCount}/{primaryTables.length})
            </span>
          </span>

          <div className="flex items-center gap-2 text-[10px]">
            {availableTablesToAdd.length > 0 && (
              <button
                type="button"
                onClick={handleAddAll}
                className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                + Add All ({availableTablesToAdd.length})
              </button>
            )}
            {displayedAddedTables.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Clear Added
              </button>
            )}
          </div>
        </div>

        {/* Combobox Search & Add Table */}
        <div className="relative nodrag" onClick={(e) => e.stopPropagation()}>
          <Combobox
            items={availableTableNames}
            value=""
            onValueChange={(nextVal) => {
              if (typeof nextVal === "string" && nextVal.trim()) {
                handleAddTable(nextVal.trim());
              }
            }}
          >
            <ComboboxInput
              placeholder={
                availableTableNames.length > 0
                  ? `Search and add a table (${availableTableNames.length} available)...`
                  : "All database tables added to this function"
              }
              disabled={availableTableNames.length === 0}
              className="h-8 w-full text-xs font-mono bg-secondary/40 border border-border/50 shadow-none focus-visible:ring-1"
            />
            <ComboboxContent
              className="w-[var(--anchor-width)] p-0 shadow-2xl border border-border/80 bg-popover text-popover-foreground rounded-xl z-50 overflow-hidden"
              align="start"
              sideOffset={4}
            >
              <ComboboxEmpty className="py-4 text-center text-xs text-muted-foreground">
                No matching tables found.
              </ComboboxEmpty>
              <ComboboxList className="max-h-60 overflow-y-auto no-scrollbar p-1 bg-popover text-popover-foreground hide-scrollbar">
                {(tableName: string) => {
                  const tbl = tableMap.get(tableName.toLowerCase());
                  return (
                    <ComboboxItem
                      key={tableName}
                      value={tableName}
                      className="flex items-center justify-between py-1.5 px-2 text-xs font-mono cursor-pointer rounded-md hover:bg-accent hover:text-accent-foreground"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Table className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-foreground">{tableName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {tbl && (
                          <span className="text-[10px] text-muted-foreground/70">
                            {tbl.columns.length} cols
                          </span>
                        )}
                        <span className="text-[10px] font-sans font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          + Add
                        </span>
                      </div>
                    </ComboboxItem>
                  );
                }}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        {/* Display Active Tables (Current Table + User-added Tables) */}
        <div className="grid grid-cols-1 gap-2 pt-1">
          {/* 1. Current Table (Pinned & Permanent) */}
          {currentTable && (
            <div className="flex flex-col gap-2 p-3 rounded-lg border bg-blue-500/5 border-blue-500/30 transition-colors">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Table size={13} className="text-blue-400" />
                  <span className="text-xs font-mono font-semibold text-foreground">
                    {currentTable.name}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-300 border-blue-500/30"
                  >
                    Current Table
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/70">
                    ({currentTable.columns.length} columns)
                  </span>
                </div>

                {onInsertSnippet && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 bg-blue-500/10 text-blue-300 border-blue-500/25 hover:bg-blue-500/20 cursor-pointer"
                    onClick={() =>
                      onInsertSnippet(
                        `const rows = db.prepare("SELECT * FROM ${currentTable.name} WHERE id = ?").all(id);\n`,
                      )
                    }
                    title={`Insert query snippet for ${currentTable.name}`}
                  >
                    <Plus size={10} />
                    Query Table
                  </Button>
                )}
              </div>

              {/* Columns List Preview */}
              {currentTable.columns.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar pt-1">
                  {currentTable.columns.map((col) => (
                    <span
                      key={col.name}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-background/60 border border-border/40 text-foreground/80"
                    >
                      <span className="font-medium text-foreground">{col.name}</span>
                      <span className="text-muted-foreground opacity-75">:{col.type}</span>
                      {col.isPrimaryKey && (
                        <span className="text-[8px] font-semibold text-amber-400 bg-amber-400/10 px-0.5 rounded">
                          PK
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground/60 italic">
                  No columns defined on this table.
                </div>
              )}
            </div>
          )}

          {/* 2. Added Tables */}
          {displayedAddedTables.map((tbl) => {
            const singularForeignId = tbl.name.replace(/s$/, "") + "_id";

            return (
              <div
                key={tbl.id}
                className="flex flex-col gap-2 p-3 rounded-lg border bg-secondary/15 border-border/40 hover:border-border/70 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Table size={13} className="text-muted-foreground" />
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {tbl.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      ({tbl.columns.length} columns)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onInsertSnippet && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1 bg-secondary/50 text-foreground hover:bg-secondary border-border/40 cursor-pointer"
                          onClick={() =>
                            onInsertSnippet(
                              `const ${toVarName(tbl.name)}Rows = db.prepare("SELECT * FROM ${tbl.name} LIMIT 20").all();\n`,
                            )
                          }
                          title={`Insert query snippet for ${tbl.name}`}
                        >
                          <Plus size={10} />
                          Query
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1 bg-secondary/50 text-foreground hover:bg-secondary border-border/40 cursor-pointer"
                          onClick={() =>
                            onInsertSnippet(
                              `// Join ${currentTableName} with ${tbl.name}\nconst joinRows = db.prepare(\n  "SELECT a.*, b.* FROM ${currentTableName} a JOIN ${tbl.name} b ON a.${singularForeignId} = b.id"\n).all();\n`,
                            )
                          }
                          title={`Insert SQL JOIN snippet with ${tbl.name}`}
                        >
                          <ArrowRightLeft size={10} />
                          Join
                        </Button>
                      </>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={() => handleRemoveTable(tbl.name)}
                      title={`Remove ${tbl.name} from this section`}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                </div>

                {/* Columns List Preview */}
                {tbl.columns.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto no-scrollbar pt-1">
                    {tbl.columns.map((col) => (
                      <span
                        key={col.name}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-background/50 border border-border/30 text-foreground/75"
                      >
                        <span className="font-medium text-foreground">{col.name}</span>
                        <span className="text-muted-foreground opacity-75">:{col.type}</span>
                        {col.isPrimaryKey && (
                          <span className="text-[8px] font-semibold text-amber-400 bg-amber-400/10 px-0.5 rounded">
                            PK
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/60 italic">
                    No columns defined
                  </div>
                )}
              </div>
            );
          })}

          {/* Prompt hint when no additional tables added */}
          {displayedAddedTables.length === 0 && primaryTables.length > 1 && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-dashed border-border/40 bg-secondary/5 text-xs text-muted-foreground/70">
              <span>No additional tables added yet.</span>
              <span className="text-[11px] text-muted-foreground/50">
                Use search above to add related tables for queries &amp; JOINs
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Relational Databases (if any exist on canvas) */}
      {otherDbs.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/80">
            Other Relational Databases on Canvas ({otherDbs.length})
          </span>

          <div className="grid grid-cols-1 gap-2">
            {otherDbs.map((otherDb) => {
              const isSelected = selectedSet.has(otherDb.id);

              return (
                <div
                  key={otherDb.id}
                  className={cn(
                    "flex flex-col gap-2 p-2.5 rounded-lg border transition-colors",
                    isSelected
                      ? "bg-secondary/40 border-primary/40 shadow-sm"
                      : "bg-secondary/15 border-border/40 hover:border-border/80",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleDb(otherDb.id)}
                      />
                      <div className="flex items-center gap-1.5">
                        <Database size={12} className="text-blue-400" />
                        <span className="text-xs font-semibold text-foreground">
                          {otherDb.label}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/30">
                          {otherDb.engine}
                        </span>
                      </div>
                    </label>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                      <span>
                        client: <code className="text-foreground font-semibold">{otherDb.varName}</code>
                      </span>
                    </div>
                  </div>

                  {/* Connected Helper Snippets when selected */}
                  {isSelected && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/30 flex-wrap text-xs">
                      <span className="text-[10px] text-muted-foreground/80 font-mono">
                        import &#123; {otherDb.varName} &#125; from &quot;{otherDb.importPath}&quot;;
                      </span>

                      {onInsertSnippet && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] gap-1 bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/20 cursor-pointer"
                          onClick={() =>
                            onInsertSnippet(
                              `// Query secondary database: ${otherDb.label}\nconst secondaryRows = await ${otherDb.varName}.prepare("SELECT * FROM ... LIMIT 10").all();\n`,
                            )
                          }
                          title="Insert query snippet into function"
                        >
                          <Plus size={10} />
                          Insert Query Snippet
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ConnectedDatabasesSection.displayName = "ConnectedDatabasesSection";
