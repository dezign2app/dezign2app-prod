import React from "react";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import { Table, GitFork, Wand2 } from "lucide-react";
import { BETTER_AUTH_TABLE_DEFINITIONS } from "@workspace/canvas";
import { BetterAuthTableMappingSectionProps } from "./types";
import { BetterAuthCategoryCard } from "./BetterAuthCategoryCard";
import { BetterAuthTableRow } from "./BetterAuthTableRow";

export const BetterAuthTableMappingSection: React.FC<
  BetterAuthTableMappingSectionProps
> = ({
  categories,
  tableMappings,
  userData,
  schemaEntities,
  onSelectTableMapping,
  onFixSchema,
  onCreateTable,
  onSyncAllRelationships,
  onAutoCreateAllMissingTables,
}) => {
  return (
    <div className="flex flex-col gap-4 p-3.5 bg-background/50 rounded-lg border border-border/40">
      <div className="flex flex-col items-start gap-4 justify-start">
        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Table className="w-3.5 h-3.5 text-primary" /> Better Auth Schema Entity Mapping
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Map official Better Auth tables by feature category or auto-generate missing tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-background shrink-0 font-medium"
            onClick={onSyncAllRelationships}
            title="Connect FK edges between user, session, organization, member, etc."
          >
            <GitFork className="w-3.5 h-3.5 mr-1 text-primary" /> Auto-Link FK Edges
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/30 shrink-0 font-medium"
            onClick={onAutoCreateAllMissingTables}
            title="Create missing tables and backfill missing columns & indexes onto existing canvas tables"
          >
            <Wand2 className="w-3.5 h-3.5 mr-1" /> Auto-Sync Tables & Indexes
          </Button>
        </div>
      </div>

      {/* Category Groups */}
      <div className="flex flex-col gap-5 pt-1">
        {categories.map((cat) => {
          const catTables = BETTER_AUTH_TABLE_DEFINITIONS.filter(
            (def) => def.category === cat.id,
          );

          return (
            <BetterAuthCategoryCard key={cat.id} category={cat}>
              {catTables.map((def) => {
                const rawMappedId =
                  tableMappings[def.key] ||
                  (def.key === "userEntityId"
                    ? userData.userEntityId || userData.userSchemaId
                    : undefined);

                return (
                  <BetterAuthTableRow
                    key={def.key}
                    def={def}
                    mappedId={rawMappedId}
                    schemaEntities={schemaEntities}
                    onSelectEntity={(nextId) =>
                      onSelectTableMapping(def, nextId)
                    }
                    onFixSchema={onFixSchema}
                    onCreateTable={onCreateTable}
                  />
                );
              })}
            </BetterAuthCategoryCard>
          );
        })}
      </div>
    </div>
  );
};
