import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Parameter } from "@/types/canvas";
import {
  ParameterEditor,
} from "../backend-nodes/graph-nodes/Editors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Id } from "@workspace/backend/_generated/dataModel";
import { useParams } from "next/navigation";
import { useCallerWebPageZone } from "./hooks/useCallerWebPageZone";
import { AuthAwarenessBanner } from "./AuthAwarenessBanner";
import { RequestBodyEditor } from "./RequestBodyEditor";
import { NestedResponseSchemaEditor } from "./NestedResponseSchemaEditor";
import { EndpointTestCasesSection } from "./endpoint-testing/EndpointTestCasesSection";
import {
  PipelineStepEditor,
  type PipelineStepDraft,
} from "./PipelineStepEditor";
import { ChevronDown, ChevronRight, Globe, AlertCircle } from "lucide-react";
import { isEndpointPipelineUnconfigured } from "@/lib/utils/pipelineValidation";
import { useBufferedInput } from "@/lib/hooks/useBufferedInput";

interface EndpointConfigProps {
  id: string;
  nodeId: string;
}

export const EndpointConfig = ({ id, nodeId }: EndpointConfigProps) => {
  const paramsHook = useParams();
  const projectId = paramsHook.projectId as Id<"projects">;
  const [pipelineExpanded, setPipelineExpanded] = React.useState(true);
  const endpoints = useBackendCanvasStore((s) => s.endpoints);
  const updateEndpoint = useBackendCanvasStore((s) => s.updateEndpoint);
  const item = endpoints.find((e) => e.id === id);
  const targetNodeId = item?.nodeId || nodeId;
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === targetNodeId),
  );
  const isExternal = node?.type === "external";
  const authRules = node?.data.authRules || [];

  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);

  // Must be called before any early returns (rules of hooks)
  const { isProtected, zoneName } = useCallerWebPageZone(nodeId, id);

  // Auto-clean any legacy or accidental auth headers/params on external endpoints
  React.useEffect(() => {
    if (isExternal && item) {
      const hasStaleAuthHeaders = item.headers?.some(
        (x: Parameter) =>
          x.id === "auth-bearer-header" ||
          x.id === "auth-header-external" ||
          x.id === "auth-query-external",
      );
      const hasStaleAuthQueries = item.queryParams?.some(
        (x: Parameter) => x.id === "auth-query-external",
      );
      if (hasStaleAuthHeaders || hasStaleAuthQueries) {
        updateEndpoint(item.id, {
          ...(hasStaleAuthHeaders
            ? {
                headers: (item.headers || []).filter(
                  (x: Parameter) =>
                    x.id !== "auth-bearer-header" &&
                    x.id !== "auth-header-external" &&
                    x.id !== "auth-query-external",
                ),
              }
            : {}),
          ...(hasStaleAuthQueries
            ? {
                queryParams: (item.queryParams || []).filter(
                  (x: Parameter) => x.id !== "auth-query-external",
                ),
              }
            : {}),
        });
      }
    }
  }, [isExternal, item?.id, item?.headers, item?.queryParams, updateEndpoint]);

  const nameBuffer = useBufferedInput(
    item?.name || "",
    React.useCallback(
      (name: string) => updateEndpoint(id, { name }),
      [id, updateEndpoint],
    ),
    200,
  );

  const summaryBuffer = useBufferedInput(
    item?.summary || "",
    React.useCallback(
      (summary: string) => updateEndpoint(id, { summary }),
      [id, updateEndpoint],
    ),
    200,
  );

  const rolesBuffer = useBufferedInput(
    item?.requiredRoles?.join(", ") || "",
    React.useCallback(
      (val: string) =>
        updateEndpoint(id, {
          requiredRoles: val
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
        }),
      [id, updateEndpoint],
    ),
    200,
  );

  const scopesBuffer = useBufferedInput(
    item?.requiredScopes?.join(", ") || "",
    React.useCallback(
      (val: string) =>
        updateEndpoint(id, {
          requiredScopes: val
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      [id, updateEndpoint],
    ),
    200,
  );

  const audienceBuffer = useBufferedInput(
    item?.audience || "",
    React.useCallback(
      (audience: string) => updateEndpoint(id, { audience }),
      [id, updateEndpoint],
    ),
    200,
  );

  if (!item) return null;

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12">
      {/* Endpoint Header - Method and Path are editable */}
      <div className="flex flex-col gap-2.5 border-b border-border/50 pb-6">
        {isExternal && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              External API Endpoint
            </span>
            {node?.data?.baseUrl?.trim() ? (
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                Base: {node.data.baseUrl}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-destructive bg-destructive/15 px-2 py-0.5 rounded border border-destructive/30 flex items-center gap-1">
                <AlertCircle size={11} /> Base URL not configured
              </span>
            )}
          </div>
        )}

        {isExternal && !node?.data?.baseUrl?.trim() && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs leading-relaxed">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[11px]">
                Base URL Not Configured
              </span>
              <span className="text-[10px] opacity-90">
                The parent external service does not have a Base URL configured. Calling this endpoint from pipelines or code will fail without a target host URL.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Select
            value={item.type || (isExternal ? "POST" : "GET")}
            onValueChange={(type) => updateEndpoint(item.id, { type })}
          >
            <SelectTrigger className="h-8 w-[95px] text-xs font-mono font-bold bg-primary/15 text-primary border-primary/30 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => (
                <SelectItem key={m} value={m} className="text-xs font-mono">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="h-8 text-sm font-semibold tracking-tight text-foreground bg-background font-mono flex-1"
            placeholder="/v1/resource"
            value={nameBuffer.value}
            onChange={(e) => nameBuffer.onChange(e.target.value)}
            onBlur={nameBuffer.flush}
          />
        </div>

        <span className="text-xs text-muted-foreground">
          {isExternal
            ? "Configure request parameters and declare the output structure callers bind to."
            : "Configure endpoint details and behavior."}
        </span>
      </div>

      {/* Authentication */}
      {!isExternal && (
        <AuthAwarenessBanner
          zoneName={zoneName}
          isProtected={isProtected}
          requireAuth={item.requireAuth !== undefined ? item.requireAuth : isProtected}
          onRequireAuthChange={(requireAuth) => {
            let updatedHeaders = [...(item.headers || [])];
            if (requireAuth) {
              if (!updatedHeaders.some((h) => h.name.toLowerCase() === "authorization")) {
                updatedHeaders = [
                  {
                    id: "auth-bearer-header",
                    name: "Authorization",
                    type: "string",
                    required: true,
                    description: "Bearer <token>",
                    defaultValue: "Bearer <token>",
                    key: "Authorization",
                    value: "Bearer <token>",
                  },
                  ...updatedHeaders,
                ];
              }
            } else {
              updatedHeaders = updatedHeaders.filter(
                (h) => h.name.toLowerCase() !== "authorization",
              );
            }
            updateEndpoint(item.id, { requireAuth, headers: updatedHeaders });
          }}
        />
      )}

      {node?.type === "api_gateway" && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Auth Rule
            </span>
            <Select
              value={item.authRuleId || "__none__"}
              onValueChange={(authRuleId) =>
                updateEndpoint(item.id, {
                  authRuleId:
                    authRuleId === "__none__" ? undefined : authRuleId,
                })
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select an auth rule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No auth rule</SelectItem>
                {authRules
                  .filter((rule) => rule.name.trim())
                  .map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {rule.name} ({rule.type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Choose a reusable gateway policy for this endpoint.
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Authorization
            </span>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Required Roles (Comma separated)
                </Label>
                <Input
                  className="h-7 text-xs bg-background"
                  placeholder="e.g. admin, user"
                  value={rolesBuffer.value}
                  onChange={(e) => rolesBuffer.onChange(e.target.value)}
                  onBlur={rolesBuffer.flush}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Required Scopes (Comma separated)
                </Label>
                <Input
                  className="h-7 text-xs bg-background"
                  placeholder="e.g. read:users, write:users"
                  value={scopesBuffer.value}
                  onChange={(e) => scopesBuffer.onChange(e.target.value)}
                  onBlur={scopesBuffer.flush}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Audience</Label>
                <Input
                  className="h-7 text-xs bg-background"
                  placeholder="e.g. my-api"
                  value={audienceBuffer.value}
                  onChange={(e) => audienceBuffer.onChange(e.target.value)}
                  onBlur={audienceBuffer.flush}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Summary
        </Label>
        <Input
          className="bg-background/50"
          placeholder="e.g. Returns all users."
          value={summaryBuffer.value}
          onChange={(e) => summaryBuffer.onChange(e.target.value)}
          onBlur={summaryBuffer.flush}
        />
      </div>



      <ParameterEditor
        title="Headers"
        isExternal={isExternal}
        parameters={(() => {
          let h = item.headers || [];
          if (isExternal) {
            return h.filter(
              (x: Parameter) =>
                x.id !== "auth-bearer-header" &&
                x.id !== "auth-header-external" &&
                x.id !== "auth-query-external",
            );
          }
          const isAuthEnabled = item.requireAuth !== false;
          if (isAuthEnabled) {
            if (!h.some((x: Parameter) => x.name.toLowerCase() === "authorization")) {
              h = [
                {
                  id: "auth-bearer-header",
                  name: "Authorization",
                  type: "string",
                  required: true,
                  description: "Bearer <token>",
                  defaultValue: "Bearer <token>",
                  key: "Authorization",
                  value: "Bearer <token>",
                },
                ...h,
              ];
            }
          } else {
            h = h.filter((x: Parameter) => x.name.toLowerCase() !== "authorization");
          }
          return h;
        })()}
        onChange={(headers) => updateEndpoint(item.id, { headers })}
      />
      <ParameterEditor
        title="Path Params"
        isExternal={isExternal}
        parameters={item.pathParams || []}
        onChange={(pathParams) => updateEndpoint(item.id, { pathParams })}
      />
      <ParameterEditor
        title="Query Params"
        isExternal={isExternal}
        parameters={(() => {
          let q = item.queryParams || [];
          if (isExternal) {
            return q.filter((x: Parameter) => x.id !== "auth-query-external");
          }
          return q;
        })()}
        onChange={(queryParams) => updateEndpoint(item.id, { queryParams })}
      />
      <RequestBodyEditor
        mode={
          item.requestBodyMode ??
          (item.requestBody?.rawJson ? "raw_json" : "field_builder")
        }
        onModeChange={(requestBodyMode) =>
          updateEndpoint(item.id, { requestBodyMode })
        }
        schema={
          item.requestBody ||
          (item.params && item.params.length > 0
            ? { id: item.id, fields: item.params, rawJson: item.body || "" }
            : item.body
            ? { id: item.id, rawJson: item.body, fields: [] }
            : { id: item.id, fields: [] })
        }
        onSchemaChange={(requestBody) =>
          updateEndpoint(item.id, { requestBody })
        }
      />

      {/* Output / Response Body Schema (Enforced for External APIs) */}
      <NestedResponseSchemaEditor
        title={isExternal ? "Output / Response Schema (Required)" : "Response Body Schema"}
        subtitle={
          isExternal
            ? "External API return contract. Declare the nested JSON structure returned by this endpoint so callers can bind to its fields."
            : "Expected response body payload returned by this endpoint."
        }
        isExternal={isExternal}
        mode={
          item.responseMode === "raw_json" ? "raw_json" : "field_builder"
        }
        onModeChange={(responseMode) =>
          updateEndpoint(item.id, { responseMode })
        }
        schema={
          item.responseBody || { id: `res_${item.id}`, fields: [] }
        }
        onSchemaChange={(responseBody) =>
          updateEndpoint(item.id, { responseBody })
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* PIPELINE STEPS SECTION (Internal Microservices only)              */}
      {/* ---------------------------------------------------------------- */}
      {isExternal ? (
        <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground flex flex-col gap-1.5">
          <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
            <Globe size={14} className="text-emerald-500" />
            External Service Contract
          </span>
          <span className="text-[11px] leading-relaxed">
            This endpoint is hosted externally by a third party. Microservices on your canvas can invoke this endpoint using an <strong>External API Call</strong> step, and subsequent pipeline steps will automatically have access to all nested output properties defined in the schema above.
          </span>
        </div>
      ) : (
        (() => {
          const isPipelineRed = isEndpointPipelineUnconfigured(
            item,
            nodeId,
            allNodes,
            allEdges,
          );

          return (
            <div className="flex flex-col gap-2 border border-border/40 rounded-xl overflow-hidden transition-colors">
              {/* Collapsible header */}
              <button
                className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
                onClick={() => setPipelineExpanded((v) => !v)}
              >
                <div>
                  <p className="text-[11px] font-semibold text-foreground/90 flex items-center gap-1.5 flex-wrap">
                    <span>Pipeline Steps</span>
                    {item.pipelineSteps && item.pipelineSteps.length > 0 && (
                      <span className="text-[9px] text-primary/70 font-mono bg-primary/10 px-1.5 py-0.5 rounded-full">
                        {item.pipelineSteps.length} step{item.pipelineSteps.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {isPipelineRed && (
                      <span className="text-[9px] font-bold text-destructive font-mono bg-destructive/15 border border-destructive/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        ⚠️ Unconfigured Inputs
                      </span>
                    )}
                  </p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                    Explicit field-level bindings per step — compiler generates exactly what you configure.
                  </p>
                </div>
                {pipelineExpanded ? (
                  <ChevronDown size={13} className="text-muted-foreground/50 shrink-0" />
                ) : (
                  <ChevronRight size={13} className="text-muted-foreground/50 shrink-0" />
                )}
              </button>

              {pipelineExpanded && (
                <div className="px-3 pb-3">
                  <PipelineStepEditor
                    steps={item.pipelineSteps || []}
                    onChange={(steps) =>
                      updateEndpoint(item.id, { pipelineSteps: steps })
                    }
                    endpoint={item}
                    allNodes={allNodes}
                    allEdges={allEdges}
                    serviceNodeId={nodeId}
                  />
                </div>
              )}
            </div>
          );
        })()
      )}

      <EndpointTestCasesSection
        endpoint={item}
        nodeId={nodeId}
        serviceNode={node}
      />
    </div>
  );
};
