"use client";

import React, { useState, useMemo } from "react";
import { Terminal, Trash2, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Resizable } from "re-resizable";
import { WTermTerminal } from "@/components/terminal";

export interface TerminalLog {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "system";
  text: string;
}

interface TerminalPanelProps {
  logs: TerminalLog[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function TerminalPanel({
  logs,
  onClearLogs,
  isOpen,
  onToggleOpen,
}: TerminalPanelProps) {
  const [copied, setCopied] = useState(false);

  // Convert structured logs into ANSI colored terminal output for wterm
  const formattedLogs = useMemo(() => {
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
    const content = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`)
      .join("\n");
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return (
      <div className="h-7 bg-[#161b22] border-t border-border/40 px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none">
        <div
          onClick={onToggleOpen}
          className="flex items-center gap-2 cursor-pointer hover:text-slate-200 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>Terminal Output ({logs.length} logs)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleOpen}
          className="h-5 px-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Resizable
      defaultSize={{ width: "100%", height: 210 }}
      minHeight={80}
      maxHeight={500}
      enable={{ top: true }}
      handleClasses={{
        top: "h-1.5 bg-border/40 hover:bg-primary/60 cursor-row-resize transition-colors z-20",
      }}
      className="border-t border-border/50 flex flex-col shrink-0 font-mono text-xs text-slate-200 select-none bg-[#090d13] relative"
    >
      {/* Header */}
      <div className="h-7 bg-[#161b22] px-3 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-300">
            Terminal / Console Log
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
            wterm engine
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLogs}
            className="h-5 px-1.5 text-[10px] gap-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearLogs}
            className="h-5 px-1.5 text-[10px] gap-1 text-slate-400 hover:text-red-400 hover:bg-slate-800"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleOpen}
            className="h-5 px-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* wterm Log Output Body */}
      <div className="flex-1 min-h-0 bg-[#090d13] relative">
        <WTermTerminal
          logs={formattedLogs}
          placeholder="Terminal idle. Click 'Run Localhost' to simulate dev server startup logs."
        />
      </div>
    </Resizable>
  );
}
