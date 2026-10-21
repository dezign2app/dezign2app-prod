"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Endpoint, BackendNode } from "@workspace/canvas/types";

import { BufferedInput } from "./BufferedInput";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ChevronDown, ChevronRight, Plus, Trash, Send, Pencil, Check, X, Braces, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { toast } from "sonner";
import { NestedResponseSchemaEditor } from "../NestedResponseSchemaEditor";
import { BindingSourceEditor } from "./BindingSourceEditor";
import { PipelineStepDraft, StepBinding, AvailableSource } from "./types";
import { getAvailableSources, HTTP_STATUS_OPTIONS } from "./utils";
import {
  isHealthEndpoint,
  getHealthCheckResponseBindings,
} from "@/lib/utils/healthCheckEndpoint";

export interface ReturnResponseStepRowProps {
  step: PipelineStepDraft;
  priorSteps: PipelineStepDraft[];
  endpoint?: Endpoint;
  allNodes: BackendNode[];
  serviceNodeId?: string;
  extraSources?: AvailableSource[];
  onChange: (updated: PipelineStepDraft) => void;
  onEndpointChange?: (changes: Partial<Endpoint>) => void;
}

export const ReturnResponseStepRow = ({
  step,
  priorSteps,
  endpoint,
  allNodes,
  serviceNodeId,
  extraSources = [],
  onChange,
  onEndpointChange,
}: ReturnResponseStepRowProps) => {
  const [expanded, setExpanded] = useState(true);
  const [responseTab, setResponseTab] = useState<"success" | "error">("success");

  const stepRef = useRef(step);
  stepRef.current = step;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;


  // Available sources (request body, params, query, headers, env, prior steps)
  const availableSources = useMemo(
    () => getAvailableSources(endpoint, priorSteps, allNodes, undefined, extraSources, serviceNodeId),
    [endpoint, priorSteps, allNodes, extraSources, serviceNodeId],
  );

  const statusCode = step.statusCode || (endpoint?.type === "POST" ? 201 : 200);

  // Compute duplicate argument keys in response bindings
  const duplicateArgCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (step.inputBindings || []).forEach((b) => {
      const key = (b.argName || "").trim().toLowerCase();
      if (key) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }, [step.inputBindings]);

  function inferFieldTypeFromBinding(
    b: StepBinding,
    sources: AvailableSource[],
    ep?: Endpoint,
  ): string {
    const src = b.source;
    if (!src) return "string";
    const srcField = "field" in src && typeof src.field === "string" ? src.field.trim() : "";

    // 1. Look in availableSources for matching source and path
    let targetSource: AvailableSource | undefined;
    if (src.kind === "step_output") {
      targetSource = sources.find(
        (s) => s.id === `step:${src.stepId}` || s.stepId === src.stepId,
      );
    } else {
      targetSource = sources.find(
        (s) => s.id === src.kind || s.kind === src.kind,
      );
    }

    if (targetSource && srcField) {
      const cleanField = srcField.toLowerCase();
      const matchedPath = targetSource.paths.find(
        (p) => p.path.toLowerCase() === cleanField,
      );
      if (matchedPath?.type) {
        return matchedPath.type;
      }
    }

    // 2. Endpoint path parameters
    if (src.kind === "req_params") {
      if (srcField) {
        const param = ep?.pathParams?.find(
          (p) => p.name?.toLowerCase() === srcField.toLowerCase(),
        );
        if (param?.type) {
          return param.type;
        }
      }
    }

    // 3. Endpoint query parameters
    if (src.kind === "req_query") {
      if (srcField) {
        const param = ep?.queryParams?.find(
          (p) => p.name?.toLowerCase() === srcField.toLowerCase(),
        );
        if (param?.type) {
          return param.type;
        }
      }
    }

    // 4. Endpoint headers
    if (src.kind === "req_headers") {
      if (srcField) {
        const header = ep?.headers?.find(
          (h) => h.name?.toLowerCase() === srcField.toLowerCase(),
        );
        if (header?.type) {
          return header.type;
        }
      }
    }

    // 5. Endpoint request body
    if (src.kind === "req_body") {
      if (srcField) {
        const field = ep?.requestBody?.fields?.find(
          (f) => (f.name || f.key)?.toLowerCase() === srcField.toLowerCase(),
        );
        if (field?.type) {
          return field.type;
        }
      }
    }

    // 6. Inline literal values
    if (src.kind === "inline") {
      if (typeof src.value === "number") return "number";
      if (typeof src.value === "boolean") return "boolean";
      return "string";
    }

    // 7. Preserve existing field type if already configured on endpoint responseBody
    const existingField = ep?.responseBody?.fields?.find(
      (f) => (f.name || f.key)?.toLowerCase() === b.argName?.trim().toLowerCase(),
    );
    if (existingField?.type) {
      return existingField.type;
    }

    return "string";
  }

  function inferFieldRequiredFromBinding(
    b: StepBinding,
    ep?: Endpoint,
  ): boolean {
    const src = b.source;
    if (!src) return true;
    const srcField = "field" in src && typeof src.field === "string" ? src.field.trim() : "";

    if (src.kind === "req_query") {
      if (srcField) {
        const param = ep?.queryParams?.find(
          (p) => p.name?.toLowerCase() === srcField.toLowerCase(),
        );
        return param?.required === true;
      }
      return false;
    }

    if (src.kind === "req_headers") {
      if (srcField) {
        const header = ep?.headers?.find(
          (h) => h.name?.toLowerCase() === srcField.toLowerCase(),
        );
        return header?.required === true;
      }
      return false;
    }

    if (src.kind === "req_body") {
      if (srcField) {
        const field = ep?.requestBody?.fields?.find(
          (f) => (f.name || f.key)?.toLowerCase() === srcField.toLowerCase(),
        );
        return field?.required !== false;
      }
    }

    return true;
  }

  // Auto-sync payload bindings into endpoint.responseBody so user never has to configure fields twice
  const syncResponseBody = (bindings: StepBinding[]) => {
    if (onEndpointChange) {
      const seen = new Set<string>();
      const fields = bindings
        .filter((b) => {
          const trimmed = (b.argName || "").trim();
          if (!trimmed) return false;
          const lower = trimmed.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        })
        .map((b, idx) => ({
          id: `res_f_${idx}`,
          name: b.argName.trim(),
          type: inferFieldTypeFromBinding(b, availableSources, endpoint),
          required: inferFieldRequiredFromBinding(b, endpoint),
          key: b.argName.trim(),
          value: "",
        }));
      onEndpointChange({
        responseBody: {
          id: endpoint?.responseBody?.id || `res_${endpoint?.id || "ep"}`,
          fields,
          rawJson: endpoint?.responseBody?.rawJson,
        },
      });
    }
  };

  const updateBinding = (bi: number, updated: StepBinding) => {
    const bindings = [...(step.inputBindings || [])];
    bindings[bi] = updated;
    onChange({ ...step, inputBindings: bindings });
    syncResponseBody(bindings);
  };

  const addBinding = () => {
    const existing = new Set(
      (step.inputBindings || [])
        .map((b) => (b.argName || "").trim().toLowerCase())
        .filter(Boolean),
    );
    let idx = (step.inputBindings || []).length + 1;
    while (existing.has(`field_${idx}`.toLowerCase())) {
      idx++;
    }
    const newBinding: StepBinding = {
      argName: `field_${idx}`,
      source: { kind: "req_body", field: "" },
    };
    const next = [...(step.inputBindings || []), newBinding];
    onChange({
      ...step,
      inputBindings: next,
    });
    syncResponseBody(next);
  };

  const removeBinding = (bi: number) => {
    const next = (step.inputBindings || []).filter((_, i) => i !== bi);
    onChange({
      ...step,
      inputBindings: next,
    });
    syncResponseBody(next);
  };

  // Build preview code
  const previewCode = useMemo(() => {
    const bindings = step.inputBindings || [];
    if (bindings.length === 0) {
      return `res.status(${statusCode}).json({ message: "Success" });`;
    }

    const getExprForBinding = (b: StepBinding): string => {
      const source = b.source;

      switch (source.kind) {
        case "inline": {
          const v = source.value;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          const str = String(v ?? "");
          if (!/\$\{([^}]+)\}/.test(str)) return `"${str}"`;
          return `\`${str.replace(/`/g, "\\`")}\``;
        }
        case "step_output": {
          const found = availableSources.find(
            (s) => s.id === `step:${source.stepId}`,
          );
          const base = found?.variableName || "stepResult";
          const field = source.field ? source.field.trim() : "";
          if (!field) return base;
          const baseLower = base.toLowerCase();
          const fieldLower = field.toLowerCase();
          const isPresigned =
            baseLower === "uploadurl" ||
            baseLower === "downloadurl" ||
            baseLower === "presignedurl" ||
            baseLower === "signedurl" ||
            (found?.label && found.label.toLowerCase().includes("presign"));

          if (
            fieldLower === baseLower ||
            (isPresigned &&
              (fieldLower === "uploadurl" ||
                fieldLower === "downloadurl" ||
                fieldLower === "presignedurl" ||
                fieldLower === "signedurl" ||
                fieldLower === "url"))
          ) {
            return base;
          }

          if (isPresigned) {
            if (fieldLower === "key") {
              const prior = priorSteps.find((s) => s.id === source.stepId);
              const keyBinding = prior?.inputBindings?.find(
                (b) => b.argName?.toLowerCase() === "key" || b.argName?.toLowerCase() === "objectkey",
              );
              if (keyBinding?.source?.kind === "req_body" && keyBinding.source.field) {
                return `req.body.${keyBinding.source.field}`;
              }
              if (keyBinding?.source?.kind === "inline" && keyBinding.source.value) {
                return JSON.stringify(keyBinding.source.value);
              }
              return `"uploads/file.png"`;
            }
            if (fieldLower === "bucket") {
              const prior = priorSteps.find((s) => s.id === source.stepId);
              return JSON.stringify(prior?.bucketId || "default-bucket");
            }
            if (fieldLower === "method") {
              const isDownload = baseLower.includes("download");
              return JSON.stringify(isDownload ? "GET" : "PUT");
            }
            if (fieldLower === "expiresinseconds") {
              const isDownload = baseLower.includes("download");
              return isDownload ? "3600" : "900";
            }
          }

          if (field.startsWith("[")) return `${base}${field}`;
          return `${base}.${field}`;
        }
        case "req_body": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.body.${field}` : "req.body";
        }
        case "req_params": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.params.${field}` : "req.params";
        }
        case "req_query": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.query.${field}` : "req.query";
        }
        case "req_headers": {
          const field = source.field ? source.field.trim() : "";
          return field ? `req.headers["${field}"]` : "req.headers";
        }
        case "auth": {
          const field = source.field ? source.field.trim() : "";
          return field ? `auth?.${field}` : "auth";
        }
        case "env": {
          const field = source.field ? source.field.trim() : "";
          return field ? `process.env.${field}` : "process.env";
        }
        default:
          return '""';
      }
    };

    const fields = bindings
      .map((b) => `${b.argName}: ${getExprForBinding(b)}`)
      .join(", ");
    return `res.status(${statusCode}).json({ ${fields} });`;
  }, [step.inputBindings, statusCode, availableSources]);

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 shadow-sm transition-all duration-150">
      {/* Header */}
      <div
        className="flex flex-col gap-0.5 px-2.5 py-1.5 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Top Line */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-emerald-400 font-mono w-3.5 shrink-0">
            ↩
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 text-emerald-400 bg-emerald-500/10 border-emerald-500/25">
            <Send size={11} />
            Return Response
          </span>
          <span className="text-xs font-medium text-foreground/90 flex-1 truncate">
            HTTP {statusCode}
          </span>
          <span className="text-[10px] font-mono text-emerald-400/60 truncate max-w-[130px]">
            {previewCode}
          </span>
          {expanded ? (
            <ChevronDown size={12} className="text-muted-foreground/50 shrink-0 ml-1" />
          ) : (
            <ChevronRight size={12} className="text-muted-foreground/50 shrink-0 ml-1" />
          )}
        </div>

        {/* Second Line: Description (read-only, no events) */}
        {(() => {
          const displayDesc =
            step.description?.trim() ||
            (step.name && step.name !== "Return Response" ? step.name.trim() : "");
          return displayDesc ? (
            <div className="flex items-center ml-7 mr-6 -mt-0.5 mb-0.5 pointer-events-none min-h-[18px]">
              <span className="text-[11px] font-sans leading-relaxed text-emerald-300/80 line-clamp-2">
                {displayDesc}
              </span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-emerald-500/20 px-3 pt-3 pb-3 flex flex-col gap-3">
          {/* Dual Tabs: Success Response (2xx) and Failure / Error Response (4xx/5xx) */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/30 border border-border/50">
            <button
              type="button"
              onClick={() => setResponseTab("success")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                responseTab === "success"
                  ? "bg-background text-foreground shadow-xs font-semibold border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Success Response (2xx)</span>
              {(step.inputBindings || []).length > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-mono">
                  {(step.inputBindings || []).length} field{(step.inputBindings || []).length !== 1 ? "s" : ""}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setResponseTab("error")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                responseTab === "error"
                  ? "bg-background text-foreground shadow-xs font-semibold border border-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
              <span>Failure / Error Response (4xx/5xx)</span>
              {endpoint?.errorResponseBody?.fields && endpoint.errorResponseBody.fields.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-destructive/15 text-destructive font-mono">
                  {endpoint.errorResponseBody.fields.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Success Response (2xx) */}
          {responseTab === "success" && (
            <div className="flex flex-col gap-3">
              {/* Status code row */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1 w-48">
                  <Label className="text-[10px] text-muted-foreground font-medium">
                    HTTP Status Code
                  </Label>
                  <Select
                    value={String(statusCode)}
                    onValueChange={(v) => onChange({ ...step, statusCode: Number(v) })}
                  >
                    <SelectTrigger className="h-7 text-xs bg-background/70 border-border/60 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HTTP_STATUS_OPTIONS.filter(
                        (opt) => opt && opt.code != null && String(opt.code).trim() !== "",
                      ).map((opt) => (
                        <SelectItem
                          key={opt.code}
                          value={String(opt.code)}
                          className="text-xs font-mono"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Response payload fields */}
              <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                      Success Response Payload
                    </Label>
                    <span className="text-[9px] text-muted-foreground/60">
                      Bind returned fields directly from step results or request data.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    onClick={addBinding}
                  >
                    <Plus size={10} />
                    Add field
                  </button>
                </div>

                {(step.inputBindings || []).length === 0 ? (
                  <div className="rounded border border-dashed border-border/40 p-2.5 text-center bg-muted/10">
                    <p className="text-[10px] text-muted-foreground/60">
                      Default response envelope will be returned.
                    </p>
                    {(() => {
                      const isHealth = isHealthEndpoint(endpoint);
                      return (
                        <p
                          className="text-[9px] text-emerald-400/80 mt-0.5 cursor-pointer hover:underline"
                          onClick={() => {
                            let next: StepBinding[];
                            if (isHealth) {
                              const serviceNode = allNodes.find((n) => n.id === serviceNodeId);
                              const serviceName = serviceNode?.data?.label || "service";
                              const servicePort = String(serviceNode?.data?.port || "8080");
                              next = getHealthCheckResponseBindings(serviceName, servicePort);
                            } else {
                              const lastPrior = priorSteps[priorSteps.length - 1];
                              const defaultBinding: StepBinding = lastPrior
                                ? {
                                    argName: "data",
                                    source: {
                                      kind: "step_output",
                                      stepId: lastPrior.id,
                                      field: "",
                                    },
                                  }
                                : {
                                    argName: "data",
                                    source: { kind: "req_body", field: "" },
                                  };
                              next = [defaultBinding];
                            }
                            onChange({
                              ...step,
                              inputBindings: next,
                            });
                            syncResponseBody(next);
                          }}
                        >
                          {isHealth
                            ? "Click here to populate standard health check response (status, service, port, timestamp)."
                            : "Click here to return the result of the previous step."}
                        </p>
                      );
                    })()}
                  </div>
                ) : (
                  (step.inputBindings || []).map((binding, bi) => {
                    const cleanArg = (binding.argName || "").trim().toLowerCase();
                    const isDuplicate = cleanArg.length > 0 && (duplicateArgCounts.get(cleanArg) || 0) > 1;

                    return (
                      <div
                        key={bi}
                        className={cn(
                          "flex flex-col gap-1 p-1.5 rounded border transition-colors",
                          isDuplicate
                            ? "border-destructive/60 bg-destructive/[0.04]"
                            : "bg-muted/15 border-border/40",
                        )}
                      >
                        <div className="grid grid-cols-[1fr_auto_2.2fr_auto] gap-1.5 items-center">
                          {/* Key name */}
                          <div className="min-w-0">
                            <BufferedInput
                              className={cn(
                                "h-7 text-xs font-mono bg-background/70 border-border/60 w-full",
                                isDuplicate && "border-destructive text-destructive ring-1 ring-destructive/40",
                              )}
                              value={binding.argName}
                              onCommit={(val) =>
                                updateBinding(bi, { ...binding, argName: val })
                              }
                              placeholder="data / fieldName"
                            />
                          </div>
                          {/* Arrow */}
                          <span className="text-[10px] text-muted-foreground/50 px-0.5 select-none">←</span>
                          {/* Source & Smart Path */}
                          <BindingSourceEditor
                            binding={binding}
                            availableSources={availableSources}
                            serviceNodeId={serviceNodeId}
                            onChange={(updated) => updateBinding(bi, updated)}
                          />
                          {/* Delete button */}
                          <button
                            type="button"
                            className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10 cursor-pointer"
                            onClick={() => removeBinding(bi)}
                            title="Remove field"
                          >
                            <Trash size={11} />
                          </button>
                        </div>
                        {isDuplicate && (
                          <div className="flex items-center gap-1 text-[9px] text-destructive font-medium px-1">
                            <AlertTriangle size={9} className="shrink-0" />
                            <span>Duplicate response field &quot;{binding.argName?.trim()}&quot;: payload field keys must be unique.</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Failure / Error Response (4xx/5xx) */}
          {responseTab === "error" && endpoint && onEndpointChange && (
            <div className="flex flex-col gap-2.5">
              <NestedResponseSchemaEditor
                title="Failure / Error Response (4xx/5xx)"
                subtitle="Declare the error payload structure returned on failure (validation error, downstream failure, or server error)."
                isExternal={false}
                mode={endpoint.responseMode === "raw_json" ? "raw_json" : "field_builder"}
                onModeChange={(responseMode) => onEndpointChange({ responseMode })}
                schema={
                  endpoint.errorResponseBody || {
                    id: `res_err_${endpoint.id}`,
                    fields: [
                      { id: "err_1", name: "error", type: "string", required: true, key: "error", value: "" },
                      { id: "err_2", name: "message", type: "string", required: true, key: "message", value: "" },
                      { id: "err_3", name: "statusCode", type: "number", required: false, key: "statusCode", value: "" },
                    ],
                  }
                }
                onSchemaChange={(errorResponseBody) => onEndpointChange({ errorResponseBody })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
