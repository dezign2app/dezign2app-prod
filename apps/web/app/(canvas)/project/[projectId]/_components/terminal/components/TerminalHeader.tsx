"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu";
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Folder,
  Archive,
  Maximize2,
  Minimize2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Code2,
  Monitor,
  FolderSync,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TerminalSession, TerminalType } from "../types";
import { AutoSyncStatus } from "../hooks/useAutoDiskSync";

interface TerminalHeaderProps {
  inElectron: boolean;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: (type?: TerminalType, shell?: string, title?: string) => void;
  onRenameTab: (id: string, newTitle: string) => void;
  onClearActiveTab: () => void;
  outputDir: string;
  onPickDirectory: () => void;
  onDownloadZip: () => void;
  downloadingZip: boolean;
  syncStatus?: AutoSyncStatus;
  lastSyncedAt?: Date | null;
  onForceSync?: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

export function TerminalHeader({
  inElectron,
  sessions,
  activeSessionId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onRenameTab,
  onClearActiveTab,
  outputDir,
  onPickDirectory,
  onDownloadZip,
  downloadingZip,
  syncStatus = "idle",
  lastSyncedAt,
  onForceSync,
  isExpanded,
  onToggleExpand,
  onClose,
}: TerminalHeaderProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isWin =
    typeof navigator !== "undefined" &&
    (navigator.platform?.includes("Win") ||
      navigator.userAgent?.includes("Windows"));

  const getRelativeSyncTime = (date: Date | null | undefined): string => {
    if (!date) return "Synced";
    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diffSeconds < 15) return "just now";
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const [relativeSyncTime, setRelativeSyncTime] = useState<string>(() =>
    getRelativeSyncTime(lastSyncedAt),
  );

  useEffect(() => {
    setRelativeSyncTime(getRelativeSyncTime(lastSyncedAt));
    if (!lastSyncedAt) return;

    const interval = setInterval(() => {
      setRelativeSyncTime(getRelativeSyncTime(lastSyncedAt));
    }, 5000);

    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  const formattedSyncTime = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  useEffect(() => {
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSessionId]);

  const handleStartRename = (session: TerminalSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      onRenameTab(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    sessionId: string,
  ) => {
    if (e.key === "Enter") {
      handleSaveRename(sessionId);
    } else if (e.key === "Escape") {
      setEditingSessionId(null);
    }
  };

  const getTabIcon = (session: TerminalSession) => {
    if (session.type === "powershell") {
      return <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />;
    }
    if (session.type === "cmd") {
      return <Monitor className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (session.type === "bash" || session.type === "zsh") {
      return <Code2 className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="flex items-center justify-between h-9 bg-sidebar border-b border-sidebar-border shrink-0 px-2 select-none text-sidebar-foreground">
      {/* Left: Dynamic Tabs Bar */}
      <div className="flex items-center h-full gap-0.5 overflow-x-auto hide-scrollbar max-w-[calc(100%-340px)]">
        {sessions.map((session, index) => {
          const isActive = session.id === activeSessionId;
          const isEditing = session.id === editingSessionId;

          return (
            <div
              key={session.id}
              onClick={() => onSelectTab(session.id)}
              onDoubleClick={() => handleStartRename(session)}
              className={`group relative flex items-center gap-1.5 h-full px-2.5 text-xs transition-colors border-b-2 cursor-pointer ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground border-primary font-semibold"
                  : "bg-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent font-medium"
              }`}
              title="Click to switch tab, double-click to rename"
            >
              {getTabIcon(session)}

              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveRename(session.id)}
                  onKeyDown={(e) => handleKeyDown(e, session.id)}
                  className="w-24 px-1 py-0.5 text-xs bg-sidebar-accent text-sidebar-foreground rounded border border-primary outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[120px]">
                  {session.title || `Terminal ${index + 1}`}
                </span>
              )}

              {session.status === "running" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-80" />
              )}

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(session.id);
                }}
                className="p-0.5 rounded text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-opacity opacity-70 group-hover:opacity-100"
                title="Close terminal (kill process)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Add Terminal (+) Dropdown Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded ml-1"
              title="New Terminal"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-48 bg-sidebar border border-sidebar-border text-sidebar-foreground text-xs shadow-xl rounded-lg p-1 z-50"
          >
            <DropdownMenuLabel className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
              New Terminal
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onNewTab("shell")}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer"
            >
              <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>Default Terminal</span>
            </DropdownMenuItem>

            {isWin && (
              <>
                <DropdownMenuItem
                  onClick={() => onNewTab("powershell", "powershell.exe", "PowerShell")}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer"
                >
                  <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>PowerShell</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onNewTab("cmd", "cmd.exe", "Command Prompt")}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5 text-amber-400" />
                  <span>Command Prompt (CMD)</span>
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuItem
              onClick={() => onNewTab("bash", "bash", "Bash")}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent rounded cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bash / Git Bash</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Terminal Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Real-time Auto-Sync Status Badge (Electron only) */}
        {inElectron && outputDir && (
          <button
            type="button"
            onClick={onForceSync}
            className="flex items-center gap-1.5 h-6 px-2 text-[11px] rounded bg-sidebar-accent/70 hover:bg-sidebar-accent border border-sidebar-border transition-colors text-sidebar-foreground"
            title={
              syncStatus === "syncing"
                ? "Syncing canvas changes to disk..."
                : syncStatus === "synced"
                  ? `Live synced to disk at ${formattedSyncTime || "just now"}. Click to force re-sync.`
                  : syncStatus === "error"
                    ? "Sync error occurred. Click to retry."
                    : "Auto-sync active. Click to force sync."
            }
          >
            {syncStatus === "syncing" ? (
              <>
                <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                <span className="text-sky-300 font-mono hidden md:inline">
                  Syncing...
                </span>
              </>
            ) : syncStatus === "synced" ? (
              <>
                <FolderSync className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-mono hidden md:inline">
                  {lastSyncedAt ? `${relativeSyncTime}` : "Synced"}
                </span>
              </>
            ) : syncStatus === "error" ? (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 font-mono hidden md:inline">
                  Sync Error
                </span>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground font-mono hidden md:inline">
                  Auto-Sync
                </span>
              </>
            )}
          </button>
        )}

        {/* Directory Selector in Desktop */}
        {inElectron ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onPickDirectory}
            className="h-6 px-2 text-[11px] gap-1.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title={
              outputDir ? `Workspace: ${outputDir}` : "Choose workspace directory"
            }
          >
            <Folder className="w-3 h-3 text-muted-foreground" />
            <span className="max-w-[130px] truncate hidden sm:inline font-mono">
              {outputDir ? outputDir.split(/[\\/]/).pop() : "Folder..."}
            </span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDownloadZip}
            disabled={downloadingZip}
            className="h-6 px-2 text-[11px] gap-1.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title="Download complete monorepo ZIP"
          >
            <Archive className="w-3 h-3 text-muted-foreground" />
            <span className="hidden sm:inline">
              {downloadingZip ? "Zipping..." : "ZIP"}
            </span>
          </Button>
        )}

        {/* Clear Active Terminal Output */}
        {activeSessionId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearActiveTab}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title="Clear terminal buffer (Ctrl+L / clear)"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}

        {/* Expand / Minimize */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleExpand}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
          title={isExpanded ? "Restore Size" : "Maximize Terminal"}
        >
          {isExpanded ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
        </Button>

        {/* Close Window */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
          title="Close Terminal Drawer"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
