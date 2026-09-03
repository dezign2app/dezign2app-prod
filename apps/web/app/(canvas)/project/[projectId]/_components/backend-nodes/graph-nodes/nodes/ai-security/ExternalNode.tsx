import React, { useState, useEffect } from "react";
import { NodeProps } from "@xyflow/react";
import { Globe, Settings, ChevronDown, AlertTriangle, AlertCircle } from "lucide-react";
import { BackendNode } from "@/types/canvas";
import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import {
  NodeHeader,
  EndpointList,
  useSimulationNodeState,
  getSimulationNodeBorderClass,
  generateId,
  LocalInput,
  LocalTextarea,
} from "../../common";
import { Textarea } from "@workspace/ui/components/textarea";
import { isOutputSchemaMissing } from "@/lib/utils/nestedJsonSchema";
import { cleanEnvVarName } from "@/lib/utils/localEnvSync";
import { ExternalEnvVarsDrawer } from "./ExternalEnvVarsDrawer";

export const ExternalNode = ({
  id,
  data,
  selected,
}: NodeProps<BackendNode>) => {
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const addEndpoint = useBackendCanvasStore((s) => s.addEndpoint);
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);
  const endpoints = allEndpoints.filter((e) => e.nodeId === id);

  const simulation = useSimulationNodeState(id);
  const borderClass = getSimulationNodeBorderClass(
    simulation,
    Boolean(selected),
    "border-border border-dashed",
  );

  const [configOpen, setConfigOpen] = useState(false);
  const hasInitializedEndpointsRef = React.useRef(false);

  // Initialize or migrate endpoints
  useEffect(() => {
    if (hasInitializedEndpointsRef.current) return;
    hasInitializedEndpointsRef.current = true;
    const existing = useBackendCanvasStore
      .getState()
      .endpoints.filter((e) => e.nodeId === id);
    if (existing.length === 0) {
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((act) => {
          addEndpoint(id, {
            id: act.id || generateId(),
            name: act.name.startsWith("/") ? act.name : `/${act.name}`,
            type: "POST",
            summary: act.name,
          });
        });
      } else {
        addEndpoint(id, {
          id: generateId(),
          name: "/v1/resource",
          type: "POST",
          summary: "External API action",
        });
      }
    }
  }, [id, addEndpoint, data.actions]);

  const isBaseUrlMissing = !data.baseUrl?.trim();

  const missingCount = endpoints.filter((ep) =>
    isOutputSchemaMissing({
      responseBody: ep.responseBody,
      responseMode: ep.responseMode,
    }),
  ).length;

  return (
    <div
      className={cn(
        "shadow-md rounded-xl bg-card border-2 min-w-[300px] max-w-[400px] flex flex-col transition-all duration-300",
        borderClass,
        isBaseUrlMissing && !selected && "border-destructive/60",
      )}
    >
      <NodeHeader
        id={id}
        data={data}
        nodeType="external"
        icon={Globe}
        title="External API"
        colorClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        selected={selected}
        rightElement={
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                useBackendCanvasStore.getState().setActiveConfigItem({
                  type: "external",
                  id,
                  nodeId: id,
                });
              }}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center text-[10px]"
              title="Configure External API Settings"
            >
              <Settings size={13} />
            </button>
          </div>
        }
      />

      {/* Description */}
      <div className="px-3 py-2 bg-secondary/5 border-b nodrag">
        <LocalTextarea
          className="min-h-[20px] text-xs bg-transparent border-none shadow-none p-1 resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          placeholder="description"
          value={data.description || ""}
          onBlur={(e) =>
            updateNode(id, { data: { ...data, description: e.target.value } })
          }
        />
      </div>

      {/* Base URL */}
      <div
        className={cn(
          "px-3 py-1.5 border-b nodrag flex items-center gap-2 transition-colors",
          isBaseUrlMissing ? "bg-destructive/10 border-destructive/30" : "bg-secondary/5",
        )}
      >
        <Globe
          size={13}
          className={cn(
            "shrink-0",
            isBaseUrlMissing ? "text-destructive" : "text-muted-foreground",
          )}
        />
        <LocalInput
          placeholder="Base URL required (e.g. https://api.stripe.com/v1)"
          className={cn(
            "h-7 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 font-mono",
            isBaseUrlMissing && "placeholder:text-destructive/70 text-destructive",
          )}
          value={data.baseUrl || ""}
          onBlur={(e) =>
            updateNode(id, { data: { ...data, baseUrl: e.target.value } })
          }
        />
      </div>

      {/* Base URL Missing Error Banner */}
      {isBaseUrlMissing && (
        <div className="px-3 py-1.5 bg-destructive/15 text-destructive text-[10px] font-medium flex items-center justify-between border-b border-destructive/30">
          <span className="flex items-center gap-1.5">
            <AlertCircle size={12} className="shrink-0 text-destructive" />
            Base URL is not configured
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider bg-destructive/20 px-1 py-0.5 rounded">
            Error
          </span>
        </div>
      )}

      {/* Schema Missing Warning Banner */}
      {missingCount > 0 && (
        <div className="px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium flex items-center justify-between border-b border-amber-500/20">
          <span className="flex items-center gap-1">
            <AlertTriangle size={11} className="shrink-0" />
            {missingCount} endpoint{missingCount !== 1 ? "s" : ""} missing output schema
          </span>
          <span className="text-[9px] opacity-75">Contract required</span>
        </div>
      )}

      {/* Endpoints List with GET/POST badges, handles & settings button */}
      <EndpointList nodeId={id} title="Endpoints / Actions" />

      {/* Environment Variables Section on External Node (identical styling to Endpoints list) */}
      <ExternalEnvVarsDrawer nodeId={id} />

      {/* Collapsible Connection & Auth Drawer */}
      <div className="p-3 bg-secondary/10 flex flex-col gap-3 rounded-b-xl border-t border-border/50">
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => setConfigOpen(!configOpen)}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
            Connection & Auth Config
          </span>
          <div className="p-0.5 rounded hover:bg-secondary text-muted-foreground group-hover:text-foreground transition-all">
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform duration-300 ease-in-out",
                configOpen && "rotate-180",
              )}
            />
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            configOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2.5 pt-2 border-t border-border/50 nodrag">
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">
                  Default Auth
                </Label>
                <Select
                  value={data.authType || "none"}
                  onValueChange={(val: "none" | "apiKey" | "basic" | "bearer" | "custom") =>
                    updateNode(id, {
                      data: {
                        ...data,
                        label: data.label || "External API",
                        authType: val,
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-6 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">
                      No Auth
                    </SelectItem>
                    <SelectItem value="bearer" className="text-xs">
                      Bearer Token
                    </SelectItem>
                    <SelectItem value="apiKey" className="text-xs">
                      API Key
                    </SelectItem>
                    <SelectItem value="basic" className="text-xs">
                      Basic Auth
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.authType && data.authType !== "none" && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Environment Variable
                  </Label>
                  <Select
                    value={
                      cleanEnvVarName(data.apiKey || "") ||
                      (data.envVars?.[0]?.name ?? "API_KEY")
                    }
                    onValueChange={(val) =>
                      updateNode(id, {
                        data: {
                          ...data,
                          label: data.label || "External API",
                          apiKey: `process.env.${val}`,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-6 text-xs bg-background font-mono">
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {data.envVars && data.envVars.length > 0 ? (
                        data.envVars.map((v) => (
                          <SelectItem
                            key={v.id}
                            value={v.name}
                            className="text-xs font-mono"
                          >
                            {v.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="API_KEY" className="text-xs font-mono">
                          process.env.API_KEY
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">
                  Rate Limit
                </Label>
                <LocalInput
                  className="h-6 text-xs w-24 text-right bg-background"
                  placeholder="100/m"
                  value={data.rateLimit || ""}
                  onBlur={(e) =>
                    updateNode(id, {
                      data: { ...data, rateLimit: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
