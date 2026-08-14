import { PageInfo } from "./types";
import { BackendNodeData } from "@workspace/canvas";
import { isAuthPage } from "../../../compileAuth";
import { EventComponentMeta } from "./eventGenerators";
import { generateAuthPageCode } from "./authPageGenerators";

export function generatePageCode(
  pageMeta: PageInfo,
  pageLoadFetchStatements: string,
  eventComponents: EventComponentMeta[],
  authNodeData?: BackendNodeData,
): string {
  const isAuth = isAuthPage(pageMeta, authNodeData);

  if (isAuth) {
    return generateAuthPageCode(pageMeta, authNodeData);
  }

  const headerCompName = `${pageMeta.componentName}Header`;
  const allImports = [
    `import { ${headerCompName} } from "./_components/${headerCompName}";`,
    ...eventComponents.map(
      (c) => `import { ${c.componentName} } from "./_components/${c.componentName}";`
    ),
  ].join("\n");

  const actionButtonsJsx =
    eventComponents.length === 0
      ? `<p className="text-muted-foreground text-sm italic">No click or trigger events configured for this page node.</p>`
      : `<div className="flex flex-wrap gap-3">\n${eventComponents
          .map((c) => `            <${c.componentName} onTrigger={handleTriggerAction} />`)
          .join("\n")}\n          </div>`;

  return `"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { getAuthBearerToken } from "@/lib/auth-token";
${allImports ? `${allImports}\n` : ""}
export default function ${pageMeta.componentName}() {
  const [pageLoadData, setPageLoadData] = useState<Record<string, Record<string, string | number | boolean | null>> | null>(null);
  const [pageLoadLoading, setPageLoadLoading] = useState<boolean>(false);
  const [pageLoadError, setPageLoadError] = useState<string | null>(null);

  const [triggerLogs, setTriggerLogs] = useState<Array<{
    id: string;
    eventName: string;
    eventType: string;
    timestamp: string;
    url: string;
    method: string;
    status?: number;
    payload?: unknown;
    data: Record<string, string | number | boolean | null> | null;
    error?: string;
  }>>([]);

  useEffect(() => {
    async function loadPageData() {
      ${pageLoadFetchStatements}
    }
    loadPageData();
  }, []);

  const handleTriggerAction = async (
    eventName: string,
    eventType: string,
    url: string,
    method: string,
    requireAuth?: boolean,
    customHeaders?: Record<string, string>,
    queryParams?: Record<string, string>,
    requestBody?: unknown,
  ) => {
    const timestamp = new Date().toLocaleTimeString();
    const logId = Math.random().toString(36).substring(2, 9);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(customHeaders || {}),
      };

      if (customHeaders?.["Authorization"] && customHeaders["Authorization"].trim() && customHeaders["Authorization"] !== "Bearer <token>") {
        headers["Authorization"] = customHeaders["Authorization"].trim();
      } else if (requireAuth !== false) {
        try {
          const token = await getAuthBearerToken();
          if (token) {
            headers["Authorization"] = token;
          }
        } catch (_tokenErr) {}
      }

      let targetUrl = url;
      if (queryParams && Object.keys(queryParams).length > 0 && targetUrl && targetUrl !== "#") {
        try {
          const urlObj = new URL(targetUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
          Object.entries(queryParams).forEach(([k, v]) => {
            if (v !== undefined && v !== null) urlObj.searchParams.set(k, String(v));
          });
          targetUrl = urlObj.toString();
        } catch (_urlErr) {}
      }

      const options: RequestInit = {
        method: method || "POST",
        headers,
        credentials: "include",
      };
      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH" ||
        (method === "DELETE" && requestBody !== undefined)
      ) {
        if (requestBody !== undefined) {
          options.body = typeof requestBody === "string" ? requestBody : JSON.stringify(requestBody);
        }
      }

      let resData: Record<string, string | number | boolean | null> | null = null;
      let status: number | undefined = undefined;

      if (targetUrl && targetUrl !== "#") {
        const res = await fetch(targetUrl, options);
        status = res.status;
        resData = await res.json().catch(() => ({ statusText: res.statusText }));
      } else {
        resData = {
          success: true,
          message: "Action '" + eventName + "' (" + eventType + ") triggered successfully (Simulated - no endpoint connected)",
          timestamp: new Date().toISOString(),
        };
      }

      setTriggerLogs((prev) => [
        {
          id: logId,
          eventName,
          eventType,
          timestamp,
          url: targetUrl || "N/A",
          method: method || "TRIGGER",
          status,
          payload: requestBody,
          data: resData,
        },
        ...prev,
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Request failed";
      setTriggerLogs((prev) => [
        {
          id: logId,
          eventName,
          eventType,
          timestamp,
          url: url || "N/A",
          method: method || "TRIGGER",
          error: errorMessage,
          data: null,
        },
        ...prev,
      ]);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Page Header */}
        <${headerCompName} />

        {/* Section 1: Page Load Data */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-card-foreground">Page Load Data</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Stringified JSON data loaded automatically on page mount
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">
              {pageLoadLoading ? "Loading..." : pageLoadError ? "Error" : "pageLoad"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 border border-border rounded-lg p-4 font-mono text-sm text-foreground overflow-x-auto shadow-inner min-h-[120px]">
              <pre className="whitespace-pre-wrap font-mono">
                {pageLoadLoading
                  ? "// Loading page data from API endpoint..."
                  : pageLoadError
                  ? "// Error: " + pageLoadError
                  : pageLoadData !== null
                  ? JSON.stringify(pageLoadData, null, 2)
                  : "// No pageLoad data available."}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Page Buttons & Action Triggers */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-card-foreground">Page Actions & Triggers</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Click buttons to trigger API requests and event handlers
            </CardDescription>
          </CardHeader>
          <CardContent>
            ${actionButtonsJsx}
          </CardContent>
        </Card>

        {/* Section 3: Trigger Output Logs */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-card-foreground">Trigger Results Log</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Real-time output logs from user clicks and actions
              </CardDescription>
            </div>
            {triggerLogs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  setTriggerLogs([]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear logs
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {triggerLogs.length === 0 ? (
              <div className="text-muted-foreground text-sm italic py-6 text-center border border-dashed border-border rounded-lg">
                No actions triggered yet. Click a button above to execute trigger logic.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {triggerLogs.map((log) => (
                  <div key={log.id} className="bg-muted/40 border border-border rounded-lg p-4 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground border-b border-border pb-2">
                      <span className="font-semibold text-foreground">{log.eventName} ({log.eventType})</span>
                      <span>{log.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-bold">{log.method}</span>
                      <span className="text-foreground/90 truncate">{log.url}</span>
                      {log.status && <span className="ml-auto text-muted-foreground">HTTP {log.status}</span>}
                    </div>
                    {log.payload !== undefined && (
                      <div className="text-[10px] text-muted-foreground bg-muted/60 p-2 rounded border border-border/40 space-y-1">
                        <div className="font-semibold uppercase tracking-wider text-[9px] text-muted-foreground/80">Request Payload Sent</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{typeof log.payload === "string" ? log.payload : JSON.stringify(log.payload, null, 2)}</pre>
                      </div>
                    )}
                    {log.error ? (
                      <div className="text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                        Error: {log.error}
                      </div>
                    ) : (
                      <pre className="text-foreground/90 bg-background/80 p-3 rounded border border-border/50 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
`;
}

export function generateRootIndexPage(
  projectName: string,
  indexCards: string,
): string {
  return `import Link from "next/link";
import { WebClientIndexHeader } from "./_components/WebClientIndexHeader";

export default function WebClientIndexPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <WebClientIndexHeader />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${indexCards}
        </div>
      </div>
    </main>
  );
}
`;
}
