"use client";

import React from "react";
import { TerminalTab } from "../types";

interface TerminalFooterProps {
  activeTab: TerminalTab;
  outputDir: string;
  eventCount: number;
  inElectron: boolean;
}

export function TerminalFooter({
  activeTab,
  outputDir,
  eventCount,
  inElectron,
}: TerminalFooterProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-400 shrink-0 font-mono">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-500">Mode:</span>
          <span className="text-zinc-200 font-medium uppercase">{activeTab}</span>
        </span>
        {outputDir && (
          <span className="hidden sm:flex items-center gap-1 text-zinc-500 truncate max-w-[260px]">
            <span>dir:</span>
            <span className="text-zinc-300">{outputDir}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-zinc-500">{eventCount} events</span>
        <span className="text-zinc-600">|</span>
        <span className="text-zinc-400">
          {inElectron ? "Electron Desktop Native" : "Web Preview"}
        </span>
      </div>
    </div>
  );
}
