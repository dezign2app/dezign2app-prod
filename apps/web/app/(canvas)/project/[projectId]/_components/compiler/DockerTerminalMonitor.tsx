"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Terminal as TerminalIcon,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Square,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { openExternalUrl } from "@/lib/electron";
import { WTermTerminal, cleanTerminalText } from "@/components/terminal";

export interface ServiceEndpointInfo {
  name: string;
  port: string;
  url: string;
  type: "service" | "web" | "db" | "redis" | "kafka";
  healthUrl?: string;
  docsUrl?: string;
}

export interface DockerTerminalMonitorProps {
  logs: string[];
  status: "idle" | "building" | "running" | "stopped" | "error";
  onClearLogs?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  isElectron?: boolean;
  services?: ServiceEndpointInfo[];
  projectDir?: string;
}

export function DockerTerminalMonitor({
  logs,
  status,
  onClearLogs,
  onStart,
  onStop,
  isElectron = false,
  services = [],
  projectDir,
}: DockerTerminalMonitorProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    navigator.clipboard.writeText(cleanTerminalText(logs.join("")));
    setCopied(true);
    toast.success("Terminal logs copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (status) {
      case "building":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Building</span>
          </div>
        );
      case "running":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Running</span>
          </div>
        );
      case "stopped":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-medium">
            <Square className="w-3 h-3 fill-zinc-400" />
            <span>Stopped</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </div>
        );
      case "idle":
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            <span>Ready</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl font-mono text-xs">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0 text-zinc-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-100 font-semibold">
            <TerminalIcon className="w-4 h-4 text-emerald-400" />
            <span>Terminal (wterm)</span>
          </div>
          {getStatusBadge()}
          {projectDir && (
            <span className="text-[10px] text-zinc-400 truncate max-w-[220px]">
              {projectDir}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isElectron && (
            <>
              {status === "running" || status === "building" ? (
                <Button
                  size="sm"
                  onClick={onStop}
                  className="h-7 text-xs gap-1.5 px-2.5 bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  <Square className="w-3 h-3 fill-white" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onStart}
                  className="h-7 text-xs gap-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Start</span>
                </Button>
              )}
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="h-7 px-2 text-xs gap-1 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40"
            title="Copy Logs"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-400" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>

          {onClearLogs && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="h-7 px-2 text-xs gap-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 disabled:opacity-40"
              title="Clear Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Running Service Link Chips */}
      {services.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/60 border-b border-zinc-800 overflow-x-auto text-[11px] shrink-0">
          <span className="text-zinc-400 font-sans text-[10px] uppercase font-medium tracking-wider shrink-0">
            Endpoints:
          </span>
          {services.map((svc) => (
            <a
              key={svc.name}
              href={svc.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openExternalUrl(svc.url, e)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
              title={`Open ${svc.name} (${svc.url}) in browser`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium">{svc.name}</span>
              <span className="text-zinc-400 font-mono">:{svc.port}</span>
              <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
            </a>
          ))}
        </div>
      )}

      {/* wterm Viewport */}
      <div className="flex-1 min-h-0 bg-[#090d13] relative">
        <WTermTerminal
          logs={logs}
          placeholder={
            isElectron
              ? 'Click "Start" to run commands and view live output.'
              : 'Run "docker compose up --build" locally or run in the Desktop App.'
          }
        />
      </div>
    </div>
  );
}
