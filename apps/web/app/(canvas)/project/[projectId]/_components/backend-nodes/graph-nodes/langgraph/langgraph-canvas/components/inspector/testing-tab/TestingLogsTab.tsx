import React from "react";
import {
  Search,
  Check,
  Copy,
  Terminal,
  Code,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Badge } from "@workspace/ui/components/badge";
import type { SimulationStepLogEntry } from "@/lib/simulation/types";
import { getLogLevelStyle } from "./types";
import { LocalInput } from "../../../../../common";

export interface TestingLogsTabProps {
  allLogs: SimulationStepLogEntry[];
  filteredLogs: SimulationStepLogEntry[];
  allLogNodes: Array<{ id: string; label: string }>;
  logStats: {
    errorCount: number;
    warnCount: number;
    llmCount: number;
    toolCount: number;
    stepCount: number;
    configCount?: number;
    stateCount?: number;
  };
  logSearchQuery: string;
  setLogSearchQuery: (q: string) => void;
  logNodeFilter: string;
  setLogNodeFilter: (n: string) => void;
  logLevelFilter: string;
  setLogLevelFilter: (l: string) => void;
  copiedAllLogs: boolean;
  handleCopyAllLogs: () => void;
  expandedLogDetails: Record<string, boolean>;
  setExpandedLogDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isTraceExpanded: boolean;
}

export function TestingLogsTab({
  allLogs,
  filteredLogs,
  allLogNodes,
  logStats,
  logSearchQuery,
  setLogSearchQuery,
  logNodeFilter,
  setLogNodeFilter,
  logLevelFilter,
  setLogLevelFilter,
  copiedAllLogs,
  handleCopyAllLogs,
  expandedLogDetails,
  setExpandedLogDetails,
  isTraceExpanded,
}: TestingLogsTabProps) {
  if (allLogs.length === 0) {
    return (
      <div className="text-center p-8 border rounded-xl border-dashed text-muted-foreground text-[11px] flex flex-col items-center gap-2">
        <Terminal className="w-6 h-6 text-muted-foreground/60" />
        <span>Run the graph to capture and view detailed execution logs for all configured steps.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-background/80 border border-border/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
            <div className="relative flex-1">
              <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
              <LocalInput
                placeholder="Filter logs by message, payload, or step..."
                value={logSearchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogSearchQuery(e.target.value)}
                className="h-7 pl-6.5 text-[10px] font-mono bg-background"
              />
            </div>
            {logSearchQuery && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[9px] px-1.5 text-muted-foreground"
                onClick={() => setLogSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Step Filter */}
            <Select value={logNodeFilter} onValueChange={setLogNodeFilter}>
              <SelectTrigger className="h-7 text-[10px] min-w-[110px] bg-background font-mono">
                <SelectValue placeholder="All Steps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-mono">
                  All Steps ({allLogs.length})
                </SelectItem>
                {allLogNodes.map((n) => {
                  const count = allLogs.filter((l) => l.nodeId === n.id).length;
                  return (
                    <SelectItem key={n.id} value={n.id} className="text-[10px] font-mono">
                      {n.label} {count > 0 ? `(${count})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Level Filter */}
            <Select value={logLevelFilter} onValueChange={setLogLevelFilter}>
              <SelectTrigger className="h-7 text-[10px] min-w-[100px] bg-background font-mono">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-mono">
                  All Levels
                </SelectItem>
                <SelectItem value="step" className="text-[10px] font-mono text-blue-400">
                  STEP ({logStats.stepCount})
                </SelectItem>
                <SelectItem value="config" className="text-[10px] font-mono text-indigo-400">
                  CONFIG {logStats.configCount !== undefined && logStats.configCount > 0 ? `(${logStats.configCount})` : ""}
                </SelectItem>
                <SelectItem value="llm" className="text-[10px] font-mono text-purple-400">
                  LLM ({logStats.llmCount})
                </SelectItem>
                <SelectItem value="tool" className="text-[10px] font-mono text-amber-400">
                  TOOL ({logStats.toolCount})
                </SelectItem>
                <SelectItem value="middleware" className="text-[10px] font-mono text-fuchsia-400">
                  MIDDLEWARE
                </SelectItem>
                <SelectItem value="router" className="text-[10px] font-mono text-sky-400">
                  ROUTER
                </SelectItem>
                <SelectItem value="state" className="text-[10px] font-mono text-emerald-400">
                  STATE {logStats.stateCount !== undefined && logStats.stateCount > 0 ? `(${logStats.stateCount})` : ""}
                </SelectItem>
                <SelectItem value="warn" className="text-[10px] font-mono text-yellow-400">
                  WARN ({logStats.warnCount})
                </SelectItem>
                <SelectItem value="error" className="text-[10px] font-mono text-red-400">
                  ERROR ({logStats.errorCount})
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground"
              onClick={handleCopyAllLogs}
              title="Copy all consolidated logs"
            >
              {copiedAllLogs ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>Copy</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-mono pt-0.5 border-t border-border/30">
          <span className="text-muted-foreground">Showing:</span>
          <Badge variant="outline" className="text-[8.5px] px-1.5 py-0 h-4 bg-muted/30">
            {filteredLogs.length} of {allLogs.length} logs
          </Badge>
          {(logStats.configCount ?? 0) > 0 && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
            >
              {logStats.configCount} Config
            </Badge>
          )}
          {(logStats.stateCount ?? 0) > 0 && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            >
              {logStats.stateCount} State Updates
            </Badge>
          )}
          {logStats.errorCount > 0 && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-red-500/15 text-red-400 border-red-500/30"
            >
              {logStats.errorCount} Errors
            </Badge>
          )}
          {logStats.warnCount > 0 && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
            >
              {logStats.warnCount} Warnings
            </Badge>
          )}
          {logStats.llmCount > 0 && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-purple-500/15 text-purple-400 border-purple-500/30"
            >
              {logStats.llmCount} LLM
            </Badge>
          )}
          {logStats.toolCount > 0 && (
            <Badge
              variant="outline"
              className="text-[8.5px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-400 border-amber-500/30"
            >
              {logStats.toolCount} Tools
            </Badge>
          )}
        </div>
      </div>

      {/* Consolidated Logs Console */}
      <div
        className={`flex flex-col gap-1 p-2 rounded-lg bg-black/90 border border-border/60 overflow-y-auto hide-scrollbar font-mono transition-all ${
          isTraceExpanded ? "min-h-[500px] max-h-[750px]" : "min-h-[340px] max-h-[520px]"
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-[10px]">
            No logs match the current filters.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const style = getLogLevelStyle(log.level);
            const LogIcon = style.icon;
            const logKey = `all_log_${idx}`;
            const isDetailOpen = expandedLogDetails[logKey];

            return (
              <div
                key={idx}
                className="flex flex-col gap-1 p-1.5 rounded bg-background/40 hover:bg-background/70 border border-border/30 text-[9.5px] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] text-muted-foreground/60">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        fractionalSecondDigits: 3,
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[7.5px] px-1 py-0 h-3.5 uppercase font-mono flex items-center gap-0.5 ${style.badge}`}
                    >
                      <LogIcon className="w-2 h-2" />
                      {style.label}
                    </Badge>
                    {log.nodeLabel && (
                      <span className="text-[8.5px] font-bold text-foreground bg-muted/60 px-1.5 py-0 rounded border border-border/40">
                        [{log.nodeLabel}]
                      </span>
                    )}
                  </div>

                  {log.details !== undefined && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLogDetails((prev) => ({
                          ...prev,
                          [logKey]: !isDetailOpen,
                        }))
                      }
                      className="text-[8px] text-muted-foreground hover:text-foreground px-1 py-0 rounded bg-muted/30 flex items-center gap-0.5"
                    >
                      <Code className="w-2 h-2" />
                      {isDetailOpen ? "Collapse Data" : "Inspect Data"}
                    </button>
                  )}
                </div>

                <div className={`whitespace-pre-wrap select-text leading-relaxed ${style.text}`}>
                  {log.message}
                </div>

                {isDetailOpen && log.details !== undefined && (
                  <pre className="text-[8.5px] font-mono text-cyan-200/90 bg-black/90 p-2 rounded border border-cyan-500/20 max-h-[220px] overflow-auto hide-scrollbar select-text">
                    {typeof log.details === "string"
                      ? log.details
                      : JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
