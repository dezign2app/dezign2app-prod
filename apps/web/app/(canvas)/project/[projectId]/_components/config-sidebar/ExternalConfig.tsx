"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Globe } from "lucide-react";
import { generateId } from "../backend-nodes/graph-nodes/common";
import {
  BackendNodeData,
  CanvasExternalNodeData,
  ExternalInputVariable,
  ExternalQueryParam,
  ExternalHeader,
  ExternalTestResult,
} from "@workspace/canvas/types";
import { ExternalEnvVarsDrawer } from "../backend-nodes/graph-nodes/nodes/ai-security/ExternalEnvVarsDrawer";
import { toVarName } from "@/lib/compiler/utils";
import { getLocalEnvVariable, fetchLocalEnvVariable } from "@/lib/utils/localEnvSync";

import {
  HttpMethod,
  isHttpMethod,
  resolveFullUrl,
  interpolateString,
  ExternalIdentitySection,
  ExternalInputVariablesSection,
  ExternalRequestConfigSection,
  ExternalLiveTestSection,
  ExternalAdvancedSettingsSection,
} from "./external-config";

/**
 * Asynchronously resolves process.env.VAR references from localStorage or .env file on disk.
 */
async function resolveEnvTokens(
  raw: string,
  projectId?: string,
  fallbackApiKey?: string,
): Promise<string> {
  if (!raw) return "";

  const matches = Array.from(
    raw.matchAll(/(?:\$\{)?process\.env\.([a-zA-Z0-9_]+)(?:\s*\|\|\s*["'].*?["'])?\}?/g),
  );

  let result = raw;
  for (const m of matches) {
    const fullMatch = m[0];
    const envKey = m[1];
    if (!envKey) continue;
    let resolved = getLocalEnvVariable(envKey);
    if (!resolved) {
      try {
        resolved = await fetchLocalEnvVariable(envKey, projectId);
      } catch {}
    }
    if (!resolved && fallbackApiKey && !fallbackApiKey.includes("process.env.")) {
      resolved = fallbackApiKey;
    }
    result = result.replace(fullMatch, resolved || "");
  }

  return result;
}

interface ExternalConfigProps {
  id: string;
  nodeId: string;
}

export const ExternalConfig: React.FC<ExternalConfigProps> = ({ id: _id, nodeId }) => {
  const params = useParams();
  const projectId = typeof params?.projectId === "string" ? params.projectId : undefined;

  const node = useBackendCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNode = useBackendCanvasStore((s) => s.updateNode);

  const fallbackData: BackendNodeData = { label: "" };
  const data = node?.data ?? fallbackData;

  // Use refs to provide stable access to latest node and data without triggering effect churn
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const dataRef = useRef<BackendNodeData>(data);
  dataRef.current = data;

  const updateData = useCallback(
    (changes: Partial<CanvasExternalNodeData>) => {
      if (!nodeRef.current) return;
      updateNode(nodeId, {
        data: {
          ...dataRef.current,
          ...changes,
        },
      });
    },
    [nodeId, updateNode],
  );

  // Commit callbacks for identity fields
  const handleFunctionNameCommit = useCallback(
    (val: string) => updateData({ functionName: toVarName(val) }),
    [updateData],
  );
  const handleLabelCommit = useCallback(
    (val: string) => updateData({ label: val }),
    [updateData],
  );
  const handleDescriptionCommit = useCallback(
    (val: string) => updateData({ description: val }),
    [updateData],
  );
  const handleUrlCommit = useCallback(
    (val: string) => updateData({ url: val, baseUrl: val }),
    [updateData],
  );
  const handleDocsUrlCommit = useCallback(
    (val: string) => updateData({ docsUrl: val }),
    [updateData],
  );
  const handleTimeoutCommit = useCallback(
    (val: string) => updateData({ timeout: val }),
    [updateData],
  );
  const handleRateLimitCommit = useCallback(
    (val: string) => updateData({ rateLimit: val }),
    [updateData],
  );
  const handleBodyContentCommit = useCallback(
    (val: string) => updateData({ bodyContent: val }),
    [updateData],
  );

  // --- Dynamic Input Variables ---
  const inputVariables: ExternalInputVariable[] = useMemo(
    () => data.inputVariables || [],
    [data.inputVariables],
  );

  const queryParams: ExternalQueryParam[] = useMemo(
    () => data.queryParams || [],
    [data.queryParams],
  );

  const headers: ExternalHeader[] = useMemo(
    () => data.headers || [],
    [data.headers],
  );

  const rawMethod = (data.method || "POST").toUpperCase();
  const method: HttpMethod = isHttpMethod(rawMethod) ? rawMethod : "POST";
  const bodyType = data.bodyType || (method === "GET" ? "none" : "json");

  // --- Live Testing State ---
  const [testVariableValues, setTestVariableValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (data.inputVariables || []).forEach((v) => {
      initial[v.name] = v.defaultValue || "";
    });
    return initial;
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ExternalTestResult | null>(
    data.lastTestResult || null,
  );
  const [inferredSchemaSaved, setInferredSchemaSaved] = useState(false);

  // --- Input Variables Handlers ---
  const handleAddInputVariable = useCallback(
    (presetName?: string, presetType: ExternalInputVariable["type"] = "string") => {
      const curVars = dataRef.current.inputVariables || [];
      const newVar: ExternalInputVariable = {
        id: generateId(),
        name: presetName || `param${curVars.length + 1}`,
        type: presetType,
        required: true,
        defaultValue: "",
        description: "",
      };
      const next = [...curVars, newVar];
      updateData({ inputVariables: next });
      setTestVariableValues((prev) => ({
        ...prev,
        [newVar.name]: prev[newVar.name] ?? "",
      }));
    },
    [updateData],
  );

  const handleUpdateInputVariable = useCallback(
    (id: string, patch: Partial<ExternalInputVariable>) => {
      const curVars = dataRef.current.inputVariables || [];
      const next = curVars.map((v) => (v.id === id ? { ...v, ...patch } : v));
      updateData({ inputVariables: next });
    },
    [updateData],
  );

  const handleDeleteInputVariable = useCallback(
    (id: string) => {
      const curVars = dataRef.current.inputVariables || [];
      const next = curVars.filter((v) => v.id !== id);
      updateData({ inputVariables: next });
    },
    [updateData],
  );

  // --- Quick Insert Tokens ---
  const handleInsertVariableIntoUrl = useCallback(
    (varName: string) => {
      const currentUrl = dataRef.current.url || dataRef.current.baseUrl || "";
      const token = `{{${varName}}}`;
      const nextUrl = currentUrl ? `${currentUrl}/${token}` : token;
      updateData({ url: nextUrl, baseUrl: nextUrl });
    },
    [updateData],
  );

  const handleInsertVariableIntoBody = useCallback(
    (varName: string) => {
      const token = `{{${varName}}}`;
      const current = dataRef.current.bodyContent || "{\n  \n}";
      const insertion = current.includes("{\n")
        ? current.replace("{\n", `{\n  "${varName}": "${token}",\n`)
        : `${current} ${token}`;
      updateData({ bodyContent: insertion });
    },
    [updateData],
  );

  // --- Query Params Handlers ---
  const handleAddQueryParam = useCallback(() => {
    const curParams = dataRef.current.queryParams || [];
    const newParam: ExternalQueryParam = {
      id: generateId(),
      name: "",
      type: "string",
      required: false,
      key: "",
      value: "",
      enabled: true,
    };
    updateData({ queryParams: [...curParams, newParam] });
  }, [updateData]);

  const handleUpdateQueryParam = useCallback(
    (id: string, patch: Partial<ExternalQueryParam>) => {
      const curParams = dataRef.current.queryParams || [];
      const next = curParams.map((q) => (q.id === id ? { ...q, ...patch } : q));
      updateData({ queryParams: next });
    },
    [updateData],
  );

  const handleDeleteQueryParam = useCallback(
    (id: string) => {
      const curParams = dataRef.current.queryParams || [];
      updateData({ queryParams: curParams.filter((q) => q.id !== id) });
    },
    [updateData],
  );

  // --- Headers Handlers ---
  const handleAddHeader = useCallback(
    (key = "", value = "") => {
      const curHeaders = dataRef.current.headers || [];
      const newHeader: ExternalHeader = {
        id: generateId(),
        name: key || "Header",
        type: "string",
        required: false,
        key,
        value,
        enabled: true,
      };
      updateData({ headers: [...curHeaders, newHeader] });
    },
    [updateData],
  );

  const handleUpdateHeader = useCallback(
    (id: string, patch: Partial<ExternalHeader>) => {
      const curHeaders = dataRef.current.headers || [];
      const next = curHeaders.map((h) => (h.id === id ? { ...h, ...patch } : h));
      updateData({ headers: next });
    },
    [updateData],
  );

  const handleDeleteHeader = useCallback(
    (id: string) => {
      const curHeaders = dataRef.current.headers || [];
      updateData({ headers: curHeaders.filter((h) => h.id !== id) });
    },
    [updateData],
  );

  // Format JSON helper
  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(dataRef.current.bodyContent || "");
      const formatted = JSON.stringify(parsed, null, 2);
      updateData({ bodyContent: formatted });
    } catch {
      // ignore parse error
    }
  }, [updateData]);

  // Compute resolved target URL for test execution and preview
  const resolvedUrl = useMemo(
    () => resolveFullUrl(data.url || data.baseUrl || "", queryParams, testVariableValues),
    [data.url, data.baseUrl, queryParams, testVariableValues],
  );

  // --- Live API Call Execution ---
  const handleRunLiveTest = async () => {
    if (!resolvedUrl.trim()) {
      setTestError("Target URL is required to test the API call.");
      return;
    }

    setIsTesting(true);
    setTestError(null);

    let dispatchedHeaders: Record<string, string> = {};
    let dispatchedBody: string | undefined = undefined;

    try {
      const requestHeaders: Record<string, string> = {};

      // User headers
      const configuredHeaders = (data.headers || []).filter(
        (h) => h.enabled !== false && (h.key || h.name)?.trim(),
      );

      for (const h of configuredHeaders) {
        const hKey = (h.key || h.name || "").trim();
        let val = interpolateString(h.value || "", testVariableValues);
        val = await resolveEnvTokens(val, projectId, data.apiKey);
        requestHeaders[hKey] = val;
      }

      // Backward compatible Auth Header ONLY if not already provided in user headers
      const hasAuthHeader = Object.keys(requestHeaders).some(
        (k) => k.toLowerCase() === "authorization",
      );

      if (!hasAuthHeader) {
        let authKeyValue = data.apiKey || "";
        authKeyValue = await resolveEnvTokens(authKeyValue, projectId);

        if (data.authType === "bearer" && authKeyValue) {
          requestHeaders["Authorization"] = `Bearer ${authKeyValue}`;
        } else if (data.authType === "apiKey" && data.authHeader && authKeyValue) {
          requestHeaders[data.authHeader] = authKeyValue;
        } else if (data.authType === "basic" && authKeyValue) {
          requestHeaders["Authorization"] = `Basic ${btoa(authKeyValue + ":" + (data.apiSecret || ""))}`;
        }
      }

      // Request Body
      let requestBody: string | undefined = undefined;
      if (["POST", "PUT", "PATCH"].includes(method) && bodyType !== "none") {
        if (!requestHeaders["Content-Type"]) {
          requestHeaders["Content-Type"] = "application/json";
        }
        if (data.bodyContent) {
          requestBody = interpolateString(data.bodyContent, testVariableValues);
        }
      }

      dispatchedHeaders = { ...requestHeaders };
      dispatchedBody = requestBody;

      // Prominently log the exact API parameters to browser console
      console.group(`🚀 [EXTERNAL API TEST DISPATCH] ${method} ${resolvedUrl}`);
      console.log("Target URL:", resolvedUrl);
      console.log("HTTP Method:", method);
      console.table(requestHeaders);
      console.log("Dispatched Headers Object:", requestHeaders);
      if (requestBody !== undefined) {
        console.log("Dispatched Body:", requestBody);
      }
      console.groupEnd();

      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutSec = Number(data.timeout) || 30;
      const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
        signal: controller.signal,
      };

      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && requestBody !== undefined) {
        fetchOptions.body = requestBody;
      }

      // Execute directly from current browser client
      const response = await fetch(resolvedUrl, fetchOptions);
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const timeMs = Math.max(1, Math.round(endTime - startTime));

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      let responseData: unknown = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }

      console.log("[External API Call Direct Response]", {
        status: response.status,
        statusText: response.statusText,
        timeMs,
        data: responseData,
      });

      const result: ExternalTestResult = {
        status: response.status,
        statusText: response.statusText,
        timeMs,
        headers: responseHeaders,
        data: responseData,
        testedAt: new Date().toLocaleTimeString(),
        requestDetails: {
          method,
          url: resolvedUrl,
          headers: dispatchedHeaders,
          body: dispatchedBody,
        },
      };

      setTestResult(result);
      updateData({ lastTestResult: result });
    } catch (err: unknown) {
      let errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Failed to execute external API call.";

      if (errorMsg === "Failed to fetch") {
        errorMsg =
          "Failed to fetch: Browser blocked the request (CORS policy or network error). Check browser DevTools console.";
      }

      console.error("[External API Call Error]", errorMsg);
      const failureResult: ExternalTestResult = {
        error: errorMsg,
        timeMs: 0,
        testedAt: new Date().toLocaleTimeString(),
        requestDetails: {
          method,
          url: resolvedUrl,
          headers: dispatchedHeaders,
          body: dispatchedBody,
        },
      };
      setTestResult(failureResult);
      setTestError(errorMsg);
      updateData({ lastTestResult: failureResult });
    } finally {
      setIsTesting(false);
    }
  };

  // Infer JSON schema from test response data
  const handleInferOutputSchema = () => {
    if (!testResult?.data) return;
    try {
      const sample = testResult.data;
      updateData({ responseSchema: sample });
      setInferredSchemaSaved(true);
      setTimeout(() => setInferredSchemaSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  if (!node) return null;

  return (
    <div className="flex flex-col gap-6 mt-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-secondary text-foreground border border-border">
            <Globe size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {data.label || "External API Calling Tool"}
            </span>
            <span className="text-xs text-muted-foreground">
              Configure external HTTP request, dynamic parameters & test live execution.
            </span>
          </div>
        </div>
      </div>

      {/* 1. Identity Section */}
      <ExternalIdentitySection
        functionName={data.functionName || toVarName(data.label || "callExternalApi")}
        onFunctionNameCommit={handleFunctionNameCommit}
        label={data.label || ""}
        onLabelCommit={handleLabelCommit}
        description={data.description || ""}
        onDescriptionCommit={handleDescriptionCommit}
        docsUrl={data.docsUrl || ""}
        onDocsUrlCommit={handleDocsUrlCommit}
      />

      {/* 2. Dynamic Input Variables */}
      <ExternalInputVariablesSection
        inputVariables={inputVariables}
        onAddVariable={handleAddInputVariable}
        onUpdateVariable={handleUpdateInputVariable}
        onDeleteVariable={handleDeleteInputVariable}
        onInsertInUrl={handleInsertVariableIntoUrl}
        onInsertInBody={handleInsertVariableIntoBody}
        onUpdateTestValue={(name, val) =>
          setTestVariableValues((prev) => ({ ...prev, [name]: val }))
        }
      />

      {/* 3. HTTP Request Configuration */}
      <ExternalRequestConfigSection
        method={method}
        onMethodChange={(m) => updateData({ method: m })}
        url={data.url || data.baseUrl || ""}
        onUrlCommit={handleUrlCommit}
        queryParams={queryParams}
        onAddQueryParam={handleAddQueryParam}
        onUpdateQueryParam={handleUpdateQueryParam}
        onDeleteQueryParam={handleDeleteQueryParam}
        headers={headers}
        onAddHeader={handleAddHeader}
        onUpdateHeader={handleUpdateHeader}
        onDeleteHeader={handleDeleteHeader}
        bodyType={bodyType}
        onBodyTypeChange={(bt) => updateData({ bodyType: bt })}
        bodyContent={data.bodyContent || ""}
        onBodyContentCommit={handleBodyContentCommit}
        onFormatJson={handleFormatJson}
      />

      {/* 4. Live Testing Studio */}
      <ExternalLiveTestSection
        method={method}
        resolvedUrl={resolvedUrl}
        inputVariables={inputVariables}
        testVariableValues={testVariableValues}
        onTestVariableValueChange={(varName, val) =>
          setTestVariableValues((prev) => ({ ...prev, [varName]: val }))
        }
        onRunLiveTest={handleRunLiveTest}
        isTesting={isTesting}
        testError={testError}
        testResult={testResult}
        onInferOutputSchema={handleInferOutputSchema}
        inferredSchemaSaved={inferredSchemaSaved}
      />

      {/* 5. Environment Variables Drawer */}
      <ExternalEnvVarsDrawer nodeId={nodeId} defaultOpen={false} />

      {/* 6. Advanced Call Settings */}
      <ExternalAdvancedSettingsSection
        timeout={data.timeout !== undefined && data.timeout !== null ? String(data.timeout) : "30"}
        onTimeoutCommit={handleTimeoutCommit}
        rateLimit={data.rateLimit || ""}
        onRateLimitCommit={handleRateLimitCommit}
      />
    </div>
  );
};
