"use client";

import React from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Play,
  Square,
  Folder,
  Copy,
  Check,
  Archive,
  Maximize2,
  Minimize2,
  X,
  Zap,
  Layers,
  Code2,
} from "lucide-react";
import { TerminalTab, ProcessStatus } from "../types";
import { TerminalStatusBadge } from "./TerminalStatusBadge";
import { AutoSyncStatus } from "../hooks/useAutoDiskSync";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface TerminalHeaderProps {
  inElectron: boolean;
  activeTab: TerminalTab;
  setActiveTab: (tab: TerminalTab) => void;
  devStatus: ProcessStatus;
  dockerStatus: ProcessStatus;
  shellActive: boolean;
  outputDir: string;
  onPickDirectory: () => void;
  onDownloadZip: () => void;
  downloadingZip: boolean;
  isExporting: boolean;
  syncStatus?: AutoSyncStatus;
  lastSyncedAt?: Date | null;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: () => void;
  onForceSync?: () => void;
  onStartDev: () => void;
  onStopDev: () => void;
  onStartDocker: () => void;
  onStopDocker: () => void;
  onStartBuild?: () => void;
  onCopyCommand: () => void;
  copiedCmd: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

export function TerminalHeader({
  inElectron,
  activeTab,
  setActiveTab,
  devStatus,
  dockerStatus,
  shellActive,
  outputDir,
  onPickDirectory,
  onDownloadZip,
  downloadingZip,
  isExporting,
  syncStatus = "idle",
  lastSyncedAt,
  autoSyncEnabled = true,
  onToggleAutoSync,
  onForceSync,
  onStartDev,
  onStopDev,
  onStartDocker,
  onStopDocker,
  onStartBuild,
  onCopyCommand,
  copiedCmd,
  isExpanded,
  onToggleExpand,
  onClose,
}: TerminalHeaderProps) {
  const formattedSyncTime = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="flex items-center justify-between h-9 bg-zinc-900 border-b border-zinc-800 shrink-0 px-2 select-none text-zinc-300">
      {/* Left: Terminal Tabs */}
      <div className="flex items-center h-full gap-0.5">
        {/* Dev Server Tab (pnpm i && pnpm dev) */}
        <button
          type="button"
          onClick={() => setActiveTab("dev")}
          className={`flex items-center gap-2 h-full px-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "dev"
              ? "bg-zinc-950 text-zinc-100 border-emerald-500 font-semibold"
              : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
          }`}
        >
          <Zap
            className={`w-3.5 h-3.5 ${activeTab === "dev" ? "text-emerald-400" : "text-zinc-500"}`}
          />
          <span>1: Dev (pnpm dev)</span>
          <TerminalStatusBadge status={devStatus} />
        </button>

        {/* Docker Build Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("docker")}
          className={`flex items-center gap-2 h-full px-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "docker"
              ? "bg-zinc-950 text-zinc-100 border-blue-500 font-semibold"
              : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
          }`}
        >
          <Layers
            className={`w-3.5 h-3.5 ${activeTab === "docker" ? "text-blue-400" : "text-zinc-500"}`}
          />
          <span>2: Docker Build</span>
          <TerminalStatusBadge status={dockerStatus} />
        </button>

        {/* Interactive Shell Tab */}
        {inElectron && (
          <button
            type="button"
            onClick={() => setActiveTab("shell")}
            className={`flex items-center gap-2 h-full px-3 text-xs font-medium transition-colors border-b-2 ${
              activeTab === "shell"
                ? "bg-zinc-950 text-zinc-100 border-purple-500 font-semibold"
                : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border-transparent"
            }`}
          >
            <Code2
              className={`w-3.5 h-3.5 ${activeTab === "shell" ? "text-purple-400" : "text-zinc-500"}`}
            />
            <span>3: Interactive Shell</span>
            {shellActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* Right: Terminal Actions */}
      <div className="flex items-center gap-1">
        {/* Real-time Auto-Sync Status Badge (Electron only) */}
        {inElectron && outputDir && (
          <button
            type="button"
            onClick={onForceSync}
            className="flex items-center gap-1.5 h-6 px-2 text-[11px] rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 transition-colors"
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
                <span className="text-sky-300 font-mono hidden md:inline">Syncing...</span>
              </>
            ) : syncStatus === "synced" ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 font-mono hidden md:inline">
                  {formattedSyncTime ? `Synced ${formattedSyncTime}` : "Synced"}
                </span>
              </>
            ) : syncStatus === "error" ? (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 font-mono hidden md:inline">Sync Error</span>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-zinc-400" />
                <span className="text-zinc-400 font-mono hidden md:inline">Auto-Sync</span>
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
            className="h-6 px-2 text-[11px] gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            title={outputDir ? `Workspace: ${outputDir}` : "Choose workspace directory"}
          >
            <Folder className="w-3 h-3 text-zinc-400" />
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
            className="h-6 px-2 text-[11px] gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            title="Download complete monorepo ZIP"
          >
            <Archive className="w-3 h-3 text-zinc-400" />
            <span className="hidden sm:inline">
              {downloadingZip ? "Zipping..." : "ZIP"}
            </span>
          </Button>
        )}

        {/* Primary Action Button (Start / Stop / Build) for Active Tab */}
        {activeTab === "dev" ? (
          devStatus === "running" || devStatus === "starting" ? (
            <Button
              size="sm"
              onClick={onStopDev}
              className="h-6 px-2.5 text-[11px] gap-1 bg-red-600 hover:bg-red-700 text-white border-0 font-medium"
            >
              <Square className="w-2.5 h-2.5 fill-white" />
              <span>Stop Dev</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onStartDev}
              disabled={isExporting}
              className="h-6 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-medium"
            >
              <Play className="w-2.5 h-2.5 fill-white" />
              <span>Run Dev</span>
            </Button>
          )
        ) : activeTab === "docker" ? (
          dockerStatus === "running" || dockerStatus === "building" ? (
            <Button
              size="sm"
              onClick={onStopDocker}
              className="h-6 px-2.5 text-[11px] gap-1 bg-red-600 hover:bg-red-700 text-white border-0 font-medium"
            >
              <Square className="w-2.5 h-2.5 fill-white" />
              <span>Stop Build</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onStartDocker}
              disabled={isExporting}
              className="h-6 px-2.5 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium"
            >
              <Play className="w-2.5 h-2.5 fill-white" />
              <span>Docker Build</span>
            </Button>
          )
        ) : activeTab === "shell" && inElectron ? (
          <Button
            size="sm"
            onClick={onStartBuild}
            disabled={isExporting}
            className="h-6 px-2.5 text-[11px] gap-1 bg-purple-600 hover:bg-purple-700 text-white border-0 font-medium"
            title="Execute pnpm install && pnpm build in project workspace"
          >
            <Play className="w-2.5 h-2.5 fill-white" />
            <span>Run Build</span>
          </Button>
        ) : null}

        {/* Copy Command */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onCopyCommand}
          className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          title="Copy startup command"
        >
          {copiedCmd ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>


        {/* Expand / Minimize */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleExpand}
          className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
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
          className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          title="Close Terminal"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
