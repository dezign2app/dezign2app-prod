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
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { JsonPayloadEditor } from "../../backend-nodes/graph-nodes/common/Editors";
import { EndpointLiveRunner } from "./EndpointLiveRunner";
import { TestCaseRequestBodyEditor } from "./TestCaseRequestBodyEditor";
import { useActiveFakeUsers } from "./fakeUser";
import { cn } from "@workspace/ui/lib/utils";
import { getInitialBody, generateId } from "./utils";

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
  const fakeUsers = useActiveFakeUsers();
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

  // Add custom path param
  const handleAddPathParam = () => {
    setParams([...params, { key: `param_${params.filter((p) => p.type === "path").length + 1}`, value: "1", type: "path", id: `p-path-${Date.now()}` }]);
  };

  // Add custom query param
  const handleAddQueryParam = () => {
    setParams([...params, { key: `query_${params.filter((p) => p.type === "query").length + 1}`, value: "sample", type: "query", id: `p-query-${Date.now()}` }]);
  };

  // Remove param
  const handleRemoveParam = (id: string) => {
    setParams(params.filter((p) => p.id !== id));
  };

  const pathParamsList = params.filter((p) => p.type === "path");
  const queryParamsList = params.filter((p) => p.type === "query");

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
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete Test Case"
              >
                <Trash className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Test Case?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>&quot;{name}&quot;</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main Tabs: Live Test | Request | Assertions */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "runner" | "request" | "assertions")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 h-8 p-0.5 bg-secondary/30">
          <TabsTrigger value="runner" className="text-xs gap-1 py-1">
            <Send className="w-3 h-3 text-primary" /> Live Test
          </TabsTrigger>
          <TabsTrigger value="request" className="text-xs gap-1 py-1">
            <Sliders className="w-3 h-3 text-primary" /> Request
          </TabsTrigger>
          <TabsTrigger value="assertions" className="text-xs gap-1 py-1">
            <CheckCircle2 className="w-3 h-3 text-primary" /> Expectations
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Live Interactive Test Execution */}
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
          {/* 1. Headers Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Headers
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 text-[10px] gap-1 rounded-full px-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border/50"
                onClick={handleAddHeader}
              >
                <Plus className="w-3 h-3" /> Add Field
              </Button>
            </div>

            {endpoint.requireAuth !== false && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/40 text-xs mb-1">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Insert Auth Persona Token:</span>
                </span>
                <Select
                  value=""
                  onValueChange={(val) => {
                    const user = fakeUsers.find((u) => u.id === val);
                    if (user) {
                      setHeaders((prev) => {
                        const filtered = prev.filter((h) => h.key.toLowerCase() !== "authorization");
                        if (!user.isAnonymous && user.token) {
                          return [...filtered, { id: generateId(), key: "authorization", value: `Bearer ${user.token}` }];
                        }
                        return filtered;
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-6 text-[11px] bg-background w-48 font-medium border-border/60">
                    <SelectValue placeholder="Pick Persona Token" />
                  </SelectTrigger>
                  <SelectContent>
                    {fakeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{u.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">({u.badge})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {headers.length === 0 && (
                <p className="text-[11px] text-muted-foreground/70 italic py-1">
                  No headers configured for this test case.
                </p>
              )}
              {headers.map((header) => (
                <div
                  key={header.id}
                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 group transition-all hover:border-primary/30"
                >
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
                    className="h-7 text-xs font-mono bg-background flex-1 border-border/60"
                  />
                  <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-secondary/80 text-muted-foreground border border-border/50 shrink-0">
                    string
                  </span>
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
                    className="h-7 text-xs font-mono bg-background flex-1 border-border/60"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded"
                    onClick={() => handleRemoveHeader(header.id)}
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Path Params Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Path Params
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 text-[10px] gap-1 rounded-full px-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border/50"
                onClick={handleAddPathParam}
              >
                <Plus className="w-3 h-3" /> Add Field
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {pathParamsList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70 italic py-1">
                  No path parameters configured for this endpoint.
                </p>
              ) : (
                pathParamsList.map((param) => (
                  <div
                    key={param.id}
                    className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 group transition-all hover:border-primary/30"
                  >
                    <Input
                      value={param.key}
                      onChange={(e) => {
                        setParams(
                          params.map((p) =>
                            p.id === param.id ? { ...p, key: e.target.value } : p,
                          ),
                        );
                      }}
                      placeholder="param_name"
                      className="h-7 text-xs font-mono bg-background flex-1 border-border/60"
                    />
                    <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-secondary/80 text-muted-foreground border border-border/50 shrink-0">
                      path
                    </span>
                    <Input
                      value={param.value}
                      onChange={(e) => {
                        setParams(
                          params.map((p) =>
                            p.id === param.id ? { ...p, value: e.target.value } : p,
                          ),
                        );
                      }}
                      placeholder="Value (e.g. 1)"
                      className="h-7 text-xs font-mono bg-background flex-1 border-border/60"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded"
                      onClick={() => handleRemoveParam(param.id)}
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Query Params Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Query Params
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 text-[10px] gap-1 rounded-full px-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border/50"
                onClick={handleAddQueryParam}
              >
                <Plus className="w-3 h-3" /> Add Field
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {queryParamsList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70 italic py-1">
                  No query parameters configured for this endpoint.
                </p>
              ) : (
                queryParamsList.map((param) => (
                  <div
                    key={param.id}
                    className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-2 group transition-all hover:border-primary/30"
                  >
                    <Input
                      value={param.key}
                      onChange={(e) => {
                        setParams(
                          params.map((p) =>
                            p.id === param.id ? { ...p, key: e.target.value } : p,
                          ),
                        );
                      }}
                      placeholder="param_name"
                      className="h-7 text-xs font-mono bg-background flex-1 border-border/60"
                    />
                    <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-secondary/80 text-muted-foreground border border-border/50 shrink-0">
                      query
                    </span>
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
                      className="h-7 text-xs font-mono bg-background flex-1 border-border/60"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded"
                      onClick={() => handleRemoveParam(param.id)}
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Request Body Card (matching Request Body Schema design) */}
          {["POST", "PUT", "PATCH", "DELETE"].includes(
            (endpoint.type || "GET").toUpperCase(),
          ) && (
            <TestCaseRequestBodyEditor
              endpoint={endpoint}
              body={body}
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
