"use client";

import React from "react";
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  X,
  Plus,
  Radio,
  ChevronDown,
  Monitor,
  Code2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu";
import { TerminalPanelTab, ServicePortInfo } from "./types";
import { TerminalSession, TerminalType } from "../../../_components/terminal/types";

interface TerminalPanelHeaderProps {
  selectedTab: TerminalPanelTab;
  onTabChange: (tab: TerminalPanelTab) => void;
  portsCount: number;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  activeSession: TerminalSession | null;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onCreateSession: (options?: {
    type?: TerminalType;
    shell?: string;
    title?: string;
  }) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onToggleOpen: () => void;
  onCopy: () => void;
  copied: boolean;
  onClear: () => void;
  hasProjectId: boolean;
}

export function TerminalPanelHeader({
  selectedTab,
  onTabChange,
  portsCount,
  sessions,
  activeSessionId,
  activeSession,
  onSelectSession,
  onCloseSession,
  onCreateSession,
  isMaximized,
  onToggleMaximize,
  onToggleOpen,
  onCopy,
  copied,
  onClear,
  hasProjectId,
}: TerminalPanelHeaderProps) {
  const isWin =
    typeof navigator !== "undefined" &&
    (navigator.platform?.includes("Win") ||
      navigator.userAgent?.includes("Windows"));

  return (
    <div className="h-8 bg-[#161b22] px-3 border-b border-border/40 flex items-center justify-between shrink-0 font-sans">
      {/* Left: VS Code Tabs */}
      <div className="flex items-center space-x-1 h-full">
        <button
          type="button"
          onClick={() => onTabChange("problems")}
          className={`h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
            selectedTab === "problems"
              ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Problems</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-800 text-slate-400 font-mono">
            0
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("output")}
          className={`h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
            selectedTab === "output"
              ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Output</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("terminal")}
          className={`h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
            selectedTab === "terminal"
              ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>Terminal</span>
          {hasProjectId && sessions.length > 1 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-800 text-slate-400 font-mono">
              {sessions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("ports")}
          className={`h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
            selectedTab === "ports"
              ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>Ports</span>
          {portsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-950/80 text-emerald-400 font-mono border border-emerald-800/40">
              {portsCount}
            </span>
          )}
        </button>
      </div>

      {/* Right: VS Code Panel Actions */}
      <div className="flex items-center gap-1">
        {selectedTab === "terminal" && hasProjectId && sessions.length > 0 && (
          <div className="flex items-center gap-1 mr-1">
            {/* Session Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[10px] font-mono text-slate-200 transition-colors"
                  title="Switch active terminal session"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="max-w-[100px] truncate">
                    {activeSession?.title || "1: bash"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-[#161b22] border-slate-700 text-slate-200 text-xs shadow-xl p-1 z-50"
              >
                <DropdownMenuLabel className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  Active Sessions
                </DropdownMenuLabel>
                {sessions.map((s, idx) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs ${
                      s.id === activeSessionId
                        ? "bg-primary/20 text-white font-medium"
                        : "hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Terminal className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{s.title || `Terminal ${idx + 1}`}</span>
                    </div>
                    {sessions.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseSession(s.id);
                        }}
                        className="p-0.5 text-slate-400 hover:text-red-400 rounded transition-colors"
                        title="Close terminal"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add New Session Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Create New Terminal Session"
                  className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-[#161b22] border-slate-700 text-slate-200 text-xs shadow-xl p-1 z-50"
              >
                <DropdownMenuLabel className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  New Terminal
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() =>
                    onCreateSession({
                      type: "shell",
                      title: `Terminal ${sessions.length + 1}`,
                    })
                  }
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span>Default Shell</span>
                </DropdownMenuItem>

                {isWin && (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        onCreateSession({
                          type: "powershell",
                          shell: "powershell.exe",
                          title: `PowerShell ${sessions.length + 1}`,
                        })
                      }
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      <span>PowerShell</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onCreateSession({
                          type: "cmd",
                          shell: "cmd.exe",
                          title: `CMD ${sessions.length + 1}`,
                        })
                      }
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded cursor-pointer"
                    >
                      <Monitor className="w-3.5 h-3.5 text-amber-400" />
                      <span>Command Prompt</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem
                  onClick={() =>
                    onCreateSession({
                      type: "bash",
                      shell: "bash",
                      title: `Bash ${sessions.length + 1}`,
                    })
                  }
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bash</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          title="Copy Output"
          className="h-6 px-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          title="Clear Console / Terminal Buffer"
          className="h-6 px-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleMaximize}
          title={isMaximized ? "Restore Panel Size" : "Maximize Panel Size"}
          className="h-6 px-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          {isMaximized ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleOpen}
          title="Close Panel"
          className="h-6 px-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
