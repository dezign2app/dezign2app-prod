import React from "react";
import { Server, ExternalLink } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { StorageTestingConfig } from "./useStorageTestingConfig";

interface ServerStatusBarProps {
  config: StorageTestingConfig;
}

export const ServerStatusBar: React.FC<ServerStatusBarProps> = ({ config }) => {
  const setActiveConfigItem = useBackendCanvasStore((s) => s.setActiveConfigItem);
  const {
    activeEndpoint,
    region,
    configuredStorageType,
    configuredForcePathStyle,
    configuredAccessKeyIdEnv,
    parentNode,
  } = config;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
          <Server size={13} className="shrink-0" />
          <span>Configured Storage Server:</span>
          <code className="text-[11px] font-mono bg-background/80 px-1.5 py-0.5 rounded border border-border/60 text-foreground">
            {activeEndpoint}
          </code>
        </div>
        <div className="flex items-center gap-1.5">
          {parentNode && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
              {parentNode.data?.label || "Storage Node"}
            </Badge>
          )}
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Server Dispatch
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-amber-500/20 text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground">
            Provider: <strong className="text-foreground uppercase">{configuredStorageType}</strong>
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Region: <strong className="text-foreground">{region}</strong>
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Style: <strong className="text-foreground">{configuredForcePathStyle ? "Path-Style" : "Virtual-Hosted"}</strong>
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Auth:{" "}
            {configuredAccessKeyIdEnv ? (
              <span className="text-amber-500 font-medium">
                Env (process.env.{configuredAccessKeyIdEnv})
              </span>
            ) : (
              <span className="text-muted-foreground">AWS Credentials Chain (AWS_ACCESS_KEY_ID)</span>
            )}
          </span>
        </div>

        {parentNode && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-amber-500/10 gap-1 ml-auto cursor-pointer"
            onClick={() =>
              setActiveConfigItem({
                type: "storage",
                id: parentNode.id,
                nodeId: parentNode.id,
              })
            }
          >
            <ExternalLink size={10} />
            <span>Edit in {parentNode.data?.label || "Storage Node"}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
