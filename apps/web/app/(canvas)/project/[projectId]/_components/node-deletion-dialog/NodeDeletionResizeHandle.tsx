"use client";

import React from "react";
import { cn } from "@workspace/ui/lib/utils";

interface NodeDeletionResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
}

export function NodeDeletionResizeHandle({
  onMouseDown,
  isDragging,
}: NodeDeletionResizeHandleProps): React.JSX.Element {
  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "hidden sm:flex relative w-1.5 hover:w-1.5 items-center justify-center cursor-col-resize select-none group shrink-0 transition-colors z-10",
        isDragging ? "bg-red-500/40" : "bg-white/[0.04] hover:bg-red-500/25",
      )}
      title="Drag to resize file list"
    >
      <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      <div
        className={cn(
          "w-[1px] h-full transition-colors",
          isDragging ? "bg-red-500" : "bg-white/[0.08] group-hover:bg-red-500/60",
        )}
      />
    </div>
  );
}
