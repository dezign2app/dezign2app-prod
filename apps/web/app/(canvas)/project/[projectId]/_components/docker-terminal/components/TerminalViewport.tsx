"use client";

import React from "react";
import { WTermTerminal, WTermTerminalHandle } from "@/components/terminal";
import { TerminalTab } from "../types";

interface TerminalViewportProps {
  activeTab: TerminalTab;
  devLogs: string[];
  dockerLogs: string[];
  shellLogs: string[];
  devWtermRef: React.RefObject<WTermTerminalHandle | null>;
  dockerWtermRef: React.RefObject<WTermTerminalHandle | null>;
  shellWtermRef: React.RefObject<WTermTerminalHandle | null>;
  onTerminalInput: (data: string, tab: TerminalTab) => void;
  onShellResize: (cols: number, rows: number) => void;
}

export function TerminalViewport({
  activeTab,
  devLogs,
  dockerLogs,
  shellLogs,
  devWtermRef,
  dockerWtermRef,
  shellWtermRef,
  onTerminalInput,
  onShellResize,
}: TerminalViewportProps) {
  return (
    <div className="flex-1 min-h-0 bg-[#090d13] relative overflow-hidden">
      {/* Tab 1: Dev Server Terminal (Isolated) */}
      <div
        className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
          activeTab === "dev"
            ? "opacity-100 z-10 pointer-events-auto"
            : "opacity-0 z-0 pointer-events-none"
        }`}
      >
        <WTermTerminal
          ref={devWtermRef}
          logs={devLogs}
          rawStream={true}
          interactive={true}
          onData={(data) => onTerminalInput(data, "dev")}
          onResize={onShellResize}
          placeholder='Click "Run Dev" to run pnpm install and launch all apps with hot reload.'
        />
      </div>

      {/* Tab 2: Docker Build Terminal (Isolated) */}
      <div
        className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
          activeTab === "docker"
            ? "opacity-100 z-10 pointer-events-auto"
            : "opacity-0 z-0 pointer-events-none"
        }`}
      >
        <WTermTerminal
          ref={dockerWtermRef}
          logs={dockerLogs}
          rawStream={true}
          interactive={true}
          onData={(data) => onTerminalInput(data, "docker")}
          onResize={onShellResize}
          placeholder='Click "Docker Build" to compile container images and orchestrate with Docker Compose.'
        />
      </div>

      {/* Tab 3: Interactive Shell Terminal (Isolated) */}
      <div
        className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${
          activeTab === "shell"
            ? "opacity-100 z-10 pointer-events-auto"
            : "opacity-0 z-0 pointer-events-none"
        }`}
      >
        <WTermTerminal
          ref={shellWtermRef}
          logs={shellLogs}
          rawStream={true}
          interactive={true}
          onData={(data) => onTerminalInput(data, "shell")}
          onResize={onShellResize}
          placeholder="Interactive shell ready. Type commands and press Enter."
        />
      </div>
    </div>
  );
}
