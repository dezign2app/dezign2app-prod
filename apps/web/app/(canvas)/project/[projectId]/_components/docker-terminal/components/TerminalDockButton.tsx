"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Terminal as TerminalIcon, ChevronUp, ChevronDown } from "lucide-react";

interface TerminalDockButtonProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  sessionCount: number;
  hasRunningSession: boolean;
}

export function TerminalDockButton({
  isOpen,
  onToggleOpen,
  sessionCount,
  hasRunningSession,
}: TerminalDockButtonProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <Button
        size="sm"
        onClick={onToggleOpen}
        className={`h-9 px-3.5 gap-2 rounded-full shadow-xl border text-xs font-medium transition-all ${
          isOpen
            ? "bg-zinc-900 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
            : hasRunningSession
              ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 ring-2 ring-emerald-500/30"
              : "bg-zinc-900 text-zinc-100 border-zinc-800 hover:bg-zinc-800"
        }`}
      >
        <TerminalIcon
          className={`w-3.5 h-3.5 ${hasRunningSession && !isOpen ? "text-white" : "text-sky-400"}`}
        />
        <span className="font-semibold">Terminal</span>
        {sessionCount > 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {sessionCount}
          </span>
        )}
        {hasRunningSession && !isOpen && (
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        )}
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        )}
      </Button>
    </div>
  );
}
