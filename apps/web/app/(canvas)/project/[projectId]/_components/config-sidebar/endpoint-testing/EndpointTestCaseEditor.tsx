"use client";

import React, { useState, useEffect, useRef } from "react";
import { Endpoint, BackendNode, JSONValue, Parameter } from "@/types/canvas";
import { SimulationTestCase } from "@workspace/canvas";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import {
  Trash,
  Plus,
  Copy,
  Sliders,
  CheckCircle2,
  Send,
  Sparkles,
  Layers,
} from "lucide-react";
import { JsonPayloadEditor } from "../../backend-nodes/graph-nodes/common/Editors";
import { EndpointLiveRunner } from "./EndpointLiveRunner";
import { cn } from "@workspace/ui/lib/utils";
import { getInitialBody } from "./utils";

interface EndpointTestCaseEditorProps {
  initialCase: SimulationTestCase;
  endpoint: Endpoint;
  nodeId: string;
  serviceNode?: BackendNode | null;
  onSave: (updated: SimulationTestCase) => void;
  onDelete: () => void;
  onDuplicate?: (tc: SimulationTestCase) => void;
}

export function EndpointTestCaseEditor({
  initialCase,
  endpoint,
  nodeId,
  serviceNode,
  onSave,
  onDelete,
  onDuplicate,
}: EndpointTestCaseEditorProps) {
  const [activeTab, setActiveTab] = useState<"runner" | "request" | "assertions">("runner");
  const [name, setName] = useState<string>(initialCase.name);

  // Headers state (key-value array)
  const [headers, setHeaders] = useState<Array<{ key: string; value: string; id: string }>>(() => {
    const list: Array<{ key: string; value: string; id: string }> = [];
    const existing = initialCase.request?.headers || {};
    Object.entries(existing).forEach(([k, v]) => {
      list.push({ key: k, value: String(v), id: `h-${Math.random()}` });
    });
    // Add default headers if none
    if (list.length === 0) {
      if (endpoint.requireAuth !== false) {
        list.push({ key: "authorization", value: "Bearer <token>", id: "h-auth" });
      }
      if (["POST", "PUT", "PATCH"].includes((endpoint.type || "GET").toUpperCase())) {
        list.push({ key: "content-type", value: "application/json", id: "h-ct" });
      }
    }
    return list;
  });

  // Parameters state (Path params + Query params)
  const [params, setParams] = useState<Array<{ key: string; value: string; type: "path" | "query"; id: string }>>(() => {
    const list: Array<{ key: string; value: string; type: "path" | "query"; id: string }> = [];
    const existingParams = initialCase.request?.params || {};

    endpoint.pathParams?.forEach((p) => {
      const k = p.key || p.name;
      if (k) {
        list.push({
          key: k,
          value: String(existingParams[k] ?? p.defaultValue ?? p.value ?? "1"),
          type: "path",
          id: `p-path-${k}`,
        });
      }
    });

    endpoint.queryParams?.forEach((q) => {
      const k = q.key || q.name;
      if (k) {
        list.push({
          key: k,
          value: String(existingParams[k] ?? q.defaultValue ?? q.value ?? ""),
          type: "query",
          id: `p-query-${k}`,
        });
      }
    });

    // Custom query params if any in test case
    Object.entries(existingParams).forEach(([k, v]) => {
      if (!list.some((p) => p.key === k)) {
        list.push({
          key: k,
          value: String(v),
          type: "query",
          id: `p-custom-${k}`,
        });
      }
    });

    return list;
  });

  // Request Body state
  const [body, setBody] = useState<JSONValue | undefined>(() => {
    if (initialCase.request?.body !== undefined) {
      return initialCase.request.body;
    }
    return getInitialBody(endpoint);
  });

  // Expectations state
  const [expectedStatus, setExpectedStatus] = useState<number | undefined>(
    initialCase.expectedStatus ?? ((endpoint.type || "GET").toUpperCase() === "POST" ? 201 : 200),
  );
  const [expectedBody, setExpectedBody] = useState<JSONValue | undefined>(
    initialCase.expectedBody,
  );

  // Sync state when initialCase changes
  useEffect(() => {
    setName(initialCase.name);
    setExpectedStatus(initialCase.expectedStatus);
    setExpectedBody(initialCase.expectedBody);
  }, [initialCase.id]);

  // Debounced auto-save
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const headerMap: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key.trim()) headerMap[h.key.trim().toLowerCase()] = h.value;
      });

      const paramMap: Record<string, string> = {};
      params.forEach((p) => {
        if (p.key.trim()) paramMap[p.key.trim()] = p.value;
      });

      onSave({
        ...initialCase,
        name: name.trim() || initialCase.name,
        request: {
          headers: headerMap,
          params: paramMap,
          body,
        },
        expectedStatus,
        expectedBody,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [name, headers, params, body, expectedStatus, expectedBody]);

  // Add header
  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "", id: `h-${Date.now()}` }]);
  };

  // Remove header
  const handleRemoveHeader = (id: string) => {
    setHeaders(headers.filter((h) => h.id !== id));
  };

  // Add custom param
  const handleAddParam = () => {
    setParams([...params, { key: "", value: "", type: "query", id: `p-${Date.now()}` }]);
  };

  // Remove param
  const handleRemoveParam = (id: string) => {
    setParams(params.filter((p) => p.id !== id));
  };

  const statusPresets = [200, 201, 400, 401, 403, 404, 500];

  return (
    <div
      className="flex flex-col gap-3 p-3 bg-secondary/5 rounded-xl border font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex-1 flex flex-col gap-1">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Test Case Name
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs bg-background font-semibold"
            placeholder="e.g. 200 OK - Valid User Payload"
          />
        </div>

        <div className="flex items-center gap-1 mt-4">
          {onDuplicate && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicate(initialCase)}
              title="Duplicate Test Case"
            >
              <Copy className="w-3.5 h-3.5 mr-1" /> Clone
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:bg-destructive/10"
                title="Delete Test Case"
              >
                <Trash className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Test Case</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 h-8 bg-background/60 p-0.5 rounded-lg border border-border/50">
          <TabsTrigger
            value="runner"
            className="text-xs font-medium data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:font-semibold text-muted-foreground flex items-center gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Live Test</span>
          </TabsTrigger>
          <TabsTrigger
            value="request"
            className="text-xs font-medium data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:font-semibold text-muted-foreground flex items-center gap-1.5 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Request</span>
          </TabsTrigger>
          <TabsTrigger
            value="assertions"
            className="text-xs font-medium data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:font-semibold text-muted-foreground flex items-center gap-1.5 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Expectations</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Live Runner */}
        <TabsContent value="runner" className="mt-3 outline-none">
          <EndpointLiveRunner
            testCase={{
              ...initialCase,
              name,
              request: {
                headers: headers.reduce((acc, h) => {
                  if (h.key.trim()) acc[h.key.trim().toLowerCase()] = h.value;
                  return acc;
                }, {} as Record<string, string>),
                params: params.reduce((acc, p) => {
                  if (p.key.trim()) acc[p.key.trim()] = p.value;
                  return acc;
                }, {} as Record<string, string>),
                body,
              },
              expectedStatus,
              expectedBody,
            }}
            endpoint={endpoint}
            nodeId={nodeId}
            serviceNode={serviceNode}
          />
        </TabsContent>

        {/* Tab 2: Request Configuration */}
        <TabsContent value="request" className="mt-3 flex flex-col gap-4 outline-none">
          {/* Path & Query Params */}
          <div className="flex flex-col gap-2 border p-3 rounded-lg bg-card/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Parameters (Path & Query)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 text-primary"
                onClick={handleAddParam}
              >
                <Plus className="w-3 h-3 mr-1" /> Add Param
              </Button>
            </div>

            {params.length > 0 ? (
              <div className="flex flex-col gap-2 mt-1">
                {params.map((param, idx) => (
                  <div key={param.id} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border shrink-0">
                      {param.type}
                    </span>
                    <Input
                      value={param.key}
                      onChange={(e) => {
                        setParams(
                          params.map((p) =>
                            p.id === param.id ? { ...p, key: e.target.value } : p,
                          ),
                        );
                      }}
                      placeholder="Param Key"
                      className="h-7 text-xs font-mono bg-background flex-1"
                    />
                    <Input
                      value={param.value}
                      onChange={(e) => {
                        setParams(
                          params.map((p) =>
                            p.id === param.id ? { ...p, value: e.target.value } : p,
                          ),
                        );
                      }}
                      placeholder="Value"
                      className="h-7 text-xs font-mono bg-background flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveParam(param.id)}
                    >
                      <Trash className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground italic py-1">
                No parameters configured for this endpoint.
              </div>
            )}
          </div>

          {/* Headers */}
          <div className="flex flex-col gap-2 border p-3 rounded-lg bg-card/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Headers
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 text-primary"
                onClick={handleAddHeader}
              >
                <Plus className="w-3 h-3 mr-1" /> Add Header
              </Button>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {headers.map((header) => (
                <div key={header.id} className="flex items-center gap-1.5">
                  <Input
                    value={header.key}
                    onChange={(e) => {
                      setHeaders(
                        headers.map((h) =>
                          h.id === header.id ? { ...h, key: e.target.value } : h,
                        ),
                      );
                    }}
                    placeholder="Header Key (e.g. Authorization)"
                    className="h-7 text-xs font-mono bg-background flex-1"
                  />
                  <Input
                    value={header.value}
                    onChange={(e) => {
                      setHeaders(
                        headers.map((h) =>
                          h.id === header.id ? { ...h, value: e.target.value } : h,
                        ),
                      );
                    }}
                    placeholder="Value (e.g. Bearer <token>)"
                    className="h-7 text-xs font-mono bg-background flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveHeader(header.id)}
                  >
                    <Trash className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Request Body Editor */}
          {["POST", "PUT", "PATCH", "DELETE"].includes(
            (endpoint.type || "GET").toUpperCase(),
          ) && (
            <JsonPayloadEditor
              title="Request Body (JSON)"
              schema={endpoint.requestBody}
              value={body}
              onChange={setBody}
            />
          )}
        </TabsContent>

        {/* Tab 3: Assertions / Expectations */}
        <TabsContent value="assertions" className="mt-3 flex flex-col gap-4 outline-none">
          {/* Expected Status */}
          <div className="flex flex-col gap-2.5 border p-3 rounded-lg bg-card/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Expected HTTP Status Code
              </span>
              {expectedStatus && (
                <span className="text-xs font-mono font-bold text-primary">
                  {expectedStatus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={expectedStatus ?? ""}
                onChange={(e) =>
                  setExpectedStatus(e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                placeholder="200"
                className="h-7 text-xs font-mono bg-background w-28"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {statusPresets.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setExpectedStatus(code)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-mono font-medium border transition-colors",
                      expectedStatus === code
                        ? "bg-secondary text-foreground font-semibold border-border/80 shadow-sm"
                        : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border/40",
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Expected Body */}
          <JsonPayloadEditor
            title="Expected Response Body (Partial or Exact Match)"
            schema={endpoint.responseBody}
            value={expectedBody}
            onChange={setExpectedBody}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
