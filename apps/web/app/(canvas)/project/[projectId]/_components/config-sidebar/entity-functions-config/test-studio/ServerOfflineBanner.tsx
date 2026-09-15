import React from "react";
import { ServerOff, Layers, RefreshCw, AlertCircle, Terminal } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";

export interface ServerOfflineBannerProps {
  connUri: string;
  engine: string;
  host: string;
  port: number | string;
  error?: string;
  pingingParent: boolean;
  onPingConnection: () => void;
  onSwitchToSandbox: () => void;
}

export const ServerOfflineBanner: React.FC<ServerOfflineBannerProps> = ({
  connUri,
  engine,
  host,
  port,
  error,
  pingingParent,
  onPingConnection,
  onSwitchToSandbox,
}) => {
  const isRedis = engine === "redis";

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 dark:bg-destructive/15 p-3.5 shadow-sm space-y-3 transition-all animate-in fade-in-50 duration-200">
      {/* Header Row: Icon, Title & Offline Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-destructive/20 text-destructive border border-destructive/30 shrink-0 mt-0.5">
            <ServerOff size={16} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-destructive">
                Live Server Inactive / Not Found
              </span>
              <Badge
                variant="outline"
                className="bg-destructive/15 border-destructive/40 text-destructive text-[9px] font-mono font-semibold py-0 px-1.5 uppercase gap-1"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                Offline
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Cannot establish connection to{" "}
              <code className="font-mono font-semibold text-foreground px-1 py-0.5 rounded bg-muted/60 text-[10px]">
                {connUri}
              </code>
              . The live {engine.toUpperCase()} server is offline or unreachable.
            </p>
          </div>
        </div>
      </div>

      {/* Error Details if provided */}
      {error && (
        <div className="flex items-start gap-1.5 p-2 rounded-md bg-background/70 border border-destructive/20 text-[11px] font-mono text-destructive/90 leading-tight">
          <AlertCircle size={13} className="shrink-0 mt-0.5 text-destructive" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* Action Footer: Switch to Sandbox CTA & Retry Connection */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-destructive/20 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Terminal size={11} className="shrink-0" />
          {isRedis ? (
            <span>
              Start Redis with <code className="text-foreground font-mono bg-muted/50 px-1 py-0.5 rounded">redis-server</code> or Docker.
            </span>
          ) : (
            <span>
              Start {engine} service locally on port <strong className="text-foreground font-mono">{port}</strong>.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            disabled={pingingParent}
            onClick={onPingConnection}
            className="h-7 text-xs px-2.5 gap-1.5 border-destructive/30 hover:bg-destructive/15 hover:text-destructive cursor-pointer"
            title="Retry connecting to live server"
          >
            <RefreshCw size={11} className={pingingParent ? "animate-spin" : ""} />
            {pingingParent ? "Checking..." : "Retry Connection"}
          </Button>

          <Button
            size="sm"
            onClick={onSwitchToSandbox}
            className="h-7 text-xs px-3 gap-1.5 font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs cursor-pointer"
            title="Switch to Simulation Sandbox to test operations without an active server"
          >
            <Layers size={12} />
            Switch to Simulation Sandbox
          </Button>
        </div>
      </div>
    </div>
  );
};
