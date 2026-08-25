"use client";

import React from "react";
import { Terminal as TerminalIcon, Plus, Monitor, Code2, Sparkles } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { WTermTerminal, WTermTerminalHandle } from "@/components/terminal";
import { TerminalSession, TerminalType } from "../types";

interface TerminalViewportProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  terminalRefs: React.MutableRefObject<Map<string, WTermTerminalHandle | null>>;
  onTerminalInput: (sessionId: string, data: string) => void;
  onTerminalResize: (sessionId: string, cols: number, rows: number) => void;
  onNewTab: (type?: TerminalType, shell?: string, title?: string) => void;
}

export function TerminalViewport({
  sessions,
  activeSessionId,
  terminalRefs,
  onTerminalInput,
  onTerminalResize,
  onNewTab,
}: TerminalViewportProps) {
  const isWin =
    typeof navigator !== "undefined" &&
    (navigator.platform?.includes("Win") ||
      navigator.userAgent?.includes("Windows"));

  // Empty State: No active terminals open
  if (sessions.length === 0) {
    return (
      <div className="flex-1 min-h-0 bg-[#090d13] flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
        <div className="relative z-10 max-w-md flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-xl">
            <TerminalIcon className="w-6 h-6 text-sky-400" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">
              No Active Terminals
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Create a terminal session to execute dev scripts, builds, or CLI tools in your workspace directory.
            </p>
          </div>

          {/* Quick Launcher Action Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => onNewTab("shell")}
              className="h-7 px-3 text-xs gap-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Terminal</span>
            </Button>

            {isWin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNewTab("powershell", "powershell.exe", "PowerShell")}
                  className="h-7 px-2.5 text-xs gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 rounded-md"
                >
                  <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>PowerShell</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNewTab("cmd", "cmd.exe", "Command Prompt")}
                  className="h-7 px-2.5 text-xs gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 rounded-md"
                >
                  <Monitor className="w-3.5 h-3.5 text-amber-400" />
                  <span>CMD</span>
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => onNewTab("bash", "bash", "Bash")}
              className="h-7 px-2.5 text-xs gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 rounded-md"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bash</span>
            </Button>
          </div>
        </div>

        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03),transparent_70%)] pointer-events-none" />
      </div>
    );
  }

  // Active Multi-Terminal Viewport
  return (
    <div className="flex-1 min-h-0 bg-[#090d13] relative overflow-hidden">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;

        return (
          <div
            key={session.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-100 ${
              isActive
                ? "opacity-100 z-10 pointer-events-auto"
                : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <WTermTerminal
              ref={(el) => {
                if (el) {
                  terminalRefs.current.set(session.id, el);
                } else {
                  terminalRefs.current.delete(session.id);
                }
              }}
              logs={session.logs}
              rawStream={true}
              interactive={true}
              autoScroll={false}
              onData={(data) => onTerminalInput(session.id, data)}
              onResize={(cols, rows) => onTerminalResize(session.id, cols, rows)}
              placeholder={`${session.title} ready. Type commands...`}
            />
          </div>
        );
      })}
    </div>
  );
}
