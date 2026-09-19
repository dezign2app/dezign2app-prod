import React from "react";
import { Database } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { TargetDatabaseSelectorProps } from "./types";

export const TargetDatabaseSelector: React.FC<TargetDatabaseSelectorProps> = ({
  selectedDatabaseId,
  databaseNodes,
  selectedDb,
  schemaEntitiesCount,
  onSelectDatabase,
  onAutoCreateMissingTables,
}) => {
  return (
    <div className="p-3 bg-background/60 rounded-lg border border-border/50 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-foreground">
            Target Database Node
          </span>
        </div>
        {selectedDb && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase font-semibold">
            {selectedDb.data?.dbEngine || "sqlite"}
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Select which database node from your schema this Auth Server operates on.
        Tables and functions will be filtered to this database.
      </p>

      <div className="flex items-center gap-2">
        <Select
          value={selectedDatabaseId || "none"}
          onValueChange={(val: string) => onSelectDatabase(val)}
        >
          <SelectTrigger className="h-8 text-xs font-mono bg-background">
            <SelectValue placeholder="Select Database Node..." />
          </SelectTrigger>
          <SelectContent className="font-mono">
            <SelectItem
              value="none"
              className="text-xs font-mono text-muted-foreground"
            >
              All Database Tables (No DB Filter)
            </SelectItem>
            {databaseNodes.map((db) => (
              <SelectItem
                key={db.id}
                value={db.id}
                className="text-xs font-mono"
              >
                {db.data?.label || "Database"} ({db.data?.dbEngine || "sqlite"})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDatabaseId && schemaEntitiesCount === 0 && (
        <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs text-amber-600 dark:text-amber-400 font-mono">
          <span>No tables in this database yet.</span>
          <button
            type="button"
            onClick={onAutoCreateMissingTables}
            className="font-bold underline hover:text-amber-500 shrink-0 text-[11px]"
          >
            Auto-create Better Auth tables &rarr;
          </button>
        </div>
      )}
    </div>
  );
};
