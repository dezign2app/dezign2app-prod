import React, { useState } from "react";
import {
  Table2,
  Database,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Lock,
  KeyRound,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import type { BackendNode } from "@/types/canvas";
import {
  LANGGRAPH_POSTGRES_TABLE_DEFINITIONS,
  LANGGRAPH_REDIS_SCHEMA_DEFINITIONS,
  type LangGraphTableDefinition,
  type LangGraphRedisSchemaDefinition,
} from "../../utils/checkpointerTables";

interface CheckpointerTablesListProps {
  checkpointerType: "postgres" | "redis" | string;
  existingTables: BackendNode[];
  linkedNodeId?: string;
  onCreateTables: () => void;
  className?: string;
}

export function CheckpointerTablesList({
  checkpointerType,
  existingTables,
  linkedNodeId,
  onCreateTables,
  className,
}: CheckpointerTablesListProps) {
  const isRedis = checkpointerType === "redis";
  const isPostgres = checkpointerType === "postgres";

  const postgresDefs = LANGGRAPH_POSTGRES_TABLE_DEFINITIONS;
  const redisDefs = LANGGRAPH_REDIS_SCHEMA_DEFINITIONS;

  const totalExpected = isRedis ? redisDefs.length : postgresDefs.length;

  // Track expanded state for individual table cards
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableName]: !prev[tableName],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    const defs = isRedis ? redisDefs : postgresDefs;
    defs.forEach((d) => {
      nextState[d.name] = expand;
    });
    setExpandedTables(nextState);
  };

  if (!isPostgres && !isRedis) {
    return null;
  }

  // Check which tables are created
  const tableStatusList = (isRedis ? redisDefs : postgresDefs).map((def) => {
    const existingNode = existingTables.find(
      (n) => n.data?.label === def.name || n.data?.tableName === def.name,
    );
    return {
      def,
      isCreated: Boolean(existingNode),
      node: existingNode,
    };
  });

  const createdCount = tableStatusList.filter((t) => t.isCreated).length;
  const missingCount = totalExpected - createdCount;
  const allCreated = createdCount >= totalExpected;

  const accentColor = isRedis ? "red" : "sky";

  return (
    <div className={cn("pt-2 border-t border-border/50 flex flex-col gap-3", className)}>
      {/* Header & Status Indicator */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Table2
            className={cn(
              "w-4 h-4",
              isRedis ? "text-red-500" : "text-sky-500",
            )}
          />
          <span>{isRedis ? "SchemaView Schemas" : "SchemaView Tables"}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({createdCount}/{totalExpected})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {allCreated ? (
            <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All {totalExpected} {isRedis ? "Schemas" : "Tables"} Provisioned
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {missingCount} Missing in SchemaView
            </span>
          )}
          <button
            type="button"
            onClick={() => toggleAll(!Object.values(expandedTables).some(Boolean))}
            className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
          >
            {Object.values(expandedTables).some(Boolean) ? "Collapse All" : "Expand All"}
          </button>
        </div>
      </div>

      {/* Tables List */}
      <div className="flex flex-col gap-2">
        {tableStatusList.map(({ def, isCreated, node }) => {
          const isExpanded = Boolean(expandedTables[def.name]);
          const redisDef = isRedis ? (def as LangGraphRedisSchemaDefinition) : null;
          const postgresDef = !isRedis ? (def as LangGraphTableDefinition) : null;

          return (
            <div
              key={def.name}
              className={cn(
                "rounded-lg border transition-all overflow-hidden",
                isCreated
                  ? "bg-secondary/20 border-border/60 hover:border-border"
                  : "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50",
              )}
            >
              {/* Table Card Header (Click to expand) */}
              <div
                onClick={() => toggleTable(def.name)}
                className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-secondary/40 select-none transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCreated ? (
                    <div
                      className="p-1 rounded bg-emerald-500/10 text-emerald-500 shrink-0"
                      title="Provisioned in SchemaView"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div
                      className="p-1 rounded bg-amber-500/15 text-amber-500 shrink-0 animate-pulse"
                      title="Not yet created in SchemaView"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-foreground truncate">
                        {def.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 font-mono bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 flex items-center gap-0.5"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        langgraph
                      </Badge>
                      {redisDef && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 font-mono uppercase bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        >
                          {redisDef.redisDataStructure}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">
                      {def.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/40">
                    {def.columns.length} {isRedis ? "fields" : "cols"}
                  </span>
                  <div className="text-muted-foreground p-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details Panel */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border/40 bg-background/50 flex flex-col gap-2.5 text-xs">
                  {/* Redis Key Template */}
                  {redisDef && (
                    <div className="flex flex-col gap-1 bg-secondary/30 p-2 rounded border border-border/40 font-mono text-[11px]">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                        <KeyRound className="w-2.5 h-2.5 text-red-500" />
                        Redis Key Pattern
                      </span>
                      <code className="text-red-600 dark:text-red-400 break-all">
                        {redisDef.keyTemplate}
                      </code>
                    </div>
                  )}

                  {/* Columns / Fields Table */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      {isRedis ? "Hash Fields" : "Table Columns"} ({def.columns.length})
                    </span>
                    <div className="flex flex-col divide-y divide-border/30 rounded border border-border/40 bg-card/60 overflow-hidden font-mono text-[11px]">
                      {def.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between px-2.5 py-1.5 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground">
                              {col.name}
                            </span>
                            {col.isPrimaryKey && (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 h-3.5 font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              >
                                PK
                              </Badge>
                            )}
                            {col.isForeignKey && (
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 h-3.5 font-bold uppercase bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                title={
                                  col.references
                                    ? `References ${col.references.table}.${col.references.column}`
                                    : "Foreign Key"
                                }
                              >
                                FK{col.references?.column ? ` → ${col.references.table}.${col.references.column}` : ""}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1.5 py-0 h-4 font-mono text-muted-foreground"
                            >
                              {col.type}
                            </Badge>
                            {col.isNotNull && (
                              <span className="text-[9px] text-muted-foreground opacity-70">
                                NOT NULL
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Table Indexes */}
                  {def.indexes && def.indexes.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                        Indexes ({def.indexes.length})
                      </span>
                      <div className="flex flex-col divide-y divide-border/30 rounded border border-border/40 bg-card/60 overflow-hidden font-mono text-[11px]">
                        {def.indexes.map((idx) => (
                          <div
                            key={idx.name}
                            className="flex items-center justify-between px-2.5 py-1.5 hover:bg-secondary/40 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">
                                {idx.name}
                              </span>
                              {idx.isUnique && (
                                <Badge
                                  variant="outline"
                                  className="text-[8px] px-1 py-0 h-3.5 font-bold uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                >
                                  UQ
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({idx.columns})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Provisioned Status Footer */}
                  <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                    <span>
                      Status:{" "}
                      {isCreated ? (
                        <span className="text-emerald-500 font-semibold">
                          Active in SchemaView
                        </span>
                      ) : (
                        <span className="text-amber-500 font-semibold">
                          Pending Creation
                        </span>
                      )}
                    </span>
                    <span className="italic">Read-only system table</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Creation Action / State Bar */}
      {allCreated ? (
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <div className="flex flex-col">
              <span className="font-medium text-[11px]">
                All checkpointer {isRedis ? "schemas" : "tables"} provisioned with FK & indexes.
              </span>
              <span className="text-[10px] opacity-80">
                Connected via foreign key relations in SchemaView.
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateTables}
            className="h-7 px-2.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 flex items-center gap-1 font-semibold border border-emerald-500/30"
            title="Update or sync foreign key mappings and indexes in SchemaView"
          >
            <RefreshCw className="w-3 h-3" />
            Sync Schema
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button
            variant="default"
            size="sm"
            onClick={onCreateTables}
            disabled={!linkedNodeId}
            className={cn(
              "h-8 text-xs gap-1.5 font-bold text-white shadow-sm cursor-pointer",
              isRedis
                ? "bg-red-600 hover:bg-red-500"
                : "bg-sky-600 hover:bg-sky-500",
            )}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Create {missingCount > 0 ? `${missingCount} Missing` : ""}{" "}
            {isRedis ? "Schemas" : "Tables"} in SchemaView
          </Button>
          <span className="text-[10px] text-muted-foreground leading-tight">
            Creates required LangGraph state checkpoints with system{" "}
            <code className="font-mono text-[9px] bg-secondary/60 px-1 py-0.5 rounded">[LangGraph 🔒]</code> badge
            linked to this {isRedis ? "Redis instance" : "PostgreSQL database"}.
          </span>
        </div>
      )}
    </div>
  );
}
