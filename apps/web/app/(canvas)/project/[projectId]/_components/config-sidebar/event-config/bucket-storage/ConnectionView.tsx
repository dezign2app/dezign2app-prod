import React from "react";
import {
  Wifi, Check, Copy, Clock, Terminal, CheckCircle2, XCircle, Loader2, Play, RefreshCw,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import { StorageTestingConfig } from "./useStorageTestingConfig";
import { StorageTestingActions } from "./useStorageTestingActions";

interface ConnectionViewProps {
  config: StorageTestingConfig;
  actions: StorageTestingActions;
}

export const ConnectionView: React.FC<ConnectionViewProps> = ({ config, actions }) => {
  const { bucketName, region, activeEndpoint, configuredStorageType, accessPolicy } = config;
  const {
    isTestingConn, connResult, handleRunConnectionTest,
    isCreatingBucket, createSuccessMsg, createErrorMsg, handleCreateBucketNow,
    isScanningServer, serverScanError, serverBuckets, handleScanServerBuckets, handleSwitchBucket,
    handleCopy,
  } = actions;

  const connectionTestCode =
    `import { s3Client } from "@workspace/storage/client";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

// Test connection and bucket reachability against configured server
const cmd = new HeadBucketCommand({ Bucket: "${bucketName}" });
const res = await s3Client.send(cmd);
console.log("Bucket reachable:", res.$metadata.httpStatusCode === 200);`;

  return (
    <div className="flex flex-col gap-4">
      {/* Connection Profile Card */}
      <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-card/50">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <Wifi size={12} /> Storage Client Connection Spec
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">@workspace/storage/client</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {[
            { label: "Target Bucket", value: bucketName },
            { label: "Storage Provider", value: configuredStorageType.toUpperCase() },
            { label: "Region", value: region },
            { label: "Access Policy", value: accessPolicy },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5 p-2 rounded bg-background/60 border border-border/40">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className="font-mono font-medium text-foreground capitalize truncate">{value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 p-2 rounded bg-background/60 border border-border/40">
          <span className="text-[10px] text-muted-foreground">Target Server Endpoint</span>
          <span className="font-mono text-[10px] text-foreground break-all">{activeEndpoint}</span>
        </div>
      </div>

      {/* Generated Code Preview */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/80 bg-black/60 dark:bg-black/80">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Terminal size={12} /> Generated Connection Test Code
          </span>
          <Button
            variant="ghost" size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => handleCopy(connectionTestCode)}
          >
            <Copy size={11} /> Copy
          </Button>
        </div>
        <pre className="text-[11px] font-mono text-emerald-400/90 overflow-x-auto leading-relaxed select-text p-1">
          {`import { s3Client } from "@workspace/storage/client";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

// 1. Send HeadBucket ping to verify credentials and endpoint reachability
const cmd = new HeadBucketCommand({ Bucket: "${bucketName}" });
const res = await s3Client.send(cmd);`}
        </pre>
      </div>

      {/* Run Button */}
      <Button
        size="sm" onClick={handleRunConnectionTest} disabled={isTestingConn}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-9 gap-2 shadow-sm"
      >
        <Wifi size={12} />
        {isTestingConn ? `Probing server at ${activeEndpoint}...` : "Ping Server & Test S3 Connection"}
      </Button>

      {/* Results */}
      {connResult && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] font-bold font-mono px-2 py-0.5 border ${
                  connResult.success
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : connResult.serverActive
                      ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                      : "bg-destructive/15 text-destructive border-destructive/30"
                }`}
              >
                {connResult.status > 0 ? `${connResult.status} ${connResult.statusText}` : "Connection Failed"}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <Clock size={11} /> {connResult.durationMs}ms
              </span>
            </div>
            <span
              className={`text-[10px] font-semibold flex items-center gap-1 ${
                connResult.serverActive ? "text-emerald-400" : "text-destructive"
              }`}
            >
              {connResult.serverActive ? (
                <><CheckCircle2 size={12} /> Server Active</>
              ) : (
                <><XCircle size={12} /> Server Inactive / Unreachable</>
              )}
            </span>
          </div>

          {connResult.serverHeader && (
            <div className="text-[10px] font-mono text-muted-foreground">
              Server Header: <strong className="text-foreground">{connResult.serverHeader}</strong>
            </div>
          )}

          {connResult.error && (
            <div className="flex flex-col gap-2 p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
              <div>
                <strong>Result:</strong> {connResult.error}
                {connResult.tip && <p className="text-[10px] text-muted-foreground mt-1">{connResult.tip}</p>}
              </div>

              {(connResult.status === 404 || connResult.bucketExists === false) && (
                <div className="flex flex-col gap-2 pt-2 border-t border-destructive/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 text-xs">
                      Bucket &quot;{bucketName}&quot; not found on server
                    </span>
                    <Button
                      size="sm" disabled={isCreatingBucket} onClick={handleCreateBucketNow}
                      className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1 px-2.5 shrink-0"
                    >
                      {isCreatingBucket ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      Create Bucket on Server
                    </Button>
                  </div>

                  {createSuccessMsg && (
                    <div className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 size={12} /> {createSuccessMsg}
                    </div>
                  )}
                  {createErrorMsg && (
                    <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-[11px] flex items-start gap-1.5 font-mono">
                      <XCircle size={12} className="shrink-0 mt-0.5" />
                      <span className="break-all">{createErrorMsg}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-destructive/15">
                    <span className="text-[10px] text-muted-foreground">
                      Want to select an existing bucket on this server instead?
                    </span>
                    <Button
                      size="sm" variant="outline" disabled={isScanningServer}
                      onClick={handleScanServerBuckets}
                      className="h-5 px-1.5 text-[9px] gap-1 hover:border-amber-500/40"
                    >
                      <RefreshCw size={9} className={cn(isScanningServer && "animate-spin")} />
                      {isScanningServer ? "Scanning..." : "Scan Server Buckets"}
                    </Button>
                  </div>

                  {serverScanError && (
                    <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-[11px] flex items-start gap-1.5 font-mono">
                      <XCircle size={12} className="shrink-0 mt-0.5" />
                      <span className="break-all">{serverScanError}</span>
                    </div>
                  )}

                  {serverBuckets && serverBuckets.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {serverBuckets.map((sb) => (
                        <Button
                          key={sb.name} variant="outline" size="sm"
                          onClick={() => handleSwitchBucket(sb.name)}
                          className="h-5 px-2 text-[10px] font-mono hover:border-amber-500/50"
                          title={`Switch current bucket to "${sb.name}"`}
                        >
                          Switch to: {sb.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {connResult.success && (
            <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-medium">
              <CheckCircle2 size={14} /> Successfully contacted storage server at {connResult.endpoint}!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
