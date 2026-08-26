import React from "react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
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
import { EndpointTestCasesSection } from "./endpoint-testing/EndpointTestCasesSection";
import {
  PipelineStepEditor,
  type PipelineStepDraft,
} from "./PipelineStepEditor";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isEndpointPipelineUnconfigured } from "@/lib/utils/pipelineValidation";

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
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const authRules = node?.data.authRules || [];

  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);

  // Must be called before any early returns (rules of hooks)
  const { isProtected, zoneName } = useCallerWebPageZone(nodeId, id);

  const item = endpoints.find((e) => e.id === id);
  if (!item) return null;

  return (
    <div className="flex flex-col gap-6 mt-6 pb-12">
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-primary/15 text-primary rounded border border-primary/20 shadow-sm">
            {item.type}
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {item.name}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          Configure endpoint details and behavior.
        </span>
      </div>

      {/* Auth awareness banner & Bearer token switch */}
      <AuthAwarenessBanner
        zoneName={zoneName}
        isProtected={isProtected}
        requireAuth={item.requireAuth !== false}
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
                  value={item.requiredRoles?.join(", ") || ""}
                  onChange={(e) =>
                    updateEndpoint(item.id, {
                      requiredRoles: e.target.value
                        .split(",")
                        .map((r) => r.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Required Scopes (Comma separated)
                </Label>
                <Input
                  className="h-7 text-xs bg-background"
                  placeholder="e.g. read:users, write:users"
                  value={item.requiredScopes?.join(", ") || ""}
                  onChange={(e) =>
                    updateEndpoint(item.id, {
                      requiredScopes: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Audience</Label>
                <Input
                  className="h-7 text-xs bg-background"
                  placeholder="e.g. my-api"
                  value={item.audience || ""}
                  onChange={(e) =>
                    updateEndpoint(item.id, { audience: e.target.value })
                  }
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
          value={item.summary || ""}
          onChange={(e) => updateEndpoint(item.id, { summary: e.target.value })}
        />
      </div>



      <ParameterEditor
        title="Headers"
        parameters={(() => {
          let h = item.headers || [];
          const isAuthEnabled = item.requireAuth !== false;
          if (isAuthEnabled) {
            if (!h.some((x) => x.name.toLowerCase() === "authorization")) {
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
            h = h.filter((x) => x.name.toLowerCase() !== "authorization");
          }
          return h;
        })()}
        onChange={(headers) => updateEndpoint(item.id, { headers })}
      />
      <ParameterEditor
        title="Path Params"
        parameters={item.pathParams || []}
        onChange={(pathParams) => updateEndpoint(item.id, { pathParams })}
      />
      <ParameterEditor
        title="Query Params"
        parameters={item.queryParams || []}
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
      {/* ---------------------------------------------------------------- */}
      {/* PIPELINE STEPS SECTION                                            */}
      {/* ---------------------------------------------------------------- */}
      {(() => {
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
  })()}

      <EndpointTestCasesSection
        endpoint={item}
        nodeId={nodeId}
        serviceNode={node}
      />
    </div>
  );
};
