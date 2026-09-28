import React from "react";
import { Plus } from "lucide-react";
import type { FrontendActionStepType } from "./types";
import {
  FRONTEND_ADDABLE_STEP_TYPES,
  FRONTEND_STEP_TYPE_META,
} from "./actionStepConstants";

export interface FrontendAddStepToolbarProps {
  onAddStep: (type: FrontendActionStepType) => void;
}

export const FrontendAddStepToolbar: React.FC<FrontendAddStepToolbarProps> = ({
  onAddStep,
}) => {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
      {FRONTEND_ADDABLE_STEP_TYPES.map((type) => {
        const meta = FRONTEND_STEP_TYPE_META[type];
        return (
          <button
            key={type}
            type="button"
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-border/60 bg-secondary/40 hover:bg-secondary text-foreground/85 hover:text-foreground transition-all duration-150 active:scale-95 shadow-xs cursor-pointer select-none"
            onClick={() => onAddStep(type)}
            title={meta.description}
          >
            <Plus size={10} className="text-muted-foreground/80 shrink-0" />
            <span className="shrink-0">{meta.icon}</span>
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
};
