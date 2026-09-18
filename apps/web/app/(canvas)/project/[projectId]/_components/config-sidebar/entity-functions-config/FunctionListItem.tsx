import React from "react";
import { Settings, Trash } from "lucide-react";
import { DbOperationFunction } from "@workspace/canvas/types";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  inferDbOperationReturnType,
  deriveDbFunctionSignature,
} from "@/lib/utils/entityOperationsHelper";

interface FunctionListItemProps {
  op: DbOperationFunction;
  onSelect: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDeleteRequest?: (op: { id: string; name: string }) => void;
}

export const FunctionListItem: React.FC<FunctionListItemProps> = ({
  op,
  onSelect,
  onToggle,
  onDeleteRequest,
}) => {
  const isEnabled = op.enabled !== false;
  const isPaginated = op.pagination?.enabled;
  const effectiveReturnType =
    (op.code && op.code.trim() ? inferDbOperationReturnType(op.code) : null) ||
    op.returnType;
  const liveSignature =
    deriveDbFunctionSignature(op.name, op.params, effectiveReturnType) ||
    op.signature;

  return (
    <div
      className={cn(
        "p-3 rounded-lg border border-border/60 bg-card/40 flex items-start justify-between gap-3 transition-colors hover:border-border cursor-pointer group",
        !isEnabled && "opacity-50 bg-muted/20",
      )}
      onClick={() => onSelect(op.id)}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-sm group-hover:text-primary transition-colors">
            {op.name}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 bg-secondary text-secondary-foreground border border-border/40">
            {op.kind === "fetchByIndex" ? "INDEX" : op.kind}
          </span>
          {isPaginated && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground border border-border/30">
              PAGE ({op.pagination?.mode || "offset"})
            </span>
          )}
        </div>
        {liveSignature ? (
          <div className="text-[11px] font-mono text-muted-foreground truncate">
            {liveSignature}
          </div>
        ) : effectiveReturnType ? (
          <div className="text-[11px] font-mono text-muted-foreground">
            Return: {effectiveReturnType}
          </div>
        ) : null}
        {(op.description || op.prompt || op.query) && (
          <div className="text-xs text-muted-foreground/80 truncate">
            {op.description || op.prompt || op.query}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <Switch
          checked={isEnabled}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(checked) => onToggle(op.id, checked)}
        />
        <div
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          title="Configure operation"
        >
          <Settings size={14} />
        </div>
        {onDeleteRequest && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest({ id: op.id, name: op.name || "Function" });
            }}
            title="Delete Function"
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};
