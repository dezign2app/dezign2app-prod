import React from "react";
import { FunctionSquare, Zap, RotateCcw, Plus } from "lucide-react";
import { DbOperationFunction } from "@workspace/canvas/types";
import { Button } from "@workspace/ui/components/button";
import { FunctionListItem } from "./FunctionListItem";

interface EntityFunctionsListProps {
  label: string;
  autoOps: DbOperationFunction[];
  customOps: DbOperationFunction[];
  onSelectOp: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRegenerateDefaults: () => void;
  onCreateNewFunction: () => void;
  onDeleteRequest: (op: { id: string; name: string }) => void;
}

export const EntityFunctionsList: React.FC<EntityFunctionsListProps> = ({
  label,
  autoOps,
  customOps,
  onSelectOp,
  onToggle,
  onRegenerateDefaults,
  onCreateNewFunction,
  onDeleteRequest,
}) => {
  return (
    <div className="space-y-6 mt-2 pb-12">
      {/* Header */}
      <div className="border-b border-border/50 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FunctionSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold">DB Operation Functions</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs cursor-pointer"
            onClick={onRegenerateDefaults}
            title="Auto-create standard CRUD & fetchByIndex operations based on current schema"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Auto-Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage database operation functions for table{" "}
          <span className="font-semibold text-foreground">{label}</span>. Click
          a function to configure signature, parameters, pagination, and AI
          logic.
        </p>
      </div>

      {/* Auto-Generated Operations Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Standard CRUD & Index Operations ({autoOps.length})
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {autoOps.map((op) => (
            <FunctionListItem
              key={op.id}
              op={op}
              onSelect={onSelectOp}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>

      {/* Custom Database Operations Section */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FunctionSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Custom DB Functions ({customOps.length})
            </h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs gap-1 cursor-pointer"
            onClick={onCreateNewFunction}
          >
            <Plus className="h-3.5 w-3.5" /> Add Function
          </Button>
        </div>

        {customOps.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-4 text-center border border-dashed border-border/60 rounded-lg">
            No custom functions added yet. Click &quot;Add Function&quot; to
            define custom database queries.
          </div>
        ) : (
          <div className="space-y-2">
            {customOps.map((op) => (
              <FunctionListItem
                key={op.id}
                op={op}
                onSelect={onSelectOp}
                onToggle={onToggle}
                onDeleteRequest={onDeleteRequest}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
