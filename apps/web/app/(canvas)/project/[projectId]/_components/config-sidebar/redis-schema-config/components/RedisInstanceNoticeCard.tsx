import React, { useState } from "react";
import { Server, ExternalLink, Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";

interface RedisInstanceNoticeCardProps {
  parentDb?: BackendNode;
  onConfigureInstance: (dbId: string) => void;
}

export const RedisInstanceNoticeCard: React.FC<RedisInstanceNoticeCardProps> = ({
  parentDb,
  onConfigureInstance,
}) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const [checking, setChecking] = useState(false);

  const connStatus = parentDb?.data?.lastConnectionStatus;
  const isConnected = connStatus?.connected === true;
  const isFailed = connStatus?.connected === false;
  const host = parentDb?.data?.host || "localhost";
  const port = parentDb?.data?.port || 6379;
  const uri = `redis://${host}:${port}`;

  const handleQuickTest = async () => {
    if (!parentDb) return;
    setChecking(true);
    try {
      const res = await fetch("/api/operations/check-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: "redis",
          connection: {
            host,
            port,
            connectionStringEnv: parentDb.data?.connectionStringEnv,
          },
        }),
      });
      const data = await res.json();
      updateNode(parentDb.id, {
        data: {
          ...parentDb.data,
          lastConnectionStatus: {
            connected: !!data.success,
            latencyMs: data.latencyMs,
            checkedAt: new Date().toLocaleTimeString(),
            serverInfo: data.info,
            error: data.error,
          },
        },
      });
    } catch (err) {
      updateNode(parentDb.id, {
        data: {
          ...parentDb.data,
          lastConnectionStatus: {
            connected: false,
            latencyMs: 0,
            checkedAt: new Date().toLocaleTimeString(),
            error: err instanceof Error ? err.message : "Connection failed",
          },
        },
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Server size={18} className="text-amber-500 shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Parent Redis Instance
              </span>
              {parentDb && (
                isConnected ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-semibold gap-1 py-0 px-1.5"
                  >
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    Live {connStatus?.latencyMs !== undefined ? `(${connStatus.latencyMs}ms)` : ""}
                  </Badge>
                ) : isFailed ? (
                  <Badge
                    variant="outline"
                    className="bg-destructive/15 border-destructive/40 text-destructive text-[9px] font-semibold gap-1 py-0 px-1.5"
                  >
                    <XCircle size={10} />
                    Offline
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-muted text-muted-foreground border-border/40 text-[9px] py-0 px-1.5"
                  >
                    Untested
                  </Badge>
                )
              )}
            </div>
            <span className="text-[10px] text-muted-foreground truncate">
              {parentDb
                ? `[${parentDb.data?.label || "Redis DB"}] (${uri}) • Policy: ${parentDb.data?.maxmemoryPolicy || "volatile-lru"}`
                : "Not attached to a Database node yet."}
            </span>
          </div>
        </div>

        {parentDb && (
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={checking}
              onClick={handleQuickTest}
              className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Test connection to parent Redis instance"
            >
              <RefreshCw size={11} className={checking ? "animate-spin" : ""} />
              {checking ? "Checking..." : "Ping"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 cursor-pointer"
              onClick={() => onConfigureInstance(parentDb.id)}
            >
              Configure <ExternalLink size={11} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
