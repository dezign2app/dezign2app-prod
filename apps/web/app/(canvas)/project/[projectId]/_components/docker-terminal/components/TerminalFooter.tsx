"use client";

import React from "react";

interface TerminalFooterProps {
  activeTitle?: string;
  sessionCount: number;
  outputDir: string;
  eventCount: number;
  inElectron: boolean;
}

export function TerminalFooter({
  activeTitle,
  sessionCount,
  outputDir,
  eventCount,
  inElectron,
}: TerminalFooterProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-400 shrink-0 font-mono">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="text-zinc-500">Active:</span>
          <span className="text-zinc-200 font-medium">
            {activeTitle || "No Active Terminal"}
          </span>
        </span>
        {sessionCount > 0 && (
          <span className="text-zinc-500 hidden sm:inline">
            ({sessionCount} {sessionCount === 1 ? "session" : "sessions"})
          </span>
        )}
        {outputDir && (
          <span className="hidden md:flex items-center gap-1 text-zinc-500 truncate max-w-[260px]">
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
