"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import { Terminal as TerminalIcon, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { TerminalTab } from "../types";

interface TerminalDockButtonProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  overallRunning: boolean;
  overallBuilding: boolean;
  activeTab: TerminalTab;
}

export function TerminalDockButton({
  isOpen,
  onToggleOpen,
  overallRunning,
  overallBuilding,
  activeTab,
}: TerminalDockButtonProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <Button
        size="sm"
        onClick={onToggleOpen}
        className={`h-9 px-3.5 gap-2 rounded-full shadow-xl border text-xs font-medium transition-all ${
          isOpen
            ? "bg-zinc-900 text-zinc-100 border-zinc-700 hover:bg-zinc-800"
            : overallRunning
              ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 ring-2 ring-emerald-500/30"
              : overallBuilding
                ? "bg-amber-600 text-white border-amber-500 hover:bg-amber-700"
                : "bg-zinc-900 text-zinc-100 border-zinc-800 hover:bg-zinc-800"
        }`}
      >
        <TerminalIcon
          className={`w-3.5 h-3.5 ${overallRunning ? "text-white" : "text-emerald-400"}`}
        />
        <span className="font-semibold">Terminal</span>
        {overallRunning ? (
          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-700/80 text-[10px] text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Running
          </span>
        ) : overallBuilding ? (
          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-700/80 text-[10px] text-white">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Building
          </span>
        ) : (
          <span className="text-[10px] text-zinc-400 font-mono uppercase">{activeTab}</span>
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
