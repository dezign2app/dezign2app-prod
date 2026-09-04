"use client";

import React, { useState, useMemo } from "react";
import {
  Play,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  Code2,
  ListFilter,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { ExternalInputVariable, ExternalTestResult } from "@workspace/canvas/types";
import { cn } from "@workspace/ui/lib/utils";
import { HttpMethod } from "./externalConfigUtils";
import { BufferedInput } from "./BufferedInput";

interface ExternalLiveTestSectionProps {
  method: HttpMethod;
  resolvedUrl: string;
  inputVariables: ExternalInputVariable[];
  testVariableValues: Record<string, string>;
  onTestVariableValueChange: (varName: string, value: string) => void;
  onRunLiveTest: () => Promise<void> | void;
  isTesting: boolean;
  testError: string | null;
  testResult: ExternalTestResult | null;
  onInferOutputSchema: () => void;
  inferredSchemaSaved: boolean;
}

export const ExternalLiveTestSection = React.memo<ExternalLiveTestSectionProps>(
  ({
    method,
    resolvedUrl,
    inputVariables,
    testVariableValues,
    onTestVariableValueChange,
    onRunLiveTest,
    isTesting,
    testError,
    testResult,
    onInferOutputSchema,
    inferredSchemaSaved,
  }) => {
    const [activeTab, setActiveTab] = useState<"response" | "params">("response");
    const [copiedResponse, setCopiedResponse] = useState(false);
    const [copiedParams, setCopiedParams] = useState(false);
    const [revealSecrets, setRevealSecrets] = useState(false);

    const handleCopyResponse = () => {
      if (!testResult?.data) return;
      const text =
        typeof testResult.data === "string"
          ? testResult.data
          : JSON.stringify(testResult.data, null, 2);
      navigator.clipboard.writeText(text);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 1500);
    };

    const handleCopyParams = () => {
      const details = testResult?.requestDetails || {
        method,
        url: resolvedUrl,
      };
      navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      setCopiedParams(true);
      setTimeout(() => setCopiedParams(false), 1500);
    };

    // Extract authorization header from dispatched request
    const authHeaderEntry = useMemo(() => {
      const headers = testResult?.requestDetails?.headers;
      if (!headers) return null;
      const entry = Object.entries(headers).find(
        ([k]) => k.toLowerCase() === "authorization",
      );
      if (!entry) return null;
      return { key: entry[0], value: entry[1] };
    }, [testResult]);

    // Intelligent diagnosis of authentication issues
    const authDiagnostic = useMemo(() => {
      if (!testResult) return null;
      const status = testResult.status;
      const isAuthError =
        status === 401 ||
        status === 403 ||
        (typeof testResult.data === "object" &&
          testResult.data?.error?.code === "invalid_api_key");

      if (!isAuthError) return null;

      if (!authHeaderEntry) {
        return {
          title: "Missing Authorization Header",
          message:
            "No Authorization header was sent with this request. Provider APIs require an API key.",
          recommendation: "Add '+ Authorization: Bearer <key>' under Request Headers above.",
        };
      }

      const val = (authHeaderEntry.value || "").trim();
      if (val === "Bearer" || val === "Bearer " || !val) {
        return {
          title: "Empty API Key Dispatched",
          message: `The Authorization header was sent as "${val || "(empty)"}". No actual key was passed.`,
          recommendation:
            "Enter your actual key (e.g. 'Bearer gsk_...') in Request Headers or save the variable in the Environment Variables Drawer.",
        };
      }

      if (val.includes("process.env.") || val.includes("${")) {
        return {
          title: "Unresolved Environment Variable",
          message: `The Authorization header contains unexpanded variable syntax: "${val}".`,
          recommendation:
            "Make sure the environment variable is configured in the Environment Variables Drawer below.",
        };
      }

      return {
        title: "API Key Rejected by Provider",
        message: "The external provider rejected the credential sent. Check provider dashboard status or key validity.",
        recommendation: "Verify key hasn't expired and matches the provider (e.g. console.groq.com).",
      };
    }, [testResult, authHeaderEntry]);

    const maskValue = (val: string) => {
      if (!val) return "(empty)";
      if (val.length <= 12) return "••••••••";
      return `${val.slice(0, 7)}...${val.slice(-4)}`;
    };

    return (
      <div className="flex flex-col gap-4 rounded-xl border-2 border-emerald-500/40 bg-card p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Play size={16} className="fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Test API Call</span>
              <span className="text-[10px] text-muted-foreground">
                Simulate or send a live HTTP request with test values.
              </span>
            </div>
          </div>

          <Button
            type="button"
            className="h-8 gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
            onClick={onRunLiveTest}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send size={13} /> Send Request
              </>
            )}
          </Button>
        </div>

        {/* Input variables for testing */}
        {inputVariables.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/20 border border-border/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Dynamic Variable Test Values
            </span>
            <div className="grid grid-cols-2 gap-2">
              {inputVariables.map((v) => (
                <div key={v.id} className="flex flex-col gap-1">
                  <Label className="text-[11px] font-mono flex items-center justify-between">
                    <span>{v.name}</span>
                    <span className="text-[9px] text-muted-foreground">({v.type})</span>
                  </Label>
                  <BufferedInput
                    className="h-7 text-xs font-mono bg-background"
                    placeholder={`Test value for ${v.name}`}
                    value={testVariableValues[v.name] ?? ""}
                    onCommit={(val) => onTestVariableValueChange(v.name, val)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Computed Request Preview */}
        <div className="flex flex-col gap-1.5 p-2.5 bg-background rounded-lg border border-border/60 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{method}</span>
            <span className="truncate text-foreground/80">{resolvedUrl || "(No URL configured)"}</span>
          </div>
        </div>

        {/* Test Error Banner */}
        {testError && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Request Failed</span>
              <span className="text-[11px] leading-relaxed opacity-90">{testError}</span>
            </div>
          </div>
        )}

        {/* Authentication Diagnostic Alert */}
        {authDiagnostic && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <span>{authDiagnostic.title}</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">{authDiagnostic.message}</p>
            <div className="text-[10px] bg-background/80 p-2 rounded border border-border/50 flex flex-col gap-1 mt-0.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground">Dispatched Authorization:</span>
                <button
                  type="button"
                  onClick={() => setRevealSecrets((prev) => !prev)}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  {revealSecrets ? <EyeOff size={10} /> : <Eye size={10} />}
                  {revealSecrets ? "Mask" : "Reveal"}
                </button>
              </div>
              <span className="font-mono font-bold text-foreground truncate select-all">
                {authHeaderEntry?.value
                  ? revealSecrets
                    ? authHeaderEntry.value
                    : maskValue(authHeaderEntry.value)
                  : "(none)"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground italic">💡 {authDiagnostic.recommendation}</p>
          </div>
        )}

        {/* Live Test Studio Inspector (Tabs: Response vs Dispatched Parameters) */}
        {testResult && (
          <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-secondary/15 border border-border">
            {/* Header with Tabs and Status */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {testResult.status !== undefined ? (
                  <span
                    className={cn(
                      "text-xs font-bold font-mono px-2 py-0.5 rounded border",
                      testResult.status >= 200 && testResult.status < 300
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-destructive/15 text-destructive border-destructive/30",
                    )}
                  >
                    {testResult.status} {testResult.statusText || ""}
                  </span>
                ) : (
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    No status
                  </span>
                )}

                {testResult.timeMs !== undefined && (
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Clock size={11} /> {testResult.timeMs}ms
                  </span>
                )}
              </div>

              {/* Segmented View Switcher */}
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
                <button
                  type="button"
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1",
                    activeTab === "response"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveTab("response")}
                >
                  <Code2 size={11} /> Response
                </button>
                <button
                  type="button"
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1",
                    activeTab === "params"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveTab("params")}
                >
                  <ListFilter size={11} /> Sent Parameters
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {activeTab === "response" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={handleCopyResponse}
                      disabled={!testResult.data}
                    >
                      {copiedResponse ? (
                        <Check size={11} className="text-emerald-500" />
                      ) : (
                        <Copy size={11} />
                      )}
                      Copy Body
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-6 text-[10px] gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={onInferOutputSchema}
                      disabled={!testResult.data}
                    >
                      {inferredSchemaSaved ? (
                        <>
                          <Check size={11} /> Saved!
                        </>
                      ) : (
                        <>
                          <Sparkles size={11} /> Infer Schema
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] gap-1 px-2"
                    onClick={handleCopyParams}
                  >
                    {copiedParams ? (
                      <Check size={11} className="text-emerald-500" />
                    ) : (
                      <Copy size={11} />
                    )}
                    Copy Parameters
                  </Button>
                )}
              </div>
            </div>

            {/* TAB 1: Response Body Output */}
            {activeTab === "response" && (
              <div className="relative">
                {testResult.data !== undefined ? (
                  <pre className="p-2.5 rounded bg-background border border-border/80 text-[11px] font-mono text-foreground overflow-x-auto max-h-[260px] leading-normal select-text">
                    {typeof testResult.data === "string"
                      ? testResult.data
                      : JSON.stringify(testResult.data, null, 2)}
                  </pre>
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No response body returned.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Dispatched Parameters Viewer */}
            {activeTab === "params" && (
              <div className="flex flex-col gap-2.5 p-2 rounded bg-background border border-border/80 text-[11px] font-mono">
                {/* Method & Resolved URL */}
                <div className="flex flex-col gap-1 p-2 rounded bg-secondary/20 border border-border/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Dispatched Request Target
                  </span>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {testResult.requestDetails?.method || method}
                    </span>
                    <span className="truncate text-foreground/90 select-all">
                      {testResult.requestDetails?.url || resolvedUrl}
                    </span>
                  </div>
                </div>

                {/* Dispatched Headers */}
                <div className="flex flex-col gap-1 p-2 rounded bg-secondary/20 border border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Dispatched Request Headers ({Object.keys(testResult.requestDetails?.headers || {}).length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealSecrets((p) => !p)}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-sans"
                    >
                      {revealSecrets ? <EyeOff size={10} /> : <Eye size={10} />}
                      {revealSecrets ? "Mask Secrets" : "Reveal Secrets"}
                    </button>
                  </div>

                  {testResult.requestDetails?.headers &&
                  Object.keys(testResult.requestDetails.headers).length > 0 ? (
                    <div className="flex flex-col divide-y divide-border/50 border border-border/60 rounded bg-background overflow-hidden">
                      {Object.entries(testResult.requestDetails.headers).map(([key, val]) => {
                        const isAuth = key.toLowerCase() === "authorization";
                        const isKeyEmpty = isAuth && (!val || val.trim() === "Bearer" || val.trim() === "Bearer ");
                        return (
                          <div key={key} className="p-1.5 flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground/80 shrink-0">{key}:</span>
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span
                                className={cn(
                                  "truncate select-all",
                                  isKeyEmpty
                                    ? "text-destructive font-bold"
                                    : "text-foreground/90",
                                )}
                              >
                                {isAuth
                                  ? revealSecrets
                                    ? val
                                    : maskValue(val)
                                  : val}
                              </span>
                              {isKeyEmpty && (
                                <span className="shrink-0 px-1 py-0.2 rounded bg-destructive/15 text-destructive border border-destructive/30 text-[9px] font-sans font-bold">
                                  Empty Token!
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[10px] italic">No headers dispatched.</span>
                  )}
                </div>

                {/* Dispatched Request Body */}
                {testResult.requestDetails?.body !== undefined && testResult.requestDetails?.body !== null && (
                  <div className="flex flex-col gap-1 p-2 rounded bg-secondary/20 border border-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Dispatched Request Body
                    </span>
                    <pre className="p-2 rounded bg-background border border-border/60 text-[10px] overflow-x-auto max-h-[160px] leading-relaxed text-foreground select-all">
                      {typeof testResult.requestDetails.body === "string"
                        ? testResult.requestDetails.body
                        : JSON.stringify(testResult.requestDetails.body, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
ExternalLiveTestSection.displayName = "ExternalLiveTestSection";

