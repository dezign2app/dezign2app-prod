import React from "react";
import { Plus } from "lucide-react";
import { StepType } from "./types";
import { ADDABLE_STEP_TYPES, STEP_TYPE_META } from "./utils";

export interface AddStepToolbarProps {
  depth?: number;
  onAddStep: (type: StepType) => void;
}

export const AddStepToolbar: React.FC<AddStepToolbarProps> = ({
  depth = 0,
  onAddStep,
}) => {
  if (depth >= 2) {
    return (
      <div className="p-2 rounded border border-dashed border-border/40 text-center bg-muted/20">
        <p className="text-[10px] text-muted-foreground/80">
          Nesting depth limit reached (2 levels). For complex multi-level logic, use a Transformer node.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {ADDABLE_STEP_TYPES.map((type) => {
        const meta = STEP_TYPE_META[type];
        return (
          <button
            key={type}
            type="button"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border/60 bg-secondary/40 hover:bg-secondary text-foreground/80 hover:text-foreground transition-all duration-150 active:scale-95 shadow-xs"
            onClick={() => onAddStep(type)}
          >
            <Plus size={10} className="text-muted-foreground/80" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
};
