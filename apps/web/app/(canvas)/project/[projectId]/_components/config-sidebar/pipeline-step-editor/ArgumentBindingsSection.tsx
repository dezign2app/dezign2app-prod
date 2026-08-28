"use client";

import React from "react";
import { Plus, Trash } from "lucide-react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { BindingSourceEditor } from "./BindingSourceEditor";
import { StepBinding, ExpectedArg, AvailableSource } from "./types";

export interface ArgumentBindingsSectionProps {
  bindings: StepBinding[];
  expectedArgs?: ExpectedArg[];
  availableSources: AvailableSource[];
  onAddBinding: () => void;
  onUpdateBinding: (index: number, updated: StepBinding) => void;
  onRemoveBinding: (index: number) => void;
  onAutoMapArguments: () => void;
}

export const ArgumentBindingsSection = ({
  bindings,
  expectedArgs = [],
  availableSources,
  onAddBinding,
  onUpdateBinding,
  onRemoveBinding,
  onAutoMapArguments,
}: ArgumentBindingsSectionProps) => {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Argument Bindings
          </Label>
          {bindings.length > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-muted/60 text-muted-foreground">
              {bindings.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors"
            onClick={onAddBinding}
          >
            <Plus size={10} />
            Add arg
          </button>
        </div>
      </div>

      {bindings.length === 0 && (
        <div className="rounded border border-dashed border-border/40 p-2.5 text-center bg-muted/10">
          <p className="text-[10px] text-muted-foreground/60">
            No arguments bound yet.
          </p>
          {expectedArgs.length > 0 ? (
            <p
              className="text-[9px] text-primary/70 mt-0.5 cursor-pointer hover:underline"
              onClick={onAutoMapArguments}
            >
              Click here to auto-map matching fields from available sources.
            </p>
          ) : (
            <p className="text-[9px] text-muted-foreground/40 mt-0.5">
              Click &quot;+ Add arg&quot; to bind function parameters.
            </p>
          )}
        </div>
      )}

      {bindings.map((binding, bi) => (
        <div
          key={bi}
          className="grid grid-cols-[1fr_auto_2.2fr_auto] gap-1.5 items-center bg-background/60 p-1.5 rounded border border-border/40"
        >
          {/* Arg name */}
          <Input
            className="h-7 text-xs font-mono bg-background/70 border-border/60"
            value={binding.argName}
            onChange={(e) =>
              onUpdateBinding(bi, { ...binding, argName: e.target.value })
            }
            placeholder="argName"
          />
          {/* Arrow */}
          <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
          {/* Source & Smart Path Editor */}
          <BindingSourceEditor
            binding={binding}
            availableSources={availableSources}
            onChange={(updated) => onUpdateBinding(bi, updated)}
          />
          {/* Delete */}
          <button
            type="button"
            className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
            onClick={() => onRemoveBinding(bi)}
            title="Remove argument"
          >
            <Trash size={11} />
          </button>
        </div>
      ))}
    </div>
  );
};
