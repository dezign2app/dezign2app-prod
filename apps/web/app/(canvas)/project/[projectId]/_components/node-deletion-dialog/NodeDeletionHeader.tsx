"use client";

import React from "react";
import { AlertDialogTitle, AlertDialogDescription } from "@workspace/ui/components/alert-dialog";
import { AlertTriangle, X } from "lucide-react";

interface NodeDeletionHeaderProps {
  primaryNodeLabel: string;
  nodeCount: number;
  primaryNodeType: string;
  isDeleting: boolean;
  onClose: () => void;
}

export function NodeDeletionHeader({
  primaryNodeLabel,
  nodeCount,
  primaryNodeType,
  isDeleting,
  onClose,
}: NodeDeletionHeaderProps): React.JSX.Element {
  return (
    <div className="p-5 pb-3 border-b border-zinc-800/80 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-zinc-300" />
        </div>

        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertDialogTitle className="text-sm font-semibold text-zinc-100 tracking-tight">
              Delete {nodeCount === 1 ? `"${primaryNodeLabel}"` : `${nodeCount} Selected Nodes`}?
            </AlertDialogTitle>
            <span className="text-[10px] uppercase font-mono tracking-wider font-medium text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.5 rounded">
              {primaryNodeType}
            </span>
          </div>
          <AlertDialogDescription className="text-xs text-zinc-400">
            Review affected canvas connections and dependencies before confirming.
          </AlertDialogDescription>
        </div>
      </div>

      <button
        onClick={onClose}
        disabled={isDeleting}
        className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors shrink-0"
        title="Close dialog"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
