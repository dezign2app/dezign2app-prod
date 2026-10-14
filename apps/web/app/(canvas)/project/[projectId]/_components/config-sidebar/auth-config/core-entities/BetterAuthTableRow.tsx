import React from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Plus,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { CanvasEntityColumn } from "@workspace/canvas";
import { BetterAuthTableRowProps } from "./types";

interface CanvasEntityIndex {
  name: string;
  columns: string;
  isUnique?: boolean;
}

import { checkEntitySchemaDiscrepancies } from "./hooks/useBetterAuthTableSync";

export const BetterAuthTableRow: React.FC<BetterAuthTableRowProps> = ({
  def,
  mappedId,
  schemaEntities,
  onSelectEntity,
  onFixSchema,
  onCreateTable,
}) => {
  const mappedEntity = schemaEntities.find((e) => e.id === mappedId);

  const {
    isValid: isSchemaValid,
    missingColumns,
    outdatedColumns,
    missingIndexes,
  } = checkEntitySchemaDiscrepancies(mappedEntity, def);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-12 gap-2 items-center p-2 rounded bg-background border border-border/50 text-xs">
        <div className="col-span-3 flex flex-col gap-0.5">
          <span className="font-mono font-bold text-foreground capitalize">
            {def.name}
          </span>
          <span className="text-[10px] text-muted-foreground truncate">
            {def.description}
          </span>
        </div>

        <div className="col-span-6">
          <Select
            value={mappedId || "none"}
            onValueChange={(val: string) =>
              onSelectEntity(val === "none" ? undefined : val)
            }
          >
            <SelectTrigger className="h-7 text-xs font-mono bg-background">
              <SelectValue placeholder="Select Entity Node..." />
            </SelectTrigger>
            <SelectContent className="font-mono">
              <SelectItem
                value="none"
                className="text-xs font-mono text-muted-foreground"
              >
                Unmapped
              </SelectItem>
              {schemaEntities.map((entity) => (
                <SelectItem
                  key={entity.id}
                  value={entity.id}
                  className="text-xs font-mono"
                >
                  {entity.data?.label || "Untitled Entity"} (
                  {entity.data?.columns?.length || 0} cols,{" "}
                  {entity.data?.indexes?.length || 0} idxs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-3 flex justify-end items-center gap-1.5">
          {mappedEntity ? (
            isSchemaValid ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-medium"
                onClick={() =>
                  onFixSchema(
                    mappedEntity.id,
                    def,
                    missingColumns,
                    missingIndexes,
                  )
                }
                title={`Fix: ${[
                  ...missingColumns.map((c: CanvasEntityColumn) => c.name),
                  ...outdatedColumns.map((c: CanvasEntityColumn) => `${c.name} constraints`),
                  ...missingIndexes.map((i: { name: string }) => i.name),
                ].join(", ")}`}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Fix Schema
                {missingIndexes.length > 0 &&
                  missingColumns.length === 0 &&
                  outdatedColumns.length === 0 &&
                  ` (+${missingIndexes.length} idxs)`}
                {missingColumns.length > 0 &&
                  missingIndexes.length === 0 &&
                  outdatedColumns.length === 0 &&
                  ` (+${missingColumns.length} cols)`}
                {(missingColumns.length > 0 || outdatedColumns.length > 0) &&
                  ` (${missingColumns.length > 0 ? `+${missingColumns.length}c` : ""}${outdatedColumns.length > 0 ? `${missingColumns.length > 0 ? ", " : ""}repair` : ""}${missingIndexes.length > 0 ? `, +${missingIndexes.length}i` : ""})`}
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px] bg-background"
              onClick={() => onCreateTable(def)}
            >
              <Plus className="w-3 h-3 mr-1 text-primary" /> Create Table
            </Button>
          )}
        </div>
      </div>

      {/* Schema Missing Columns / Indexes Banner */}
      {mappedEntity && !isSchemaValid && (
        <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10.5px] text-amber-600 dark:text-amber-400 font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Entity <strong>{mappedEntity.data?.label}</strong> needs:{" "}
              {missingColumns.length > 0 && (
                <span className="font-bold underline mr-1">
                  cols ({missingColumns.map((c: CanvasEntityColumn) => c.name).join(", ")})
                </span>
              )}
              {outdatedColumns.length > 0 && (
                <span className="font-bold underline mr-1">
                  constraints ({outdatedColumns.map((c: CanvasEntityColumn) => `${c.name}${c.isNotNull ? " [not-null]" : ""}${c.isUnique ? " [unique]" : ""}`).join(", ")})
                </span>
              )}
              {missingIndexes.length > 0 && (
                <span className="font-bold underline">
                  indexes ({missingIndexes.map((i: { name: string }) => i.name).join(", ")})
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() =>
              onFixSchema(
                mappedEntity.id,
                def,
                missingColumns,
                missingIndexes,
              )
            }
            className="ml-2 font-bold underline hover:text-amber-500 text-[10px] shrink-0"
          >
            Fix Constraints & Schema
          </button>
        </div>
      )}
    </div>
  );
};
