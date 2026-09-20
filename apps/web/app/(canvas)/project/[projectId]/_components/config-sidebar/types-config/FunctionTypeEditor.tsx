"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { TypeCombobox } from "../TypeCombobox";
import { TypePropertyRow } from "./TypePropertyRow";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { FunctionTypeEditorProps } from "./types";

const RETURN_TYPE_PRESETS = [
  "void",
  "Promise<void>",
  "boolean",
  "string",
  "number",
  "any",
];

export const FunctionTypeEditor: React.FC<FunctionTypeEditorProps> = ({
  currentType,
  otherCustomTypes,
  onAddField,
  onUpdateField,
  onDeleteField,
  onUpdateCurrentType,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* 1. Input Parameters Type Section */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Input Parameters Type Section ({(currentType.fields || []).length})
            </span>
            {otherCustomTypes.length > 0 && (
              <span className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                <Sparkles size={11} /> {otherCustomTypes.length} custom types
              </span>
            )}
          </div>
          {!currentType.isReadOnly && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[10px] gap-1 rounded-full px-3 cursor-pointer"
              onClick={onAddField}
            >
              <Plus size={12} /> Add Parameter
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 mt-1">
          {(currentType.fields || []).map((f) => (
            <TypePropertyRow
              key={f.id}
              field={f}
              otherCustomTypes={otherCustomTypes}
              readOnly={Boolean(currentType.isReadOnly)}
              onUpdate={(updates) => onUpdateField(f.id, updates)}
              onDelete={() => onDeleteField(f.id)}
            />
          ))}

          {(currentType.fields || []).length === 0 && (
            <span className="text-xs text-muted-foreground/60 italic py-2">
              No input parameters defined (accepts 0 arguments). Click &quot;Add Parameter&quot; above.
            </span>
          )}
        </div>
      </div>

      {/* 2. Output Type Section */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Output Type Section
          </span>
          <div className="flex items-center gap-1">
            {RETURN_TYPE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onUpdateCurrentType({ returnType: preset })}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer",
                  (currentType.returnType || "void") === preset
                    ? "bg-primary/20 text-primary font-semibold ring-1 ring-primary/30"
                    : "bg-secondary/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TypeCombobox
            value={currentType.returnType || "void"}
            onValueChange={(val) => onUpdateCurrentType({ returnType: val })}
            className="w-full text-xs font-mono"
            placeholder="Output / Return type (e.g. void, Promise<User>, boolean)..."
          />
        </div>
        <span className="text-[11px] text-muted-foreground/70">
          Specify what this function produces or returns. Select a custom type or type any valid TypeScript return type.
        </span>
      </div>
    </div>
  );
};
