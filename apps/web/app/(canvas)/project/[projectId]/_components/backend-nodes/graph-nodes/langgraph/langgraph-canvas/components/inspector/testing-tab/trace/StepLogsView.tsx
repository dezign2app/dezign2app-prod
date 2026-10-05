import React from "react";
import { Terminal, Copy, Code } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { toast } from "sonner";
import type { SimulationStepLogEntry } from "@/lib/simulation/types";
import { getLogLevelStyle } from "../types";

export interface StepLogsViewProps {
  nodeLogs: SimulationStepLogEntry[];
  stepLabel: string;
  stepIdx: number;
  expandedLogDetails: Record<string, boolean>;
  setExpandedLogDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function StepLogsView({
  nodeLogs,
  stepLabel,
  stepIdx,
  expandedLogDetails,
  setExpandedLogDetails,
}: StepLogsViewProps) {
  const handleCopyStepLogs = () => {
    const text = nodeLogs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.message}${
            l.details ? "\n" + JSON.stringify(l.details, null, 2) : ""
          }`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${nodeLogs.length} logs for ${stepLabel}`);
  };

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-black/60 rounded-md border border-blue-500/20 max-h-[380px] overflow-y-auto hide-scrollbar">
      <div className="flex items-center justify-between pb-1 border-b border-border/30">
        <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
          <Terminal className="w-3 h-3 text-blue-400" />
          Step Execution Logs ({nodeLogs.length} entries)
        </span>
        <button
          type="button"
          onClick={handleCopyStepLogs}
          className="text-[8.5px] text-muted-foreground hover:text-blue-400 flex items-center gap-1 font-mono"
        >
          <Copy className="w-2.5 h-2.5" /> Copy Step Logs
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {nodeLogs.map((log, lIdx) => {
          const style = getLogLevelStyle(log.level);
          const LogIcon = style.icon;
          const logKey = `${stepIdx}_log_${lIdx}`;
          const isDetailOpen = expandedLogDetails[logKey];

          return (
            <div
              key={lIdx}
              className="flex flex-col gap-1 p-1.5 rounded bg-background/50 border border-border/40 text-[9.5px] font-mono"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[8px] text-muted-foreground/70">
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
                    className="text-[8px] text-muted-foreground hover:text-foreground px-1 py-0 rounded bg-muted/40 flex items-center gap-0.5"
                  >
                    <Code className="w-2 h-2" />
                    {isDetailOpen ? "Hide Details" : "Show Details"}
                  </button>
                )}
              </div>

              <div className={`whitespace-pre-wrap select-text leading-relaxed ${style.text}`}>
                {log.message}
              </div>

              {isDetailOpen && log.details !== undefined && (
                <pre className="text-[8.5px] font-mono text-muted-foreground bg-black/80 p-1.5 rounded border border-border/50 max-h-[200px] overflow-auto hide-scrollbar select-text">
                  {typeof log.details === "string"
                    ? log.details
                    : JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
