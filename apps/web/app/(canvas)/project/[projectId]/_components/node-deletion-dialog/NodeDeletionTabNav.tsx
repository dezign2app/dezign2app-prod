"use client";

import React from "react";
import { LayoutGrid, FileCode } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

interface NodeDeletionTabNavProps {
  activeTab: "architecture" | "code";
  onTabChange: (tab: "architecture" | "code") => void;
  canvasImpactCount: number;
  fileImpactCount: number;
}

export function NodeDeletionTabNav({
  activeTab,
  onTabChange,
  canvasImpactCount,
  fileImpactCount,
}: NodeDeletionTabNavProps): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-zinc-900/60 border border-zinc-800/80 rounded-lg w-fit">
      <button
        type="button"
        onClick={() => onTabChange("architecture")}
        className={cn(
          "flex items-center gap-2 py-1 px-3 rounded-md text-xs font-medium transition-all",
          activeTab === "architecture"
            ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent",
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5 text-zinc-400" />
        <span>Architecture Impact</span>
        {canvasImpactCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/50">
            {canvasImpactCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onTabChange("code")}
        className={cn(
          "flex items-center gap-2 py-1 px-3 rounded-md text-xs font-medium transition-all",
          activeTab === "code"
            ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent",
        )}
      >
        <FileCode className="w-3.5 h-3.5 text-zinc-400" />
        <span>Code & Files Diff</span>
        {fileImpactCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/50">
            {fileImpactCount}
          </span>
        )}
      </button>
    </div>
  );
}
