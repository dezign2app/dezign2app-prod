"use client";

import React from "react";
import {
  Terminal as TerminalIcon,
  Plus,
  Monitor,
  Code2,
  Trash,
  ChevronRight,
  Copy,
  Check,
  ClipboardPaste,
  CheckSquare,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@workspace/ui/components/context-menu";
import { XTermTerminal, XTermTerminalHandle, copyToClipboard } from "@/components/terminal";
import { isElectron } from "@/lib/electron";
import { TerminalSession, TerminalType } from "../types";
import { getShellPrompt } from "../hooks/useDynamicTerminalSessions";
import { toast } from "sonner";

interface TerminalViewportProps {
  projectId?: string;
  outputDir?: string;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  terminalRefs:
    | React.MutableRefObject<Map<string, XTermTerminalHandle | null>>
    | React.RefObject<Map<string, XTermTerminalHandle | null>>;
  onTerminalInput: (sessionId: string, data: string) => void;
  onTerminalResize: (sessionId: string, cols: number, rows: number) => void;
  onNewTab: (type?: TerminalType, shell?: string, title?: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onCloseSession?: (sessionId: string) => void;
  onReplayMissedLogs?: (sessionId: string, fullReset?: boolean) => void;
}

export function TerminalViewport({
  projectId,
  outputDir = "",
  sessions,
  activeSessionId,
  terminalRefs,
  onTerminalInput,
  onTerminalResize,
  onNewTab,
  onSelectSession,
  onCloseSession,
  onReplayMissedLogs,
}: TerminalViewportProps) {
  const inElectron = isElectron();
  const isWin =
    typeof navigator !== "undefined" &&
    (navigator.platform?.includes("Win") ||
      navigator.userAgent?.includes("Windows"));

  const [selectedText, setSelectedText] = React.useState<string>("");
  const [copied, setCopied] = React.useState<boolean>(false);

  // Clear selection state on active session change
  React.useEffect(() => {
    setSelectedText("");
    setCopied(false);
  }, [activeSessionId]);

  const handleCopySelection = React.useCallback(async () => {
    const activeHandle = activeSessionId ? terminalRefs.current?.get(activeSessionId) : null;
    const textToCopy = activeHandle?.getSelection() || selectedText;
    if (textToCopy && textToCopy.trim()) {
      const ok = await copyToClipboard(textToCopy);
      if (ok) {
        setCopied(true);
        toast.success("Selection copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      toast.info("No text selected. Highlight terminal text first, or use 'Copy All'.");
    }
  }, [activeSessionId, terminalRefs, selectedText]);

  const handleCopyAll = React.useCallback(async () => {
    const activeHandle = activeSessionId ? terminalRefs.current?.get(activeSessionId) : null;
    const textToCopy = activeHandle?.getText();
    if (textToCopy && textToCopy.trim()) {
      const ok = await copyToClipboard(textToCopy);
      if (ok) {
        setCopied(true);
        toast.success("Terminal output copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      toast.info("Terminal buffer is empty");
    }
  }, [activeSessionId, terminalRefs]);

  const handlePaste = React.useCallback(async () => {
    if (!activeSessionId) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          onTerminalInput(activeSessionId, text);
          toast.success("Pasted into terminal");
        }
      }
    } catch {
      toast.error("Clipboard access was denied");
    }
  }, [activeSessionId, onTerminalInput]);

  const handleSelectAll = React.useCallback(() => {
    const activeHandle = activeSessionId ? terminalRefs.current?.get(activeSessionId) : null;
    activeHandle?.selectAll?.();
  }, [activeSessionId, terminalRefs]);

  const handleClearActiveTerminal = React.useCallback(() => {
    const activeHandle = activeSessionId ? terminalRefs.current?.get(activeSessionId) : null;
    activeHandle?.clear?.();
    setSelectedText("");
    toast.info("Terminal buffer cleared");
  }, [activeSessionId, terminalRefs]);

  // Auto-fit and focus the active terminal session on session change
  React.useEffect(() => {
    if (!activeSessionId) return;
    const timer = setTimeout(() => {
      const handle = terminalRefs.current?.get(activeSessionId);
      handle?.fit?.();   // recompute cols after panel/tab resize
      handle?.focus?.();
      onReplayMissedLogs?.(activeSessionId);
    }, 40);
    return () => clearTimeout(timer);
  }, [activeSessionId, terminalRefs, onReplayMissedLogs]);

  // Empty State: No active terminals open
  if (sessions.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden bg-[#090d13]">
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

  // Active Multi-Terminal Viewport with Right-Side Terminal Tabs List
  return (
    <div className="w-full h-full flex flex-row flex-1 min-h-0 bg-[#090d13] relative overflow-hidden">
      {/* Left: Active Terminal Viewports */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 h-full min-w-0 relative overflow-hidden bg-[#090d13] select-text">
            {/* Quick Action Floating Bar in Top-Right Corner */}
            <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5 pointer-events-auto select-none">
              {selectedText.trim().length > 0 && (
                <Button
                  size="sm"
                  onClick={handleCopySelection}
                  className="h-6 px-2.5 text-[11px] font-mono gap-1.5 bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-500/20 border border-sky-400/40 rounded transition-all animate-in fade-in zoom-in-95"
                  title="Copy selected text to clipboard (Ctrl+C)"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>
                    {copied
                      ? "Copied!"
                      : `Copy Selection (${
                          selectedText.length > 20
                            ? selectedText.slice(0, 16) + "..."
                            : selectedText.length + " chars"
                        })`}
                  </span>
                </Button>
              )}

              <div className="flex items-center rounded bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-0.5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={selectedText.trim() ? handleCopySelection : handleCopyAll}
                  className="px-2 py-1 flex items-center gap-1 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                  title={
                    selectedText.trim()
                      ? "Copy Selection (Ctrl+C)"
                      : "Copy All Output (Ctrl+Shift+C)"
                  }
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{selectedText.trim() ? "Copy Sel" : "Copy"}</span>
                </button>
                <div className="w-px h-3 bg-slate-700/80 my-auto" />
                <button
                  type="button"
                  onClick={handleClearActiveTerminal}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                  title="Clear Terminal Buffer"
                >
                  <Trash className="w-3 h-3" />
                </button>
              </div>
            </div>

            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;

              return (
                <div
                  key={session.id}
                  className={`absolute inset-0 w-full h-full transition-opacity duration-100 select-text ${
                    isActive
                      ? "opacity-100 z-10 pointer-events-auto"
                      : "opacity-0 z-0 pointer-events-none"
                  }`}
                >
                  <XTermTerminal
                    ref={(el) => {
                      if (el) {
                        terminalRefs.current?.set(session.id, el);
                      } else {
                        terminalRefs.current?.delete(session.id);
                      }
                    }}
                    onReady={() => {
                      const handle = terminalRefs.current?.get(session.id);
                      if (inElectron) {
                        onReplayMissedLogs?.(session.id, true);
                      } else {
                        const targetDir =
                          outputDir || `/workspace/${projectId || "dezign2app"}`;
                        const prompt = getShellPrompt(session.shell, targetDir);
                        handle?.write(
                          `\x1b[36mDezign2App Monorepo Terminal: ${session.title || "Main Terminal"} [Web Preview]\x1b[0m\r\n\x1b[90mWorkspace: ${targetDir}\x1b[0m\r\n\x1b[90mType commands like "help", "pnpm dev", "pnpm build", "docker compose", "clear".\x1b[0m\r\n\r\n${prompt}`,
                        );
                      }
                      handle?.fit?.();
                      handle?.focus?.();
                    }}
                    interactive={true}
                    onSelectionChange={(sel) => {
                      if (session.id === activeSessionId) {
                        setSelectedText(sel);
                      }
                    }}
                    onData={(data) => onTerminalInput(session.id, data)}
                    onResize={(cols, rows) => onTerminalResize(session.id, cols, rows)}
                  />
                </div>
              );
            })}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-[#161b22] border-slate-700 text-slate-200 text-xs shadow-2xl p-1 z-50">
          <ContextMenuItem
            onClick={handleCopySelection}
            disabled={!selectedText.trim()}
            className="gap-2 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-sky-400" />
            <span className="flex-1">Copy Selection</span>
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleCopyAll} className="gap-2 cursor-pointer">
            <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
            <span className="flex-1">Copy All Output</span>
            <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="bg-slate-700/60" />

          <ContextMenuItem onClick={handlePaste} className="gap-2 cursor-pointer">
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
            <span className="flex-1">Paste into Terminal</span>
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleSelectAll} className="gap-2 cursor-pointer">
            <span className="w-3.5" />
            <span className="flex-1">Select All</span>
            <ContextMenuShortcut>Ctrl+Shift+A</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator className="bg-slate-700/60" />

          <ContextMenuItem
            onClick={handleClearActiveTerminal}
            className="gap-2 cursor-pointer text-red-300 hover:text-red-200"
          >
            <Trash className="w-3.5 h-3.5 text-red-400" />
            <span className="flex-1">Clear Buffer</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="bg-slate-700/60" />

          <ContextMenuItem
            onClick={() =>
              onNewTab("shell", undefined, `Terminal ${sessions.length + 1}`)
            }
            className="gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span className="flex-1">New Terminal Tab</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Right: Terminal Sessions List Sidebar & Add Terminal */}
      <div className="w-48 sm:w-56 h-full shrink-0 border-l border-border/40 bg-[#0d1117]/95 flex flex-col font-sans select-none z-20">
        {/* Header of Right Side List */}
        <div className="h-8 px-2.5 flex items-center justify-between border-b border-border/30 text-[11px] text-slate-400 font-medium tracking-wide">
          <span className="flex items-center gap-1.5 uppercase text-[10px] text-slate-400 font-semibold tracking-wider">
            <TerminalIcon className="w-3.5 h-3.5 text-primary" />
            <span>Terminals</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono text-[9px]">
              {sessions.length}
            </span>
          </span>

          {/* + Add Terminal Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-0.5"
                title="New Terminal"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
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
                  onNewTab("shell", undefined, `Terminal ${sessions.length + 1}`)
                }
                className="gap-2 cursor-pointer"
              >
                <TerminalIcon className="w-3.5 h-3.5 text-primary" />
                <span>Default Shell</span>
              </DropdownMenuItem>

              {isWin && (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      onNewTab(
                        "powershell",
                        "powershell.exe",
                        `PowerShell ${sessions.length + 1}`,
                      )
                    }
                    className="gap-2 cursor-pointer"
                  >
                    <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>PowerShell</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onNewTab("cmd", "cmd.exe", `CMD ${sessions.length + 1}`)
                    }
                    className="gap-2 cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5 text-amber-400" />
                    <span>Command Prompt</span>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuItem
                onClick={() =>
                  onNewTab("bash", "bash", `Bash ${sessions.length + 1}`)
                }
                className="gap-2 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bash</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Scrollable list of active terminal sessions */}
        <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1 font-sans text-xs">
          {sessions.map((s, idx) => {
            const isActive = s.id === activeSessionId;
            const lowerShell = (s.shell || s.type || "").toLowerCase();
            let Icon = TerminalIcon;
            let iconColor = "text-primary";
            if (lowerShell.includes("powershell")) {
              Icon = TerminalIcon;
              iconColor = "text-sky-400";
            } else if (lowerShell.includes("cmd")) {
              Icon = Monitor;
              iconColor = "text-amber-400";
            } else if (lowerShell.includes("bash")) {
              Icon = Code2;
              iconColor = "text-emerald-400";
            }

            return (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession?.(s.id);
                  onReplayMissedLogs?.(s.id);
                  setTimeout(() => {
                    terminalRefs.current.get(s.id)?.focus();
                  }, 40);
                }}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs transition-all ${
                  isActive
                    ? "bg-slate-800 text-white font-medium shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                  <span className="truncate text-[11px] font-mono">
                    {s.title || `Terminal ${idx + 1}`}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      s.status === "error"
                        ? "bg-red-400"
                        : "bg-emerald-400 animate-pulse"
                    }`}
                  />
                  {sessions.length > 1 && onCloseSession && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-400 rounded transition-all"
                      title="Close Terminal"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
