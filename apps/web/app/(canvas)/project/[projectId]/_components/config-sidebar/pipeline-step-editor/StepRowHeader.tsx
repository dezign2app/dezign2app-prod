"use client";

import React from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { PipelineStepDraft } from "./types";
import { StepTypeMeta } from "./utils";

export interface StepRowHeaderProps {
  step: PipelineStepDraft;
  index: number;
  meta: StepTypeMeta;
  displayVarName: string;
  isUnconfigured: boolean;
  expanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export const StepRowHeader = ({
  step,
  index,
  meta,
  displayVarName,
  isUnconfigured,
  expanded,
  isFirst,
  isLast,
  dragHandleProps,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StepRowHeaderProps) => {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer select-none"
      onClick={onToggleExpand}
    >
      <div
        {...dragHandleProps}
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted/40"
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={13} className="shrink-0" />
      </div>
      <span className="text-[11px] text-muted-foreground/60 w-3.5 shrink-0 font-mono">
        {index + 1}
      </span>
      <span
        className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}
      >
        {meta.icon}
        {meta.label}
      </span>

      {/* Variable assignment view */}
      <span className="text-xs font-mono font-medium text-foreground/90 flex-1 truncate flex items-center gap-1.5">
        <span className="text-muted-foreground/45 font-normal select-none">const</span>
        <span className="text-primary/95 font-semibold">{displayVarName}</span>
        <span className="text-muted-foreground/35 font-normal select-none">=</span>
        {step.functionRef?.name && (
          <span className="text-[11px] text-muted-foreground/75 font-mono truncate max-w-[150px]">
            {step.functionRef.name}(...)
          </span>
        )}
        {step.type === "custom_code" && (
          <span className="text-[11px] text-muted-foreground/50 font-mono italic truncate max-w-[120px]">
            {`{ /* code */ }`}
          </span>
        )}
      </span>

      {/* Unconfigured Warning Badge */}
      {isUnconfigured && (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1 shrink-0">
          <AlertTriangle size={10} />
          Unconfigured
        </span>
      )}

      <div
        className="flex items-center gap-0.5 ml-1"
        onClick={(e) => e.stopPropagation()}
      >
        {!isFirst && (
          <button
            type="button"
            className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
            onClick={onMoveUp}
            title="Move step up"
          >
            <ArrowUp size={11} />
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            className="text-muted-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-muted/40"
            onClick={onMoveDown}
            title="Move step down"
          >
            <ArrowDown size={11} />
          </button>
        )}
        <button
          type="button"
          className="text-destructive/50 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
          onClick={onDelete}
          title="Delete step"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {expanded ? (
        <ChevronDown size={12} className="text-muted-foreground/50 shrink-0" />
      ) : (
        <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />
      )}
    </div>
  );
};
