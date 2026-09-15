import React from "react";
import { Terminal, Server, Activity, Layers } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";

export interface TestStudioHeaderProps {
  connUri: string;
  isParentConnected: boolean;
  isParentFailed?: boolean;
  parentDb?: BackendNode;
  pingingParent: boolean;
  testMode: "live" | "sandbox";
  onPingConnection: () => void;
  onSetTestMode: (mode: "live" | "sandbox") => void;
}

export const TestStudioHeader: React.FC<TestStudioHeaderProps> = ({
  connUri,
  isParentConnected,
  isParentFailed,
  parentDb,
  pingingParent,
  testMode,
  onPingConnection,
  onSetTestMode,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
          <Terminal size={18} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">Test Cases & Live Execution Studio</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 font-mono uppercase font-semibold",
                testMode === "live"
                  ? isParentConnected
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : isParentFailed
                      ? "bg-destructive/15 border-destructive/40 text-destructive"
                      : "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400",
              )}
            >
              {testMode === "live"
                ? isParentConnected
                  ? "Live Server"
                  : isParentFailed
                    ? "Live Server (Offline)"
                    : "Live Server (Untested)"
                : "Sandbox"}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
            <Server size={11} className="shrink-0" />
            <span>{connUri}</span>
            {parentDb?.data?.lastConnectionStatus?.latencyMs !== undefined &&
              parentDb.data.lastConnectionStatus.connected && (
                <span className="text-emerald-500 font-bold">
                  ({parentDb.data.lastConnectionStatus.latencyMs}ms)
                </span>
              )}
            {parentDb?.data?.lastConnectionStatus?.connected === false && (
              <span className="text-destructive font-semibold text-[10px]">
                (offline)
              </span>
            )}
            {parentDb && (
              <button
                type="button"
                disabled={pingingParent}
                onClick={onPingConnection}
                className="hover:text-foreground underline text-[10px] ml-1 cursor-pointer"
                title="Ping database connection"
              >
                {pingingParent ? "pinging..." : "ping"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live vs Sandbox Mode Switcher */}
      <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
        <button
          type="button"
          onClick={() => onSetTestMode("live")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
            testMode === "live"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Activity size={12} className={testMode === "live" ? "text-emerald-500" : ""} />
          Live Server
        </button>
        <button
          type="button"
          onClick={() => onSetTestMode("sandbox")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
            testMode === "sandbox"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers size={12} className={testMode === "sandbox" ? "text-purple-500" : ""} />
          Simulation Sandbox
        </button>
      </div>
    </div>
  );
};
