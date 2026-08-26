"use client";

import React, { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  Copy,
  Check,
  Trash,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { LiveApiCallResult, AssertionResultItem } from "./utils";
import { toast } from "sonner";

interface EndpointResponseViewerProps {
  result: LiveApiCallResult | null;
  assertions: AssertionResultItem[];
  isLoading: boolean;
  onClear: () => void;
}

export function EndpointResponseViewer({
  result,
  assertions,
  isLoading,
  onClear,
}: EndpointResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<"body" | "headers" | "assertions" | "raw">("body");
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-border/50 bg-background/20 backdrop-blur-sm animate-pulse text-center gap-2">
        <div className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-muted-foreground font-medium">
          Sending live HTTP request to endpoint...
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          Measuring latency and inspecting response stream
        </span>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const handleCopyBody = () => {
    if (!result) return;
    const textToCopy =
      typeof result.body === "object"
        ? JSON.stringify(result.body, null, 2)
        : result.rawText || String(result.body || "");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Response copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const is2xx = result.status >= 200 && result.status < 300;
  const is3xx = result.status >= 300 && result.status < 400;
  const is4xx = result.status >= 400 && result.status < 500;
  const is5xx = result.status >= 500;
  const isFailed = result.status === 0;

  const passedCount = assertions.filter((a) => a.passed).length;
  const totalAssertions = assertions.length;
  const allPassed = totalAssertions > 0 && passedCount === totalAssertions;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-3.5 shadow-sm backdrop-blur-sm">
      {/* Response Header Bar */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Badge */}
          <span
            className={cn(
              "px-2.5 py-0.5 rounded text-xs font-mono font-bold border shadow-sm flex items-center gap-1.5",
              is2xx && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              is3xx && "bg-sky-500/10 text-sky-400 border-sky-500/20",
              is4xx && "bg-amber-500/10 text-amber-400 border-amber-500/20",
              is5xx && "bg-destructive/10 text-destructive border-destructive/20",
              isFailed && "bg-destructive/10 text-destructive border-destructive/20",
            )}
          >
            {is2xx && <CheckCircle2 className="w-3.5 h-3.5" />}
            {(is4xx || is5xx || isFailed) && <XCircle className="w-3.5 h-3.5" />}
            <span>
              {isFailed ? "CONNECTION FAILED" : `${result.status} ${result.statusText}`}
            </span>
          </span>

          {/* Latency Badge */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-muted-foreground bg-secondary/40 border border-border/50">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span>{result.latencyMs} ms</span>
          </span>

          {/* Size Badge */}
          {result.sizeFormatted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-muted-foreground bg-secondary/40 border border-border/50">
              <HardDrive className="w-3 h-3 text-muted-foreground" />
              <span>{result.sizeFormatted}</span>
            </span>
          )}

          {/* Assertion Summary Badge */}
          {totalAssertions > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border",
                allPassed
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20",
              )}
            >
              {allPassed ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              <span>
                {passedCount}/{totalAssertions} Assertions
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopyBody}
            title="Copy Response Body"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onClear}
            title="Clear Results"
          >
            <Trash className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Network Error / Diagnostics notice if connection failed */}
      {result.error && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
          <div className="flex items-start gap-2 text-destructive font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{result.error}</span>
          </div>
          <div className="text-[11px] text-muted-foreground pl-6 flex flex-col gap-1">
            <span>• Is the service running locally in Docker or your development terminal?</span>
            <span>• If in Web browser, local calls may be restricted by mixed-content or CORS. Use the <strong>Electron Desktop app</strong> or a public dev tunnel/staging URL.</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val: string) => {
          if (val === "body" || val === "headers" || val === "assertions") {
            setActiveTab(val);
          }
        }}
        className="w-full"
      >
        <div className="flex items-center justify-between border-b pb-1">
          <TabsList className="h-7 p-0 bg-transparent gap-2">
            <TabsTrigger
              value="body"
              className="h-6 text-xs px-2.5 data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            >
              Response Body
            </TabsTrigger>
            <TabsTrigger
              value="headers"
              className="h-6 text-xs px-2.5 data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            >
              Headers ({Object.keys(result.headers || {}).length})
            </TabsTrigger>
            {totalAssertions > 0 && (
              <TabsTrigger
                value="assertions"
                className="h-6 text-xs px-2.5 data-[state=active]:bg-secondary data-[state=active]:text-foreground flex items-center gap-1"
              >
                <span>Assertions</span>
                <span
                  className={cn(
                    "text-[10px] px-1 rounded-full",
                    allPassed
                      ? "bg-emerald-500/20 text-emerald-500 font-bold"
                      : "bg-destructive/20 text-destructive font-bold",
                  )}
                >
                  {passedCount}/{totalAssertions}
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="raw"
              className="h-6 text-xs px-2.5 data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            >
              Raw
            </TabsTrigger>
          </TabsList>
          <span className="text-[10px] font-mono text-muted-foreground">
            {result.timestamp}
          </span>
        </div>

        {/* Tab 1: Response Body */}
        <TabsContent value="body" className="mt-2 outline-none">
          {result.body !== null && result.body !== undefined ? (
            <pre className="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto max-h-[260px] overflow-y-auto leading-relaxed border border-zinc-800">
              {typeof result.body === "object"
                ? JSON.stringify(result.body, null, 2)
                : String(result.body)}
            </pre>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground italic border rounded-lg bg-secondary/10">
              No response body received.
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Response Headers */}
        <TabsContent value="headers" className="mt-2 outline-none">
          {Object.keys(result.headers || {}).length > 0 ? (
            <div className="flex flex-col gap-1 border rounded-lg p-2.5 bg-background/50 text-xs font-mono max-h-[240px] overflow-y-auto">
              {Object.entries(result.headers).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start gap-2 py-1 border-b last:border-0 border-border/40"
                >
                  <span className="w-1/3 font-semibold text-muted-foreground truncate" title={key}>
                    {key}:
                  </span>
                  <span className="flex-1 text-foreground break-all" title={value}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground italic border rounded-lg bg-secondary/10">
              No response headers recorded.
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Assertions */}
        <TabsContent value="assertions" className="mt-2 outline-none">
          <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
            {assertions.map((ast) => (
              <div
                key={ast.id}
                className={cn(
                  "flex flex-col gap-1 p-2.5 rounded-lg border text-xs font-mono",
                  ast.passed
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/5 border-destructive/20 text-destructive",
                )}
              >
                <div className="flex items-center gap-2">
                  {ast.passed ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-destructive" />
                  )}
                  <span className="font-semibold text-foreground flex-1">
                    {ast.name}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                      ast.passed
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "bg-destructive/20 text-destructive",
                    )}
                  >
                    {ast.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
                {ast.detail && (
                  <span className="text-[11px] text-muted-foreground pl-6">
                    {ast.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Raw Text */}
        <TabsContent value="raw" className="mt-2 outline-none">
          <pre className="p-3 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-xs overflow-x-auto max-h-[240px] overflow-y-auto whitespace-pre-wrap border border-zinc-800">
            {result.rawText || "(empty body)"}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
