import React from "react";
import { Play, Check, Copy, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import { ConfigItemData } from "../types";
import { StorageTestingConfig } from "./useStorageTestingConfig";
import { StorageTestingActions } from "./useStorageTestingActions";
import { generateFullVitestSuite } from "./codeGenerators";

interface SuiteViewProps {
  item: ConfigItemData;
  config: StorageTestingConfig;
  actions: StorageTestingActions;
}

export const SuiteView: React.FC<SuiteViewProps> = ({ item, config, actions }) => {
  const { bucketName, activeEndpoint } = config;
  const { isRunningSuite, suiteResult, handleRunTestSuite, copiedCode, handleCopy } = actions;

  const fullVitestSuite = generateFullVitestSuite(item);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-foreground">Generated Vitest Storage Suite</span>
          <span className="text-[10px] text-muted-foreground">
            Standalone test suite verifying connection and operations for <code>{bucketName}</code>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="h-7 px-2.5 text-xs gap-1.5"
            onClick={() => handleCopy(fullVitestSuite)}
          >
            {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copiedCode ? "Copied Suite" : "Copy Test File"}
          </Button>
        </div>
      </div>

      {/* Run Suite Action Bar */}
      <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/80 bg-card/60">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Play size={12} className="text-amber-500" /> Run Generated Test Suite
            </span>
            <span className="text-[10px] text-muted-foreground">
              Executes all test cases against <code>{activeEndpoint}</code> using configured <code>.env</code> variables.
            </span>
          </div>
          <Button
            size="sm" onClick={handleRunTestSuite} disabled={isRunningSuite}
            className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs gap-1.5 shadow-sm"
          >
            {isRunningSuite ? (
              <><Loader2 size={12} className="animate-spin" /><span>Executing Tests...</span></>
            ) : (
              <><Play size={12} fill="currentColor" /><span>Run Test Cases</span></>
            )}
          </Button>
        </div>

        {/* Suite Results */}
        {suiteResult && (
          <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 border ${
                    suiteResult.failed === 0
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-destructive/15 text-destructive border-destructive/30"
                  }`}
                >
                  {suiteResult.failed === 0 ? "PASSED" : "FAILED"} ({suiteResult.passed}/{suiteResult.total} passed)
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                  <Clock size={11} /> {suiteResult.durationMs}ms
                </span>
              </div>

              <span
                className={`text-[10px] font-semibold flex items-center gap-1 ${
                  suiteResult.serverActive ? "text-emerald-400" : "text-destructive"
                }`}
              >
                {suiteResult.serverActive ? (
                  <><CheckCircle2 size={12} /> Server Reachable</>
                ) : (
                  <><XCircle size={12} /> Server Offline / Unreachable</>
                )}
              </span>
            </div>

            {suiteResult.error && (
              <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium">
                {suiteResult.error}
              </div>
            )}

            <div className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60 bg-background/50 overflow-hidden">
              {suiteResult.cases.map((tc) => (
                <div key={tc.id} className="flex flex-col p-2.5 gap-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {tc.passed ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle size={13} className="text-destructive shrink-0" />
                      )}
                      <span
                        className={cn(
                          "font-mono font-medium truncate",
                          tc.passed ? "text-foreground" : "text-destructive font-semibold",
                        )}
                      >
                        {tc.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono">{tc.durationMs}ms</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 h-4 uppercase font-mono",
                          tc.passed
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : "bg-destructive/10 text-destructive border-destructive/30",
                        )}
                      >
                        {tc.passed ? "Pass" : "Fail"}
                      </Badge>
                    </div>
                  </div>

                  {tc.details && (
                    <span className="text-[11px] text-muted-foreground pl-5 font-mono">{tc.details}</span>
                  )}
                  {tc.error && (
                    <div className="ml-5 p-2 rounded bg-destructive/10 border border-destructive/25 text-destructive font-mono text-[10px] whitespace-pre-wrap select-all">
                      <strong>Assertion Error:</strong> {tc.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generated Vitest Code Preview */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Generated Vitest Code
        </span>
        <pre className="p-3.5 rounded-xl bg-black/60 dark:bg-black/90 border border-border/80 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed select-text max-h-[340px]">
          {fullVitestSuite}
        </pre>
      </div>
    </div>
  );
};
