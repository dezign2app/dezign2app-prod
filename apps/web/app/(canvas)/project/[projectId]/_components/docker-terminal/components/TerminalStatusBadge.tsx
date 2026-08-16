"use client";

import React from "react";
import { AlertCircle, Square } from "lucide-react";
import { ProcessStatus } from "../types";

interface TerminalStatusBadgeProps {
  status: ProcessStatus;
}

export function TerminalStatusBadge({ status }: TerminalStatusBadgeProps) {
  switch (status) {
    case "running":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Running</span>
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-mono">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>Failed</span>
        </span>
      );
    case "stopped":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
          <Square className="w-2 h-2 fill-zinc-400" />
          <span>Stopped</span>
        </span>
      );
    case "idle":
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span>Idle</span>
        </span>
      );
  }
}
