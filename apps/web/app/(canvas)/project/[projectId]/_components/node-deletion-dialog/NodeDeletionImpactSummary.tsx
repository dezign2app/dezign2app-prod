"use client";

import React from "react";
import { Badge } from "@workspace/ui/components/badge";
import { FileMinus, FileEdit, HardDrive, Layers } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { getNodeLabel } from "./utils";

interface NodeDeletionImpactSummaryProps {
  nodesPendingDeletion: BackendNode[];
  deletedCount: number;
  modifiedCount: number;
  inDesktop: boolean;
  outputDir: string | null;
}

export function NodeDeletionImpactSummary({
  nodesPendingDeletion,
  deletedCount,
  modifiedCount,
  inDesktop,
  outputDir,
}: NodeDeletionImpactSummaryProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {/* Target Nodes List (if multiple nodes selected) */}
      {nodesPendingDeletion.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
          <span className="text-[11px] font-medium text-zinc-400 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Target Nodes:
          </span>
          {nodesPendingDeletion.map((node) => {
            const label = getNodeLabel(node);
            return (
              <Badge
                key={node.id}
                variant="outline"
                className="text-[11px] border-zinc-700/60 bg-zinc-800/60 text-zinc-300 px-2 py-0.5"
              >
                {label} <span className="text-[9px] text-zinc-500 ml-1 font-mono">({node.type})</span>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Impact Stats & Local Disk Workspace Bar */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-400 text-xs">Files Affected:</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[11px] font-mono">
            <FileMinus className="w-3 h-3 text-zinc-400" />
            {deletedCount} to delete
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[11px] font-mono">
            <FileEdit className="w-3 h-3 text-zinc-400" />
            {modifiedCount} to modify
          </span>
        </div>

        {inDesktop && outputDir && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono truncate max-w-[240px]"
            title={outputDir}
          >
            <HardDrive className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{outputDir}</span>
          </div>
        )}
      </div>
    </div>
  );
}
