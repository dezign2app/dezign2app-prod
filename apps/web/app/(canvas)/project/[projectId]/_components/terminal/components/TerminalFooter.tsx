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
    <div className="flex items-center justify-between px-3 py-1 bg-sidebar border-t border-sidebar-border text-[10px] text-muted-foreground shrink-0 font-mono">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/70">Active:</span>
          <span className="text-sidebar-foreground font-medium">
            {activeTitle || "No Active Terminal"}
          </span>
        </span>
        {sessionCount > 0 && (
          <span className="text-muted-foreground/70 hidden sm:inline">
            ({sessionCount} {sessionCount === 1 ? "session" : "sessions"})
          </span>
        )}
        {outputDir && (
          <span className="hidden md:flex items-center gap-1 text-muted-foreground/70 truncate max-w-[260px]">
            <span>dir:</span>
            <span className="text-sidebar-foreground">{outputDir}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground/70">{eventCount} events</span>
        <span className="text-border">|</span>
        <span className="text-sidebar-foreground">
          {inElectron ? "Desktop Native" : "Web Preview"}
        </span>
      </div>
    </div>
  );
}
