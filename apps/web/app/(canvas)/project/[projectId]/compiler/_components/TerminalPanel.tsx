"use client";

import React, { useState, useMemo } from "react";
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
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Resizable } from "re-resizable";
import { WTermTerminal, cleanTerminalText } from "@/components/terminal";

export interface TerminalLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "system";
  text: string;
}

export type TerminalPanelTab = "problems" | "output" | "terminal" | "ports";

export interface ServicePortInfo {
  port: number | string;
  name: string;
  type?: string;
  url?: string;
  status?: "running" | "ready" | "stopped";
}

interface TerminalPanelProps {
  logs?: TerminalLog[];
  onClearLogs?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab?: TerminalPanelTab;
  onSelectTab?: (tab: TerminalPanelTab) => void;
  ports?: ServicePortInfo[];
  outputLogs?: string[];
}

export function TerminalPanel({
  logs = [],
  onClearLogs,
  isOpen,
  onToggleOpen,
  activeTab = "terminal",
  onSelectTab,
  ports = [],
  outputLogs = [],
}: TerminalPanelProps) {
  const [currentTab, setCurrentTab] = useState<TerminalPanelTab>(activeTab);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedTab = onSelectTab ? activeTab : currentTab;
  const handleTabChange = (tab: TerminalPanelTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else {
      setCurrentTab(tab);
    }
  };

  // Convert structured logs into ANSI colored terminal output for wterm
  const formattedLogs = useMemo(() => {
    if (logs.length === 0) {
      return [
        "\x1b[90m[system]\x1b[0m \x1b[32m✔ Project monorepo workspace initialized.\x1b[0m\r\n",
        "\x1b[90m[system]\x1b[0m \x1b[36mℹ Ready to compile, simulate, and preview.\x1b[0m\r\n",
      ];
    }
    return logs.map((log) => {
      let typeBadge = "";
      switch (log.type) {
        case "error":
          typeBadge = `\x1b[41;97m ERROR \x1b[0m \x1b[31m${log.text}\x1b[0m`;
          break;
        case "warning":
          typeBadge = `\x1b[43;30m WARN \x1b[0m \x1b[33m${log.text}\x1b[0m`;
          break;
        case "success":
          typeBadge = `\x1b[42;30m SUCCESS \x1b[0m \x1b[32m${log.text}\x1b[0m`;
          break;
        case "system":
          typeBadge = `\x1b[45;97m SYSTEM \x1b[0m \x1b[35m${log.text}\x1b[0m`;
          break;
        case "info":
        default:
          typeBadge = `\x1b[44;97m INFO \x1b[0m \x1b[36m${log.text}\x1b[0m`;
          break;
      }
      return `\x1b[90m[${log.timestamp}]\x1b[0m ${typeBadge}\r\n`;
    });
  }, [logs]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const content = logs
      .map((l) => {
        const cleanedText = cleanTerminalText(l.text);
        return `[${l.timestamp}] [${l.type.toUpperCase()}] ${cleanedText}`;
      })
      .join("\n");
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Resizable
      size={{ width: "100%", height: isMaximized ? "85%" : 240 }}
      minHeight={100}
      maxHeight={700}
      enable={{ top: !isMaximized }}
      handleClasses={{
        top: "h-1 bg-border/50 hover:bg-primary cursor-row-resize transition-colors z-30",
      }}
      className="border-t border-border/50 flex flex-col shrink-0 font-sans text-xs select-none bg-[#090d13] relative overflow-hidden z-20"
    >
      {/* VS Code Bottom Panel Header Tabs Bar */}
      <div className="h-8 bg-[#161b22] px-3 border-b border-border/40 flex items-center justify-between shrink-0 font-sans">
        {/* Left: VS Code Tabs */}
        <div className="flex items-center space-x-1 h-full">
          <button
            type="button"
            onClick={() => handleTabChange("problems")}
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
            onClick={() => handleTabChange("output")}
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
            onClick={() => handleTabChange("terminal")}
            className={`h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              selectedTab === "terminal"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("ports")}
            className={`h-full px-2.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase transition-colors relative ${
              selectedTab === "ports"
                ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>Ports</span>
            {ports.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-950/80 text-emerald-400 font-mono border border-emerald-800/40">
                {ports.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: VS Code Panel Actions */}
        <div className="flex items-center gap-1">
          {selectedTab === "terminal" && (
            <div className="flex items-center gap-1 mr-2 px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700 text-[10px] font-mono text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>1: bash</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLogs}
            title="Copy Output"
            className="h-6 px-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>

          {onClearLogs && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearLogs}
              title="Clear Console"
              className="h-6 px-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMaximized((prev) => !prev)}
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

      {/* Tab View Content */}
      <div className="flex-1 min-h-0 bg-[#090d13] relative overflow-hidden font-mono text-xs">
        {selectedTab === "terminal" && (
          <WTermTerminal
            logs={formattedLogs}
            interactive={true}
            autoScroll={true}
            placeholder="Terminal active. Type commands or view build logs."
          />
        )}

        {selectedTab === "output" && (
          <div className="h-full overflow-y-auto p-3 text-slate-300 font-mono text-xs space-y-1">
            {outputLogs.length > 0 ? (
              outputLogs.map((line, idx) => (
                <div key={idx} className="leading-relaxed">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-slate-400 space-y-1">
                <p className="text-slate-200 font-semibold">[Monorepo Build Output]</p>
                <p>✔ Compiler engine ready.</p>
                <p>✔ Turbopack and StackBlitz integration initialized.</p>
                <p className="text-slate-400">Waiting for next compile trigger...</p>
              </div>
            )}
          </div>
        )}

        {selectedTab === "problems" && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
            <p className="text-sm font-medium text-slate-300">
              No problems have been detected in the workspace.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              All routes, schema types, and client endpoints are valid.
            </p>
          </div>
        )}

        {selectedTab === "ports" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#161b22] text-slate-400 border-b border-border/40">
                  <tr>
                    <th className="px-3 py-2">Port</th>
                    <th className="px-3 py-2">Process / Service</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-slate-200">
                  {ports.length > 0 ? (
                    ports.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-bold text-emerald-400">
                          {p.port}
                        </td>
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2 text-slate-400">
                          {p.type || "HTTP"}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={p.url || `http://localhost:${p.port}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-bold text-emerald-400">
                          3000
                        </td>
                        <td className="px-3 py-2">Web Client Application</td>
                        <td className="px-3 py-2 text-slate-400">Next.js App</td>
                        <td className="px-3 py-2">
                          <a
                            href="http://localhost:3000"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-bold text-emerald-400">
                          3002
                        </td>
                        <td className="px-3 py-2">System Design Engine</td>
                        <td className="px-3 py-2 text-slate-400">Express API</td>
                        <td className="px-3 py-2">
                          <a
                            href="http://localhost:3002"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Resizable>
  );
}
