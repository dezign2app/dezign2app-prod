import React, { useState } from "react";
import { CheckCircle2, XCircle, Copy, Check, AlertTriangle, ServerOff, Layers } from "lucide-react";
import { DbOperationTestCase } from "@workspace/canvas/types";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";

export interface TestResultViewerProps {
  lastResult: NonNullable<DbOperationTestCase["lastResult"]>;
  testMode: "live" | "sandbox";
  onSwitchToSandbox?: () => void;
}

export const TestResultViewer: React.FC<TestResultViewerProps> = ({
  lastResult,
  testMode,
  onSwitchToSandbox,
}) => {
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const isServerOffline =
    testMode === "live" &&
    !lastResult.success &&
    (lastResult.error?.includes("Could not connect") ||
      lastResult.error?.includes("Connection refused") ||
      lastResult.error?.includes("ECONNREFUSED") ||
      lastResult.error?.includes("Server not found or inactive") ||
      lastResult.error?.includes("timed out"));

  const handleCopyCommand = () => {
    if (!lastResult.rawCommand) return;
    navigator.clipboard.writeText(lastResult.rawCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 1500);
  };

  const handleCopyOutput = () => {
    if (lastResult.output === undefined) return;
    const str =
      typeof lastResult.output === "object"
        ? JSON.stringify(lastResult.output, null, 2)
        : String(lastResult.output ?? "");
    navigator.clipboard.writeText(str);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-border/40">
      {/* Status & Raw Command Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {lastResult.success ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold gap-1 py-0.5 px-2"
            >
              <CheckCircle2 size={12} className="text-emerald-500" />
              Test Passed (200 OK)
            </Badge>
          ) : isServerOffline ? (
            <Badge
              variant="outline"
              className="bg-destructive/15 border-destructive/40 text-destructive text-xs font-semibold gap-1 py-0.5 px-2"
            >
              <ServerOff size={12} />
              Server Not Found / Inactive
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-destructive/15 border-destructive/40 text-destructive text-xs font-semibold gap-1 py-0.5 px-2"
            >
              <XCircle size={12} />
              Execution Failed
            </Badge>
          )}

          <Badge variant="outline" className="text-[10px] font-mono">
            {testMode === "live" ? "Live Server" : "Sandbox"}
          </Badge>
        </div>

        {lastResult.rawCommand && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleCopyCommand}
          >
            {copiedCommand ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
            {copiedCommand ? "Copied" : "Copy Command"}
          </Button>
        )}
      </div>

      {/* Raw Executed Command Snippet */}
      {lastResult.rawCommand && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Executed Raw Command (Redis / Query CLI)
          </span>
          <div className="p-2.5 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800 space-y-1">
            {lastResult.rawCommand.split("\n").map((cmdLine, idx) => (
              <div key={idx} className="flex items-start">
                <span className="text-red-400 select-none mr-1.5 shrink-0">$</span>
                <span className="text-emerald-400 font-semibold">{cmdLine}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message Callout if failed */}
      {lastResult.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-2">
          <div className="flex items-start gap-2">
            {isServerOffline ? (
              <ServerOff size={15} className="shrink-0 mt-0.5 text-destructive" />
            ) : (
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-bold">
                {isServerOffline ? "Database Server Offline / Not Found" : "Execution Error"}
              </span>
              <span className="opacity-90 leading-relaxed font-mono text-[11px] break-all">
                {lastResult.error}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-destructive/20 font-sans flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              {isServerOffline
                ? "The live server is unavailable. You can switch to Simulation Sandbox mode to run mock test cases."
                : "Switch to Simulation Sandbox mode to run mock test cases without a live server."}
            </span>

            {isServerOffline && onSwitchToSandbox && (
              <Button
                size="sm"
                onClick={onSwitchToSandbox}
                className="h-6 text-[11px] px-2.5 font-semibold bg-purple-600 hover:bg-purple-500 text-white gap-1 cursor-pointer shadow-xs"
              >
                <Layers size={11} />
                Switch to Sandbox
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Output Payload Inspector */}
      {lastResult.output !== undefined && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
              Response Output
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleCopyOutput}
            >
              {copiedOutput ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copiedOutput ? "Copied" : "Copy Output"}
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800 max-h-60">
            <pre className="text-xs leading-relaxed">
              {typeof lastResult.output === "object"
                ? JSON.stringify(lastResult.output, null, 2)
                : String(lastResult.output)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
