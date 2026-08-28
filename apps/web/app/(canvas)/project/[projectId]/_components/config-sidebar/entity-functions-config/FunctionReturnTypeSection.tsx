import React from "react";
import { Sparkles, Database } from "lucide-react";
import { DbOperationFunction } from "@workspace/canvas/types";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

interface FunctionReturnTypeSectionProps {
  selectedOp: DbOperationFunction;
  pascalLabel: string;
  updateSelectedOp: (changes: Partial<DbOperationFunction>) => void;
}

export const FunctionReturnTypeSection: React.FC<FunctionReturnTypeSectionProps> = ({
  selectedOp,
  pascalLabel,
  updateSelectedOp,
}) => {
  const returnTypeMode = selectedOp.returnTypeMode || "fixed";

  const presets = [
    `${pascalLabel}Row[]`,
    `${pascalLabel}Row | undefined`,
    `${pascalLabel}Row`,
    "void",
    "boolean",
    "number",
    "string",
  ];

  return (
    <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/60 bg-card/40 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
            Function Return Type Contract
          </span>
          <span className="text-[10px] text-muted-foreground">
            Specify fixed TypeScript return type or let AI infer dynamically from function logic.
          </span>
        </div>
      </div>

      {/* Return Type Mode Tabs */}
      <div className="flex items-center justify-between gap-1 bg-background/60 p-1 rounded-lg border border-border/50">
        <button
          type="button"
          onClick={() => updateSelectedOp({ returnTypeMode: "fixed" })}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer",
            returnTypeMode === "fixed"
              ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
          )}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Fixed Type</span>
        </button>

        <button
          type="button"
          onClick={() => updateSelectedOp({ returnTypeMode: "inferred" })}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-medium transition-all cursor-pointer",
            returnTypeMode === "inferred"
              ? "bg-secondary text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Inferred</span>
        </button>
      </div>

      {/* Mode 1: Fixed Type with Presets & Input */}
      {returnTypeMode === "fixed" && (
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-semibold text-muted-foreground">
              TypeScript Return Type Signature
            </Label>
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateSelectedOp({ returnType: preset })}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono transition-all border cursor-pointer",
                  selectedOp.returnType === preset
                    ? "bg-primary/15 text-primary border-primary/40 font-bold"
                    : "bg-background/60 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground",
                )}
              >
                {preset}
              </button>
            ))}
          </div>

          <Input
            placeholder="e.g. UserRow[] or Promise<UserRow | undefined>"
            value={selectedOp.returnType || ""}
            onChange={(e) => updateSelectedOp({ returnType: e.target.value })}
            className="h-8 text-xs font-mono bg-background"
          />
        </div>
      )}

      {/* Mode 2: AI Inferred */}
      {returnTypeMode === "inferred" && (
        <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-border/40">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>AI Dynamic Return Inference</span>
          </div>
          <span>
            The return type will be inferred dynamically by AI from the function logic, entity schema ({pascalLabel}), and query operations.
          </span>
        </div>
      )}
    </div>
  );
};
